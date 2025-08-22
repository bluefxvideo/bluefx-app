'use server';

import { createClient } from '@/app/supabase/server';
import { Json } from '@/types/database';

export interface CinematographerVideo {
  id: string;
  user_id: string;
  video_concept: string;
  project_name: string;
  style_preferences: Json;
  shot_list?: Json | null;
  ai_director_notes?: string | null;
  final_video_url?: string | null;
  preview_urls?: string[] | null;
  progress_percentage?: number | null;
  total_duration_seconds?: number | null;
  metadata?: Json | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Get all videos for a user with optional filtering
 */
export async function getCinematographerVideos(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ videos: CinematographerVideo[]; total: number }> {
  const supabase = await createClient();
  
  const { data: videos, error, count } = await supabase
    .from('cinematographer_videos')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching cinematographer videos:', error);
    throw new Error('Failed to fetch videos');
  }

  return {
    videos: videos || [],
    total: count || 0
  };
}

/**
 * Get a specific video by ID
 */
export async function getCinematographerVideo(
  videoId: string,
  userId: string
): Promise<CinematographerVideo | null> {
  const supabase = await createClient();
  
  const { data: video, error } = await supabase
    .from('cinematographer_videos')
    .select('*')
    .eq('id', videoId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Video not found
    }
    console.error('Error fetching cinematographer video:', error);
    throw new Error('Failed to fetch video');
  }

  return video;
}

/**
 * Update video status and metadata
 */
export async function updateCinematographerVideo(
  videoId: string,
  updates: Partial<CinematographerVideo>
): Promise<CinematographerVideo> {
  const supabase = await createClient();
  
  const { data: video, error } = await supabase
    .from('cinematographer_videos')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', videoId)
    .select()
    .single();

  if (error) {
    console.error('Error updating cinematographer video:', error);
    throw new Error('Failed to update video');
  }

  return video;
}

/**
 * Delete a video (admin or owner only)
 */
export async function deleteCinematographerVideo(
  videoId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<boolean> {
  const supabase = await createClient();
  
  // Check ownership or admin privilege
  if (!isAdmin) {
    const { data: video } = await supabase
      .from('cinematographer_videos')
      .select('user_id')
      .eq('id', videoId)
      .single();
    
    if (!video || video.user_id !== userId) {
      throw new Error('Unauthorized to delete this video');
    }
  }
  
  const { error } = await supabase
    .from('cinematographer_videos')
    .delete()
    .eq('id', videoId);

  if (error) {
    console.error('Error deleting cinematographer video:', error);
    throw new Error('Failed to delete video');
  }

  return true;
}

/**
 * Get videos by status for monitoring
 */
export async function getCinematographerVideosByStatus(
  status: CinematographerVideo['status'],
  limit: number = 100
): Promise<CinematographerVideo[]> {
  const supabase = await createClient();
  
  const { data: videos, error } = await supabase
    .from('cinematographer_videos')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching videos by status:', error);
    throw new Error('Failed to fetch videos by status');
  }

  return videos || [];
}

/**
 * Update video status by job ID (used by webhooks)
 */
export async function updateCinematographerVideoByJobId(
  jobId: string,
  updates: Partial<CinematographerVideo>
): Promise<CinematographerVideo | null> {
  const supabase = await createClient();
  
  const { data: video, error } = await supabase
    .from('cinematographer_videos')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('job_id', jobId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Video not found
    }
    console.error('Error updating video by job ID:', error);
    throw new Error('Failed to update video');
  }

  return video;
}

/**
 * Get user credits for cinematographer
 * Using the proven pattern from Logo Machine
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
      console.log(`User ${user_id} not found in credits table, will auto-topup on first use`);
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
 * Deduct credits for cinematographer operations
 * Uses Supabase RPC function for atomic credit deduction
 * Automatically tops up user to 600 credits if they have less than the required amount
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
 * Store cinematographer video results
 */
export async function storeCinematographerResults(params: {
  user_id: string;
  video_concept: string;
  project_name: string;
  batch_id: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  aspect_ratio?: string;
  settings?: Json;
  status: 'planning' | 'shooting' | 'editing' | 'completed' | 'failed';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('cinematographer_videos')
      .insert({
        id: params.batch_id,
        user_id: params.user_id,
        video_concept: params.video_concept,
        project_name: params.project_name,
        final_video_url: params.video_url,
        preview_urls: params.thumbnail_url ? [params.thumbnail_url] : null,
        total_duration_seconds: params.duration,
        style_preferences: params.settings || {},
        metadata: {
          aspect_ratio: params.aspect_ratio,
          generation_settings: params.settings
        } as Json,
        status: params.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing cinematographer results:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Cinematographer results stored for batch: ${params.batch_id}`);
    return { success: true };

  } catch (error) {
    console.error('storeCinematographerResults error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to store results' 
    };
  }
}

/**
 * Record cinematographer metrics for analytics
 */
export async function recordCinematographerMetrics(params: {
  user_id: string;
  batch_id: string;
  model_version: string;
  video_concept: string;
  duration: number;
  aspect_ratio: string;
  generation_time_ms: number;
  credits_used: number;
  workflow_type: 'generate' | 'audio_add';
  has_reference_image: boolean;
}): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase
      .from('tool_usage_metrics')
      .insert({
        user_id: params.user_id,
        tool_id: 'ai-cinematographer',
        usage_type: params.workflow_type,
        credits_used: params.credits_used,
        metadata: {
          batch_id: params.batch_id,
          model_version: params.model_version,
          video_concept: params.video_concept,
          duration: params.duration,
          aspect_ratio: params.aspect_ratio,
          generation_time_ms: params.generation_time_ms,
          has_reference_image: params.has_reference_image
        } as Json,
        created_at: new Date().toISOString()
      });

    console.log(`📊 Cinematographer metrics recorded for batch: ${params.batch_id}`);

  } catch (error) {
    console.error('recordCinematographerMetrics error:', error);
    // Don't throw - metrics are non-critical
  }
}

/**
 * Create prediction record for tracking
 */
export async function createPredictionRecord(params: {
  prediction_id: string;
  user_id: string;
  tool_id: string;
  service_id: string;
  model_version: string;
  status: string;
  input_data: Json;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('ai_predictions')
      .insert({
        prediction_id: params.prediction_id,
        user_id: params.user_id,
        tool_id: params.tool_id,
        service_id: params.service_id,
        model_version: params.model_version,
        status: params.status,
        input_data: params.input_data,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error creating prediction record:', error);
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    console.error('createPredictionRecord error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create prediction record' 
    };
  }
}