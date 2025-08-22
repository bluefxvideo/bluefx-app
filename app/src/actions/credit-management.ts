'use server';

import { createClient } from '@/app/supabase/server';

export interface CreditTopupResponse {
  success: boolean;
  message?: string;
  total_credits?: number;
  available_credits?: number;
  period_renewed?: boolean;
  error?: string;
}

/**
 * Top up user credits to 600 (default) if they have less
 * Does NOT add on top - sets total to 600 and resets used to 0
 */
export async function topupUserCredits(
  userId: string,
  targetCredits: number = 600
): Promise<CreditTopupResponse> {
  try {
    const supabase = await createClient();

    // Call the RPC function for credit top-up
    const { data, error } = await supabase
      .rpc('topup_user_credits', {
        p_user_id: userId,
        p_target_credits: targetCredits
      });

    if (error) {
      console.error('Credit top-up RPC error:', error);
      return {
        success: false,
        error: `Failed to top up credits: ${error.message}`,
      };
    }

    // Return the result from the RPC function
    return {
      success: data?.success || false,
      message: data?.message,
      total_credits: data?.total_credits,
      available_credits: data?.available_credits,
      period_renewed: data?.period_renewed,
    };

  } catch (error) {
    console.error('topupUserCredits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Credit top-up failed',
    };
  }
}

/**
 * Check if user needs credit top-up and do it automatically
 */
export async function autoTopupCredits(userId: string): Promise<CreditTopupResponse> {
  try {
    const supabase = await createClient();

    // Get current credit status
    const { data: credits, error } = await supabase
      .from('user_credits')
      .select('available_credits, period_end')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return {
        success: false,
        error: 'Failed to check credit status',
      };
    }

    // If no credits record or available < 600 or period expired, top up
    const needsTopup = !credits || 
                      (credits.available_credits < 600) || 
                      (new Date(credits.period_end) < new Date());

    if (needsTopup) {
      return await topupUserCredits(userId, 600);
    }

    return {
      success: true,
      message: 'No top-up needed',
      available_credits: credits.available_credits,
    };

  } catch (error) {
    console.error('autoTopupCredits error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Auto top-up failed',
    };
  }
}