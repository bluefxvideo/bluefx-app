import { eventsTable } from '@/lib/free-video/leads';
import { UNLOCK } from '@/lib/free-video/offer';

/** The unlock price one lead sees now: the launch price until its clock runs out, then the regular price. */
export interface UnlockPrice {
  launch: boolean;
  /** What the button charges, e.g. '$49'. */
  price: string;
  /** The regular price, struck through while the launch price runs. */
  regular: string;
  product: string;
  /** When the launch price ends (ISO); null once it has. */
  endsAt: string | null;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Each lead's own launch clock (owner 2026-10-27: "$99, today $49"): LAUNCH_DAYS from the lead's first visit to the
 * unlock page (its first unlock_view event), so the deadline on the page is true. A lead who has not visited yet starts
 * the clock now. A database error keeps the launch price, so a bad read never charges more.
 */
export async function unlockPriceOf(leadId: string, now = Date.now()): Promise<UnlockPrice> {
  let firstView = now;
  try {
    const { data, error } = await eventsTable().select('at').eq('lead_id', leadId).eq('event', 'unlock_view').order('at', { ascending: true }).limit(1);
    if (error) throw new Error(error.message);
    const at = data?.[0]?.at ? Date.parse(data[0].at) : NaN;
    if (Number.isFinite(at)) firstView = at;
  } catch (error) {
    console.warn('⚠️ [free-video] unlock price clock not read, launch price kept:', error);
  }
  const ends = firstView + UNLOCK.launchDays * DAY_MS;
  return now < ends
    ? { launch: true, price: UNLOCK.price, regular: UNLOCK.regularPrice, product: UNLOCK.launchProduct, endsAt: new Date(ends).toISOString() }
    : { launch: false, price: UNLOCK.regularPrice, regular: UNLOCK.regularPrice, product: UNLOCK.product, endsAt: null };
}
