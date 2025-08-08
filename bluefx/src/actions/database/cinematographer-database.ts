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