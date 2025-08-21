'use server';

import { createIdeogramV2aPrediction, waitForIdeogramV2aCompletion, generateMultipleThumbnails } from '../models/ideogram-v2a';
import { performFaceSwap } from '../models/face-swap-cdingram';
import { generateYouTubeTitles } from '../models/openai-chat';
import { uploadImageToStorage, downloadAndUploadImage } from '../supabase-storage';
import { 
  storeThumbnailResults, 
  createPredictionRecord, 
  recordGenerationMetrics,
  getUserCredits,
  deductCredits 
} from '../database/thumbnail-database';
import { Json } from '@/types/database';

/**
 * Unified Thumbnail Machine Server Action
 * Orchestrates all thumbnail-related operations with AI-driven workflow decisions
 */

export interface ThumbnailMachineRequest {
  // Operation mode - determines which workflow to execute
  operation_mode?: 'generate' | 'face-swap-only' | 'recreation-only' | 'titles-only';
  
  // Core generation (used for 'generate' and 'recreation-only' modes)
  prompt?: string; // Optional for some modes
  
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
  prediction_id: string;
  batch_id: string;
  credits_used: number;
  remaining_credits?: number; // NEW - from credit system integration
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
      prediction_id: batch_id, // Use batch_id as temp prediction_id
      user_id: request.user_id,
      tool_id: 'thumbnail-machine',
      service_id: 'generate',
      model_version: 'ideogram-v2a',
      status: 'starting',
      input_data: request as unknown as Json,
    });

    // Step 4: AI Decision - Core Thumbnail Generation  
    const numOutputs = request.num_outputs || 1;
    console.log(`🎨 AI Decision: Generating ${numOutputs} thumbnail(s) using Ideogram V2a`);
    
    // For single thumbnail generation, use direct function instead of multiple
    let predictions;
    if (numOutputs === 1) {
      const singlePrediction = await createIdeogramV2aPrediction({
        prompt: request.prompt,
        aspect_ratio: request.aspect_ratio || '16:9',
        style_type: request.style_type || 'Auto',
        magic_prompt_option: request.magic_prompt_option || 'On',
        seed: request.seed,
        // Temporarily disable webhook for testing - use polling instead
        // webhook: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/replicate-ai`,
      });
      predictions = [singlePrediction];
    } else {
      // Fallback for multiple thumbnails (if needed in future)
      predictions = await generateMultipleThumbnails(
        request.prompt,
        numOutputs,
        {
          aspectRatio: request.aspect_ratio || '16:9',
          styleType: request.style_type || 'Auto',
          // Temporarily disable webhook for testing - use polling instead
          // webhook: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/replicate-ai`,
        }
      );
    }

    // Update prediction records for all generated predictions
    for (const prediction of predictions) {
      await createPredictionRecord({
        prediction_id: prediction.id,
        user_id: request.user_id,
        tool_id: 'thumbnail-machine',
        service_id: 'generate',
        model_version: 'ideogram-v2a',
        status: 'processing',
        input_data: request as unknown as Json,
      });
    }

    // Step 5: Wait for All Completions
    console.log(`⏳ Waiting for ${predictions.length} Ideogram V2a completions`);
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
              const faceSwapResult = await performFaceSwap(thumbnail.url, sourceImageUrl);
            
            if (faceSwapResult) {
              // Download and store face-swapped result in Supabase Storage
              const faceSwapStorageResult = await downloadAndUploadImage(
                faceSwapResult,
                'thumbnail-machine-faceswap',
                `${thumbnail.id}_swapped`,
                {
                  folder: 'thumbnails/faceswap',
                  bucket: 'images'
                }
              );
              
              face_swapped_thumbnails.push({
                url: faceSwapStorageResult.success && faceSwapStorageResult.url 
                  ? faceSwapStorageResult.url 
                  : faceSwapResult, // Fallback to original if storage fails
                source_thumbnail_id: thumbnail.id,
                replicate_url: faceSwapResult, // Keep original for reference
              });
              total_credits += FACE_SWAP_CREDITS;
              
              if (faceSwapStorageResult.success) {
                console.log(`✅ Stored face-swapped thumbnail: ${faceSwapStorageResult.url}`);
              } else {
                console.warn(`⚠️ Failed to store face-swapped thumbnail, using original URL`);
              }
            }
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
      prompt: request.prompt,
      image_urls: [thumb.url], // Supabase Storage URL
      dimensions: 'landscape', // Use predefined value for 16:9 aspect ratio
      height: 1024,
      width: 1024,
      model_name: 'ideogram-v2a',
      model_version: 'ideogram-v2a',
      batch_id: thumb.batch_id,
      generation_settings: request as unknown as Json,
      metadata: {
        variation_index: thumb.variation_index,
        total_variations: thumbnails.length,
        type: 'thumbnail',
        replicate_url: thumb.replicate_url, // Keep original URL for reference
        stored_in_supabase: true
      },
    }));

    await storeThumbnailResults(thumbnailRecords);

    // Step 11: Record Analytics
    await recordGenerationMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'ideogram-v2a',
      style_type: 'auto',
      num_variations: thumbnails.length,
      generation_time_ms: Date.now() - startTime,
      total_credits_used: total_credits,
      prompt_length: request.prompt.length,
      has_advanced_options: hasAdvancedOptions(request),
    });

    const generation_time_ms = Date.now() - startTime;
    console.log(`🎉 AI Orchestrator: Workflow completed in ${generation_time_ms}ms`);

    return {
      success: true,
      thumbnails,
      face_swapped_thumbnails,
      titles,
      prediction_id: predictions[0]?.id || batch_id, // Use first prediction ID or batch_id as fallback
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
      prediction_id: '',
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

    // Upload target image
    let targetImageUrl: string;
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

    // Perform face swap
    console.log('🔄 Performing face swap via Replicate API');
    const faceSwapResultUrl = await performFaceSwap(targetImageUrl, sourceImageUrl);
    
    if (!faceSwapResultUrl) {
      throw new Error('Face swap operation failed');
    }

    // Download and store result
    const storageResult = await downloadAndUploadImage(
      faceSwapResultUrl,
      'face-swap-result',
      `result_${batch_id}`,
      {
        folder: 'face-swap/results',
        bucket: 'images'
      }
    );

    const finalImageUrl = storageResult.success && storageResult.url 
      ? storageResult.url 
      : faceSwapResultUrl;

    // Deduct credits
    const creditDeduction = await deductCredits(
      request.user_id,
      FACE_SWAP_CREDITS,
      'face-swap-only',
      { batch_id, source: sourceImageUrl, target: targetImageUrl, result: finalImageUrl }
    );

    // Store result in database
    await storeThumbnailResults([{
      user_id: request.user_id,
      prompt: 'Face Swap Operation',
      image_urls: [finalImageUrl],
      dimensions: 'landscape', // Use predefined value
      height: 1024,
      width: 1024,
      model_name: 'face-swap-cdingram',
      model_version: 'face-swap',
      batch_id,
      generation_settings: request as unknown as Json,
      metadata: {
        type: 'face-swap',
        source_image: sourceImageUrl,
        target_image: targetImageUrl,
        stored_in_supabase: storageResult.success
      }
    }]);

    const generation_time_ms = Date.now() - startTime;
    console.log(`✅ Face Swap workflow completed in ${generation_time_ms}ms`);

    return {
      success: true,
      face_swapped_thumbnails: [{
        url: finalImageUrl,
        source_thumbnail_id: batch_id,
        replicate_url: faceSwapResultUrl
      }],
      prediction_id: batch_id,
      batch_id,
      credits_used: FACE_SWAP_CREDITS,
      remaining_credits: creditDeduction.remainingCredits,
      generation_time_ms
    };
  } catch (error) {
    console.error('🚨 Face Swap workflow error:', error);
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

    // Create recreation prompt
    let recreationPrompt = request.prompt || 'Recreate this thumbnail with similar style and composition';
    
    // Add style-specific instructions
    if (request.recreation_style) {
      const stylePrompts = {
        similar: 'maintaining the same visual style, composition, and color scheme',
        improved: 'enhancing the quality, clarity, and visual appeal while keeping the core concept',
        'style-transfer': 'adapting the concept to a new artistic style while preserving the main elements'
      };
      recreationPrompt += `, ${stylePrompts[request.recreation_style]}`;
    }
    
    recreationPrompt += '. Create a high-quality thumbnail with sharp details, vibrant colors, and professional composition suitable for YouTube.';

    // Generate recreation using Ideogram V2a
    console.log('🎨 Creating recreation with Ideogram V2a');
    const prediction = await createIdeogramV2aPrediction({
      prompt: recreationPrompt,
      aspect_ratio: request.aspect_ratio || '16:9',
      style_type: request.style_type || 'Auto',
      magic_prompt_option: 'On',
      seed: request.seed
    });

    // Record in database
    await createPredictionRecord({
      prediction_id: prediction.id,
      user_id: request.user_id,
      tool_id: 'thumbnail-machine',
      service_id: 'recreation',
      model_version: 'ideogram-v2a',
      status: 'processing',
      input_data: request as unknown as Json
    });

    // Wait for completion
    console.log(`⏳ Waiting for recreation completion: ${prediction.id}`);
    const completedPrediction = await waitForIdeogramV2aCompletion(prediction.id);

    if (completedPrediction.status !== 'succeeded' || !completedPrediction.output) {
      throw new Error(`Recreation failed: ${completedPrediction.error || completedPrediction.status}`);
    }

    // Download and store result
    const storageResult = await downloadAndUploadImage(
      completedPrediction.output as string,
      'recreation-result',
      `recreation_${batch_id}`,
      {
        folder: 'recreation/results',
        bucket: 'images'
      }
    );

    const finalImageUrl = storageResult.success && storageResult.url 
      ? storageResult.url 
      : completedPrediction.output as string;

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
      model_name: 'ideogram-v2a',
      model_version: 'ideogram-v2a',
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
      model_version: 'ideogram-v2a',
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
        replicate_url: completedPrediction.output as string
      }],
      prediction_id: prediction.id,
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
    
    // Generate titles with enhanced context
    let titlePrompt = topic;
    if (request.target_keywords) {
      titlePrompt += `. Include keywords: ${request.target_keywords}`;
    }
    
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

    // Store in database (simplified record for titles)
    await storeThumbnailResults([{
      user_id: request.user_id,
      prompt: topic,
      image_urls: [], // No images for titles-only
      dimensions: 'square', // Use default value for non-image generation
      height: 1, // Use positive value to satisfy constraint
      width: 1, // Use positive value to satisfy constraint
      model_name: 'gpt-4o-mini',
      model_version: 'openai-chat',
      batch_id,
      generation_settings: request as unknown as Json,
      metadata: {
        type: 'titles-only',
        titles,
        title_count: titles.length,
        title_style: request.title_style,
        target_keywords: request.target_keywords
      }
    }]);

    const generation_time_ms = Date.now() - startTime;
    console.log(`✅ Titles workflow completed in ${generation_time_ms}ms`);

    return {
      success: true,
      titles,
      prediction_id: batch_id,
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