import { createAdminClient } from '@/app/supabase/server';
import { isLive } from '@/lib/free-video/config';

/**
 * Is the credit bank launched (credit_bank_settings.starts_at set and reached)? The funnel pages use this to pick
 * their sales copy: "100 complete video ads, ready whenever you need them" once new lifetime buyers get 5,000
 * credits, today's "10 every month, for life" until then (owner 2026-11-02).
 *
 * One small query, cached per process, and false on any error, so a failed read always shows today's copy.
 * Server only (admin client).
 */

/** How long one read of the launch switch is reused. Polled status pages call this every few seconds. */
const CACHE_MS = 60_000;

let cache: { at: number; startsAt: string | null } | null = null;

/** True when the switch is set and its time has come. Pure, for the cached value. */
export function bankLiveAt(startsAt: string | null, now = Date.now()): boolean {
  if (!startsAt) return false;
  const at = Date.parse(startsAt);
  return Number.isFinite(at) && now >= at;
}

/** Whether the pages should show the credit bank copy now. Never throws. */
export async function isCreditBankLive(): Promise<boolean> {
  // Local preview only (never on the live site): PREVIEW_BANK_COPY=1 shows the new copy before launch.
  if (!isLive() && process.env.PREVIEW_BANK_COPY === '1') return true;
  if (cache && Date.now() - cache.at < CACHE_MS) return bankLiveAt(cache.startsAt);
  try {
    // credit_bank_settings is not in the generated database types yet.
    const { data, error } = await (createAdminClient() as any).from('credit_bank_settings').select('starts_at').eq('id', 1).maybeSingle();
    if (error) {
      console.warn('⚠️ [credit-bank] Launch switch unreadable, showing today\'s copy:', error.message);
      cache = { at: Date.now(), startsAt: null };
      return false;
    }
    const startsAt = typeof data?.starts_at === 'string' ? data.starts_at : null;
    cache = { at: Date.now(), startsAt };
    return bankLiveAt(startsAt);
  } catch (error) {
    console.warn('⚠️ [credit-bank] Launch switch read failed, showing today\'s copy:', String(error).slice(0, 160));
    return false;
  }
}
