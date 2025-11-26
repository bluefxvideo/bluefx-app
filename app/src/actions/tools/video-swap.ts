'use server';

import { performVideoSwap } from '@/actions/models/wan-video-swap';
import {
  createVideoSwapJob,
  updateVideoSwapJob,
  getUserCredits,
  deductCredits,
  recordVideoSwapMetrics,
} from '@/actions/database/video-swap-database';
import { Json } from '@/types/database';

// Credits cost for video swap
const VIDEO_SWAP_CREDITS = 25;

/**
 * Request types for Video Swap
 * Now accepts URLs instead of Files (files uploaded via API route first)
 */
export interface VideoSwapRequest {
  source_video_url: string;
  character_image_url: string;
  resolution?: '480' | '720';
  frames_per_second?: number;
  merge_audio?: boolean;
  go_fast?: boolean;
  refert_num?: 1 | 5;
  seed?: number;
  user_id: string;
}

export interface VideoSwapResponse {
  success: boolean;
  job?: {
    id: string;
    status: string;
    source_video_url: string;
    character_image_url: string;
    result_video_url?: string;
    created_at: string;
  };
  job_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  warnings?: string[];
  error?: string;
}

/**
 * Validate video file
 */
function validateVideo(file: File): { valid: boolean; error?: string } {
  const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
  const maxSize = 100 * 1024 * 1024; // 100MB

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid video format. Supported: MP4, MOV, WebM. Got: ${file.type}`
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Video file too large. Maximum: 100MB. Got: ${(file.size / 1024 / 1024).toFixed(1)}MB`
    };
  }

  return { valid: true };
}

/**
 * Validate image file
 */
function validateImage(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid image format. Supported: JPEG, PNG, WebP, GIF. Got: ${file.type}`
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Image file too large. Maximum: 10MB. Got: ${(file.size / 1024 / 1024).toFixed(1)}MB`
    };
  }

  return { valid: true };
}

/**
 * Execute Video Swap - Main orchestrator
 *
 * Workflow:
 * 1. Validate URLs are provided
 * 2. Check user credits
 * 3. Deduct credits
 * 4. Create job record
 * 5. Call Replicate API with webhook
 * 6. Return job ID for tracking
 *
 * Note: File uploads are now handled by the /api/upload/video-swap API route
 * This function receives URLs instead of Files
 */
