import { PIXEL_HOST } from '@/lib/free-video/pixel';
import { type ClickBankHop, ClickBankHopSchema } from '@/types/free-video';

/**
 * ClickBank affiliate attribution for the funnel (Direct Offer Tracking), the way the lifetime page does it.
 *
 * An affiliate's Direct Tracking Link is our landing page with ?affiliate=<nickname> (or ?shield=<encrypted>). ClickBank's
 * script on the page (clickbank-tracking.tsx) registers the click as a hop, sets the vq cookie on .bluefx.net, puts
 * ?hopId= in the address and appends hopId and vq to every link of the page, the /go buttons included. The order form
 * reads the hopId from its address, so the affiliate is credited even without the cookie (another browser). What the
 * browser holds at the form submit is kept on the lead (clickbank-hops.ts), and /go puts it on the checkout link for a
 * click that comes from the emails on another device. Pure helpers only: safe in the browser.
 */

/** The seller account whose order form the funnel's buttons open (offer.ts LIFETIME_CHECKOUT_URL). */
export const CLICKBANK_VENDOR = 'bluefx02';
export const CLICKBANK_SCRIPT_URL = 'https://scripts.clickbank.net/hop.min.js';
/** The host ClickBank's script runs on: the live site, where the listed landing page is. */
export const CLICKBANK_HOST = PIXEL_HOST;
/** The free_video_events row that keeps a lead's attribution (meta = ClickBankHop, ref = the affiliate). */
export const CB_HOP_EVENT = 'cb_hop' as const;

/** Keeps the valid values of a raw hop; undefined when none is left. */
export function cleanHop(raw: Record<string, unknown>): ClickBankHop | undefined {
  const parsed = ClickBankHopSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string' && v !== '')));
  if (!parsed.success) return undefined;
  const hop = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as ClickBankHop;
  return Object.keys(hop).length ? hop : undefined;
}

/** The attribution the browser holds now: the address's affiliate, shield and hopId, and the vq cookie the script set. */
export function hopFromBrowser(): ClickBankHop | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const params = new URLSearchParams(window.location.search);
    const vq = document.cookie.match(/(?:^|;\s*)vq=([^;]*)/)?.[1];
    return cleanHop({ affiliate: params.get('affiliate'), shield: params.get('shield'), hopId: params.get('hopId'), vq });
  } catch {
    return undefined;
  }
}

/** The hop ClickBank's script appended to a /go link (hopId and vq) when it rewrote the page's links. */
export function hopFromSearchParams(params: URLSearchParams): ClickBankHop | undefined {
  return cleanHop({ hopId: params.get('hopId'), vq: params.get('vq') });
}

/** The checkout link with the hop on it, as ClickBank's own script rewrites pay links: hopId and vq. */
export function withHop(url: string, hop: ClickBankHop | undefined): string {
  if (!hop?.hopId && !hop?.vq) return url;
  const out = new URL(url);
  if (hop.hopId) out.searchParams.set('hopId', hop.hopId);
  if (hop.vq) out.searchParams.set('vq', hop.vq);
  return out.toString();
}

/** What the admin shows for a lead: the affiliate's nickname, "shield" for an encrypted link, null without an affiliate. */
export function hopLabel(hop: ClickBankHop | null | undefined): string | null {
  if (!hop) return null;
  return hop.affiliate ?? (hop.shield ? 'shield' : null);
}
