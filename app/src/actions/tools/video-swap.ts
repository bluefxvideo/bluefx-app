'use server';

import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  submitKlingMotionControl,
  getKlingMotionControlStatus,
  getKlingMotionControlResult,
} from '@/actions/models/fal-kling-motion-control';
import {
  createVideoSwapJob,
  updateVideoSwapJob,
  getUserCredits,
  deductCredits,
} from '@/actions/database/video-swap-database';
import { refundFailedGeneration } from '@/lib/credits/refund';
import { finalizeVideoSwap, failVideoSwap } from '@/lib/video-swap/finalize';
import {
  VIDEO_SWAP_MAX_SECONDS,
  videoSwapCredits,
  type VideoSwapOrientation,
} from '@/lib/video-swap/pricing';
import { Json } from '@/types/database';
import { createClient } from '@/app/supabase/server';

const execFileAsync = promisify(execFile);

/** The signed-in user's id; every entry point below trusts the session, not the caller. */
async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
const PROVIDER = 'fal-kling-2.6-pro-motion-control';

/** Length of a hosted video in seconds; ffprobe reads http(s) sources directly. */
async function probeRemoteDuration(url: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    url,
  ], { timeout: 60_000 });
  const duration = parseFloat(stdout.trim());
  if (!duration || Number.isNaN(duration)) {
    throw new Error('Could not read the video length (is this a valid video file?)');
  }
  return duration;
}

/**
 * Request types for Video Swap
 * Now accepts URLs instead of Files (files uploaded via API route first)
 */