export async function executeVideoSwap(
  request: VideoSwapRequest
): Promise<VideoSwapResponse> {
  const startTime = Date.now();
  const job_id = crypto.randomUUID();

  try {
    console.log('🎬 Video Swap: Starting execution', {
      job_id,
      user_id: request.user_id,
      source_video_url: request.source_video_url.substring(0, 50) + '...',
      character_image_url: request.character_image_url.substring(0, 50) + '...',
      resolution: request.resolution || '720',
    });

    // Step 1: Validate URLs are provided
    if (!request.source_video_url) {
      return {
        success: false,
        error: 'Source video URL is required',
        job_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    if (!request.character_image_url) {
      return {
        success: false,
        error: 'Character image URL is required',
        job_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Step 2: Credit Validation
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      return {
        success: false,
        error: 'Unable to verify credit balance',
        job_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    if ((creditCheck.credits || 0) < VIDEO_SWAP_CREDITS) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${VIDEO_SWAP_CREDITS}, Available: ${creditCheck.credits || 0}`,
        job_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: creditCheck.credits || 0,
      };
    }

    console.log(`💳 Credits validated: ${creditCheck.credits} available, ${VIDEO_SWAP_CREDITS} required`);

    // Step 3: Deduct credits
    const deductResult = await deductCredits(
      request.user_id,
      VIDEO_SWAP_CREDITS,
      'video-swap',
      {
        job_id,
        resolution: request.resolution || '720',
      } as Json
    );

    if (!deductResult.success) {
      console.error('Credit deduction failed:', deductResult.error);
      return {
        success: false,
        error: `Failed to deduct credits: ${deductResult.error}`,
        job_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: creditCheck.credits || 0,
      };
    }

    console.log(`💳 Credits deducted: ${VIDEO_SWAP_CREDITS}. Remaining: ${deductResult.remainingCredits}`);

    // Step 4: Create job record in database
    const jobResult = await createVideoSwapJob({
      user_id: request.user_id,
      source_video_url: request.source_video_url,
      character_image_url: request.character_image_url,
      resolution: request.resolution || '720',
      frames_per_second: request.frames_per_second || 24,
      merge_audio: request.merge_audio ?? true,
      go_fast: request.go_fast ?? true,
      refert_num: request.refert_num || 1,
      seed: request.seed,
      metadata: {} as Json,
    });

    if (!jobResult.success || !jobResult.job) {
      console.error('Failed to create job record:', jobResult.error);
      return {
        success: false,
        error: `Failed to create job record: ${jobResult.error}`,
        job_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: VIDEO_SWAP_CREDITS,
        remaining_credits: deductResult.remainingCredits || 0,
      };
    }

    const job = jobResult.job;
    console.log('📝 Job record created:', job.id);

    // Step 5: Update job status to processing
    await updateVideoSwapJob(job.id, { status: 'processing' });

    // Step 6: Call Replicate API with webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.bluefx.net'}/api/webhooks/replicate-ai`;

    console.log('🚀 Calling Replicate API...', { webhookUrl });

    try {
      const predictionResult = await performVideoSwap(
        request.source_video_url,
        request.character_image_url,
        {
          resolution: request.resolution || '720',
          frames_per_second: request.frames_per_second || 24,
          merge_audio: request.merge_audio ?? true,
          go_fast: request.go_fast ?? true,
          refert_num: request.refert_num || 1,
          seed: request.seed,
        },
        webhookUrl,
        request.user_id,
        job.id
      );

      // Update job with external prediction ID
      await updateVideoSwapJob(job.id, {
        external_job_id: predictionResult.predictionId,
        status: 'processing',
      });

      console.log('✅ Video Swap: Prediction submitted', {
        job_id: job.id,
        prediction_id: predictionResult.predictionId,
      });

      return {
        success: true,
        job: {
          id: job.id,
          status: 'processing',
          source_video_url: request.source_video_url,
          character_image_url: request.character_image_url,
          created_at: job.created_at || new Date().toISOString(),
        },
        job_id: job.id,
        generation_time_ms: Date.now() - startTime,
        credits_used: VIDEO_SWAP_CREDITS,
        remaining_credits: deductResult.remainingCredits || 0,
      };

    } catch (apiError) {
      console.error('Replicate API call failed:', apiError);

      // Update job status to failed
      await updateVideoSwapJob(job.id, {
        status: 'failed',
        error_message: apiError instanceof Error ? apiError.message : 'API call failed',
      });

      return {
        success: false,
        error: `Video swap API call failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
        job_id: job.id,
        generation_time_ms: Date.now() - startTime,
        credits_used: VIDEO_SWAP_CREDITS,
        remaining_credits: deductResult.remainingCredits || 0,
      };
    }

  } catch (error) {
    console.error('Video Swap execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      job_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Get video swap job status
 */
export async function getVideoSwapStatus(
  jobId: string,
  userId: string
): Promise<{
  success: boolean;
  job?: {
    id: string;
    status: string;
    progress_percentage: number;
    result_video_url?: string | null;
    error_message?: string | null;
  };
  error?: string;
}> {
  try {
    const { getVideoSwapJob } = await import('@/actions/database/video-swap-database');
    const job = await getVideoSwapJob(jobId, userId);

    if (!job) {
      return {
        success: false,
        error: 'Job not found',
      };
    }

    return {
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress_percentage: job.progress_percentage,
        result_video_url: job.result_video_url,
        error_message: job.error_message,
      },
    };

  } catch (error) {
    console.error('getVideoSwapStatus error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job status',
    };
  }
}

/**
 * Get user's video swap history
 */
export async function getVideoSwapHistory(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{
  success: boolean;
  jobs?: Array<{
    id: string;
    status: string;
    source_video_url: string;
    character_image_url: string;
    result_video_url?: string | null;
    thumbnail_url?: string | null;
    created_at: string | null;
  }>;
  total?: number;
  error?: string;
}> {
  try {
    const { getVideoSwapJobs } = await import('@/actions/database/video-swap-database');
    const { jobs, total } = await getVideoSwapJobs(userId, limit, offset);

    return {
      success: true,
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        source_video_url: job.source_video_url,
        character_image_url: job.character_image_url,
        result_video_url: job.result_video_url,
        thumbnail_url: job.thumbnail_url,
        created_at: job.created_at,
      })),
      total,
    };

  } catch (error) {
    console.error('getVideoSwapHistory error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history',
    };
  }
}

/**
 * Cancel a video swap job
 */
export async function cancelVideoSwapJob(
  jobId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getVideoSwapJob, updateVideoSwapJob } = await import('@/actions/database/video-swap-database');
    const { cancelVideoSwapPrediction } = await import('@/actions/models/wan-video-swap');

    const job = await getVideoSwapJob(jobId, userId);

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.status !== 'processing') {
      return { success: false, error: 'Job is not in a cancellable state' };
    }

    // Cancel the Replicate prediction if we have an external job ID
    if (job.external_job_id) {
      try {
        await cancelVideoSwapPrediction(job.external_job_id);
      } catch (cancelError) {
        console.warn('Failed to cancel Replicate prediction:', cancelError);
        // Continue anyway - we'll mark the job as failed
      }
    }

    // Update job status
    await updateVideoSwapJob(jobId, {
      status: 'failed',
      error_message: 'Cancelled by user',
    });

    return { success: true };

  } catch (error) {
    console.error('cancelVideoSwapJob error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job',
    };
  }
}
