'use server';

import { getLogoHistory, deleteLogo } from '../database/logo-database';
import { createClient } from '@/app/supabase/server';

export interface LogoHistoryItem {
  id: string;
  companyName: string;
  type: 'logo-design' | 'recreate';
  logoUrl?: string;
  createdAt: string;
  credits: number;
  status: 'completed' | 'failed';
  batch_id: string;
  metadata?: any;
}

/**
 * Fetch user's logo generation history
 */
export async function fetchUserLogoHistory(): Promise<{
  success: boolean;
  history?: LogoHistoryItem[];
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
    const historyResult = await getLogoHistory(user.id, 50);

    if (!historyResult.success || !historyResult.logos) {
      return {
        success: false,
        error: historyResult.error || 'Failed to fetch logo history',
      };
    }

    // Transform database records to history items
    const history: LogoHistoryItem[] = historyResult.logos.map((item: any) => {
      // Determine type based on metadata or generation_settings
      let type: 'logo-design' | 'recreate' = 'logo-design';
      
      // Check metadata first
      if (item.metadata?.workflow_intent === 'recreate' || item.generation_settings?.workflow_intent === 'recreate') {
        type = 'recreate';
      }

      // Calculate credits used (based on type)
      let credits = 3; // Default for logo generation
      if (type === 'recreate') credits = 4;

      // Validate logo URL to ensure it's from our approved domains
      let logoUrl = item.image_urls?.[0];
      if (logoUrl && !logoUrl.includes('supabase') && logoUrl.includes('oaidalleapiprodscus')) {
        // Skip OpenAI URLs that might still exist to prevent Next.js hostname errors
        console.warn(`Skipping invalid OpenAI URL for logo ${item.id}`);
        logoUrl = undefined;
      }

      return {
        id: item.id,
        companyName: item.metadata?.company_name || item.prompt || 'Unknown Company',
        type,
        logoUrl,
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
    console.error('fetchUserLogoHistory error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch logo history',
    };
  }
}

/**
 * Delete a logo history item
 */
export async function deleteLogoItem(itemId: string): Promise<{
  success: boolean;
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

    // Delete the item
    const deleteResult = await deleteLogo(itemId, user.id);

    if (!deleteResult.success) {
      return {
        success: false,
        error: deleteResult.error || 'Failed to delete logo',
      };
    }

    return {
      success: true,
    };

  } catch (error) {
    console.error('deleteLogoItem error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete logo',
    };
  }
}