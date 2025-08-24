'use server';

import { createClient, createAdminClient } from '@/app/supabase/server';
import type { Json } from '@/types/database';

export interface TalkingAvatarVideo {
  id: string;
  user_id: string;
  video_url: string | null;
  script_text: string;
  avatar_template_id: string | null;
  status: string;
  audio_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  progress_percentage: number | null;
  error_message: string | null;
  external_job_id: string | null;
  processing_provider: string | null;
  video_settings: Json | null;
  voice_settings: Json | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AvatarTemplate {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  gender: string | null;
  age_range: string | null;
  ethnicity: string | null;
  voice_provider: string;
  voice_id: string;
  preview_video_url: string | null;
  is_active: boolean | null;
  usage_count: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Get all avatar videos for a user with optional filtering
 */
export async function getTalkingAvatarVideos(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ videos: TalkingAvatarVideo[]; total: number }> {
  const supabase = await createClient();
  
  const { data: videos, error, count } = await supabase
    .from('avatar_videos')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching avatar videos:', error);
    throw new Error('Failed to fetch videos');
  }

  return {
    videos: videos || [],
    total: count || 0
  };
}

/**
 * Get all avatar templates
 */
export async function getAvatarTemplates(
  category?: string
): Promise<AvatarTemplate[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('avatar_templates')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data: templates, error } = await query;

  if (error) {
    console.error('Error fetching avatar templates:', error);
    throw new Error('Failed to fetch avatar templates');
  }

  return templates || [];
}

/**
 * Get a specific avatar video by ID
 */
export async function getTalkingAvatarVideo(
  videoId: string,
  userId: string
): Promise<TalkingAvatarVideo | null> {
  const supabase = await createClient();
  
  const { data: video, error } = await supabase
    .from('avatar_videos')
    .select('*')
    .eq('id', videoId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Video not found
    }
    console.error('Error fetching avatar video:', error);
    throw new Error('Failed to fetch video');
  }

  return video;
}

/**
 * Update avatar video status and metadata
 */
export async function updateTalkingAvatarVideo(
  videoId: string,
  updates: Partial<TalkingAvatarVideo>
): Promise<TalkingAvatarVideo> {
  const supabase = await createClient();
  
  const { data: video, error } = await supabase
    .from('avatar_videos')
    .update({
      ...updates,
      video_status_last_checked: new Date().toISOString()
    })
    .eq('id', videoId)
    .select()
    .single();

  if (error) {
    console.error('Error updating avatar video:', error);
    throw new Error('Failed to update video');
  }

  return video;
}

/**
 * Delete an avatar video (user only)
 */
export async function deleteTalkingAvatarVideo(
  videoId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  // Check ownership
  const { data: video } = await supabase
    .from('avatar_videos')
    .select('user_id')
    .eq('id', videoId)
    .single();
  
  if (!video || video.user_id !== userId) {
    throw new Error('Unauthorized to delete this video');
  }
  
  const { error } = await supabase
    .from('avatar_videos')
    .delete()
    .eq('id', videoId);

  if (error) {
    console.error('Error deleting avatar video:', error);
    throw new Error('Failed to delete video');
  }

  return true;
}

/**
 * Create new avatar template (admin only)
 */
