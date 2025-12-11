'use server';

import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Retrieve complete script-to-video data for consistency and auto-save
 */
export async function getScriptVideoData(videoId: string, userId: string) {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select(`
        *,
        storyboard_data,
        whisper_data,
        voice_data,
        image_data,
        caption_data,
        processing_logs,
        version_number,
        edit_history,
        last_modified
      `)
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      data: {
        // Core data
        id: data.id,
        script_title: data.script_title,
        script_content: data.script_content,
        video_url: data.video_url,
        status: data.status,
        
        // Complete metadata for consistency
        storyboard: data.storyboard_data || null,
        whisper: data.whisper_data || null,
        voice: data.voice_data || null,
        images: data.image_data || null,
        captions: data.caption_data || null,
        
        // Legacy data (backward compatibility)
        processing_logs: data.processing_logs || {},
        
        // Version tracking
        version: data.version_number || 1,
        edits: data.edit_history || [],
        lastModified: data.last_modified || data.updated_at,
        
        // Timestamps
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    };
  } catch (error) {
    console.error('Error retrieving script video data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve video data'
    };
  }
}

/**
 * Update script-to-video data for auto-save
 */
export async function updateScriptVideoData(
  videoId: string,
  userId: string,
  updates: {
    segments?: any[];
    caption_chunks?: any;
    edit_operation?: {
      type: string;
      timestamp: string;
      changes: any;
    };
  }
) {
  try {
    // Get current data first
    const { data: currentData, error: fetchError } = await supabase
      .from('script_to_video_history')
      .select('version_number, edit_history')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const newVersion = (currentData.version_number || 1) + 1;
    const editHistory = currentData.edit_history || [];
    
    if (updates.edit_operation) {
      editHistory.push(updates.edit_operation);
    }
    
    // Update with new data
    const { data, error } = await supabase
      .from('script_to_video_history')
      .update({
        ...(updates.segments && { 
          processing_logs: supabase.rpc('jsonb_set', {
            target: 'processing_logs',
            path: '{segments}',
            new_value: JSON.stringify(updates.segments)
          })
        }),
        ...(updates.caption_chunks && {
          caption_data: {
            chunks: updates.caption_chunks
          }
        }),
        version_number: newVersion,
        edit_history: editHistory,
        last_modified: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      data: {
        id: data.id,
        version: newVersion,
        lastModified: data.last_modified
      }
    };
  } catch (error) {
    console.error('Error updating script video data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update video data'
    };
  }
}

/**
 * Get user's recent script-to-video projects for dashboard
 */
export async function getUserScriptVideos(
  userId: string,
  limit: number = 10
) {
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select(`
        id,
        script_title,
        video_url,
        thumbnail_url,
        status,
        created_at,
        updated_at,
        last_modified,
        version_number,
        storyboard_data->>narrative_analysis->story_summary as story_summary,
        caption_data->>settings->quality_score as quality_score
      `)
      .eq('user_id', userId)
      .order('last_modified', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return {
      success: true,
      videos: data || []
    };
  } catch (error) {
    console.error('Error fetching user videos:', error);
    return {
      success: false,
      videos: [],
      error: error instanceof Error ? error.message : 'Failed to fetch videos'
    };
  }
}