export interface VideoSwapRequest {
  source_video_url: string;
  character_image_url: string;
  /** 'video' follows the reference video (complex motion, up to 30 s); 'image' follows the image (camera moves, up to 10 s). */
  character_orientation: VideoSwapOrientation;
  keep_original_sound: boolean;
  prompt?: string;
  /** Ignored: the user comes from the session. Kept so older callers still type-check. */
  user_id?: string;
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
 * Execute Video Swap.
 *
 * 1. Measure the source clip and check it against fal's length limit for
 *    the chosen orientation.
 * 2. Price it (8 credits per second, rounded up) and check the balance.
 * 3. Create the job row, then charge with the row id in the ledger so a
 *    failure can be refunded against it.
 * 4. Submit to Kling motion control on fal with the webhook; the webhook
 *    (or the status poller) finishes the job minutes later.
 *
 * Files are uploaded by /api/upload/video-swap first; this takes URLs.
 */
export async function executeVideoSwap(
  request: VideoSwapRequest
): Promise<VideoSwapResponse> {
  const startTime = Date.now();
  const fail = (error: string, extra: Partial<VideoSwapResponse> = {}): VideoSwapResponse => ({
    success: false,
    error,
    job_id: extra.job_id || '',
    generation_time_ms: Date.now() - startTime,
    credits_used: extra.credits_used || 0,
    remaining_credits: extra.remaining_credits || 0,
  });

  try {
    const userId = await currentUserId();
    if (!userId) return fail('You must be signed in.');
    if (!request.source_video_url) return fail('Source video URL is required');
    if (!request.character_image_url) return fail('Character image URL is required');
    const orientation: VideoSwapOrientation = request.character_orientation === 'image' ? 'image' : 'video';

    // Step 1: length check against fal's limit for this orientation
    let duration: number;
    try {
      duration = await probeRemoteDuration(request.source_video_url);
    } catch (probeError) {
      return fail(probeError instanceof Error ? probeError.message : 'Could not read the video');
    }
    const maxSeconds = VIDEO_SWAP_MAX_SECONDS[orientation];
    if (duration > maxSeconds + 0.5) {
      return fail(
        `This clip is ${duration.toFixed(1)} s. ${orientation === 'image' ? 'Following the image' : 'Following the video'} allows up to ${maxSeconds} s.`
      );
    }

    // Step 2: price + balance
    const credits = videoSwapCredits(duration);
    const creditCheck = await getUserCredits(userId);
    if (!creditCheck.success) return fail('Unable to verify credit balance');
    if ((creditCheck.credits || 0) < credits) {
      return fail(`Insufficient credits. Required: ${credits}, Available: ${creditCheck.credits || 0}`, {
        remaining_credits: creditCheck.credits || 0,
      });
    }

    // Step 3: job row first, then the charge references it
    const jobResult = await createVideoSwapJob({
      user_id: userId,
      source_video_url: request.source_video_url,
      character_image_url: request.character_image_url,
      merge_audio: request.keep_original_sound,
      credits_used: credits,
      processing_provider: PROVIDER,
      duration_seconds: Math.round(duration * 100) / 100,
      metadata: {
        character_orientation: orientation,
        keep_original_sound: request.keep_original_sound,
        prompt: request.prompt?.trim() || null,
        engine: 'fal-ai/kling-video/v2.6/pro/motion-control',
      } as Json,
    });
    if (!jobResult.success || !jobResult.job) {
      return fail(`Failed to create job record: ${jobResult.error}`);
    }
    const job = jobResult.job;

    const deductResult = await deductCredits(userId, credits, 'video-swap', {
      job_id: job.id,
      seconds: Math.ceil(duration),
      character_orientation: orientation,
    } as Json);
    if (!deductResult.success) {
      await updateVideoSwapJob(job.id, { status: 'failed', error_message: deductResult.error || 'Credit deduction failed' });
      return fail(`Failed to deduct credits: ${deductResult.error}`, { job_id: job.id, remaining_credits: creditCheck.credits || 0 });
    }
    console.log(`💳 Video Swap: ${credits} credits for ${duration.toFixed(1)} s (job ${job.id}). Remaining: ${deductResult.remainingCredits}`);

    // Step 4: submit to fal with the webhook
    await updateVideoSwapJob(job.id, { status: 'processing' });
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.bluefx.net'}/api/webhooks/fal-ai`;
    const submitted = await submitKlingMotionControl({
      image_url: request.character_image_url,
      video_url: request.source_video_url,
      character_orientation: orientation,
      keep_original_sound: request.keep_original_sound,
      prompt: request.prompt,
      webhook_url: webhookUrl,
    });

    if (!submitted.success || !submitted.request_id) {
      const refund = await refundFailedGeneration({
        userId,
        referenceIds: [job.id],
        operation: 'video swap',
      });
      const message = `${submitted.error || 'Video swap submit failed'}${refund.refunded ? ` — ${refund.amount} credits were refunded.` : ''}`;
      await updateVideoSwapJob(job.id, { status: 'failed', error_message: message });
      return fail(message, {
        job_id: job.id,
        credits_used: refund.refunded ? 0 : credits,
        remaining_credits: (deductResult.remainingCredits || 0) + (refund.refunded ? credits : 0),
      });
    }

    await updateVideoSwapJob(job.id, { external_job_id: submitted.request_id, status: 'processing' });
    console.log('✅ Video Swap: submitted', { job_id: job.id, request_id: submitted.request_id });

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
      credits_used: credits,
      remaining_credits: deductResult.remainingCredits || 0,
    };
  } catch (error) {
    console.error('Video Swap execution error:', error);
    return fail(error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

/**
 * Get video swap job status
 */
export async function getVideoSwapStatus(
  jobId: string,
  _userId?: string
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
    const userId = await currentUserId();
    if (!userId) return { success: false, error: 'You must be signed in.' };
    const { getVideoSwapJob } = await import('@/actions/database/video-swap-database');
    let job = await getVideoSwapJob(jobId, userId);

    if (!job) {
      return {
        success: false,
        error: 'Job not found',
      };
    }

    // Webhooks can be missed; when the row still says processing, ask fal
    // directly and finish or fail the job here (idempotent with the webhook).
    if (job.status === 'processing' && job.external_job_id && job.processing_provider === PROVIDER) {
      const queue = await getKlingMotionControlStatus(job.external_job_id);
      if (queue.success && queue.status === 'COMPLETED') {
        const result = await getKlingMotionControlResult(job.external_job_id);
        if (result.success && result.videoUrl) {
          await finalizeVideoSwap(job.external_job_id, result.videoUrl);
        } else {
          await failVideoSwap(job.external_job_id, result.error);
        }
        job = (await getVideoSwapJob(jobId, userId)) || job;
      }
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
  _userId?: string,
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
    const userId = await currentUserId();
    if (!userId) return { success: false, error: 'You must be signed in.' };
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
  _userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await currentUserId();
    if (!userId) return { success: false, error: 'You must be signed in.' };
    const { getVideoSwapJob, updateVideoSwapJob } = await import('@/actions/database/video-swap-database');
    const { cancelKlingMotionControl } = await import('@/actions/models/fal-kling-motion-control');

    const job = await getVideoSwapJob(jobId, userId);

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.status !== 'processing') {
      return { success: false, error: 'Job is not in a cancellable state' };
    }

    // Ask fal to cancel; a run already in progress still finishes on fal's
    // side, but the job is closed here and the credits go back either way.
    if (job.external_job_id) {
      const cancelled = await cancelKlingMotionControl(job.external_job_id);
      if (!cancelled.success) console.warn('Video Swap: fal cancel refused:', cancelled.error);
      const closed = await failVideoSwap(job.external_job_id, 'Cancelled by you');
      if (closed.handled) return { success: true };
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
