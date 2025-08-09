'use server';

import { createClient } from '@/app/supabase/server';
import { Json } from '@/types/database';

/**
 * Database operations for Voice Over tool
 * Handles storing generated voices, tracking history, and managing voice collections
 */

interface GeneratedVoice {
  id: string;
  user_id: string;
  text_content: string;
  script_text?: string | null;
  voice_id: string;
  voice_name: string;
  voice_provider: string;
  audio_format: string;
  audio_url?: string | null;
  duration_seconds?: number | null;
  file_size_mb?: number | null;
  file_size_bytes?: number | null;
  export_format?: string | null;
  voice_settings?: Json;
  batch_id?: string | null;
  credits_used?: number | null;
  quality_rating?: number | null;
  created_at?: string | null;
}

interface VoiceCollection {
  id?: string;
  user_id: string | null;
  name: string;
  description?: string | null;
  voice_ids: string[];
  created_at?: string | null;
}

/**
 * Get user's voice over history
 */
export async function getVoiceOverHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: GeneratedVoice[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('generated_voices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Voice history fetch error:', error);
      return {
        success: false,
        error: `Failed to fetch voice history: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('getVoiceOverHistory error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'History fetch failed',
    };
  }
}

/**
 * Get voice over by batch ID (for batch generations)
 */
export async function getVoiceOverBatch(
  batchId: string,
  userId: string
): Promise<{ success: boolean; data?: GeneratedVoice[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('generated_voices')
      .select('*')
      .eq('batch_id', batchId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Batch fetch error:', error);
      return {
        success: false,
        error: `Failed to fetch batch: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('getVoiceOverBatch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Batch fetch failed',
    };
  }
}

/**
 * Delete generated voice
 */
export async function deleteGeneratedVoice(
  voiceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('generated_voices')
      .delete()
      .eq('id', voiceId)
      .eq('user_id', userId); // Ensure user can only delete their own voices

    if (error) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: `Failed to delete voice: ${error.message}`,
      };
    }

    return { success: true };

  } catch (error) {
    console.error('deleteGeneratedVoice error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Create voice collection
 */
export async function createVoiceCollection(
  collection: VoiceCollection
): Promise<{ success: boolean; data?: VoiceCollection; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('voice_collections')
      .insert({
        ...collection,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Collection create error:', error);
      return {
        success: false,
        error: `Failed to create collection: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('createVoiceCollection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Collection creation failed',
    };
  }
}

/**
 * Get user's voice collections
 */
export async function getVoiceCollections(
  userId: string
): Promise<{ success: boolean; data?: VoiceCollection[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('voice_collections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Collections fetch error:', error);
      return {
        success: false,
        error: `Failed to fetch collections: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('getVoiceCollections error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Collections fetch failed',
    };
  }
}

/**
 * Update voice collection
 */
export async function updateVoiceCollection(
  collectionId: string,
  updates: Partial<VoiceCollection>,
  userId: string
): Promise<{ success: boolean; data?: VoiceCollection; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('voice_collections')
      .update(updates)
      .eq('id', collectionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Collection update error:', error);
      return {
        success: false,
        error: `Failed to update collection: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('updateVoiceCollection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Collection update failed',
    };
  }
}

/**
 * Delete voice collection
 */
export async function deleteVoiceCollection(
  collectionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('voice_collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Collection delete error:', error);
      return {
        success: false,
        error: `Failed to delete collection: ${error.message}`,
      };
    }

    return { success: true };

  } catch (error) {
    console.error('deleteVoiceCollection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Collection delete failed',
    };
  }
}

/**
 * Get voice generation analytics
 */
export async function getVoiceGenerationAnalytics(
  userId: string,
  days: number = 30
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const supabase = await createClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get generation count by voice
    const { data: voiceStats, error: voiceError } = await supabase
      .from('generated_voices')
      .select('voice_id, voice_name, credits_used, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (voiceError) {
      throw new Error(`Failed to fetch voice stats: ${voiceError.message}`);
    }

    // Get total usage stats
    const { error: totalError } = await supabase
      .rpc('get_voice_over_stats', { user_id_param: userId });

    if (totalError) {
      console.warn('Failed to fetch total stats:', totalError);
    }

    // Process the data
    const voiceUsageMap = new Map();
    let totalGenerations = 0;
    let totalCreditsUsed = 0;

    voiceStats?.forEach((voice: Record<string, unknown>) => {
      const voiceId = voice.voice_id;
      if (!voiceUsageMap.has(voiceId)) {
        voiceUsageMap.set(voiceId, {
          voice_id: voiceId,
          voice_name: voice.voice_name,
          count: 0,
          credits_used: 0,
        });
      }
      
      const voiceData = voiceUsageMap.get(voiceId);
      voiceData.count += 1;
      voiceData.credits_used += (voice.credits_used as number) || 0;
      
      totalGenerations += 1;
      totalCreditsUsed += (voice.credits_used as number) || 0;
    });

    return {
      success: true,
      data: {
        total_generations: totalGenerations,
        total_credits_used: totalCreditsUsed,
        voice_usage: Array.from(voiceUsageMap.values()),
        period_days: days,
      },
    };

  } catch (error) {
    console.error('getVoiceGenerationAnalytics error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analytics fetch failed',
    };
  }
}

/**
 * Search generated voices
 */
export async function searchGeneratedVoices(
  userId: string,
  query: string,
  filters?: {
    voice_id?: string;
    export_format?: string;
    date_from?: string;
    date_to?: string;
  }
): Promise<{ success: boolean; data?: GeneratedVoice[]; error?: string }> {
  try {
    const supabase = await createClient();

    let queryBuilder = supabase
      .from('generated_voices')
      .select('*')
      .eq('user_id', userId);

    // Text search in script
    if (query.trim()) {
      queryBuilder = queryBuilder.ilike('script_text', `%${query}%`);
    }

    // Apply filters
    if (filters?.voice_id) {
      queryBuilder = queryBuilder.eq('voice_id', filters.voice_id);
    }
    if (filters?.export_format) {
      queryBuilder = queryBuilder.eq('export_format', filters.export_format);
    }
    if (filters?.date_from) {
      queryBuilder = queryBuilder.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      queryBuilder = queryBuilder.lte('created_at', filters.date_to);
    }

    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Search error:', error);
      return {
        success: false,
        error: `Search failed: ${error.message}`,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    console.error('searchGeneratedVoices error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}