'use server';

import { createVideoGenerationPrediction } from '@/actions/models/video-generation-v1';
import { generateImage } from '@/actions/models/image-generation-nano-banana';
import { uploadImageToStorage } from '@/actions/supabase-storage';
import {
  getUserCredits,
  deductCredits,
  storeCinematographerResults,
  storeStartingShotResult,
  recordCinematographerMetrics,
  createPredictionRecord
} from '@/actions/database/cinematographer-database';
import { Json } from '@/types/database';
import type { StartingShotAspectRatio } from '@/types/cinematographer';

// Type re-export only (constants should be imported directly from @/types/cinematographer in client components)
export type { StartingShotAspectRatio };

// Request/Response types for Starting Shot (First Frame Image Generation)
export interface StartingShotRequest {
  prompt: string;
  aspect_ratio?: StartingShotAspectRatio;
  reference_image_files?: File[]; // Optional reference image files to upload (up to 3)
  reference_image_urls?: string[]; // Optional reference image URLs already uploaded (up to 3)
  user_id: string;
}

export interface StartingShotResponse {
  success: boolean;
  image?: {
    id: string;
    image_url: string;
    prompt: string;
    aspect_ratio: string;
    created_at: string;
  };
  batch_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  error?: string;
}

// Request/Response types for the AI Cinematographer
export interface CinematographerRequest {
  prompt: string;
  reference_image?: File | null; // Optional for LTX-2-Fast (text-to-video supported)
  reference_image_url?: string; // URL of a reference image (e.g., from Starting Shot)
  duration?: 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20; // LTX-2-Fast durations
  resolution?: '1080p' | '2k' | '4k'; // Video resolution (default: 1080p)
  generate_audio?: boolean; // Enable AI audio generation (default: true)
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
    resolution: string;
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

