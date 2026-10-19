'use server';

import { z } from 'zod';
import { createClient } from '@/app/supabase/server';
import { bonusVideoAdsOf, makeBonusVideoAd as makeOne } from '@/lib/free-video/bonus-ads';
import type { BonusVideoAd } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * The bonus video ads of a free video ad buyer (lib/free-video/bonus-ads.ts): the 3 cards waiting in Make a Video Ad,
 * and the click that makes one at no credits.
 *
 * SECURITY: every export of this 'use server' file is a public server action. Both act only for the signed-in user,
 * and only on bonus video ads the sweep handed to that account (next_ads.buyerId).
 */

const MakeSchema = z.object({ leadId: z.string().uuid(), n: z.union([z.literal(2), z.literal(3), z.literal(4)]) });

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** The signed-in user's bonus video ads; none for anyone else or on a failed read. */
export async function listBonusVideoAds(): Promise<BonusVideoAd[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  try {
    return await bonusVideoAdsOf(userId);
  } catch (error) {
    console.error('❌ Bonus video ads not read:', error);
    return [];
  }
}

/** Makes one bonus video ad (or opens it, when it is made or being made). */
export async function makeBonusVideoAd(input: { leadId: string; n: number }): Promise<ApiResponse<{ jobId: string }>> {
  const userId = await currentUserId();
  if (!userId) return createApiError('Please sign in again.');
  const parsed = MakeSchema.safeParse(input);
  if (!parsed.success) return createApiError('This bonus video ad is not in your account.');
  try {
    const jobId = await makeOne(userId, parsed.data.leadId, parsed.data.n, true);
    return createApiSuccess({ jobId });
  } catch (error) {
    console.error('❌ Bonus video ad not started:', error);
    return createApiError(error instanceof Error && error.message.startsWith('This bonus') ? error.message : 'Your bonus video ad could not start. Please try again in a minute.');
  }
}
