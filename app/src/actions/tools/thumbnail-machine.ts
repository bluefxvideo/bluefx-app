'use server';

import { createFluxThumbnailPrediction, waitForFluxThumbnailCompletion } from '../models/flux-thumbnails-v2';
import { performFaceSwap } from '../models/face-swap-cdingram';
import { generateYouTubeTitles } from '../models/openai-chat';
import { uploadImageToStorage } from '../supabase-storage';
import { 
  storeThumbnailResults, 
  createPredictionRecord, 
  recordGenerationMetrics,
  getUserCredits,
  deductCredits 
} from '../database/thumbnail-database';

/**
 * Unified Thumbnail Machine Server Action
 * Orchestrates all thumbnail-related operations with AI-driven workflow decisions
 */

export interface ThumbnailMachineRequest {
  // Core generation
  prompt: string;
  
  // Reference image upload (NEW - from Phase 1)
  reference_image?: string | File; // base64, File object, or URL
  
  // Advanced options
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
  num_outputs?: number; // 1-4 (matches legacy batch behavior)
  guidance_scale?: number;
  num_inference_steps?: number;
  output_format?: 'webp' | 'jpg' | 'png';
  output_quality?: number;
  seed?: number;
  
  // Face swap options (ENHANCED - from Phase 1)
  face_swap?: {
    source_image: string | File; // base64, File, or URL
    target_image?: string | File; // Optional - can use generated thumbnails
    apply_to_all?: boolean; // Apply to all generated variations
  };
  
  // Title generation options (ENHANCED - from Phase 1)
  generate_titles?: boolean;
  title_style?: 'emotional' | 'professional' | 'shocking' | 'educational' | 'engaging';
  title_count?: number; // Number of title variations (default: 10)
  
  // User context (ENHANCED - for credit system)
  user_id: string; // Now required for credit validation
}

export interface ThumbnailMachineResponse {
  success: boolean;
  
  // Generated thumbnails
  thumbnails?: {
    id: string;
    url: string;
    variation_index: number;
    batch_id: string;
  }[];
  
  // Face swap results (if requested)
  face_swapped_thumbnails?: {
    url: string;
    source_thumbnail_id: string;
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
 * ENHANCED AI Orchestrator - Replaces 6 Legacy Edge Functions
 * Intelligent workflow decisions using all imported Phase 1 tools
 */
export async function generateThumbnails(
  request: ThumbnailMachineRequest
): Promise<ThumbnailMachineResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  let total_credits = 0;
  const warnings: string[] = [];

  try {
    console.log(`🤖 AI Orchestrator: Starting workflow for user ${request.user_id}`);

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

    // Step 2: AI Decision - Reference Image Processing
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
      model_version: 'flux-thumbnails-v2',
      status: 'starting',
      input_data: request,
    });

    // Step 4: AI Decision - Core Thumbnail Generation
    console.log(`🎨 AI Decision: Generating ${request.num_outputs || 4} thumbnails`);
    
    const prediction = await createFluxThumbnailPrediction({
      prompt: request.prompt,
      aspect_ratio: request.aspect_ratio || '16:9',
      num_outputs: request.num_outputs || 4,
      guidance_scale: request.guidance_scale || 3,
      num_inference_steps: request.num_inference_steps || 28,
      output_format: request.output_format || 'webp',
      output_quality: request.output_quality || 85,
      seed: request.seed,
      enable_safety_checker: true,
      webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`,
    });

    // Update prediction record with actual Replicate ID
    await createPredictionRecord({
      prediction_id: prediction.id,
      user_id: request.user_id,
      tool_id: 'thumbnail-machine',
      service_id: 'generate',
      model_version: 'flux-thumbnails-v2',
      status: 'processing',
      input_data: request,
    });

    // Step 5: Wait for Completion
    console.log(`⏳ Waiting for Replicate completion: ${prediction.id}`);
    const completed_prediction = await waitForFluxThumbnailCompletion(prediction.id);
    
    if (completed_prediction.status !== 'succeeded') {
      throw new Error(`Generation failed: ${completed_prediction.error || 'Unknown error'}`);
    }

    // Step 6: Process Generated Thumbnails
    const thumbnails = completed_prediction.output?.map((url, index) => ({
      id: `${batch_id}_${index + 1}`,
      url,
      variation_index: index + 1,
      batch_id,
    })) || [];

    console.log(`✅ Generated ${thumbnails.length} thumbnails`);
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
              face_swapped_thumbnails.push({
                url: faceSwapResult,
                source_thumbnail_id: thumbnail.id,
              });
              total_credits += FACE_SWAP_CREDITS;
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
      image_urls: [thumb.url],
      dimensions: '1024x1024',
      height: 1024,
      width: 1024,
      model_name: 'flux-thumbnails-v2',
      model_version: 'flux-thumbnails-v2',
      batch_id: thumb.batch_id,
      generation_settings: request,
      metadata: {
        variation_index: thumb.variation_index,
        total_variations: thumbnails.length,
        type: 'thumbnail'
      },
    }));

    await storeThumbnailResults(thumbnailRecords);

    // Step 11: Record Analytics
    await recordGenerationMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'flux-thumbnails-v2',
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
      prediction_id: prediction.id,
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
  let credits = 0;
  
  // Core thumbnail generation
  credits += (request.num_outputs || 4) * CREDITS_PER_THUMBNAIL;
  
  // Face swap (if requested)
  if (request.face_swap) {
    const targetsCount = request.face_swap.apply_to_all ? (request.num_outputs || 4) : 1;
    credits += targetsCount * FACE_SWAP_CREDITS;
  }
  
  // Title generation (if requested)
  if (request.generate_titles) {
    credits += TITLE_GENERATION_CREDITS;
  }
  
  return credits;
}

// Calculate actual credits used for thumbnails
function calculateThumbnailCredits(num_outputs: number): number {
  return num_outputs * CREDITS_PER_THUMBNAIL;
}

// Check if request uses advanced options (for analytics)
function hasAdvancedOptions(request: ThumbnailMachineRequest): boolean {
  return !!(
    request.guidance_scale && request.guidance_scale !== 3 ||
    request.num_inference_steps && request.num_inference_steps !== 28 ||
    request.output_quality && request.output_quality !== 85 ||
    request.seed ||
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
    num_outputs: 4,
    guidance_scale: 3,
    num_inference_steps: 28,
    output_format: 'webp',
    output_quality: 85,
  });
}