    // Use reference image URL if provided (from Starting Shot), otherwise upload file
    if (request.reference_image_url) {
      referenceImageUrl = request.reference_image_url;
      console.log('📸 Using reference image URL from Starting Shot:', referenceImageUrl);
    } else if (request.reference_image) {
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
      return await handleVideoGeneration(request, batch_id, startTime, referenceImageUrl, creditCosts.total, creditCheck.credits || 0);
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
  creditCost: number,
  currentCredits: number
): Promise<CinematographerResponse> {
  try {
    // Create video generation prediction using LTX-2-Fast
    let prediction;
    try {
      console.log('🎬 Attempting to create LTX-2-Fast prediction...');
      prediction = await createVideoGenerationPrediction({
        prompt: request.prompt,
        image: referenceImageUrl, // Optional for LTX-2-Fast (text-to-video supported)
        duration: request.duration || 6,
        resolution: request.resolution || '1080p',
        generate_audio: request.generate_audio !== false, // Default to true
        webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai` // For status updates
      });
      
      // Validate prediction response
      if (!prediction || !prediction.id) {
        throw new Error('Invalid prediction response: missing prediction ID');
      }
      
      console.log('✅ Replicate prediction created successfully:', prediction.id);
    } catch (error) {
      console.error('❌ Replicate prediction creation failed:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      
      // Handle content moderation failures (E005) and other Replicate errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown prediction error';
      
      // Check for common content moderation patterns
      if (errorMessage.includes('flagged') || errorMessage.includes('sensitive') || errorMessage.includes('E005')) {
        return {
          success: false,
          error: 'Content was flagged as sensitive. Please try with different prompts or images.',
          batch_id,
          generation_time_ms: Date.now() - startTime,
          credits_used: 0,
          remaining_credits: currentCredits,
        };
      }
      
      return {
        success: false,
        error: `Video generation failed: ${errorMessage}`,
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: currentCredits,
      };
    }

    // Ensure we have a valid prediction before proceeding
    if (!prediction?.id) {
      console.error('❌ No valid prediction available for database storage');
      return {
        success: false,
        error: 'Prediction creation failed - no valid prediction ID',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: currentCredits,
      };
    }

    // Create prediction tracking record
    try {
      await createPredictionRecord({
        prediction_id: prediction.id,
        user_id: request.user_id,
        tool_id: 'ai-cinematographer',
        service_id: 'replicate',
        model_version: 'ltx-2-fast',
        status: 'planning',
        input_data: {
          prompt: request.prompt,
          duration: request.duration || 6,
          resolution: request.resolution || '1080p',
          generate_audio: request.generate_audio !== false,
          reference_image: referenceImageUrl
        } as Json,
      });
    } catch (error) {
      console.error('Error creating prediction tracking record:', error);
      // Continue anyway - the prediction was created successfully
    }

    // Store video record in database
    const storeResult = await storeCinematographerResults({
      user_id: request.user_id,
      video_concept: request.prompt,
      project_name: `Video Generation - ${new Date().toISOString()}`,
      batch_id,
      duration: request.duration || 6,
      resolution: request.resolution || '1080p',
      settings: {
        prediction_id: prediction.id,
        reference_image: referenceImageUrl,
        generation_params: {
          duration: request.duration || 6,
          resolution: request.resolution || '1080p',
          generate_audio: request.generate_audio !== false
        }
      } as Json,
      status: 'shooting'
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
      model_version: 'ltx-2-fast',
      video_concept: request.prompt,
      duration: request.duration || 6,
      resolution: request.resolution || '1080p',
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
        duration: request.duration || 6,
        resolution: request.resolution || '1080p',
        prompt: request.prompt,
        created_at: new Date().toISOString(),
      },
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: creditCost,
      remaining_credits: creditDeduction.remainingCredits || 0,
      warnings: undefined,
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
 * LTX-2-Fast pricing: credits per second × duration
 * - 1080p: 1 credit/second (100 x 6s videos with 600 credits)
 * - 2k: 2 credits/second
 * - 4k: 4 credits/second
 */
function calculateCinematographerCreditCost(request: CinematographerRequest) {
  let baseCost = 0;

  if (request.workflow_intent === 'generate') {
    const duration = request.duration || 6;
    const resolution = request.resolution || '1080p';

    // Credits per second based on resolution
    const creditsPerSecond = resolution === '4k' ? 4 : resolution === '2k' ? 2 : 1;
    baseCost = duration * creditsPerSecond;

  } else if (request.workflow_intent === 'audio_add') {
    baseCost = 4; // Audio integration cost (not typically needed with LTX-2-Fast built-in audio)
  }

  const total = baseCost;

  return {
    base: baseCost,
    duration_seconds: request.duration || 6,
    resolution: request.resolution || '1080p',
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

/**
 * Starting Shot - First Frame Image Generation
 * Uses google/nano-banana for fast, high-quality image generation
 * Cost: 1 credit per image (~$0.04 actual cost)
 */
export async function executeStartingShot(
  request: StartingShotRequest
): Promise<StartingShotResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  const CREDIT_COST = 1; // 1 credit per image

  try {
    // Step 1: Credit Validation
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

    if ((creditCheck.credits || 0) < CREDIT_COST) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${CREDIT_COST}, Available: ${creditCheck.credits || 0}`,
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: creditCheck.credits || 0,
      };
    }

    console.log(`🖼️ Starting Shot - Credits validated: ${creditCheck.credits} available`);

    // Step 2: Upload reference images if provided as files
    let referenceImageUrls: string[] = request.reference_image_urls || [];

    if (request.reference_image_files && request.reference_image_files.length > 0) {
      console.log(`🖼️ Uploading ${request.reference_image_files.length} reference image(s)...`);

      for (const file of request.reference_image_files) {
        try {
          const fileExtension = file.name.split('.').pop() || 'jpg';
          const safeFilename = `starting_shot_ref_${batch_id}_${Date.now()}.${fileExtension}`;

          const uploadResult = await uploadImageToStorage(file, {
            bucket: 'images',
            folder: 'starting-shot-references',
            filename: safeFilename,
            contentType: file.type || 'image/jpeg',
          });

          if (uploadResult.success && uploadResult.url) {
            referenceImageUrls.push(uploadResult.url);
            console.log('📸 Reference image uploaded:', uploadResult.url);
          }
        } catch (error) {
          console.error('Failed to upload reference image:', error);
          // Continue with other images
        }
      }
    }

    // Step 3: Generate image using nano-banana
    const aspectRatio = request.aspect_ratio || '16:9';
    const hasReferenceImages = referenceImageUrls.length > 0;
    console.log(`🖼️ Generating image with prompt: "${request.prompt.substring(0, 50)}..." aspect: ${aspectRatio}${hasReferenceImages ? `, references: ${referenceImageUrls.length}` : ''}`);

    const imageResult = await generateImage(request.prompt, aspectRatio, hasReferenceImages ? referenceImageUrls : undefined);

    if (!imageResult.success || !imageResult.imageUrl) {
      return {
        success: false,
        error: imageResult.error || 'Image generation failed',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: creditCheck.credits || 0,
      };
    }

    console.log(`✅ Starting Shot generated successfully: ${imageResult.imageUrl}`);

    // Step 3: Store result in database
    const storeResult = await storeStartingShotResult({
      user_id: request.user_id,
      batch_id,
      prompt: request.prompt,
      image_url: imageResult.imageUrl,
      aspect_ratio: aspectRatio,
    });

    if (!storeResult.success) {
      console.error('Failed to store starting shot result:', storeResult.error);
      // Continue anyway - the image was generated successfully
    }

    // Step 4: Deduct credits
    const creditDeduction = await deductCredits(
      request.user_id,
      CREDIT_COST,
      'starting-shot',
      { batch_id, prompt: request.prompt, aspect_ratio: aspectRatio } as Json
    );

    if (!creditDeduction.success) {
      console.warn('Credit deduction failed:', creditDeduction.error);
      // Continue anyway - don't fail the generation
    }

    return {
      success: true,
      image: {
        id: batch_id,
        image_url: imageResult.imageUrl,
        prompt: request.prompt,
        aspect_ratio: aspectRatio,
        created_at: new Date().toISOString(),
      },
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: CREDIT_COST,
      remaining_credits: creditDeduction.remainingCredits || (creditCheck.credits || 0) - CREDIT_COST,
    };

  } catch (error) {
    console.error('Starting Shot execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}