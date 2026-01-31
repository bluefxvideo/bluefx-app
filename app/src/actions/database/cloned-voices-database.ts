'use server';

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

function getSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface ClonedVoice {
  id: string;
  user_id: string;
  name: string;
  minimax_voice_id: string;
  source_audio_url: string | null;
  preview_url: string | null;
  created_at: string;
}

/**
 * Save a newly cloned voice to the database
 */
export async function saveClonedVoice(
  userId: string,
  name: string,
  minimaxVoiceId: string,
  sourceAudioUrl?: string,
  previewUrl?: string
): Promise<{ success: boolean; data?: ClonedVoice; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('cloned_voices')
      .insert({
        user_id: userId,
        name,
        minimax_voice_id: minimaxVoiceId,
        source_audio_url: sourceAudioUrl || null,
        preview_url: previewUrl || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving cloned voice:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ClonedVoice };
  } catch (error) {
    console.error('Save cloned voice error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save cloned voice'
    };
  }
}

/**
 * Get all cloned voices for a user
 */
export async function getUserClonedVoices(
  userId: string
): Promise<{ success: boolean; data?: ClonedVoice[]; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('cloned_voices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cloned voices:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as ClonedVoice[] };
  } catch (error) {
    console.error('Get cloned voices error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch cloned voices'
    };
  }
}

/**
 * Get a single cloned voice by ID
 */
export async function getClonedVoiceById(
  voiceId: string,
  userId: string
): Promise<{ success: boolean; data?: ClonedVoice; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('cloned_voices')
      .select('*')
      .eq('id', voiceId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching cloned voice:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ClonedVoice };
  } catch (error) {
    console.error('Get cloned voice error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch cloned voice'
    };
  }
}

/**
 * Get a cloned voice by its Minimax voice ID
 */
export async function getClonedVoiceByMinimaxId(
  minimaxVoiceId: string,
  userId: string
): Promise<{ success: boolean; data?: ClonedVoice; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('cloned_voices')
      .select('*')
      .eq('minimax_voice_id', minimaxVoiceId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - not an error for this use case
        return { success: true, data: undefined };
      }
      console.error('Error fetching cloned voice by minimax ID:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ClonedVoice };
  } catch (error) {
    console.error('Get cloned voice by minimax ID error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch cloned voice'
    };
  }
}

/**
 * Update a cloned voice name
 */
export async function updateClonedVoiceName(
  voiceId: string,
  userId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('cloned_voices')
      .update({ name: newName })
      .eq('id', voiceId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating cloned voice:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Update cloned voice error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update cloned voice'
    };
  }
}

/**
 * Delete a cloned voice
 */
export async function deleteClonedVoice(
  voiceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('cloned_voices')
      .delete()
      .eq('id', voiceId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting cloned voice:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete cloned voice error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete cloned voice'
    };
  }
}

/**
 * Check if a user owns a specific cloned voice ID
 */
export async function userOwnsClonedVoice(
  minimaxVoiceId: string,
  userId: string
): Promise<boolean> {
  const result = await getClonedVoiceByMinimaxId(minimaxVoiceId, userId);
  return result.success && !!result.data;
}
