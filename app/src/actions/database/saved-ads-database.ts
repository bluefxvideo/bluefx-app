'use server';

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Get all saved winning ad IDs for a user
 */
export async function getUserSavedAdIds(
  userId: string
): Promise<{ success: boolean; data?: number[]; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('user_saved_ads')
      .select('winning_ad_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching saved ad IDs:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map((row) => row.winning_ad_id) };
  } catch (error) {
    console.error('Get saved ad IDs error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch saved ads',
    };
  }
}

/**
 * Save a winning ad for the user
 */
export async function saveWinningAd(
  userId: string,
  winningAdId: number,
  tiktokMaterialId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase.from('user_saved_ads').upsert(
      {
        user_id: userId,
        winning_ad_id: winningAdId,
        tiktok_material_id: tiktokMaterialId,
      },
      { onConflict: 'user_id,winning_ad_id' }
    );

    if (error) {
      console.error('Error saving ad:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Save ad error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save ad',
    };
  }
}

/**
 * Unsave (remove bookmark) a winning ad for the user
 */
export async function unsaveWinningAd(
  userId: string,
  winningAdId: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('user_saved_ads')
      .delete()
      .eq('user_id', userId)
      .eq('winning_ad_id', winningAdId);

    if (error) {
      console.error('Error unsaving ad:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unsave ad error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unsave ad',
    };
  }
}
