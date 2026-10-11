/**
 * Google Analytics 4 and Microsoft Clarity on the free video ad opt-in page (owner 2026-10-11: "on the optin page we need
 * all the tracking, clarity etc"). FunnelTracking (components/free-video/funnel-tracking.tsx, in the funnel layout) starts
 * them; the landing page calls the track* functions below at the moments the funnel already measures (its first-party
 * events and the pixel's Lead and InitiateCheckout).
 *
 * Where they run: ONLY on the opt-in page /free-video-ad, only on app.bluefx.net, never for a European time zone (the
 * pixel's rule: these pages have no cookie banner), never for an internal visit (internal-visit.ts), and only when the
 * address and the referrer are clean (pageAllowed below). Clarity also needs CLARITY_PROJECT_ID (config.ts).
 * Why only there (review 2026-10-11): the thank-you page and /v/<token> carry the visitor's view token in the path, and
 * Google's own automatic features read the REAL address and title, whatever page_location and page_title we set: the
 * history page_view of a page change, site search, file downloads and outbound clicks (the /v/ page's download link is
 * a public link to the visitor's video ad), and the conversion ping of a key event (its url and tiba fields). Clarity
 * records the real address too. So:
 * - neither starts on any other funnel page (the steps after the opt-in are counted first-party, in the admin panel);
 * - leaving the opt-in page turns both off for the rest of that page load BEFORE the address changes: trackLead runs
 *   right before the landing page's router.push to /free-video-ad/thanks/<token>. Google Analytics gets its documented
 *   switch window['ga-disable-<id>'] = true, which drops every later hit (the history page_view of the move
 *   included); Clarity gets 'stop'. updateTrackedPage does the same for any other page change, as a backstop;
 * - only generate_lead may be marked as a key event in Google Analytics: it fires on the opt-in page, so its conversion
 *   ping carries the opt-in page's address and title. Never mark begin_checkout as a key event.
 *
 * No personal data goes to either: no email, name, website address or view token. pageAllowed keeps both off when the
 * address carries a query parameter outside TRACKED_PARAMS or a value outside SAFE_VALUE (an email from a mail merge
 * tag, a site search term), or when the referrer is one of the token pages. Every Google Analytics hit also carries a
 * cleaned page address (campaign parameters only), a fixed page title and a cleaned referrer; event parameters are fixed
 * values. Clarity masks every input box by itself; the step 2 sheet's title and the form messages quote the website and
 * carry data-clarity-mask. Clarity's identify call is never used.
 *
 * Local checks: NEXT_PUBLIC_FV_TRACKING_DEV=1 in the dev server's environment (or localStorage fv_tracking_debug=1)
 * logs every call as [gtag] and [clarity] in the console instead of loading Google's and Microsoft's scripts, on any
 * host and in any time zone, with or without a Clarity id. An internal visit still turns everything off, and so do the
 * page rules.
 *
 * Client-safe: no server imports.
 */

import { isInternalVisit } from './internal-visit';
import { isPlacement } from './offer';
import { browserTimeZone, europeanTimeZone, PIXEL_DATA, PIXEL_HOST } from './pixel';

/** The owner's Google Analytics 4 property (web stream measurement id). */
export const GA_MEASUREMENT_ID = 'G-7G7KH11L1T';

/** Google's documented switch: window['ga-disable-<measurement id>'] = true stops every later hit of that id on the page. */
const GA_DISABLE_KEY = `ga-disable-${GA_MEASUREMENT_ID}`;

/** localStorage key: '1' logs the gtag and clarity calls instead of loading the scripts (like fv_pixel_debug for the pixel). */
export const TRACKING_DEBUG_KEY = 'fv_tracking_debug';

/** The dev server switch (never set in a committed file). Next inlines it at build time. */
const DEV_SWITCH = process.env.NEXT_PUBLIC_FV_TRACKING_DEV === '1';

/** A Clarity project id: a few lowercase letters and digits. Anything else never reaches the snippet. */
export const CLARITY_ID = /^[a-z0-9]{6,20}$/;

/** The only page Google Analytics and Clarity run on. */
const OPT_IN_PATH = '/free-video-ad';

/** Clarity's script does not start when window.clarity.v is already set (its check for a second Clarity tag). */
const CLARITY_BLOCKED = 'fv-blocked';

/** Query parameters a Google Analytics page address keeps: campaign attribution only. */
const GA_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'gclid', 'ref'];

/**
 * Query parameters the opt-in page may carry when tracking starts: campaign tags, ad click ids and ClickBank's
 * affiliate hop. Any other one (a site search term, a merge tag, a hand-off we do not know): no tracking for that visit.
 */
