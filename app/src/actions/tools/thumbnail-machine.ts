'use server';

import { createIdeogramV2aPrediction, waitForIdeogramV2aCompletion, generateMultipleThumbnails } from '../models/ideogram-v2-turbo';
import { performFaceSwap } from '../models/face-swap-cdingram';
import { generateYouTubeTitles, analyzeImageForRecreation, createChatCompletion } from '../models/openai-chat';
import { recreateLogo as recreateWithOpenAI } from '../models/openai-image';
import { uploadImageToStorage, downloadAndUploadImage } from '../supabase-storage';
import { 
  storeThumbnailResults, 
  createPredictionRecord, 
  updatePredictionRecord,
  recordGenerationMetrics,
  getUserCredits,
  deductCredits 
} from '../database/thumbnail-database';
import { Json } from '@/types/database';

// Style-based system prompts from legacy thumbnail system
const THUMBNAIL_STYLES = {
  clickbait: {
    name: "Clickbait",
    description: "Eye-catching and attention-grabbing design",
    systemPrompt: `Create an attention-grabbing, clickbait-style thumbnail that demands attention. Focus on:
- Bold, vibrant colors
- Dramatic lighting and effects
- Exaggerated expressions or elements
- High contrast and energy
- Dynamic composition with action elements`
  },
  professional: {
    name: "Professional", 
    description: "Clean, corporate, and trustworthy design",
    systemPrompt: `Create a professional and polished thumbnail that exudes credibility and expertise. Focus on:
- Clean, minimalist composition
- Professional color schemes (blues, grays, whites)
- High-quality, corporate-friendly imagery
- Clear typography space
- Balanced and structured layout`
  },
  minimal: {
    name: "Minimal",
    description: "Simple, elegant, and modern design", 
    systemPrompt: `Create a minimalist and elegant thumbnail that emphasizes simplicity. Focus on:
- Generous white space
- Limited color palette
- Simple geometric shapes
- Essential elements only
- Subtle typography space`
  }
};

/**
 * AI Prompt Enhancement using OpenAI Chat API (based on legacy system)
 * Enhances prompts for better thumbnail generation results
 */
