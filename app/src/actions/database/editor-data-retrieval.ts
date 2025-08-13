'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Editor Data Retrieval Service
 * Extracts unified editor data for video editing interface
 */

export interface EditorDataResponse {
  success: boolean;
  editor_data?: any;
  video_id?: string;
  error?: string;
}

/**
 * Get unified editor data for a specific video
 */
export async function getEditorData(video_id: string): Promise<EditorDataResponse> {
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('id, editor_data, created_at, last_modified')
      .eq('id', video_id)
      .single();

    if (error) throw error;

    if (!data?.editor_data) {
      return {
        success: false,
        error: 'No editor data found for this video'
      };
    }

    return {
      success: true,
      editor_data: data.editor_data,
      video_id: data.id
    };
  } catch (error) {
    console.error('Error getting editor data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get editor data'
    };
  }
}

/**
 * Get latest editor data for a user
 */
export async function getLatestEditorData(user_id: string): Promise<EditorDataResponse> {
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('id, editor_data, created_at, last_modified')
      .eq('user_id', user_id)
      .not('editor_data', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

    if (!data) {
      return {
        success: false,
        error: 'No videos with editor data found for this user'
      };
    }

    return {
      success: true,
      editor_data: data.editor_data,
      video_id: data.id
    };
  } catch (error) {
    console.error('Error getting latest editor data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get latest editor data'
    };
  }
}

/**
 * Update editor state (for auto-save)
 */
export async function updateEditorState(
  video_id: string, 
  editor_state: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current editor_data
    const { data: currentData, error: fetchError } = await supabase
      .from('script_to_video_history')
      .select('editor_data')
      .eq('id', video_id)
      .single();

    if (fetchError) throw fetchError;

    // Update just the editor_state portion
    const updatedEditorData = {
      ...currentData.editor_data,
      editor_state: {
        ...currentData.editor_data?.editor_state,
        ...editor_state,
        last_auto_save: new Date().toISOString()
      }
    };

    const { error: updateError } = await supabase
      .from('script_to_video_history')
      .update({
        editor_data: updatedEditorData,
        last_modified: new Date().toISOString()
      })
      .eq('id', video_id);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error updating editor state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update editor state'
    };
  }
}

/**
 * Get all videos with editor data for a user (for project listing)
 */
export async function getUserVideoProjects(user_id: string) {
  try {
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select(`
        id,
        script_title,
        created_at,
        last_modified,
        status,
        editor_data->project as project_info,
        editor_data->script->word_count as word_count,
        editor_data->timeline->total_duration as duration,
        editor_data->generation->credits_breakdown->total as credits_used
      `)
      .eq('user_id', user_id)
      .not('editor_data', 'is', null)
      .order('last_modified', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      projects: data.map(project => ({
        id: project.id,
        title: project.script_title,
        created_at: project.created_at,
        last_modified: project.last_modified,
        status: project.status,
        word_count: project.word_count || 0,
        duration: project.duration || 0,
        credits_used: project.credits_used || 0
      }))
    };
  } catch (error) {
    console.error('Error getting user video projects:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get projects'
    };
  }
}

/**
 * Check if editor data structure is valid
 */
export function validateEditorData(editor_data: any): boolean {
  if (!editor_data) return false;
  
  const requiredFields = [
    'project',
    'script', 
    'voice',
    'visuals',
    'timeline',
    'generation',
    'editor_state',
    'export'
  ];
  
  return requiredFields.every(field => editor_data.hasOwnProperty(field));
}