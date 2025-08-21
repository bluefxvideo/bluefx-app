'use server';

import { getThumbnailHistory } from '../database/thumbnail-database';
import { createClient } from '@/app/supabase/server';

export interface ThumbnailHistoryItem {
  id: string;
  prompt: string;
  type: 'thumbnail' | 'face-swap' | 'recreate' | 'titles';
  thumbnails?: string[];
  titles?: string[];
  createdAt: string;
  credits: number;
  status: 'completed' | 'failed';
  batch_id: string;
  metadata?: any;
}

/**
 * Fetch user's thumbnail generation history
 */
export async function fetchUserThumbnailHistory(): Promise<{
  success: boolean;
  history?: ThumbnailHistoryItem[];
  error?: string;
}> {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    // Fetch history from database
    const historyResult = await getThumbnailHistory(user.id, 50, 0);

    if (!historyResult.success || !historyResult.data) {
      return {
        success: false,
        error: historyResult.error || 'Failed to fetch history',
      };
    }

    // Transform database records to history items
    const history: ThumbnailHistoryItem[] = historyResult.data.map((item: any) => {
      // Determine type based on metadata or generation_settings
      let type: 'thumbnail' | 'face-swap' | 'recreate' | 'titles' = 'thumbnail';
      
      // Check metadata first
      if (item.metadata?.type) {
        type = item.metadata.type;
      } else if (item.generation_settings?.operation_mode) {
        // Check generation_settings for operation mode
        const mode = item.generation_settings.operation_mode;
        if (mode === 'face-swap-only') type = 'face-swap';
        else if (mode === 'recreation-only') type = 'recreate';
        else if (mode === 'titles-only') type = 'titles';
      }

      // Calculate credits used (approximate based on type and variations)
      let credits = 2; // Default for single thumbnail
      if (type === 'face-swap') credits = 3;
      if (type === 'titles') credits = 1;
      
      // Multiply by number of variations/images
      const imageCount = item.image_urls?.length || 1;
      if (type !== 'titles') {
        credits = credits * imageCount;
      }

      return {
        id: item.id,
        prompt: item.prompt || '',
        type,
        thumbnails: item.image_urls || [],
        titles: item.metadata?.titles || [],
        createdAt: item.created_at,
        credits,
        status: 'completed',
        batch_id: item.batch_id,
        metadata: item.metadata,
      };
    });

    return {
      success: true,
      history,
    };

  } catch (error) {
    console.error('fetchUserThumbnailHistory error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch history',
    };
  }
}