async function enhanceThumbnailPrompt(combinedPrompt: string, userId: string): Promise<string> {
  try {
    console.log('🔍 Enhancing prompt with OpenAI...');
    
    const completion = await createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a thumbnail generation prompt expert. Enhance the given prompt to create more visually appealing and effective thumbnails. Focus on composition, visual elements, and style.

You MUST return a JSON object that exactly matches this schema, with no additional properties:
{
  "enhancedPrompt": "Your enhanced version of the prompt that includes detailed visual descriptions, composition, and style elements"
}

Example response:
{
  "enhancedPrompt": "A majestic robot android, rendered in a modern 3D style with dramatic lighting, positioned against a dark gradient background. Sharp focus on the metallic details, with subtle blue accent lighting highlighting key features. Composition optimized for thumbnail visibility with the robot centered and facing slightly to the right. High contrast and cinematic atmosphere."
}`
        },
        {
          role: 'user',
          content: combinedPrompt
        }
      ],
      temperature: 0.8,
      max_tokens: 300,
      n: 1
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      console.warn('No response from OpenAI, using original prompt');
      return combinedPrompt;
    }

    try {
      const parsed = JSON.parse(response);
      if (parsed.enhancedPrompt) {
        console.log('✅ Prompt enhanced successfully');
        return parsed.enhancedPrompt;
      }
    } catch (parseError) {
      console.warn('Failed to parse OpenAI response, using original prompt:', parseError);
    }

    return combinedPrompt;
  } catch (error) {
    console.error('Prompt enhancement failed:', error);
    // Return original prompt if enhancement fails
    return combinedPrompt;
  }
}

/**
 * Unified Thumbnail Machine Server Action
 * Orchestrates all thumbnail-related operations with AI-driven workflow decisions
 */

export interface ThumbnailMachineRequest {
  // Operation mode - determines which workflow to execute
  operation_mode?: 'generate' | 'face-swap-only' | 'recreation-only' | 'titles-only';
  
  // Core generation (used for 'generate' and 'recreation-only' modes)
  prompt?: string; // Optional for some modes
  thumbnail_style?: 'clickbait' | 'professional' | 'minimal'; // Style-based system prompts
  
  // Reference image upload (used for 'recreation-only' mode)
  reference_image?: string | File; // base64, File object, or URL
  recreation_style?: 'similar' | 'improved' | 'style-transfer'; // For recreation mode
  
  // Advanced options (updated for Ideogram V2a)
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '16:10' | '10:16' | '3:1' | '1:3';
  num_outputs?: number; // Default: 1 (single thumbnail generation)
  style_type?: 'None' | 'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime';
  magic_prompt_option?: 'Auto' | 'On' | 'Off';
  seed?: number;
  
  // Face swap options (for 'generate' with face swap or 'face-swap-only' mode)
  face_swap?: {
    source_image: string | File; // base64, File, or URL
    target_image?: string | File; // Required for 'face-swap-only' mode
    apply_to_all?: boolean; // Apply to all generated variations
  };
  
  // Title generation options (for 'generate' with titles or 'titles-only' mode)
  generate_titles?: boolean;
  title_style?: 'emotional' | 'professional' | 'shocking' | 'educational' | 'engaging';
  title_count?: number; // Number of title variations (default: 10)
  target_keywords?: string; // For SEO optimization in titles-only mode
  
  // User context (ENHANCED - for credit system)
  user_id: string; // Now required for credit validation
}

export interface ThumbnailMachineResponse {
  success: boolean;
  
  // Generated thumbnails
  thumbnails?: {
    id: string;
    url: string; // Supabase Storage URL
    variation_index: number;
    batch_id: string;
    replicate_url?: string; // Original Replicate URL for reference
  }[];
  
  // Face swap results (if requested)
  face_swapped_thumbnails?: {
    url: string; // Supabase Storage URL
    source_thumbnail_id: string;
    replicate_url?: string; // Original Replicate URL for reference
  }[];
  
  // Generated titles (if requested)
  titles?: string[];
  
  // Metadata
  batch_id: string;
  credits_used: number;
  remaining_credits?: number;
  generation_time_ms: number;
  
  // Error handling
  error?: string;
  warnings?: string[];
}

// Credit constants (from legacy system analysis)
const CREDITS_PER_THUMBNAIL = 2;
const FACE_SWAP_CREDITS = 3;
const TITLE_GENERATION_CREDITS = 1;

/**
 * UNIFIED AI Orchestrator - Handles ALL Thumbnail Machine Operations
 * Single orchestrator for generate, face-swap, recreation, and titles
 * Intelligent workflow routing based on operation_mode
 */
export async function generateThumbnails(
  request: ThumbnailMachineRequest
): Promise<ThumbnailMachineResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  let total_credits = 0;
  const warnings: string[] = [];

  // Default to 'generate' mode if not specified
  const operation_mode = request.operation_mode || 'generate';

  try {
    console.log(`🤖 AI Orchestrator: Starting ${operation_mode} workflow for user ${request.user_id}`);

    // Step 1: Credit Validation (CRITICAL - from legacy system)
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      throw new Error('Unable to verify credit balance');
    }

    const estimatedCredits = calculateEstimatedCredits(request);
    if ((creditCheck.credits || 0) < estimatedCredits) {
      throw new Error(`Insufficient credits. Need ${estimatedCredits}, have ${creditCheck.credits || 0}`);
    }

    console.log(`💳 Credits validated: ${creditCheck.credits} available, ${estimatedCredits} estimated`);

    // Step 2: Route to appropriate workflow based on operation mode
    switch (operation_mode) {
      case 'face-swap-only':
        return await executeFaceSwapOnlyWorkflow(request, batch_id, startTime);
      
      case 'recreation-only':
        return await executeRecreationOnlyWorkflow(request, batch_id, startTime);
      
      case 'titles-only':
        return await executeTitlesOnlyWorkflow(request, batch_id, startTime);
      
      case 'generate':
      default:
        // Continue with full generation workflow below
        break;
    }

    // === GENERATE MODE WORKFLOW (original complex orchestration) ===
    
    // Step 3: AI Decision - Reference Image Processing
    let referenceImageUrl: string | undefined;
    if (request.reference_image) {
      console.log('🖼️ AI Decision: Processing reference image upload');
      
      const uploadResult = await uploadImageToStorage(request.reference_image, {
        folder: 'thumbnails/references',
        filename: `ref_${batch_id}.png`
      });

      if (uploadResult.success && uploadResult.url) {
        referenceImageUrl = uploadResult.url;
        console.log(`✅ Reference image uploaded: ${referenceImageUrl}`);
      } else {
        warnings.push('Reference image upload failed, proceeding without reference');
        console.warn('⚠️ Reference image upload failed');
      }
    }

    // Step 3: Create Prediction Record (from legacy system)
    await createPredictionRecord({
      user_id: request.user_id,
      tool_id: 'thumbnail-machine',
      service_id: 'generate',
      model_version: 'ideogram-v2-turbo',
      status: 'starting',
      input_data: request as unknown as Json,
    });

    // Step 4: AI Decision - Core Thumbnail Generation  
    const numOutputs = request.num_outputs || 1;
    console.log(`🎨 AI Decision: Generating ${numOutputs} thumbnail(s) using Ideogram V2a`);
    
    // Step 1: Apply style-based system prompt (Local Enhancement)
    const selectedStyle = request.thumbnail_style || 'clickbait'; // Default to clickbait style
    const styleConfig = THUMBNAIL_STYLES[selectedStyle];
    let combinedPrompt = `${styleConfig.systemPrompt}\n\nUser's request: ${request.prompt}`;
    
    console.log(`🎨 Using ${selectedStyle} style for thumbnail generation`);
    
    // Step 2: AI Enhancement using OpenAI (like legacy system)
    const enhancedPrompt = await enhanceThumbnailPrompt(combinedPrompt, request.user_id);
    
    console.log('📝 Final enhanced prompt:', enhancedPrompt.substring(0, 200) + '...');

    // For single thumbnail generation, use direct function instead of multiple
    let predictions;
    if (numOutputs === 1) {
      const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`;
      console.log('🔗 Using webhook URL:', webhookUrl);
      
      const singlePrediction = await createIdeogramV2aPrediction({
        prompt: enhancedPrompt, // Use the enhanced prompt instead of raw user prompt
        aspect_ratio: request.aspect_ratio || '16:9',
        style_type: request.style_type || 'Auto',
        magic_prompt_option: request.magic_prompt_option || 'On',
        seed: request.seed,
        webhook: webhookUrl,
        user_id: request.user_id, // Add user_id for webhook processing
        batch_id: batch_id, // Add batch_id for webhook processing
      });
      predictions = [singlePrediction];
    } else {
      // Fallback for multiple thumbnails (if needed in future)
      predictions = await generateMultipleThumbnails(
        enhancedPrompt, // Use enhanced prompt here too
        numOutputs,
        {
          aspectRatio: request.aspect_ratio || '16:9',
          styleType: request.style_type || 'Auto',
          webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`,
        }
      );
    }

    // Create a single prediction record with the main Replicate prediction ID
    // This allows us to track and poll if webhooks fail
    const predictionIds = predictions.map(p => p.id);
    await createPredictionRecord({
      prediction_id: batch_id,
      user_id: request.user_id,
      tool_id: 'thumbnail-machine',
      service_id: 'generate',
      model_version: 'ideogram-v2-turbo',
      status: 'processing',
      input_data: request as unknown as Json,
      external_id: predictionIds[0], // Store the main prediction ID for webhook matching
    });

    // Step 5: Wait for All Completions
    console.log(`⏳ Waiting for ${predictions.length} Ideogram V2a completions`);
    console.log(`📝 Replicate prediction IDs available for polling:`, predictionIds);
    const completed_predictions = await Promise.all(
      predictions.map(p => waitForIdeogramV2aCompletion(p.id))
    );
    
    // Check for any failures
    const failed_predictions = completed_predictions.filter(p => p.status !== 'succeeded');
    if (failed_predictions.length > 0) {
      console.warn(`⚠️ ${failed_predictions.length} predictions failed`);
      // Continue with successful ones
    }

    // Step 6: Process Generated Thumbnails and Download to Storage
    const successful_predictions = completed_predictions.filter(p => p.status === 'succeeded' && p.output);
    console.log(`📥 Downloading and storing ${successful_predictions.length} thumbnails in Supabase Storage`);
    
    const thumbnails = [];
    for (let index = 0; index < successful_predictions.length; index++) {
      const prediction = successful_predictions[index];
      const replicateUrl = prediction.output as string;
      
      // Download and store in Supabase Storage
      const storageResult = await downloadAndUploadImage(
        replicateUrl,
        'thumbnail-machine',
        `${batch_id}_${index + 1}`,
        {
          folder: 'thumbnails/generated',
          bucket: 'images'
        }
      );
      
      if (storageResult.success && storageResult.url) {
        thumbnails.push({
          id: `${batch_id}_${index + 1}`,
          url: storageResult.url, // Use Supabase Storage URL instead of Replicate URL
          variation_index: index + 1,
          batch_id,
          replicate_url: replicateUrl, // Keep original for reference
        });
        console.log(`✅ Stored thumbnail ${index + 1}: ${storageResult.url}`);
      } else {
        console.warn(`⚠️ Failed to store thumbnail ${index + 1}, using original URL`);
        // Fallback to original URL if storage fails
        thumbnails.push({
          id: `${batch_id}_${index + 1}`,
          url: replicateUrl,
          variation_index: index + 1,
          batch_id,
          replicate_url: replicateUrl,
        });
      }
    }

    console.log(`✅ Generated and stored ${thumbnails.length} thumbnails`);
    total_credits += calculateThumbnailCredits(thumbnails.length);

    // Step 7: AI Decision - Face Swap Processing
    let face_swapped_thumbnails;
    if (request.face_swap && thumbnails.length > 0) {
      console.log('🔄 AI Decision: Processing face swap for variations');
      
      try {
        face_swapped_thumbnails = [];
        
        // Upload source face image if needed
        let sourceImageUrl: string | null = null;
        if (typeof request.face_swap.source_image === 'string' && request.face_swap.source_image.startsWith('http')) {
          sourceImageUrl = request.face_swap.source_image;
        } else {
          const uploadResult = await uploadImageToStorage(request.face_swap.source_image, {
            folder: 'thumbnails/faces',
            filename: `face_source_${batch_id}.png`
          });
          if (uploadResult.success && uploadResult.url) {
            sourceImageUrl = uploadResult.url;
          } else {
            warnings.push('Face source upload failed, skipping face swap');
            console.warn('⚠️ Face source upload failed');
          }
        }

        // Only proceed with face swap if we have a valid source URL
        if (sourceImageUrl) {
          // Apply face swap to thumbnails (first one or all based on apply_to_all)
          const targetThumbnails = request.face_swap.apply_to_all ? thumbnails : [thumbnails[0]];
          
          for (const thumbnail of targetThumbnails) {
            try {
              // Use webhook for async face swap processing (non-blocking)
              const faceSwapPredictionId = await performFaceSwap(
                thumbnail.url, 
                sourceImageUrl, 
                webhookUrl, // Pass webhook for async processing
                request.user_id, // Pass user_id for webhook processing
                batch_id // Pass batch_id for real-time matching
              );
            
              console.log(`🔄 Face swap prediction created: ${faceSwapPredictionId} for thumbnail ${thumbnail.id}`);
              
              // Store face swap prediction record for webhook processing
              await createPredictionRecord({
                user_id: request.user_id,
                tool_id: 'thumbnail-machine-faceswap',
                service_id: 'face-swap',
                model_version: 'cdingram-face-swap',
                status: 'processing',
                input_data: {
                  source_thumbnail_id: thumbnail.id,
                  batch_id: batch_id,
                  input_image: thumbnail.url,
                  swap_image: sourceImageUrl
                } as unknown as Json,
              });
              
              // Note: Actual face swap results will be processed by webhook
              // and stored via real-time updates
              total_credits += FACE_SWAP_CREDITS;
          } catch (swapError) {
            console.warn(`Face swap failed for thumbnail ${thumbnail.id}:`, swapError);
            warnings.push(`Face swap failed for variation ${thumbnail.variation_index}`);
          }
          }
        } else {
          console.warn('⚠️ Skipping face swap - no valid source image URL');
        }
        
        console.log(`✅ Face swap applied to ${face_swapped_thumbnails.length} thumbnails`);
        
      } catch (faceSwapError) {
        console.error('Face swap error:', faceSwapError);
        warnings.push('Face swap processing failed');
      }
    }

    // Step 8: AI Decision - Title Generation
    let titles;
    if (request.generate_titles) {
      console.log('📝 AI Decision: Generating YouTube titles');
      
      try {
        titles = await generateYouTubeTitles(
          request.prompt,
          request.title_count || 10,
          'gpt-4o-mini' // Cost-effective model for titles
        );
        
        console.log(`✅ Generated ${titles?.length || 0} title variations`);
        total_credits += TITLE_GENERATION_CREDITS;
        
      } catch (titleError) {
        console.error('Title generation error:', titleError);
        warnings.push('Title generation failed');
      }
    }

    // Step 9: Deduct Credits
    const creditDeduction = await deductCredits(
      request.user_id,
      total_credits,
      'thumbnail-generation',
      { batch_id, num_outputs: thumbnails.length }
    );

    if (!creditDeduction.success) {
      warnings.push('Credit deduction failed - please contact support');
    }

    // Step 10: Store Results in Database
    const thumbnailRecords = thumbnails.map((thumb) => ({
      user_id: request.user_id,
      prompt: request.prompt, // Store original user prompt
      image_urls: [thumb.url], // Supabase Storage URL
      dimensions: 'landscape', // Use predefined value for 16:9 aspect ratio
      height: 1024,
      width: 1024,
      model_name: 'ideogram-v2-turbo',
      model_version: 'ideogram-v2-turbo',
      batch_id: thumb.batch_id,
      generation_settings: request as unknown as Json,
      metadata: {
        variation_index: thumb.variation_index,
        total_variations: thumbnails.length,
        type: 'thumbnail',
        thumbnail_style: selectedStyle,
        enhanced_prompt: enhancedPrompt, // Store enhanced prompt for reference
        replicate_url: thumb.replicate_url, // Keep original URL for reference
        stored_in_supabase: true
      },
    }));

    await storeThumbnailResults(thumbnailRecords);

    // Step 11: Record Analytics
    await recordGenerationMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'ideogram-v2-turbo',
      style_type: selectedStyle, // Use the selected style instead of 'auto'
      num_variations: thumbnails.length,
      generation_time_ms: Date.now() - startTime,
      total_credits_used: total_credits,
      prompt_length: enhancedPrompt.length, // Use enhanced prompt length for analytics
      has_advanced_options: hasAdvancedOptions(request),
    });

    const generation_time_ms = Date.now() - startTime;
    console.log(`🎉 AI Orchestrator: Workflow completed in ${generation_time_ms}ms`);

    return {
      success: true,
      thumbnails,
      face_swapped_thumbnails,
      titles,
      batch_id,
      credits_used: total_credits,
      remaining_credits: creditDeduction.remainingCredits,
      generation_time_ms,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

  } catch (error) {
    console.error('🚨 AI Orchestrator error:', error);
    
    // Attempt to refund credits if generation failed
    if (total_credits > 0) {
      try {
        // Note: In a real system, you'd implement credit refund logic
        console.log(`💰 Would refund ${total_credits} credits to user ${request.user_id}`);
      } catch (refundError) {
        console.error('Credit refund error:', refundError);
      }
    }
    
    return {
      success: false,
      batch_id,
      credits_used: total_credits,
      generation_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'AI orchestration failed',
    };
  }
}

