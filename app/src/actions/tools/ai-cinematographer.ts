'use server';

import { createVideoGenerationPrediction } from '@/actions/models/video-generation-v1';
import { uploadImageToStorage } from '@/actions/supabase-storage';
import { 
  getUserCredits,
  deductCredits,
  storeCinematographerResults,
  recordCinematographerMetrics,
  createPredictionRecord
} from '@/actions/database/cinematographer-database';
import { Json } from '@/types/database';

// Request/Response types for the AI Cinematographer
export interface CinematographerRequest {
  prompt: string;
  reference_image?: File | null;
  duration?: 5 | 10; // Kling only accepts 5 or 10 seconds
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  motion_scale?: number; // 0-2 (deprecated - use cfg_scale instead)
  workflow_intent: 'generate' | 'audio_add';
  audio_file?: File | null;
  user_id: string;
}

export interface CinematographerResponse {
  success: boolean;
  video?: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    duration: number;
    aspect_ratio: string;
    prompt: string;
    created_at: string;
  };
  batch_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  warnings?: string[];
  error?: string;
}

/**
 * AI Cinematographer - Single orchestrator replacing 7 legacy edge functions
 * Server Action for video generation workflow
 * 
 * Replaces:
 * - cinematographer-generate-video
 * - cinematographer-webhook  
 * - cinematographer-check-status
 * - cinematographer-add-audio
 * - cinematographer-check-audio
 * - cinematographer-save-video
 * - cinematographer-delete-video
 * 
 * Features:
 * - Professional video generation from prompts and reference images
 * - Async job management with status tracking
 * - Audio integration and synchronization
 * - Credit cost calculation (8 credits for video generation, 4 for audio)
 * - Real-time status updates via database subscriptions
 */