const TRACKED_PARAMS = [...GA_PARAMS, 'fbclid', 'gad_source', 'gbraid', 'wbraid', 'msclkid', 'hopId', 'affiliate', 'tid', 'shield', 'vq'];

/** A query value that is safe in an address Google or Microsoft may see: words, digits and a little punctuation, never an @ or a slash. */
const SAFE_VALUE = /^[\w .,:+()|~-]{1,100}$/;

/** A view token in a path (FREE_VIDEO_TOKEN_PATTERN). */
const TOKEN_PART = /^[A-Za-z0-9_-]{22}$/;

export type TrackingMode = 'live' | 'debug';

/** What FunnelTracking loads: Google's script in live mode, and Microsoft's when Clarity may run on this page. */
export interface TrackingStart {
  mode: TrackingMode;
  clarity: boolean;
}

type Command = (...args: unknown[]) => void;
type ClarityCommand = Command & { q?: unknown[]; v?: string };
type TrackedWindow = Window & { dataLayer?: unknown[]; gtag?: Command; clarity?: ClarityCommand };

const state: { started: boolean; mode: TrackingMode | null; clarity: 'off' | 'on' | 'stopped' } = {
  started: false,
  mode: null,
  clarity: 'off',
};

/** Events sent before startTracking ran (the bluefx.net hand-off's form_start comes in the landing page's first effect). */
const early: { name: string; params: Record<string, unknown> }[] = [];

const trimmedPath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

/** A path of ours with any view token cut out, and whether it had one (/v/<token> → /v). */
function cleanPath(pathname: string): { path: string; tokenPage: boolean } {
  const parts = pathname.split('/').filter(Boolean);
  const kept = parts.filter((part) => !TOKEN_PART.test(part));
  return { path: `/${kept.join('/')}`, tokenPage: kept.length < parts.length };
}

/** The campaign parameters of a query string with safe values, or ''. */
function campaignQuery(search: string): string {
  const from = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of GA_PARAMS) {
    const value = from.get(key);
    if (value && SAFE_VALUE.test(value)) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `?${query}` : '';
}

/** The referrer without anything personal: another site's origin only, one of ours as a path without a token. */
function cleanReferrer(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const url = new URL(document.referrer);
    return url.origin === window.location.origin ? `${url.origin}${cleanPath(url.pathname).path}` : `${url.origin}/`;
  } catch {
    return undefined;
  }
}

/** The page fields every Google Analytics hit carries (gtag set): the opt-in page's address with campaign parameters, a fixed title, a cleaned referrer. */
function pageFields(): Record<string, string> {
  const referrer = cleanReferrer();
  return {
    page_location: `${window.location.origin}${OPT_IN_PATH}${campaignQuery(window.location.search)}`,
    page_title: 'Free video ad: opt-in page',
    ...(referrer ? { page_referrer: referrer } : {}),
  };
}

/**
 * True when this page view may be tracked at all: the opt-in page, every query parameter known and every value safe
 * (Google's automatic features and Clarity read the real address), and not reached from one of our token pages (the
 * referrer would carry the token).
 */
function pageAllowed(): boolean {
  if (trimmedPath(window.location.pathname) !== OPT_IN_PATH) return false;
  for (const [key, value] of new URLSearchParams(window.location.search)) {
    if (!TRACKED_PARAMS.includes(key) || !SAFE_VALUE.test(value)) return false;
  }
  try {
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin && cleanPath(referrer.pathname).tokenPage) return false;
    }
  } catch {
    return false;
  }
  return true;
}