/**
 * AI Helper Functions for Enhanced Orchestration
 */

// Calculate estimated credits before starting workflow
function calculateEstimatedCredits(request: ThumbnailMachineRequest): number {
  const mode = request.operation_mode || 'generate';
  
  switch (mode) {
    case 'face-swap-only':
      return FACE_SWAP_CREDITS;
    
    case 'recreation-only':
      return CREDITS_PER_THUMBNAIL; // Recreation uses same cost as generation
    
    case 'titles-only':
      return TITLE_GENERATION_CREDITS;
    
    case 'generate':
    default:
      let credits = 0;
      // Core thumbnail generation
      credits += (request.num_outputs || 1) * CREDITS_PER_THUMBNAIL;
      
      // Face swap (if requested)
      if (request.face_swap) {
        const targetsCount = request.face_swap.apply_to_all ? (request.num_outputs || 1) : 1;
        credits += targetsCount * FACE_SWAP_CREDITS;
      }
      
      // Title generation (if requested)
      if (request.generate_titles) {
        credits += TITLE_GENERATION_CREDITS;
      }
      
      return credits;
  }
}

// Calculate actual credits used for thumbnails
function calculateThumbnailCredits(num_outputs: number): number {
  return num_outputs * CREDITS_PER_THUMBNAIL;
}