export async function executeAICinematographer(
  request: CinematographerRequest
): Promise<CinematographerResponse> {
  const startTime = Date.now();
  
  try {
    // Generate unique batch ID for this operation
    const batch_id = crypto.randomUUID();
    
    // Calculate credit costs based on workflow
    const creditCosts = calculateCinematographerCreditCost(request);
    
    // Step 1: Credit Validation (using proven pattern from Logo Machine)
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      return {
        success: false,
        error: 'Unable to verify credit balance',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    if ((creditCheck.credits || 0) < creditCosts.total) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${creditCosts.total}, Available: ${creditCheck.credits || 0}`,
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: creditCheck.credits || 0,
      };
    }

    console.log(`💳 Credits validated: ${creditCheck.credits} available, ${creditCosts.total} required`);

    let referenceImageUrl: string | undefined;
    
    // Upload reference image if provided
    if (request.reference_image) {
      try {
        console.log('📸 Starting reference image upload:', {
          fileName: request.reference_image.name,
          fileSize: request.reference_image.size,
          fileType: request.reference_image.type,
          batch_id
        });

        // Ensure file extension handling is robust
        const fileExtension = request.reference_image.name.split('.').pop() || 'jpg';
        const safeFilename = `${batch_id}_reference.${fileExtension}`;

        const uploadResult = await uploadImageToStorage(
          request.reference_image,
          {
            bucket: 'images',
            folder: 'cinematographer',
            filename: safeFilename,
            contentType: request.reference_image.type || 'image/jpeg',
          }
        );
        
        console.log('📸 Upload result:', uploadResult);
        
        if (!uploadResult.success) {
          console.error('Upload failed with error:', uploadResult.error);
          throw new Error(uploadResult.error || 'Upload failed');
        }
        
        referenceImageUrl = uploadResult.url;
        console.log('📸 Reference image uploaded successfully:', referenceImageUrl);
      } catch (error) {
        console.error('Reference image upload failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
        return {
          success: false,
          error: `Failed to upload reference image: ${errorMessage}`,
          batch_id,
          generation_time_ms: Date.now() - startTime,
          credits_used: 0,
          remaining_credits: creditCheck.credits || 0,
        };
      }
    }

    // Handle different workflow intents
    if (request.workflow_intent === 'generate') {
      return await handleVideoGeneration(request, batch_id, startTime, referenceImageUrl, creditCosts.total);
    } else if (request.workflow_intent === 'audio_add') {
      return await handleAudioIntegration(request, batch_id, startTime, creditCosts.total);
    }

    return {
      success: false,
      error: 'Invalid workflow intent',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: creditCheck.credits || 0,
    };

  } catch (error) {
    console.error('AI Cinematographer execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      batch_id: crypto.randomUUID(),
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Handle video generation workflow
 */
async function handleVideoGeneration(
  request: CinematographerRequest,
  batch_id: string,
  startTime: number,
  referenceImageUrl: string | undefined,
  creditCost: number
): Promise<CinematographerResponse> {
  try {
    // Create video generation prediction using Kling v1.6 parameters
    const prediction = await createVideoGenerationPrediction({
      prompt: request.prompt,
      start_image: referenceImageUrl, // Use start_image instead of image for Kling
      duration: request.duration && [5, 10].includes(request.duration) ? request.duration as (5 | 10) : 5, // Kling only accepts 5 or 10 seconds
      aspect_ratio: request.aspect_ratio || '16:9',
      cfg_scale: 0.5, // Kling flexibility parameter
      webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai` // For status updates
    });

    // Create prediction tracking record
    await createPredictionRecord({
      prediction_id: prediction.id,
      user_id: request.user_id,
      tool_id: 'ai-cinematographer',
      service_id: 'replicate',
      model_version: 'stable-video-diffusion',
      status: 'starting',
      input_data: {
        prompt: request.prompt,
        duration: request.duration || 4,
        aspect_ratio: request.aspect_ratio || '16:9',
        motion_scale: request.motion_scale || 1.0,
        reference_image: referenceImageUrl
      } as Json,
    });

    // Store video record in database
    const storeResult = await storeCinematographerResults({
      user_id: request.user_id,
      video_concept: request.prompt,
      project_name: `Video Generation - ${new Date().toISOString()}`,
      batch_id,
      duration: request.duration || 4,
      aspect_ratio: request.aspect_ratio || '16:9',
      settings: {
        prediction_id: prediction.id,
        reference_image: referenceImageUrl,
        generation_params: {
          duration: request.duration || 4,
          aspect_ratio: request.aspect_ratio || '16:9',
          motion_scale: request.motion_scale || 1.0
        }
      } as Json,
      status: 'processing'
    });

    if (!storeResult.success) {
      return {
        success: false,
        error: storeResult.error || 'Failed to save video generation record',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Deduct credits using proven pattern
    const creditDeduction = await deductCredits(
      request.user_id,
      creditCost,
      'video-generation',
      { batch_id, video_concept: request.prompt, workflow: 'generate' } as Json
    );

    if (!creditDeduction.success) {
      console.warn('Credit deduction failed:', creditDeduction.error);
      // Continue anyway - don't fail the generation
    }

    // Record metrics
    await recordCinematographerMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: 'stable-video-diffusion',
      video_concept: request.prompt,
      duration: request.duration || 4,
      aspect_ratio: request.aspect_ratio || '16:9',
      generation_time_ms: Date.now() - startTime,
      credits_used: creditCost,
      workflow_type: 'generate',
      has_reference_image: !!referenceImageUrl
    });

    // Return response with job tracking info
    return {
      success: true,
      video: {
        id: batch_id,
        video_url: '', // Will be updated via webhook when complete
        thumbnail_url: undefined,
        duration: request.duration || 4,
        aspect_ratio: request.aspect_ratio || '16:9',
        prompt: request.prompt,
        created_at: new Date().toISOString(),
      },
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: creditCost,
      remaining_credits: creditDeduction.remainingCredits || 0,
      warnings: referenceImageUrl ? undefined : ['No reference image provided - video will be generated from prompt only'],
    };

  } catch (error) {
    console.error('Video generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Video generation failed',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Handle audio integration workflow
 */
async function handleAudioIntegration(
  _request: CinematographerRequest,
  batch_id: string,
  startTime: number,
  _creditCost: number
): Promise<CinematographerResponse> {
  // TODO: Implement audio integration
  return {
    success: false,
    error: 'Audio integration not yet implemented',
    batch_id,
    generation_time_ms: Date.now() - startTime,
    credits_used: 0,
    remaining_credits: 0,
  };
}

/**
 * Construct optimized prompt for video generation
 */
// Removed unused function constructVideoPrompt

/**
 * Calculate credit costs for cinematographer operations
 */
function calculateCinematographerCreditCost(request: CinematographerRequest) {
  let baseCost = 0;
  
  if (request.workflow_intent === 'generate') {
    // Kling v1.6 pricing structure based on duration
    const duration = request.duration || 5;
    
    if (duration === 5) {
      baseCost = 8; // Base cost for 5-second video
    } else if (duration === 10) {
      baseCost = 15; // Higher cost for 10-second video (almost 2x)
    } else {
      baseCost = 8; // Fallback to 5-second pricing
    }
    
    // Reference image complexity bonus
    if (request.reference_image) {
      baseCost += 2; // +2 credits for reference image processing
    }
    
  } else if (request.workflow_intent === 'audio_add') {
    baseCost = 4; // Audio integration cost
  }
  
  const total = baseCost;
  
  return {
    base: baseCost,
    duration_seconds: request.duration || 5,
    total,
    breakdown: {
      video_generation: request.workflow_intent === 'generate' ? total : 0,
      audio_integration: request.workflow_intent === 'audio_add' ? total : 0,
    }
  };
}

// Removed manual deductCredits - now using the proven pattern from cinematographer-database.ts

/**
 * Alternative export for AI Cinematographer (helps with Server Action serialization)
 */
export { executeAICinematographer as generateVideo };