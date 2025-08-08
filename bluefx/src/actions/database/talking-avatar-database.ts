'use server';

import { createClient } from '@/app/supabase/server';
import type { Json } from '@/types/database';

export interface TalkingAvatarVideo {
  id: string;
  user_id: string;
  video_url: string | null;
  script_text: string;
  avatar_template_id: string;
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