export async function createAvatarTemplate(
  template: Omit<AvatarTemplate, 'id' | 'created_at'>
): Promise<AvatarTemplate> {
  const supabase = await createClient();
  
  const { data: newTemplate, error } = await supabase
    .from('avatar_templates')
    .insert({
      ...template,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating avatar template:', error);
    throw new Error('Failed to create avatar template');
  }

  return newTemplate;
}

/**
 * Delete avatar template (admin only)
 */
export async function deleteAvatarTemplate(
  templateId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('avatar_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('Error deleting avatar template:', error);
    throw new Error('Failed to delete avatar template');
  }

  return true;
}

/**
 * Get videos by status for monitoring
 */
export async function getTalkingAvatarVideosByStatus(
  status: TalkingAvatarVideo['status'],
  limit: number = 100
): Promise<TalkingAvatarVideo[]> {
  const supabase = await createClient();
  
  const { data: videos, error } = await supabase
    .from('avatar_videos')
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
export async function updateTalkingAvatarVideoByJobId(
  jobId: string,
  updates: Partial<TalkingAvatarVideo>
): Promise<TalkingAvatarVideo | null> {
  const supabase = await createClient();
  
  const { data: video, error } = await supabase
    .from('avatar_videos')
    .update({
      ...updates,
      video_status_last_checked: new Date().toISOString()
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
 * Get user credits using the same pattern as cinematographer
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
 * Deduct credits for talking avatar operations - mirrors cinematographer pattern
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
 * Store talking avatar video results following legacy pattern
 */
export async function storeTalkingAvatarResults(params: {
  user_id: string;
  script_text: string;
  avatar_template_id: string | null;
  batch_id: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  hedra_generation_id?: string;
  hedra_asset_id?: string;
  voice_audio_url?: string;
  settings?: Json;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('avatar_videos')
      .insert({
        id: params.batch_id,
        user_id: params.user_id,
        script_text: params.script_text,
        avatar_template_id: params.avatar_template_id,
        video_url: params.video_url,
        thumbnail_url: params.thumbnail_url,
        duration_seconds: params.duration,
        hedra_generation_id: params.hedra_generation_id,
        hedra_asset_id: params.hedra_asset_id,
        audio_url: params.voice_audio_url,
        video_settings: params.settings || {},
        status: params.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing talking avatar results:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Talking avatar results stored for batch: ${params.batch_id}`);
    return { success: true };

  } catch (error) {
    console.error('storeTalkingAvatarResults error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to store results' 
    };
  }
}

/**
 * Record talking avatar metrics for analytics
 */
export async function recordTalkingAvatarMetrics(params: {
  user_id: string;
  batch_id: string;
  model_version: string;
  script_text: string;
  duration: number;
  aspect_ratio: string;
  generation_time_ms: number;
  credits_used: number;
  workflow_type: 'generate' | 'voice_add';
  has_custom_avatar: boolean;
}): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase
      .from('tool_usage_metrics')
      .insert({
        user_id: params.user_id,
        tool_id: 'talking-avatar',
        usage_type: params.workflow_type,
        credits_used: params.credits_used,
        metadata: {
          batch_id: params.batch_id,
          model_version: params.model_version,
          script_text: params.script_text,
          duration: params.duration,
          aspect_ratio: params.aspect_ratio,
          generation_time_ms: params.generation_time_ms,
          has_custom_avatar: params.has_custom_avatar
        } as Json,
        created_at: new Date().toISOString()
      });

    console.log(`📊 Talking avatar metrics recorded for batch: ${params.batch_id}`);

  } catch (error) {
    console.error('recordTalkingAvatarMetrics error:', error);
    // Don't throw - metrics are non-critical
  }
}

/**
 * Update talking avatar video using admin client (for webhooks)
 * Uses admin client to bypass RLS policies
 */
export async function updateTalkingAvatarVideoAdmin(
  videoId: string,
  updates: Partial<TalkingAvatarVideo>
): Promise<TalkingAvatarVideo> {
  const supabase = createAdminClient();
  
  const { data: video, error } = await supabase
    .from('avatar_videos')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', videoId)
    .select()
    .single();

  if (error) {
    console.error('Error updating talking avatar video (admin):', error);
    throw new Error('Failed to update video');
  }

  return video;
}

/**
 * Update talking avatar video by Hedra generation ID (for webhooks)
 */
export async function updateTalkingAvatarVideoByHedraId(
  hedraGenerationId: string,
  updates: Partial<TalkingAvatarVideo>
): Promise<TalkingAvatarVideo | null> {
  const supabase = createAdminClient();
  
  const { data: video, error } = await supabase
    .from('avatar_videos')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('hedra_generation_id', hedraGenerationId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Video not found
    }
    console.error('Error updating video by Hedra ID:', error);
    throw new Error('Failed to update video');
  }

  return video;
}