// Check if request uses advanced options (for analytics) - Updated for Ideogram V2a
function hasAdvancedOptions(request: ThumbnailMachineRequest): boolean {
  return !!(
    request.seed ||
    request.style_type && request.style_type !== 'Auto' ||
    request.magic_prompt_option && request.magic_prompt_option !== 'On' ||
    request.aspect_ratio && request.aspect_ratio !== '16:9' ||
    request.thumbnail_style && request.thumbnail_style !== 'clickbait' || // Custom thumbnail style
    request.reference_image ||
    request.face_swap ||
    request.generate_titles
  );
}

/**
 * Simplified thumbnail generation for basic use cases
 */
export async function generateBasicThumbnails(
  prompt: string,
  user_id: string,
  options?: {
    aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
    num_outputs?: number;
  }
): Promise<ThumbnailMachineResponse> {
  return generateThumbnails({
    prompt,
    user_id,
    aspect_ratio: options?.aspect_ratio,
    num_outputs: options?.num_outputs,
  });
}

/**
 * Enhanced thumbnail generation with all features
 */
export async function generateEnhancedThumbnails(
  prompt: string,
  user_id: string,
  options: {
    reference_image?: string | File;
    generate_titles?: boolean;
    title_style?: 'emotional' | 'professional' | 'shocking' | 'educational' | 'engaging';
    face_swap?: {
      source_image: string | File;
      target_image?: string | File;
      apply_to_all?: boolean;
    };
    style_type?: 'None' | 'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime';
  }
): Promise<ThumbnailMachineResponse> {
  return generateThumbnails({
    prompt,
    user_id,
    reference_image: options.reference_image,
    generate_titles: options.generate_titles,
    title_style: options.title_style,
    face_swap: options.face_swap,
    // Default to YouTube-optimized settings
    aspect_ratio: '16:9',
    num_outputs: 1,
    style_type: options.style_type || 'Auto',
    magic_prompt_option: 'On', // Enhanced prompts for better results
  });
}

