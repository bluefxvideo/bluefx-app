'use server';

import { createVideoGenerationPrediction } from '@/actions/models/video-generation-v1';
import { createSeedancePrediction, type SeedanceAspectRatio, type SeedanceDuration } from '@/actions/models/video-generation-seedance';
import { generateImage } from '@/actions/models/image-generation-nano-banana';
import { generateImageWithPro } from '@/actions/models/image-generation-nano-banana-pro';
import { uploadImageToStorage, downloadAndUploadImage } from '@/actions/supabase-storage';
import {
  getUserCredits,
  deductCredits,
  storeCinematographerResults,
  storeStartingShotResult,
  recordCinematographerMetrics,
  createPredictionRecord
} from '@/actions/database/cinematographer-database';
import { Json } from '@/types/database';
import type { StartingShotAspectRatio, CinematographerRequest, CinematographerResponse } from '@/types/cinematographer';

// Re-export types for consumers (import from @/types/cinematographer for client components)
export type { StartingShotAspectRatio, CinematographerRequest, CinematographerResponse };

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

// CinematographerRequest and CinematographerResponse types are now in @/types/cinematographer
// and re-exported above for backwards compatibility

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
  console.log('🎬 SERVER ACTION ENTRY - executeAICinematographer');
  const startTime = Date.now();

  // Safely log request info for debugging
  try {
    console.log('🎬 Request received:', {
      prompt: typeof request.prompt === 'string' ? request.prompt?.substring(0, 50) + '...' : 'NO PROMPT',
      model: request.model,
      duration: request.duration,
      resolution: request.resolution,
      hasReferenceImage: !!request.reference_image,
      referenceImageType: request.reference_image ? typeof request.reference_image : 'none',
      hasReferenceImageUrl: !!request.reference_image_url,
      hasLastFrameImage: !!request.last_frame_image,
      hasLastFrameImageUrl: !!request.last_frame_image_url,
      workflow_intent: request.workflow_intent,
      aspect_ratio: request.aspect_ratio,
      camera_fixed: request.camera_fixed,
      seed: request.seed,
    });
  } catch (logError) {
    console.error('🎬 Error logging request:', logError);
  }

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
        const fileName = request.reference_image.name || 'upload.jpg';
        const fileType = request.reference_image.type || 'image/jpeg';

        console.log('📸 Starting reference image upload:', {
          fileName,
          fileSize: request.reference_image.size,
          fileType,
          batch_id
        });

        const fileExtension = fileName.split('.').pop() || 'jpg';
        const safeFilename = `${batch_id}_reference.${fileExtension}`;

        const uploadResult = await uploadImageToStorage(
          request.reference_image,
          {
            bucket: 'images',
            folder: 'cinematographer',
            filename: safeFilename,
            contentType: fileType,
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

    // Handle last frame image upload (Pro model only)
    let lastFrameImageUrl: string | undefined;
    if (request.model === 'pro') {
      if (request.last_frame_image_url) {
        lastFrameImageUrl = request.last_frame_image_url;
        console.log('📸 Using last frame image URL:', lastFrameImageUrl);
      } else if (request.last_frame_image) {
        try {
          const fileName = request.last_frame_image.name || 'last_frame.jpg';
          const fileType = request.last_frame_image.type || 'image/jpeg';

          console.log('📸 Starting last frame image upload:', {
            fileName,
            fileSize: request.last_frame_image.size,
            fileType,
            batch_id
          });

          const fileExtension = fileName.split('.').pop() || 'jpg';
          const safeFilename = `${batch_id}_last_frame.${fileExtension}`;

          const uploadResult = await uploadImageToStorage(
            request.last_frame_image,
            {
              bucket: 'images',
              folder: 'cinematographer',
              filename: safeFilename,
              contentType: fileType,
            }
          );

          if (!uploadResult.success) {
            console.error('Last frame upload failed with error:', uploadResult.error);
            throw new Error(uploadResult.error || 'Upload failed');
          }

          lastFrameImageUrl = uploadResult.url;
          console.log('📸 Last frame image uploaded successfully:', lastFrameImageUrl);
        } catch (error) {
          console.error('Last frame image upload failed:', error);
          // Don't fail the entire request, just continue without last frame
          console.warn('Continuing without last frame image');
        }
      }
    }

    // Handle different workflow intents
    if (request.workflow_intent === 'generate') {
      return await handleVideoGeneration(request, batch_id, startTime, referenceImageUrl, creditCosts.total, creditCheck.credits || 0, lastFrameImageUrl);
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
 * Supports both Fast (LTX-2-Fast) and Pro (Seedance 1.5 Pro) models
 */
async function handleVideoGeneration(
  request: CinematographerRequest,
  batch_id: string,
  startTime: number,
  referenceImageUrl: string | undefined,
  creditCost: number,
  currentCredits: number,
  lastFrameImageUrl?: string
): Promise<CinematographerResponse> {
  try {
    const model = request.model || 'fast';
    const modelVersion = model === 'fast' ? 'ltx-2-fast' : 'seedance-1.5-pro';

    // Create video generation prediction based on model selection
    let prediction;
    try {
      if (model === 'fast') {
        // LTX-2-Fast model
        console.log('🎬 Attempting to create LTX-2-Fast prediction...');

        // Validate duration for Fast model (6, 8, 10, 12, 14, 16, 18, 20)
        const fastDuration = (request.duration || 6) as 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20;
        const fastResolution = (request.resolution || '1080p') as '1080p' | '2k' | '4k';

        prediction = await createVideoGenerationPrediction({
          prompt: request.prompt,
          image: referenceImageUrl,
          duration: fastDuration,
          resolution: fastResolution,
          generate_audio: request.generate_audio !== false,
          webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`
        });
      } else {
        // Seedance 1.5 Pro model
        console.log('🎬 Attempting to create Seedance 1.5 Pro prediction...');

        // Validate duration for Pro model (5-10 seconds)
        const proDuration = Math.max(5, Math.min(10, request.duration || 5)) as SeedanceDuration;
        const proAspectRatio = (request.aspect_ratio || '16:9') as SeedanceAspectRatio;

        prediction = await createSeedancePrediction({
          prompt: request.prompt,
          image: referenceImageUrl,
          last_frame_image: lastFrameImageUrl,
          duration: proDuration,
          aspect_ratio: proAspectRatio,
          seed: request.seed,
          camera_fixed: request.camera_fixed,
          generate_audio: request.generate_audio !== false,
          webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`
        });
      }

      // Validate prediction response
      if (!prediction || !prediction.id) {
        throw new Error('Invalid prediction response: missing prediction ID');
      }

      console.log(`✅ ${modelVersion} prediction created successfully:`, prediction.id);
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
    const effectiveDuration = model === 'fast' ? (request.duration || 6) : Math.max(5, Math.min(10, request.duration || 5));
    const effectiveResolution = model === 'fast' ? (request.resolution || '1080p') : '720p';

    try {
      await createPredictionRecord({
        prediction_id: prediction.id,
        user_id: request.user_id,
        tool_id: 'ai-cinematographer',
        service_id: 'replicate',
        model_version: modelVersion,
        status: 'planning',
        input_data: {
          prompt: request.prompt,
          model,
          duration: effectiveDuration,
          resolution: effectiveResolution,
          generate_audio: request.generate_audio !== false,
          reference_image: referenceImageUrl,
          ...(model === 'pro' && {
            aspect_ratio: request.aspect_ratio || '16:9',
            last_frame_image: lastFrameImageUrl,
            seed: request.seed,
            camera_fixed: request.camera_fixed,
          })
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
      project_name: `${model === 'pro' ? 'Pro' : 'Fast'} Video - ${new Date().toISOString()}`,
      batch_id,
      duration: effectiveDuration,
      resolution: effectiveResolution,
      settings: {
        prediction_id: prediction.id,
        model,
        reference_image: referenceImageUrl,
        generation_params: {
          model,
          duration: effectiveDuration,
          resolution: effectiveResolution,
          generate_audio: request.generate_audio !== false,
          ...(model === 'pro' && {
            aspect_ratio: request.aspect_ratio || '16:9',
            last_frame_image: lastFrameImageUrl,
            seed: request.seed,
            camera_fixed: request.camera_fixed,
          })
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
      { batch_id, video_concept: request.prompt, workflow: 'generate', model } as Json
    );

    if (!creditDeduction.success) {
      console.warn('Credit deduction failed:', creditDeduction.error);
      // Continue anyway - don't fail the generation
    }

    // Record metrics
    await recordCinematographerMetrics({
      user_id: request.user_id,
      batch_id,
      model_version: modelVersion,
      video_concept: request.prompt,
      duration: effectiveDuration,
      resolution: effectiveResolution,
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
        duration: effectiveDuration,
        resolution: effectiveResolution,
        prompt: request.prompt,
        created_at: new Date().toISOString(),
      },
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: creditCost,
      remaining_credits: creditDeduction.remainingCredits || 0,
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
 *
 * Fast Mode (LTX-2-Fast) pricing:
 * - 1080p: 1 credit/second (100 x 6s videos with 600 credits)
 * - 2k: 2 credits/second
 * - 4k: 4 credits/second
 *
 * Pro Mode (Seedance 1.5 Pro) pricing:
 * - 720p: 2 credits/second (2x Fast mode)
 */
function calculateCinematographerCreditCost(request: CinematographerRequest) {
  let baseCost = 0;
  const model = request.model || 'fast';

  if (request.workflow_intent === 'generate') {
    // Pro model: 5-10 seconds, Fast model: 6-20 seconds
    const duration = request.duration || (model === 'fast' ? 6 : 5);
    const resolution = request.resolution || (model === 'fast' ? '1080p' : '720p');

    if (model === 'fast') {
      // Fast mode: 1/2/4 credits per second based on resolution
      const creditsPerSecond = resolution === '4k' ? 4 : resolution === '2k' ? 2 : 1;
      baseCost = duration * creditsPerSecond;
    } else {
      // Pro mode: 2 credits/sec
      baseCost = duration * 2;
    }

  } else if (request.workflow_intent === 'audio_add') {
    baseCost = 4; // Audio integration cost
  }

  const total = baseCost;

  return {
    base: baseCost,
    model,
    duration_seconds: request.duration || (model === 'fast' ? 6 : 5),
    resolution: request.resolution || (model === 'fast' ? '1080p' : '720p'),
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

    // Step 3: Download from Replicate and re-upload to Supabase for permanent storage
    let permanentImageUrl = imageResult.imageUrl;

    try {
      console.log('📸 Re-uploading Starting Shot to Supabase storage...');
      const uploadResult = await downloadAndUploadImage(
        imageResult.imageUrl,
        'starting-shot',
        batch_id,
        {
          bucket: 'images',
          folder: 'starting-shots',
          contentType: 'image/jpeg',
        }
      );

      if (uploadResult.success && uploadResult.url) {
        permanentImageUrl = uploadResult.url;
        console.log(`✅ Starting Shot saved to Supabase: ${permanentImageUrl}`);
      } else {
        console.warn('Failed to re-upload Starting Shot, using Replicate URL:', uploadResult.error);
      }
    } catch (uploadError) {
      console.error('Error re-uploading Starting Shot:', uploadError);
      // Continue with Replicate URL as fallback
    }

    // Step 4: Store result in database
    const storeResult = await storeStartingShotResult({
      user_id: request.user_id,
      batch_id,
      prompt: request.prompt,
      image_url: permanentImageUrl,
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
        image_url: permanentImageUrl,
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

// ============================================================================
// STORYBOARD - 3x3 Grid Generation & Frame Extraction
// ============================================================================

// Visual style labels for prompt construction
const VISUAL_STYLE_PROMPTS: Record<string, string> = {
  cinematic_realism: 'photorealistic, cinematic lighting, film-quality',
  film_noir: 'high contrast black and white, dramatic shadows, film noir aesthetic',
  sci_fi: 'futuristic, neon lighting, cyberpunk aesthetic, sci-fi',
  fantasy_epic: 'epic fantasy, dramatic lighting, magical atmosphere',
  documentary: 'documentary style, natural lighting, candid feel',
  custom: '', // Will use custom_style from request
};

// Request/Response types for Storyboard
export interface StoryboardRequest {
  story_description: string;
  visual_style: string;
  custom_style?: string;
  aspect_ratio?: '16:9' | '9:16';
  reference_image_files?: File[];
  reference_image_urls?: string[];
  user_id: string;
}

export interface StoryboardResponse {
  success: boolean;
  storyboard?: {
    id: string;
    grid_image_url: string;
    prompt: string;
    visual_style: string;
    frame_aspect_ratio: '16:9' | '9:16';
    created_at: string;
  };
  batch_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  error?: string;
}

export interface FrameExtractionRequest {
  storyboard_id: string;
  grid_image_url: string;
  frame_numbers: number[]; // 1-9
  user_id: string;
}

export interface ExtractedFrame {
  id: string;
  frame_number: number;
  image_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface FrameExtractionResponse {
  success: boolean;
  frames: ExtractedFrame[];
  batch_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  error?: string;
}

/**
 * Generate Storyboard - 3x3 Cinematic Grid
 * Uses google/nano-banana-pro for higher quality image generation
 * Cost: 6 credits per storyboard grid
 */
export async function executeStoryboardGeneration(
  request: StoryboardRequest
): Promise<StoryboardResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  const CREDIT_COST = 6; // 6 credits for Nano Banana Pro grid generation

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

    console.log(`📊 Storyboard - Credits validated: ${creditCheck.credits} available`);

    // Step 2: Upload reference images if provided as files
    let referenceImageUrls: string[] = request.reference_image_urls || [];

    if (request.reference_image_files && request.reference_image_files.length > 0) {
      console.log(`📊 Uploading ${request.reference_image_files.length} reference image(s)...`);

      for (const file of request.reference_image_files) {
        try {
          const fileExtension = file.name.split('.').pop() || 'jpg';
          const safeFilename = `storyboard_ref_${batch_id}_${Date.now()}.${fileExtension}`;

          const uploadResult = await uploadImageToStorage(file, {
            bucket: 'images',
            folder: 'storyboard-references',
            filename: safeFilename,
            contentType: file.type || 'image/jpeg',
          });

          if (uploadResult.success && uploadResult.url) {
            referenceImageUrls.push(uploadResult.url);
            console.log('📸 Reference image uploaded:', uploadResult.url);
          }
        } catch (error) {
          console.error('Failed to upload reference image:', error);
        }
      }
    }

    // Step 3: Construct the storyboard prompt (VERSION 4 - 3x3 Grid for better quality)
    // 3x3 at 4K = 1280x720 per frame, much better source quality for upscaling
    const visualStylePrompt = request.visual_style === 'custom'
      ? request.custom_style || ''
      : VISUAL_STYLE_PROMPTS[request.visual_style] || VISUAL_STYLE_PROMPTS.cinematic_realism;

    // Frame aspect ratio - defaults to 16:9 if not specified
    const frameAspectRatio = request.aspect_ratio || '16:9';
    const isVertical = frameAspectRatio === '9:16';

    // For vertical frames, we generate the entire grid in portrait orientation (9:16)
    // This way the 3x3 grid contains 9 vertical frames that can be extracted correctly
    // For landscape, we keep the 16:9 grid with 16:9 frames inside
    const gridAspectRatio = isVertical ? '9:16' : '16:9';
    const frameOrientationDescription = isVertical
      ? '9:16 vertical/portrait orientation (tall frames, like TikTok/Reels/Shorts)'
      : '16:9 landscape/horizontal orientation (wide frames, like YouTube/TV)';

    const storyboardPrompt = `Create a 3x3 cinematic storyboard grid (3 columns, 3 rows = 9 frames).

CRITICAL: NO gaps, NO borders, NO black bars between frames. All frames must touch edge-to-edge in a seamless grid.

Each individual frame within the grid must be ${frameOrientationDescription}. NO TEXT OR DIALOGUE ON ANY FRAME.

${request.story_description}

STYLE: ${visualStylePrompt}, consistent characters throughout all frames, seamless edge-to-edge grid, NO borders between frames.`;

    console.log(`📊 Generating storyboard (${gridAspectRatio} grid, ${frameAspectRatio} frames) with prompt length: ${storyboardPrompt.length}`);

    // Step 4: Generate image using nano-banana-pro for higher quality storyboard grids
    // Grid aspect ratio matches frame aspect ratio: 16:9 grid for landscape, 9:16 grid for vertical
    const hasReferenceImages = referenceImageUrls.length > 0;
    const imageResult = await generateImageWithPro(
      storyboardPrompt,
      gridAspectRatio, // Grid orientation matches frame orientation
      hasReferenceImages ? referenceImageUrls : undefined,
      '4K', // 4K resolution for grid extraction
      'jpg' // JPG format
    );

    if (!imageResult.success || !imageResult.imageUrl) {
      return {
        success: false,
        error: imageResult.error || 'Storyboard generation failed',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: creditCheck.credits || 0,
      };
    }

    console.log(`✅ Storyboard generated successfully: ${imageResult.imageUrl}`);

    // Step 5: Re-upload to Supabase for permanent storage
    let permanentImageUrl = imageResult.imageUrl;

    try {
      console.log('📊 Re-uploading storyboard to Supabase storage...');
      const uploadResult = await downloadAndUploadImage(
        imageResult.imageUrl,
        'storyboard-grid',
        batch_id,
        {
          bucket: 'images',
          folder: 'storyboards',
          contentType: 'image/jpeg',
        }
      );

      if (uploadResult.success && uploadResult.url) {
        permanentImageUrl = uploadResult.url;
        console.log(`✅ Storyboard saved to Supabase: ${permanentImageUrl}`);
      } else {
        console.warn('Failed to re-upload storyboard, using Replicate URL:', uploadResult.error);
      }
    } catch (uploadError) {
      console.error('Error re-uploading storyboard:', uploadError);
    }

    // Step 6: Store result in database (using the same pattern as Starting Shot)
    // Note: We store storyboards as starting shots since they use the same table structure
    // The type is differentiated by project_name prefix
    const storeResult = await storeStartingShotResult({
      user_id: request.user_id,
      batch_id,
      prompt: `[STORYBOARD] ${request.story_description} | Style: ${request.visual_style}${request.custom_style ? ` | Custom: ${request.custom_style}` : ''}`,
      image_url: permanentImageUrl,
      aspect_ratio: '1:1',
    });

    if (!storeResult.success) {
      console.error('Failed to store storyboard result:', storeResult.error);
    }

    // Step 7: Deduct credits
    const creditDeduction = await deductCredits(
      request.user_id,
      CREDIT_COST,
      'storyboard-generation',
      { batch_id, prompt: request.story_description, visual_style: request.visual_style } as Json
    );

    if (!creditDeduction.success) {
      console.warn('Credit deduction failed:', creditDeduction.error);
    }

    return {
      success: true,
      storyboard: {
        id: batch_id,
        grid_image_url: permanentImageUrl,
        prompt: request.story_description,
        visual_style: request.visual_style,
        frame_aspect_ratio: frameAspectRatio as '16:9' | '9:16',
        created_at: new Date().toISOString(),
      },
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: CREDIT_COST,
      remaining_credits: creditDeduction.remainingCredits || (creditCheck.credits || 0) - CREDIT_COST,
    };

  } catch (error) {
    console.error('Storyboard generation error:', error);
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

/**
 * Extract Individual Frame from Storyboard Grid
 * Sends each frame to Nano-Banana Pro for high-res extraction
 * Cost: 3 credits per frame (using Pro model for reliable extraction)
 */
export async function executeFrameExtraction(
  request: FrameExtractionRequest
): Promise<FrameExtractionResponse> {
  const startTime = Date.now();
  const batch_id = crypto.randomUUID();
  const CREDIT_PER_FRAME = 3; // Pro model costs 3 credits
  const totalCreditCost = request.frame_numbers.length * CREDIT_PER_FRAME;

  try {
    // Step 1: Credit Validation
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      return {
        success: false,
        frames: [],
        error: 'Unable to verify credit balance',
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    if ((creditCheck.credits || 0) < totalCreditCost) {
      return {
        success: false,
        frames: [],
        error: `Insufficient credits. Required: ${totalCreditCost}, Available: ${creditCheck.credits || 0}`,
        batch_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: creditCheck.credits || 0,
      };
    }

    console.log(`🎞️ Frame Extraction - Credits validated: ${creditCheck.credits} available, extracting ${request.frame_numbers.length} frames`);

    const extractedFrames: ExtractedFrame[] = [];
    let creditsUsed = 0;

    // Frame position mapping (1-9 to row/column)
    const getFramePosition = (frameNum: number) => {
      const row = Math.ceil(frameNum / 3);
      const col = ((frameNum - 1) % 3) + 1;
      return { row, col };
    };

    // Process frames sequentially
    for (const frameNum of request.frame_numbers) {
      // Generate a proper UUID for each frame (database requires UUID format)
      const frameId = crypto.randomUUID();
      const { row, col } = getFramePosition(frameNum);

      try {
        console.log(`🎞️ Extracting frame ${frameNum} (row ${row}, column ${col}) using Pro model...`);

        // Simple extraction prompt for Pro model
        const extractPrompt = `Crop out frame in row ${row}, column ${col}. Return only that frame, high quality.`;

        // Use Pro model for reliable extraction
        const imageResult = await generateImageWithPro(
          extractPrompt,
          '16:9', // Standard video aspect ratio for extracted frames
          [request.grid_image_url], // Use the grid as reference
          '2K', // 2K resolution
          'jpg' // JPG format
        );

        if (imageResult.success && imageResult.imageUrl) {
          // Re-upload to Supabase
          let permanentUrl = imageResult.imageUrl;
          try {
            const uploadResult = await downloadAndUploadImage(
              imageResult.imageUrl,
              'storyboard-frame',
              frameId,
              {
                bucket: 'images',
                folder: 'storyboard-frames',
                contentType: 'image/jpeg',
              }
            );

            if (uploadResult.success && uploadResult.url) {
              permanentUrl = uploadResult.url;
            }
          } catch (uploadError) {
            console.error(`Failed to re-upload frame ${frameNum}:`, uploadError);
          }

          extractedFrames.push({
            id: frameId,
            frame_number: frameNum,
            image_url: permanentUrl,
            status: 'completed',
          });

          // Save extracted frame to history (as starting shot type for consistency)
          try {
            await storeStartingShotResult({
              user_id: request.user_id,
              batch_id: frameId,
              prompt: `[STORYBOARD FRAME ${frameNum}] Extracted from storyboard ${request.storyboard_id}`,
              image_url: permanentUrl,
              aspect_ratio: '16:9',
            });
            console.log(`📦 Frame ${frameNum} saved to history`);
          } catch (storeError) {
            console.error(`Failed to save frame ${frameNum} to history:`, storeError);
          }

          // Deduct credit for this frame
          await deductCredits(
            request.user_id,
            CREDIT_PER_FRAME,
            'storyboard-frame-extraction',
            { batch_id, frame_number: frameNum, storyboard_id: request.storyboard_id } as Json
          );
          creditsUsed += CREDIT_PER_FRAME;

          console.log(`✅ Frame ${frameNum} extracted successfully`);
        } else {
          extractedFrames.push({
            id: frameId,
            frame_number: frameNum,
            image_url: '',
            status: 'failed',
            error: imageResult.error || 'Extraction failed',
          });
          console.error(`❌ Frame ${frameNum} extraction failed:`, imageResult.error);
        }
      } catch (error) {
        extractedFrames.push({
          id: frameId,
          frame_number: frameNum,
          image_url: '',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`❌ Frame ${frameNum} extraction error:`, error);
      }
    }

    const remainingCredits = (creditCheck.credits || 0) - creditsUsed;

    return {
      success: extractedFrames.some(f => f.status === 'completed'),
      frames: extractedFrames,
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: creditsUsed,
      remaining_credits: remainingCredits,
    };

  } catch (error) {
    console.error('Frame extraction error:', error);
    return {
      success: false,
      frames: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      batch_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

// ============================================================================
// GRID IMAGE UPLOAD - For extracting frames from user-uploaded grids
// ============================================================================

export interface UploadGridImageResponse {
  success: boolean;
  grid_image_url?: string;
  grid_id?: string;
  error?: string;
}

/**
 * Upload a grid image to Supabase storage for frame extraction
 * This allows users to upload their own 3x3 grid images
 */
export async function uploadGridImageToStorage(
  file: File,
  _userId: string
): Promise<UploadGridImageResponse> {
  try {
    const gridId = `uploaded_grid_${Date.now()}`;
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const safeFilename = `${gridId}.${fileExtension}`;

    console.log(`📤 Uploading grid image: ${safeFilename}`);

    const uploadResult = await uploadImageToStorage(file, {
      bucket: 'images',
      folder: 'storyboard-grids',
      filename: safeFilename,
      contentType: file.type || 'image/jpeg',
    });

    if (!uploadResult.success || !uploadResult.url) {
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload grid image',
      };
    }

    console.log(`✅ Grid image uploaded: ${uploadResult.url}`);

    return {
      success: true,
      grid_image_url: uploadResult.url,
      grid_id: gridId,
    };
  } catch (error) {
    console.error('uploadGridImageToStorage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload grid image',
    };
  }
}