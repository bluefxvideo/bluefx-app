'use server';

import { createClient, createAdminClient } from '@/app/supabase/server';
import { Json } from '@/types/database';

/**
 * Video Swap Job interface
 * Matches the video_swap_jobs table schema
 */
export interface VideoSwapJob {
  id: string;
  user_id: string;
  source_video_url: string;
  character_image_url: string;
  resolution: '480' | '720';
  frames_per_second: number;
  merge_audio: boolean;
  go_fast: boolean;
  refert_num: 1 | 5;
  seed: number | null;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress_percentage: number;
  result_video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  external_job_id: string | null;
  processing_provider: string;
  error_message: string | null;
  credits_used: number;
  metadata: Json | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
}

export type VideoSwapJobInsert = Omit<VideoSwapJob, 'id' | 'created_at' | 'updated_at' | 'completed_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
};

export type VideoSwapJobUpdate = Partial<Omit<VideoSwapJob, 'id' | 'user_id'>>;

// Credits cost for video swap
export const VIDEO_SWAP_CREDITS = 25;

/**
 * Create a new video swap job
 */
export async function createVideoSwapJob(
  params: {
    user_id: string;
    source_video_url: string;
    character_image_url: string;
    resolution?: '480' | '720';
    frames_per_second?: number;
    merge_audio?: boolean;
    go_fast?: boolean;
    refert_num?: 1 | 5;
    seed?: number;
    external_job_id?: string;
    metadata?: Json;
  }
): Promise<{ success: boolean; job?: VideoSwapJob; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: job, error } = await supabase
      .from('video_swap_jobs')
      .insert({
        user_id: params.user_id,
        source_video_url: params.source_video_url,
        character_image_url: params.character_image_url,
        resolution: params.resolution || '720',
        frames_per_second: params.frames_per_second || 24,
        merge_audio: params.merge_audio ?? true,
        go_fast: params.go_fast ?? true,
        refert_num: params.refert_num || 1,
        seed: params.seed || null,
        status: 'pending',
        progress_percentage: 0,
        external_job_id: params.external_job_id || null,
        processing_provider: 'replicate',
        credits_used: VIDEO_SWAP_CREDITS,
        metadata: params.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating video swap job:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Video swap job created: ${job.id}`);
    return { success: true, job };

  } catch (error) {
    console.error('createVideoSwapJob error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create video swap job'
    };
  }
}

/**
 * Get all video swap jobs for a user
 */
export async function getVideoSwapJobs(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ jobs: VideoSwapJob[]; total: number }> {
  const supabase = await createClient();

  const { data: jobs, error, count } = await supabase
    .from('video_swap_jobs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching video swap jobs:', error);
    throw new Error('Failed to fetch video swap jobs');
  }

  return {
    jobs: (jobs || []) as VideoSwapJob[],
    total: count || 0
  };
}

/**
 * Get a specific video swap job by ID
 */
export async function getVideoSwapJob(
  jobId: string,
  userId: string
): Promise<VideoSwapJob | null> {
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from('video_swap_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Job not found
    }
    console.error('Error fetching video swap job:', error);
    throw new Error('Failed to fetch video swap job');
  }

  return job as VideoSwapJob;
}

/**
 * Update a video swap job
 */
export async function updateVideoSwapJob(
  jobId: string,
  updates: VideoSwapJobUpdate
): Promise<VideoSwapJob> {
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from('video_swap_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error) {
    console.error('Error updating video swap job:', error);
    throw new Error('Failed to update video swap job');
  }

  return job as VideoSwapJob;
}

/**
 * Update a video swap job (Admin version for webhooks)
 * Uses admin client to bypass RLS policies
 */
export async function updateVideoSwapJobAdmin(
  jobId: string,
  updates: VideoSwapJobUpdate
): Promise<VideoSwapJob> {
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from('video_swap_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error) {
    console.error('Error updating video swap job (admin):', error);
    throw new Error('Failed to update video swap job');
  }

  return job as VideoSwapJob;
}

/**
 * Update video swap job by external job ID (Replicate prediction ID)
 * Used by webhooks
 */
export async function updateVideoSwapJobByExternalId(
  externalJobId: string,
  updates: VideoSwapJobUpdate
): Promise<VideoSwapJob | null> {
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from('video_swap_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('external_job_id', externalJobId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Job not found
    }
    console.error('Error updating video swap job by external ID:', error);
    throw new Error('Failed to update video swap job');
  }

  return job as VideoSwapJob;
}

/**
 * Get video swap job by external job ID (Replicate prediction ID)
 */
export async function getVideoSwapJobByExternalId(
  externalJobId: string
): Promise<VideoSwapJob | null> {
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from('video_swap_jobs')
    .select('*')
    .eq('external_job_id', externalJobId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Job not found
    }
    console.error('Error fetching video swap job by external ID:', error);
    throw new Error('Failed to fetch video swap job');
  }

  return job as VideoSwapJob;
}

/**
 * Delete a video swap job
 */
export async function deleteVideoSwapJob(
  jobId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Verify ownership
  const { data: job } = await supabase
    .from('video_swap_jobs')
    .select('user_id')
    .eq('id', jobId)
    .single();

  if (!job || job.user_id !== userId) {
    throw new Error('Unauthorized to delete this job');
  }

  const { error } = await supabase
    .from('video_swap_jobs')
    .delete()
    .eq('id', jobId);

  if (error) {
    console.error('Error deleting video swap job:', error);
    throw new Error('Failed to delete video swap job');
  }

  return true;
}

/**
 * Get video swap jobs by status (for monitoring)
 */
export async function getVideoSwapJobsByStatus(
  status: VideoSwapJob['status'],
  limit: number = 100
): Promise<VideoSwapJob[]> {
  const supabase = createAdminClient();

  const { data: jobs, error } = await supabase
    .from('video_swap_jobs')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching video swap jobs by status:', error);
    throw new Error('Failed to fetch video swap jobs by status');
  }

  return (jobs || []) as VideoSwapJob[];
}

/**
 * Get user credits
 */
export async function getUserCredits(
  user_id: string
): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', user_id)
      .single();

    if (error && error.code === 'PGRST116') {
      // User not found in credits table - will auto-topup on first use
      console.log(`User ${user_id} not found in credits table`);
      return { success: true, credits: 0 };
    }

    if (error) {
      console.error('Error getting user credits:', error);
      return { success: false, error: error.message };
    }

    return { success: true, credits: data?.available_credits || 0 };

  } catch (error) {
    console.error('getUserCredits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user credits'
    };
  }
}

/**
 * Deduct credits for video swap operation
 * Uses Supabase RPC function for atomic credit deduction
 */
export async function deductCredits(
  user_id: string,
  amount: number,
  operation: string,
  metadata?: Json
): Promise<{ success: boolean; remainingCredits?: number; error?: string }> {
  try {
    const supabase = await createClient();

    // First check if user has enough credits
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('available_credits, period_end')
      .eq('user_id', user_id)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      console.error('Credits check error:', creditsError);
      return {
        success: false,
        error: `Failed to check credits: ${creditsError.message}`,
      };
    }

    // If no credits record or available credits < required amount or period expired, top up first
    const needsTopup = !credits ||
                      (credits.available_credits < amount) ||
                      (new Date(credits.period_end) < new Date());

    if (needsTopup) {
      console.log(`Auto top-up needed for user ${user_id}. Current credits: ${credits?.available_credits || 0}`);

      // Top up to 600 credits using RPC function
      const { data: topupData, error: topupError } = await supabase
        .rpc('topup_user_credits', {
          p_user_id: user_id,
          p_target_credits: 600
        });

      if (topupError || !topupData?.success) {
        console.error('Auto top-up failed:', topupError);
        return {
          success: false,
          error: `Auto top-up failed: ${topupError?.message || 'Unknown error'}`,
        };
      }

      console.log(`Auto top-up successful. New available credits: ${topupData.available_credits}`);
    }

    // Now proceed with credit deduction using RPC function
    const { data, error } = await supabase
      .rpc('deduct_user_credits', {
        p_user_id: user_id,
        p_amount: amount,
        p_operation: operation,
        p_metadata: metadata
      });

    if (error) {
      console.error('Credit deduction RPC error:', error);
      return {
        success: false,
        error: `Failed to deduct credits: ${error.message}`,
      };
    }

    // Check the result from the RPC function
    if (!data || !data.success) {
      return {
        success: false,
        error: data?.error || 'Credit deduction failed',
      };
    }

    console.log(`💳 Deducted ${amount} credits from user ${user_id}. Remaining: ${data.remaining_credits}`);

    return {
      success: true,
      remainingCredits: data.remaining_credits,
    };

  } catch (error) {
    console.error('deductCredits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deduct credits',
    };
  }
}

/**
 * Record video swap metrics for analytics
 */
export async function recordVideoSwapMetrics(params: {
  user_id: string;
  job_id: string;
  resolution: string;
  duration_seconds: number;
  generation_time_ms: number;
  credits_used: number;
}): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase
      .from('credit_usage')
      .insert({
        user_id: params.user_id,
        service_type: 'video-swap',
        credits_used: params.credits_used,
        metadata: {
          job_id: params.job_id,
          resolution: params.resolution,
          duration_seconds: params.duration_seconds,
          generation_time_ms: params.generation_time_ms,
        } as Json,
        created_at: new Date().toISOString()
      });

    console.log(`📊 Video swap metrics recorded for job: ${params.job_id}`);

  } catch (error) {
    console.error('recordVideoSwapMetrics error:', error);
    // Don't throw - metrics are non-critical
  }
}
