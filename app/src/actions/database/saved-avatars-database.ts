'use server';

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

function getSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface SavedAvatar {
  id: string;
  user_id: string;
  name: string;
  image_url: string;
  created_at: string;
}

/**
 * Get all saved avatars for a user
 */
export async function getUserSavedAvatars(
  userId: string
): Promise<{ success: boolean; data?: SavedAvatar[]; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('user_saved_avatars')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved avatars:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as SavedAvatar[] };
  } catch (error) {
    console.error('Get saved avatars error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch saved avatars'
    };
  }
}

/**
 * Save a new avatar for the user
 */
export async function saveUserAvatar(
  userId: string,
  name: string,
  imageUrl: string
): Promise<{ success: boolean; data?: SavedAvatar; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('user_saved_avatars')
      .insert({
        user_id: userId,
        name,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving avatar:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as SavedAvatar };
  } catch (error) {
    console.error('Save avatar error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save avatar'
    };
  }
}

/**
 * Update a saved avatar's name
 */
export async function updateSavedAvatarName(
  userId: string,
  avatarId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('user_saved_avatars')
      .update({ name: newName })
      .eq('id', avatarId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating saved avatar:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Update saved avatar error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update avatar'
    };
  }
}

/**
 * Delete a saved avatar
 */
export async function deleteSavedAvatar(
  userId: string,
  avatarId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('user_saved_avatars')
      .delete()
      .eq('id', avatarId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting saved avatar:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete saved avatar error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete avatar'
    };
  }
}