/**
 * FACE SWAP ONLY WORKFLOW
 * Dedicated workflow for standalone face swap operations
 */
async function executeFaceSwapOnlyWorkflow(
  request: ThumbnailMachineRequest,
  batch_id: string,
  startTime: number
): Promise<ThumbnailMachineResponse> {
  try {
    console.log('🔄 Executing Face Swap Only Workflow');
    
    // Validate required fields
    if (!request.face_swap?.source_image || !request.face_swap?.target_image) {
      throw new Error('Face swap requires both source and target images');
    }

    // ✅ FIX: Create prediction record for state restoration (like regular generation)
    await createPredictionRecord({
      prediction_id: batch_id,
      user_id: request.user_id,
      tool_id: 'thumbnail-machine',
      service_id: 'face-swap-only',
      model_version: 'cdingram-face-swap',
      status: 'starting',
      input_data: request as unknown as Json,
    });

    // Upload source face image
    let sourceImageUrl: string;
    if (typeof request.face_swap.source_image === 'string' && request.face_swap.source_image.startsWith('http')) {
      sourceImageUrl = request.face_swap.source_image;
    } else {
      const sourceUpload = await uploadImageToStorage(request.face_swap.source_image, {
        folder: 'face-swap/source',
        filename: `source_${batch_id}.png`,
        bucket: 'images'
      });
      if (!sourceUpload.success || !sourceUpload.url) {
        throw new Error('Failed to upload source face image');
      }
      sourceImageUrl = sourceUpload.url;
    }

    // Handle target image with aspect ratio consideration
    let targetImageUrl: string;
    
    // If aspect ratio is specified and different from default, try to generate a new base image
    // If generation fails, fallback to using the uploaded target image directly
    if (request.aspect_ratio && request.aspect_ratio !== '16:9') {
      console.log(`🎨 Attempting to generate base thumbnail with aspect ratio: ${request.aspect_ratio}`);
      
      try {
        // Create a base thumbnail with the desired aspect ratio
        const baseThumbnailPrediction = await createIdeogramV2aPrediction({
          prompt: 'professional headshot, clean background, high quality portrait',
          aspect_ratio: request.aspect_ratio,
          style_type: 'Realistic',
          magic_prompt_option: 'On'
        });

        if (!baseThumbnailPrediction.id) {
          throw new Error('Failed to create base thumbnail prediction');
        }

        // Wait for completion
        const completedBasePrediction = await waitForIdeogramV2aCompletion(baseThumbnailPrediction.id);
        if (completedBasePrediction.status === 'failed') {
          throw new Error(`Base thumbnail generation failed: ${completedBasePrediction.error || 'Unknown error'}`);
        }
        
        if (!completedBasePrediction.output) {
          throw new Error('Base thumbnail generation completed but no output received');
        }

        targetImageUrl = completedBasePrediction.output;
        console.log('✅ Generated base thumbnail:', targetImageUrl);
        
        // Add small delay to ensure image is fully available on CDN
        console.log('⏳ Waiting 2 seconds for Ideogram image to be available on CDN...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (baseGenerationError) {
        console.warn('⚠️ Base thumbnail generation failed, falling back to uploaded target image:', baseGenerationError);
        
        // Fallback: Check if user provided a target image to use directly
        if (!request.face_swap.target_image) {
          throw new Error(`Cannot generate base thumbnail (${baseGenerationError instanceof Error ? baseGenerationError.message : 'service unavailable'}) and no target image provided. Please upload a target image or try again later.`);
        }
        
        // Use the uploaded target image directly as fallback
        if (typeof request.face_swap.target_image === 'string' && request.face_swap.target_image.startsWith('http')) {
          targetImageUrl = request.face_swap.target_image;
          console.log('🔄 Using provided target image as fallback:', targetImageUrl);
        } else {
          // Upload the target image first
          const targetUpload = await uploadImageToStorage(request.face_swap.target_image, {
            folder: 'face-swap/target',
            filename: `target_${batch_id}.png`,
            bucket: 'images'
          });
          if (!targetUpload.success || !targetUpload.url) {
            throw new Error('Failed to upload target image as fallback');
          }
          targetImageUrl = targetUpload.url;
          console.log('🔄 Uploaded and using target image as fallback:', targetImageUrl);
        }
      }
    } else {
      // Use the uploaded target image as-is
      if (typeof request.face_swap.target_image === 'string' && request.face_swap.target_image.startsWith('http')) {
        targetImageUrl = request.face_swap.target_image;
      } else {
        const targetUpload = await uploadImageToStorage(request.face_swap.target_image, {
          folder: 'face-swap/target',
          filename: `target_${batch_id}.png`,
          bucket: 'images'
        });
        if (!targetUpload.success || !targetUpload.url) {
          throw new Error('Failed to upload target image');
        }
        targetImageUrl = targetUpload.url;
      }
    }

    // Perform face swap with webhook pattern (async)
    console.log('🔄 Starting face swap via webhook pattern');
    console.log('🎯 Final URLs before face swap:', { targetImageUrl, sourceImageUrl });
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`;
    console.log('🔗 Webhook URL for face swap:', webhookUrl);
    
    const faceSwapPredictionId = await performFaceSwap(
      targetImageUrl, 
      sourceImageUrl, 
      webhookUrl,
      request.user_id,
      batch_id // Pass original batch_id, webhook will handle the rest
    );
    
    console.log('✅ Face swap started with prediction ID:', faceSwapPredictionId);

    // ✅ FIX: Update prediction with external_id for proper webhook matching
    await updatePredictionRecord(batch_id, { 
      status: 'processing',
      external_id: faceSwapPredictionId // Store Replicate prediction ID for webhook matching
    });

    // Deduct credits upfront
    const creditDeduction = await deductCredits(
      request.user_id,
      FACE_SWAP_CREDITS,
      'face-swap-only',
      { batch_id, source: sourceImageUrl, target: targetImageUrl }
    );

    const generation_time_ms = Date.now() - startTime;
    console.log(`✅ Face Swap workflow started in ${generation_time_ms}ms - results will be delivered via webhook`);

    return {
      success: true,
      thumbnails: [], // Empty for face-swap-only mode
      face_swapped_thumbnails: [], // Will be populated via real-time when webhook completes
      batch_id, // Use original UUID batch_id for proper database storage
      credits_used: FACE_SWAP_CREDITS,
      remaining_credits: creditDeduction.remainingCredits,
      generation_time_ms
    };
  } catch (error) {
    console.error('🚨 Face Swap workflow error:', error);
    
    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('service unavailable') || error.message.includes('temporarily unavailable') || error.message.includes('E004')) {
        throw new Error('Thumbnail generation service is temporarily unavailable. Please try again in a few minutes or provide a target image to use directly.');
      }
      if (error.message.includes('Base thumbnail generation failed')) {
        throw new Error('Could not generate base thumbnail. Please provide a target image or try again later.');
      }
    }
    
    throw error;
  }
}

/**
 * RECREATION ONLY WORKFLOW
 * Dedicated workflow for recreating thumbnails from reference
 */
async function executeRecreationOnlyWorkflow(
  request: ThumbnailMachineRequest,
  batch_id: string,
  startTime: number
): Promise<ThumbnailMachineResponse> {
  try {
    console.log('🔄 Executing Recreation Only Workflow');
    
    // Validate required fields
    if (!request.reference_image) {
      throw new Error('Recreation requires a reference image');
    }

    // ✅ FIX: Create prediction record FIRST for state restoration (like regular generation)
    await createPredictionRecord({
      prediction_id: batch_id,
      user_id: request.user_id,
      tool_id: 'thumbnail-machine',
      service_id: 'recreation-only',
      model_version: 'gpt-image-1',
      status: 'starting',
      input_data: request as unknown as Json,
    });

    // Upload reference image
    let referenceImageUrl: string;
    if (typeof request.reference_image === 'string' && request.reference_image.startsWith('http')) {
      referenceImageUrl = request.reference_image;
    } else {
      const referenceUpload = await uploadImageToStorage(request.reference_image, {
        folder: 'recreation/reference',
        filename: `ref_${batch_id}.png`,
        bucket: 'images'
      });
      if (!referenceUpload.success || !referenceUpload.url) {
        throw new Error('Failed to upload reference image');
      }
      referenceImageUrl = referenceUpload.url;
    }

    // Step 1: Build recreation prompt
    let recreationPrompt = 'Create a high-quality YouTube thumbnail';
    
    // Add user modifications if provided
    if (request.prompt) {
      recreationPrompt = `${request.prompt}`;
    }
    
    // Add style-specific instructions
    if (request.recreation_style) {
      const stylePrompts = {
        similar: ' Maintain the exact same visual style, composition, and color scheme.',
        improved: ' Enhance the quality, clarity, and visual appeal while keeping the core concept intact.',
        'style-transfer': ' Adapt the concept to a modern, trendy style while preserving the main elements and message.'
      };
      recreationPrompt += stylePrompts[request.recreation_style];
    }
    
    recreationPrompt += ' Professional quality YouTube thumbnail with sharp details, vibrant colors, and optimal composition.';

    // Step 2: Generate recreation using OpenAI Image Edits API (gpt-image-1)
    console.log('🎨 Creating recreation with OpenAI gpt-image-1 model');
    
    // ✅ FIX: Update prediction status to processing (like regular generation)
    await updatePredictionRecord(batch_id, { status: 'processing' });

    const openAIResult = await recreateWithOpenAI(
      referenceImageUrl,
      'YouTube Thumbnail Recreation', // Company name parameter (required by function signature)
      recreationPrompt,
      request.user_id
    );

    if (!openAIResult.data || openAIResult.data.length === 0) {
      throw new Error('OpenAI recreation failed: No images generated');
    }

    // ✅ Prediction record already created at workflow start

    // Get the generated image - OpenAI can return either url or b64_json
    const result = openAIResult.data[0];
    let generatedImageUrl: string;
    
    if (result.url) {
      generatedImageUrl = result.url;
    } else if (result.b64_json) {
      // Convert base64 to proper data URL format
      generatedImageUrl = `data:image/png;base64,${result.b64_json}`;
    } else {
      throw new Error('No image URL or data returned from OpenAI');
    }

    // Download and store result
    const storageResult = await downloadAndUploadImage(
      generatedImageUrl,
      'recreation-result',
      `recreation_${batch_id}`,
      {
        folder: 'recreation/results',
        bucket: 'images'
      }
    );

    const finalImageUrl = storageResult.success && storageResult.url 
      ? storageResult.url 
      : generatedImageUrl;

    // Deduct credits
    const creditDeduction = await deductCredits(
      request.user_id,
      CREDITS_PER_THUMBNAIL,
      'recreation',
      { 
        batch_id, 
        reference_image: referenceImageUrl, 
        result: finalImageUrl,
        style: request.recreation_style 
      }
    );

    // Store result in database
    await storeThumbnailResults([{
      user_id: request.user_id,
      prompt: recreationPrompt,
      image_urls: [finalImageUrl],
      dimensions: 'landscape', // Use predefined value for 16:9 aspect ratio
      height: 1024,
      width: 1024,
      model_name: 'gpt-image-1',
      model_version: 'gpt-image-1',
      batch_id,
      generation_settings: request as unknown as Json,
      metadata: {
        type: 'recreation',
        reference_image: referenceImageUrl,
        recreation_style: request.recreation_style,
        stored_in_supabase: storageResult.success
      }
    }]);

    // Record analytics
    await recordGenerationMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'gpt-image-1',
      style_type: request.recreation_style || 'similar',
      num_variations: 1,
      generation_time_ms: Date.now() - startTime,
      total_credits_used: CREDITS_PER_THUMBNAIL,
      prompt_length: recreationPrompt.length,
      has_advanced_options: true
    });

    const generation_time_ms = Date.now() - startTime;
    console.log(`✅ Recreation workflow completed in ${generation_time_ms}ms`);

    return {
      success: true,
      thumbnails: [{
        id: `${batch_id}_1`,
        url: finalImageUrl,
        variation_index: 1,
        batch_id,
        replicate_url: finalImageUrl // Use finalImageUrl since recreation uses OpenAI, not Replicate
      }],
      prediction_id: batch_id,
      batch_id,
      credits_used: CREDITS_PER_THUMBNAIL,
      remaining_credits: creditDeduction.remainingCredits,
      generation_time_ms
    };
  } catch (error) {
    console.error('🚨 Recreation workflow error:', error);
    throw error;
  }
}

/**
 * TITLES ONLY WORKFLOW
 * Dedicated workflow for generating titles without thumbnails
 */
async function executeTitlesOnlyWorkflow(
  request: ThumbnailMachineRequest,
  batch_id: string,
  startTime: number
): Promise<ThumbnailMachineResponse> {
  try {
    console.log('📝 Executing Titles Only Workflow');
    
    // Validate required fields
    const topic = request.prompt || 'YouTube video';

    // ✅ FIX: Create prediction record for state restoration (like regular generation)
    await createPredictionRecord({
      prediction_id: batch_id,
      user_id: request.user_id,
      tool_id: 'thumbnail-machine',
      service_id: 'titles-only',
      model_version: 'gpt-4o-mini',
      status: 'starting',
      input_data: request as unknown as Json,
    });
    
    // Generate titles with enhanced context
    let titlePrompt = topic;
    if (request.target_keywords) {
      titlePrompt += `. Include keywords: ${request.target_keywords}`;
    }
    
    // ✅ FIX: Update prediction status to processing (like regular generation)
    await updatePredictionRecord(batch_id, { status: 'processing' });

    console.log('📝 Generating YouTube titles with OpenAI');
    const titles = await generateYouTubeTitles(
      titlePrompt,
      request.title_count || 10,
      'gpt-4o-mini' // Cost-effective model for titles
    );
    
    if (!titles || titles.length === 0) {
      throw new Error('Title generation failed');
    }

    // Deduct credits
    const creditDeduction = await deductCredits(
      request.user_id,
      TITLE_GENERATION_CREDITS,
      'title-generation',
      { 
        batch_id, 
        topic,
        title_count: titles.length,
        style: request.title_style
      }
    );

    // Note: Titles-only operations are excluded from history as they don't generate images

    const generation_time_ms = Date.now() - startTime;
    console.log(`✅ Titles workflow completed in ${generation_time_ms}ms`);

    return {
      success: true,
      titles,
      batch_id,
      credits_used: TITLE_GENERATION_CREDITS,
      remaining_credits: creditDeduction.remainingCredits,
      generation_time_ms
    };
  } catch (error) {
    console.error('🚨 Titles workflow error:', error);
    throw error;
  }
}