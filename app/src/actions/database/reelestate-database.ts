'use server';

import { createClient } from '@/app/supabase/server';
import type {
  ReelEstateListingRow,
  ReelEstateCleanupRow,
  ImageAnalysis,
  ScriptSegment,
  ClipStatus,
  ZillowListingData,
} from '@/types/reelestate';

// ═══════════════════════════════════════════
// Listings CRUD
// ═══════════════════════════════════════════

export async function createListing(data: {
  user_id: string;
  name?: string;
  zillow_url?: string;
  source_type: 'zillow' | 'manual';
  listing_data?: ZillowListingData;
  photo_urls: string[];
  aspect_ratio?: string;
  target_duration?: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('reelestate_listings')
      .insert({
        user_id: data.user_id,
        name: data.name || null,
        zillow_url: data.zillow_url || null,
        source_type: data.source_type,
        listing_data: data.listing_data || null,
        photo_urls: data.photo_urls,
        aspect_ratio: data.aspect_ratio || '16:9',
        target_duration: data.target_duration || 30,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to create listing:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: row.id };
  } catch (error) {
    console.error('❌ Error creating listing:', error);
    return { success: false, error: 'Failed to create listing' };
  }
}

export async function updateListing(
  id: string,
  updates: Partial<Omit<ReelEstateListingRow, 'id' | 'user_id' | 'created_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('reelestate_listings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('❌ Failed to update listing:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error updating listing:', error);
    return { success: false, error: 'Failed to update listing' };
  }
}

export async function getListing(
  id: string
): Promise<{ success: boolean; listing?: ReelEstateListingRow; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('reelestate_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, listing: data as ReelEstateListingRow };
  } catch (error) {
    return { success: false, error: 'Failed to get listing' };
  }
}

export async function getUserListings(
  limit = 20
): Promise<{ success: boolean; listings?: ReelEstateListingRow[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Authentication required' };

    const { data, error } = await supabase
      .from('reelestate_listings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, listings: (data || []) as ReelEstateListingRow[] };
  } catch (error) {
    return { success: false, error: 'Failed to get listings' };
  }
}

export async function deleteListing(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('reelestate_listings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete listing' };
  }
}

// Delete saved editor composition for a listing (forces fresh load on next editor open)
export async function deleteSavedComposition(listingId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('video_editor_compositions')
      .delete()
      .eq('video_id', listingId);

    if (error) console.error('❌ Failed to delete saved composition:', error);
    else console.log('✅ Deleted saved composition for listing:', listingId);
  } catch (error) {
    console.error('❌ Error deleting saved composition:', error);
  }
}

// ═══════════════════════════════════════════
// Cleanups CRUD
// ═══════════════════════════════════════════

export async function createCleanupRecord(data: {
  user_id: string;
  listing_id?: string;
  original_url: string;
  preset: string;
  cleanup_prompt: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('reelestate_cleanups')
      .insert({
        user_id: data.user_id,
        listing_id: data.listing_id || null,
        original_url: data.original_url,
        preset: data.preset,
        cleanup_prompt: data.cleanup_prompt,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to create cleanup record:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: row.id };
  } catch (error) {
    return { success: false, error: 'Failed to create cleanup record' };
  }
}

export async function updateCleanupRecord(
  id: string,
  updates: Partial<Pick<ReelEstateCleanupRow, 'cleaned_url' | 'status' | 'error_message' | 'credits_used'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('reelestate_cleanups')
      .update(updates)
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update cleanup record' };
  }
}

export async function getCleanupHistory(
  userId: string,
  listingId?: string,
  limit = 50
): Promise<{ success: boolean; cleanups?: ReelEstateCleanupRow[]; error?: string }> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from('reelestate_cleanups')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (listingId) {
      query = query.eq('listing_id', listingId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, cleanups: (data || []) as ReelEstateCleanupRow[] };
  } catch (error) {
    return { success: false, error: 'Failed to get cleanup history' };
  }
}
