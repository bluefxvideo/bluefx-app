'use server';

import { createClient } from '@/app/supabase/server';

export interface UserCreditsResponse {
  success: boolean;
  credits?: number;
  error?: string;
}

/**
 * Get user's available credits
 * Centralized function used by sidebar and tools
 */
export async function getUserCredits(userId?: string): Promise<UserCreditsResponse> {
  try {
    const supabase = await createClient();

    // If no userId provided, get from current session
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }
      uid = user.id;
    }

    const { data, error } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', uid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - user has no credits yet
        return { success: true, credits: 0 };
      }
      return { success: false, error: error.message };
    }

    return { success: true, credits: data?.available_credits || 0 };
  } catch (error) {
    console.error('getUserCredits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get credits',
    };
  }
}

// topupUserCredits / autoTopupCredits were removed 2026-11-02: exported server actions with no
// caller that let any signed-in session top itself up to any amount. Monthly grants run on the
// server only (lib/credits/subscription-entitlement.ts, service role).