function debugFlag(): boolean {
  try {
    return window.localStorage.getItem(TRACKING_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

/** null: nothing loads (an internal visit, another page or host, an unsafe address, a European time zone). 'debug': console only. */
function trackingMode(): TrackingMode | null {
  if (isInternalVisit()) return null;
  if (!pageAllowed()) return null;
  if (DEV_SWITCH || debugFlag()) return 'debug';
  if (window.location.hostname !== PIXEL_HOST) return null;
  return europeanTimeZone(browserTimeZone()) ? null : 'live';
}

/**
 * Once per page load (FunnelTracking calls it a tick after mount): decides the mode, defines gtag (and the Clarity queue)
 * and sends the config with the cleaned page fields, which also sends the page_view. Returns what FunnelTracking loads.
 */
export function startTracking(clarityProjectId: string): TrackingStart | null {
  if (typeof window === 'undefined') return null;
  if (state.started) return state.mode ? { mode: state.mode, clarity: state.clarity === 'on' } : null;
  state.started = true;
  try {
    const mode = trackingMode();
    if (!mode) return null;
    const w = window as TrackedWindow;
    if (mode === 'debug') {
      w.gtag = (...args: unknown[]) => console.log('[gtag]', ...args);
    } else {
      w.dataLayer = w.dataLayer || [];
      const layer = w.dataLayer;
      // The standard snippet's gtag: gtag.js reads Arguments objects from the dataLayer, not arrays.
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        layer.push(arguments);
      };
    }
    state.mode = mode;
    w.gtag('js', new Date());
    w.gtag('set', pageFields());
    w.gtag('config', GA_MEASUREMENT_ID, { send_page_view: true });

    if (mode === 'debug' || CLARITY_ID.test(clarityProjectId)) {
      if (mode === 'debug') {
        w.clarity = (...args: unknown[]) => console.log('[clarity]', ...args);
      } else {
        // The queue of Microsoft's standard snippet, defined first so the funnel_step below waits for the script.
        const queue: ClarityCommand = function clarity() {
          // eslint-disable-next-line prefer-rest-params
          (queue.q = queue.q || []).push(arguments);
        };
        w.clarity = w.clarity || queue;
      }
      state.clarity = 'on';
      w.clarity('set', 'funnel_step', 'landing');
    }
    for (const event of early.splice(0)) send(event.name, event.params);
    return { mode, clarity: state.clarity === 'on' };
  } catch {
    state.mode = null;
    return null;
  } finally {
    early.length = 0;
  }
}

/**
 * Turns Google Analytics and Clarity off for the rest of this page load, before the address leaves the opt-in page.
 * Google Analytics: the ga-disable switch (no later hit, the history page_view of the move included). Clarity: a running
 * Clarity gets 'stop'; one whose script has not run yet never starts (the v mark). Never started again on this page load.
 */
function stopTracking(): void {
  if (!state.mode) return;
  const w = window as TrackedWindow;
  const mode = state.mode;
  state.mode = null;
  (window as unknown as Record<string, unknown>)[GA_DISABLE_KEY] = true;
  if (mode === 'debug') console.log('[gtag]', 'ga-disable', GA_MEASUREMENT_ID);
  if (state.clarity !== 'on') return;
  state.clarity = 'stopped';
  const clarity = w.clarity;
  if (typeof clarity !== 'function') return;
  if (mode === 'debug' || (clarity.v && clarity.v !== CLARITY_BLOCKED)) clarity('stop');
  else clarity.v = CLARITY_BLOCKED;
}

/** Every page change inside the funnel (FunnelTracking): anywhere but the opt-in page, tracking stops (a backstop: trackLead stops it before the move). */
export function updateTrackedPage(pathname: string): void {
  if (!state.mode) return;
  try {
    if (trimmedPath(pathname) !== OPT_IN_PATH) stopTracking();
  } catch {
    // Measurement must never break the page.
  }
}

/**
 * One event to Google Analytics (and to Clarity while it records). Before startTracking it waits (at most 10 events);
 * after it, a no-op when nothing was started or tracking stopped. Never throws.
 */
function send(name: string, params: Record<string, unknown>): void {
  if (!state.started) {
    if (early.length < 10) early.push({ name, params });
    return;
  }
  if (!state.mode) return;
  try {
    const w = window as TrackedWindow;
    w.gtag?.('event', name, params);
    if (state.clarity === 'on') w.clarity?.('event', name);
  } catch {
    // Measurement must never break the page.
  }
}

/** form_start: the first focus of a website field, the same moment as the first-party form_start event. */
export function trackFormStart(): void {
  send('form_start', { form_name: 'free_video_ad' });
}

/**
 * generate_lead: the opt-in succeeded, the same moment as the pixel's Lead, while the address is still the opt-in page.
 * The landing page sends the visitor to the thank-you page (its address carries the view token) right after, so
 * tracking stops here, before the move.
 */
export function trackLead(): void {
  send('generate_lead', { lead_source: 'free_video_ad' });
  try {
    stopTracking();
  } catch {
    // Measurement must never break the page.
  }
}

/** The placement of a /go/<placement> link, when it is a known one. */
function placementOf(href: string): string | undefined {
  try {
    const part = new URL(href, window.location.href).pathname.split('/')[2] ?? '';
    return isPlacement(part) ? part : undefined;
  } catch {
    return undefined;
  }
}

/**
 * begin_checkout: a click on the AI Media Machine offer button, the same moment as the pixel's InitiateCheckout. Sent
 * only from the opt-in page (the offer under the form's "one free video ad per business" answer, fvland): on the other
 * pages tracking never runs. Never a key event (see the top of this file).
 */
export function trackCheckout(href: string): void {
  const { value, currency, content_name: itemName } = PIXEL_DATA.checkout;
  const placement = placementOf(href);
  send('begin_checkout', {
    currency,
    value,
    ...(placement ? { placement } : {}),
    items: [{ item_id: 'aimm_lifetime', item_name: itemName, price: value, quantity: 1 }],
  });
}
