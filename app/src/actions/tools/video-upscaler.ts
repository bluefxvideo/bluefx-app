'use server';

import { createVideoUpscalePrediction } from '@/actions/models/video-upscale';
import { getUserCredits, deductCredits } from '@/actions/database/cinematographer-database';
import { Json } from '@/types/database';
import { createAdminClient } from '@/app/supabase/server';

// Credits cost for video upscale (per second of video)
const UPSCALE_CREDITS_PER_SECOND = 1;

/**
 * Video Upscaler Tool
 * Upscale any video from 720p to 1080p or 4K using Topaz Labs AI
 */

export type UpscaleResolution = '1080p' | '4k';

export interface VideoUpscaleRequest {
  video_url: string; // URL of the video to upscale
  video_id?: string; // Optional: ID of the cinematographer video record to update
  target_resolution?: UpscaleResolution;
  target_fps?: 15 | 24 | 30 | 60;
  estimated_duration?: number; // Duration in seconds for credit calculation
  user_id: string;
}

export interface VideoUpscaleResponse {
  success: boolean;
  job?: {
    id: string;
    prediction_id: string;
    status: string;
    video_url: string;
    target_resolution: string;
    created_at: string;
  };
  prediction_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  warnings?: string[];
  error?: string;
}

/**
 * Calculate upscale credits based on video duration and target resolution
 */
function calculateUpscaleCredits(durationSeconds: number, resolution: UpscaleResolution): number {
  // 1080p: 1 credit/second, 4K: 2 credits/second
  const multiplier = resolution === '4k' ? 2 : 1;
  return Math.ceil(durationSeconds * UPSCALE_CREDITS_PER_SECOND * multiplier);
}

/**
 * Execute Video Upscale - Main function
 */
export async function executeVideoUpscale(
  request: VideoUpscaleRequest
): Promise<VideoUpscaleResponse> {
  const startTime = Date.now();
  const prediction_id = `upscale_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  try {
    console.log('🔍 Video Upscaler: Starting upscale process');
    console.log('🔍 Request:', {
      video_url: request.video_url?.substring(0, 50) + '...',
      video_id: request.video_id,
      target_resolution: request.target_resolution,
      target_fps: request.target_fps,
      estimated_duration: request.estimated_duration,
    });

    // Validate required fields
    if (!request.video_url) {
      return {
        success: false,
        error: 'Video URL is required',
        prediction_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    if (!request.user_id) {
      return {
        success: false,
        error: 'User ID is required',
        prediction_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    // Calculate credits needed
    const duration = request.estimated_duration || 10; // Default to 10 seconds if not provided
    const resolution = request.target_resolution || '1080p';
    const creditsNeeded = calculateUpscaleCredits(duration, resolution);

    // Check user credits
    const creditCheck = await getUserCredits(request.user_id);
    if (!creditCheck.success) {
      return {
        success: false,
        error: 'Unable to verify credit balance',
        prediction_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: 0,
      };
    }

    if ((creditCheck.credits || 0) < creditsNeeded) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${creditsNeeded}, Available: ${creditCheck.credits || 0}`,
        prediction_id,
        generation_time_ms: Date.now() - startTime,
        credits_used: 0,
        remaining_credits: creditCheck.credits || 0,
      };
    }

    console.log(`💳 Credits validated: ${creditCheck.credits} available, ${creditsNeeded} required`);

    // Create the upscale prediction
    const upscalePrediction = await createVideoUpscalePrediction({
      video: request.video_url,
      target_resolution: resolution === '4k' ? '4k' : '1080p',
      target_fps: request.target_fps || 30,
      webhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/replicate-ai`,
    });

    if (!upscalePrediction?.id) {
      throw new Error('Failed to create upscale prediction');
    }

    console.log(`✅ Upscale prediction created: ${upscalePrediction.id}`);

    // If video_id is provided, update the cinematographer record
    if (request.video_id) {
      try {
        const supabase = createAdminClient();

        // Get current metadata
        const { data: videoRecord } = await supabase
          .from('cinematographer_videos')
          .select('metadata')
          .eq('id', request.video_id)
          .single();

        const currentMetadata = (videoRecord?.metadata as Record<string, unknown>) || {};
        const generationSettings = (currentMetadata.generation_settings as Record<string, unknown>) || {};

        // Update with upscale info
        await supabase
          .from('cinematographer_videos')
          .update({
            status: 'upscaling',
            progress_percentage: 80,
            ai_director_notes: `Upscaling to ${resolution}...`,
            metadata: {
              ...currentMetadata,
              generation_settings: {
                ...generationSettings,
                upscale_prediction_id: upscalePrediction.id,
                upscale_target_resolution: resolution,
                upscale_started_at: new Date().toISOString(),
              }
            } as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.video_id);

        console.log(`📝 Updated video record ${request.video_id} with upscale status`);
      } catch (dbError) {
        console.error('Failed to update video record:', dbError);
        // Continue anyway - the upscale was started
      }
    }

    // Deduct credits
    const creditDeduction = await deductCredits(
      request.user_id,
      creditsNeeded,
      'video-upscale',
      {
        prediction_id: upscalePrediction.id,
        video_url: request.video_url,
        target_resolution: resolution,
        duration_seconds: duration,
      } as Json
    );

    if (!creditDeduction.success) {
      console.warn('Credit deduction failed:', creditDeduction.error);
      // Continue anyway - upscale was started
    }

    return {
      success: true,
      job: {
        id: prediction_id,
        prediction_id: upscalePrediction.id,
        status: 'processing',
        video_url: request.video_url,
        target_resolution: resolution,
        created_at: new Date().toISOString(),
      },
      prediction_id: upscalePrediction.id,
      generation_time_ms: Date.now() - startTime,
      credits_used: creditsNeeded,
      remaining_credits: creditDeduction.remainingCredits || (creditCheck.credits || 0) - creditsNeeded,
    };

  } catch (error) {
    console.error('Video upscale error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Video upscale failed',
      prediction_id,
      generation_time_ms: Date.now() - startTime,
      credits_used: 0,
      remaining_credits: 0,
    };
  }
}

/**
 * Get upscale job status by checking the cinematographer video record
 */
export async function getUpscaleStatus(
  videoId: string,
  userId: string
): Promise<{
  success: boolean;
  status?: string;
  upscaled_url?: string;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    const { data: video, error } = await supabase
      .from('cinematographer_videos')
      .select('status, final_video_url, metadata')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!video) {
      return { success: false, error: 'Video not found' };
    }

    const metadata = video.metadata as Record<string, unknown> | null;
    const generationSettings = metadata?.generation_settings as Record<string, unknown> | undefined;

    return {
      success: true,
      status: video.status,
      upscaled_url: generationSettings?.upscale_completed ? video.final_video_url : undefined,
    };

  } catch (error) {
    console.error('Get upscale status error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    };
  }
}
