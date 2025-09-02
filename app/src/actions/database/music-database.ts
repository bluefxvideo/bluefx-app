'use server';

import { createClient } from '@/app/supabase/server';
import { Json } from '@/types/database';

export interface GeneratedMusic {
  id: string;
  user_id: string;
  created_at: string | null;
  updated_at: string | null;
  track_title: string;
  genre: string;
  mood: string;
  duration_seconds: number;
  audio_url?: string | null;
  description?: string | null;
  tempo?: number | null;
  status: string;
  generation_settings?: Json;
  progress_percentage?: number | null;
  quality_rating?: number | null;
  is_favorite?: boolean | null;
  key_signature?: string | null;
  lyrics?: string | null;
  instrument_breakdown?: Json;
  download_count?: number | null;
  waveform_url?: string | null;
}

export interface MusicDatabaseResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get music generation history for a user
 */
export async function getMusicHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<MusicDatabaseResponse<GeneratedMusic[]>> {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }

    const { data, error } = await supabase
      .from('music_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Music history fetch error:', error);
      return {
        success: false,
        error: 'Failed to fetch music history'
      };
    }

    return {
      success: true,
      data: data || []
    };

  } catch (error) {
    console.error('Music history error:', error);
    return {
      success: false,
      error: 'Failed to fetch music history'
    };
  }
}

/**
 * Create a new music generation record
 */
export async function createMusicRecord(
  userId: string,
  prompt: string,
  settings: {
    genre?: string;
    mood?: string;
    duration?: number;
    prediction_id?: string;
    batch_id?: string;
    credits_used?: number;
    model_provider?: string;
  }
): Promise<MusicDatabaseResponse<GeneratedMusic>> {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }

    const { data, error } = await supabase
      .from('music_history')
      .insert({
        user_id: userId,
        track_title: prompt,
        genre: settings.genre || 'electronic',
        mood: settings.mood || 'upbeat',
        duration_seconds: settings.duration || 30,
        generation_settings: {
          ...settings,
          model_provider: settings.model_provider || 'lyria-2'
        },
        status: 'pending',
        description: prompt
      })
      .select()
      .single();

    if (error) {
      console.error('Music record creation error:', error);
      return {
        success: false,
        error: 'Failed to create music record'
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('Create music record error:', error);
    return {
      success: false,
      error: 'Failed to create music record'
    };
  }
}

/**
 * Update music record with completion data (Admin version for webhooks)
 */
export async function updateMusicRecordAdmin(
  musicId: string,
  updateData: {
    status?: string;
    audio_url?: string | null;
    final_audio_url?: string | null;
    progress_percentage?: number | null;
    quality_rating?: number | null;
    duration_seconds?: number;
    generation_settings?: Json;
  }
): Promise<MusicDatabaseResponse<GeneratedMusic>> {
  try {
    const { createAdminClient } = await import('@/app/supabase/server');
    const supabase = createAdminClient();

    // Map final_audio_url to audio_url for the database
    const dbUpdateData = { ...updateData };
    if (updateData.final_audio_url) {
      dbUpdateData.audio_url = updateData.final_audio_url;
      delete dbUpdateData.final_audio_url;
    }

    const { data, error } = await supabase
      .from('music_history')
      .update({
        ...dbUpdateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', musicId)
      .select()
      .single();

    if (error) {
      console.error('Music record update error (admin):', error);
      return {
        success: false,
        error: 'Failed to update music record'
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('updateMusicRecordAdmin error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database update failed'
    };
  }
}

/**
 * Update music record with completion data (User version)
 */
export async function updateMusicRecord(
  musicId: string,
  updateData: {
    status?: string;
    audio_url?: string | null;
    final_audio_url?: string | null;
    progress_percentage?: number | null;
    quality_rating?: number | null;
    duration_seconds?: number;
    generation_settings?: Json;
  }
): Promise<MusicDatabaseResponse<GeneratedMusic>> {
  try {
    const supabase = await createClient();

    // Map final_audio_url to audio_url for the database
    const dbUpdateData = { ...updateData };
    if (updateData.final_audio_url) {
      dbUpdateData.audio_url = updateData.final_audio_url;
      delete dbUpdateData.final_audio_url;
    }

    const { data, error } = await supabase
      .from('music_history')
      .update({
        ...dbUpdateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', musicId)
      .select()
      .single();

    if (error) {
      console.error('Music record update error:', error);
      return {
        success: false,
        error: 'Failed to update music record'
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('Update music record error:', error);
    return {
      success: false,
      error: 'Failed to update music record'
    };
  }
}

/**
 * Get music record by prediction ID
 */
export async function getMusicById(
  musicId: string
): Promise<MusicDatabaseResponse<GeneratedMusic>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('music_history')
      .select('*')
      .eq('id', musicId)
      .single();

    if (error) {
      console.error('Music fetch by prediction ID error:', error);
      return {
        success: false,
        error: 'Music not found'
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('Get music by prediction ID error:', error);
    return {
      success: false,
      error: 'Failed to fetch music'
    };
  }
}

/**
 * Delete a music record
 */
export async function deleteGeneratedMusic(
  musicId: string,
  userId: string
): Promise<MusicDatabaseResponse<void>> {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }

    const { error } = await supabase
      .from('music_history')
      .delete()
      .eq('id', musicId)
      .eq('user_id', userId);

    if (error) {
      console.error('Music deletion error:', error);
      return {
        success: false,
        error: 'Failed to delete music'
      };
    }

    return {
      success: true
    };

  } catch (error) {
    console.error('Delete music error:', error);
    return {
      success: false,
      error: 'Failed to delete music'
    };
  }
}

/**
 * Search music by filters
 */
export async function searchMusic(
  userId: string,
  filters: {
    genre?: string;
    mood?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<MusicDatabaseResponse<GeneratedMusic[]>> {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      return {
        success: false,
        error: 'Unauthorized access'
      };
    }

    let query = supabase
      .from('music_history')
      .select('*')
      .eq('user_id', userId);

    // Apply filters
    if (filters.genre) {
      query = query.eq('genre', filters.genre);
    }
    if (filters.mood) {
      query = query.eq('mood', filters.mood);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Music search error:', error);
      return {
        success: false,
        error: 'Failed to search music'
      };
    }

    return {
      success: true,
      data: data || []
    };

  } catch (error) {
    console.error('Search music error:', error);
    return {
      success: false,
      error: 'Failed to search music'
    };
  }
}