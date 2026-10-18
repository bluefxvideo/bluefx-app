/**
 * Google Analytics 4 and Microsoft Clarity on the free video ad funnel (owner 2026-10-11: "on the optin page we need
 * all the tracking, clarity etc"; 2026-10-12: Clarity on the result page too, "nothing really private is on" it).
 * FunnelTracking (components/free-video/funnel-tracking.tsx, in the funnel layout) starts them; the landing page and the
 * offer buttons call the track* functions below at the moments the funnel already measures (its first-party events and
 * the pixel's Lead and InitiateCheckout).
 *
 * Where they run:
 * - Google Analytics: ONLY on the opt-in page /free-video-ad.
 * - Clarity: on the opt-in page and on the result pages (/free-video-ad/thanks/<token> and /v/<token>). It keeps
 *   recording across the opt-in page's move to the thank-you page (one session: form, making, video ad, offer) and starts
 *   on a direct visit to a result page (the emailed /v/ link).
 * - Both: only on app.bluefx.net, never for a European time zone (the pixel's rule: these pages have no cookie banner),
 *   never for an internal visit (internal-visit.ts), and only when every query parameter is a known one with a plain
 *   value (queryAllowed). The opt-in page is also left alone when the referrer is one of the token pages (Google would
 *   carry the token). Clarity also needs CLARITY_PROJECT_ID (config.ts). Decided once per page load: a page whose start
 *   was refused stays untracked after a move.
 * Why Google Analytics stays off the result pages (review 2026-10-11): they carry the visitor's view token in the path,
 * and Google's own automatic features read the REAL address and title, whatever page_location and page_title we set: the
 * history page_view of a page change, site search, file downloads and outbound clicks (the /v/ page's download link is a
 * public link to the visitor's video ad), and the conversion ping of a key event (its url and tiba fields). So:
 * - Google Analytics never starts on any other funnel page, the result pages included;
 * - leaving the opt-in page turns Google Analytics off for the rest of that page load BEFORE the address changes:
 *   trackLead runs right before the landing page's router.push to /free-video-ad/thanks/<token>. Google Analytics gets
 *   its documented switch window['ga-disable-<id>'] = true, which drops every later hit (the history page_view of the
 *   move included). updateTrackedPage does the same for any other page change, as a backstop;
 * - only generate_lead may be marked as a key event in Google Analytics: it fires on the opt-in page, so its conversion
 *   ping carries the opt-in page's address and title. Never mark begin_checkout as a key event.
 * Clarity on the result pages records the real address (the token: the owner's own Clarity project, his call
 * 2026-10-12). funnel_step is 'landing' on the opt-in page, then 'making' (queued, being made, final check) and
 * 'ready' (the video ad is on the page) from the page's own view (trackResultState). A page change to anywhere else in
 * the funnel stops Clarity for the rest of the page load.
 *
 * No personal data goes to either: no email, name or view token to Google Analytics; Clarity never gets the visitor's
 * first name or email: every element that prints the first name carries data-clarity-mask (the letter's "Hey <name>,"
 * on the ready view, the making view's title and its spoken copy); the website address may show (owner 2026-10-12). Every
 * Google Analytics hit carries a cleaned page address (campaign parameters only), a fixed page title and a cleaned
 * referrer; event parameters are fixed values. Clarity masks every input box by itself; the step 2 sheet's title and
 * the form messages quote the website and carry data-clarity-mask. Clarity's identify call is never used.
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
import type { OfferOpenSource } from '@/types/free-video';

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

/** The only page Google Analytics runs on (Clarity too, plus the result pages). */
const OPT_IN_PATH = '/free-video-ad';

/** The result pages Clarity runs on: the thank-you page and the emailed video ad page, each with its view token. */
const RESULT_PATHS = [/^\/free-video-ad\/thanks\/([A-Za-z0-9_-]{22})$/, /^\/v\/([A-Za-z0-9_-]{22})$/];

/** Clarity's script does not start when window.clarity.v is already set (its check for a second Clarity tag). */
const CLARITY_BLOCKED = 'fv-blocked';

/** Query parameters a Google Analytics page address keeps: campaign attribution only. */
const GA_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'gclid', 'ref'];

/**
 * Query parameters a tracked page may carry when tracking starts: campaign tags, ad click ids and ClickBank's
 * affiliate hop. Any other one (a site search term, a merge tag, a hand-off we do not know): no tracking for that visit.
 */
const TRACKED_PARAMS = [...GA_PARAMS, 'fbclid', 'gad_source', 'gbraid', 'wbraid', 'msclkid', 'hopId', 'affiliate', 'tid', 'shield', 'vq'];

/** A query value that is safe in an address Google or Microsoft may see: words, digits and a little punctuation, never an @ or a slash. */
// Up to 512: Facebook's newer click ids (fbclid with _aem_) run 150 to 200 characters; the character set still keeps out
// emails (@), paths (/) and encoded text.
const SAFE_VALUE = /^[\w .,:+()|~-]{1,512}$/;

/** A view token in a path (FREE_VIDEO_TOKEN_PATTERN). */
const TOKEN_PART = /^[A-Za-z0-9_-]{22}$/;

/** The page's view states that read as "being made" (queued, making, the owner's final check). */
const MAKING_STATES = ['queued', 'making', 'checking'];

export type TrackingMode = 'live' | 'debug';

/** The kind of funnel page tracking may run on. */
type PageKind = 'opt-in' | 'result';

/** Clarity's funnel_step tag: the opt-in page, then the result page while the video ad is made, then with it on the page. */
type FunnelStep = 'landing' | 'making' | 'ready';

/** What FunnelTracking loads: Google's script when Google Analytics runs on this page, Microsoft's when Clarity does. */
export interface TrackingStart {
  mode: TrackingMode;
  ga: boolean;
  clarity: boolean;
}

type Command = (...args: unknown[]) => void;
type ClarityCommand = Command & { q?: unknown[]; v?: string };
type TrackedWindow = Window & { dataLayer?: unknown[]; gtag?: Command; clarity?: ClarityCommand };
type Switch = 'off' | 'on' | 'stopped';

const state: { started: boolean; mode: TrackingMode | null; ga: Switch; clarity: Switch; start: TrackingStart | null; steps: Set<FunnelStep> } = {
  started: false,
  mode: null,
  ga: 'off',
  clarity: 'off',
  start: null,
  steps: new Set(),
};

/** Events sent before startTracking ran (the bluefx.net hand-off's form_start comes in the landing page's first effect). */
const early: { name: string; params: Record<string, unknown> }[] = [];

const trimmedPath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

/** The opt-in page, a result page, or null for any other address. */
function pageKindOf(pathname: string): PageKind | null {
  const path = trimmedPath(pathname);
  if (path === OPT_IN_PATH) return 'opt-in';
  return RESULT_PATHS.some((pattern) => pattern.test(path)) ? 'result' : null;
}

/** The view token of a result page's path (/free-video-ad/thanks/<token>, /v/<token>), else null. */
export function resultToken(pathname: string): string | null {
  const path = trimmedPath(pathname);
  for (const pattern of RESULT_PATHS) {
    const match = pattern.exec(path);
    if (match) return match[1];
  }
  return null;
}

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

/** True when every query parameter is a known one with a plain value (Google's automatic features and Clarity read the real address). */
function queryAllowed(): boolean {
  for (const [key, value] of new URLSearchParams(window.location.search)) {
    if (!TRACKED_PARAMS.includes(key) || !SAFE_VALUE.test(value)) return false;
  }
  return true;
}

/** True when the referrer is one of our token pages (Google Analytics would carry the token). A referrer that cannot be read counts as one. */
function fromTokenPage(): boolean {
  try {
    if (!document.referrer) return false;
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin && cleanPath(referrer.pathname).tokenPage;
  } catch {
    return true;
  }
}

function debugFlag(): boolean {
  try {
    return window.localStorage.getItem(TRACKING_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

/** null: nothing loads (an internal visit, another page or host, an unsafe address, a European time zone). 'debug': console only. */
function trackingMode(kind: PageKind | null): TrackingMode | null {
  if (isInternalVisit()) return null;
  if (!kind || !queryAllowed()) return null;
  if (kind === 'opt-in' && fromTokenPage()) return null;
  if (DEV_SWITCH || debugFlag()) return 'debug';
  if (window.location.hostname !== PIXEL_HOST) return null;
  return europeanTimeZone(browserTimeZone()) ? null : 'live';
}

/** Tags the Clarity session with a funnel step, once per step. */
function setStep(step: FunnelStep): void {
  if (state.clarity !== 'on' || state.steps.has(step)) return;
  state.steps.add(step);
  (window as TrackedWindow).clarity?.('set', 'funnel_step', step);
}

/**
 * Once per page load (FunnelTracking calls it a tick after mount): decides the mode and the page kind. On the opt-in
 * page it defines gtag and sends the config with the cleaned page fields (which also sends the page_view); on the opt-in
 * page and the result pages it defines the Clarity queue. Returns what FunnelTracking loads.
 */
export function startTracking(clarityProjectId: string): TrackingStart | null {
  if (typeof window === 'undefined') return null;
  if (state.started) return state.start;
  state.started = true;
  try {
    const kind = pageKindOf(window.location.pathname);
    const mode = trackingMode(kind);
    if (!mode || !kind) return null;
    const w = window as TrackedWindow;
    const clarityAllowed = mode === 'debug' || CLARITY_ID.test(clarityProjectId);
    if (kind === 'result' && !clarityAllowed) return null;
    state.mode = mode;

    if (kind === 'opt-in') {
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
      state.ga = 'on';
      w.gtag('js', new Date());
      w.gtag('set', pageFields());
      w.gtag('config', GA_MEASUREMENT_ID, { send_page_view: true });
    }

    if (clarityAllowed) {
      if (mode === 'debug') {
        w.clarity = (...args: unknown[]) => console.log('[clarity]', ...args);
      } else {
        // The queue of Microsoft's standard snippet, defined first so the calls below wait for the script.
        const queue: ClarityCommand = function clarity() {
          // eslint-disable-next-line prefer-rest-params
          (queue.q = queue.q || []).push(arguments);
        };
        w.clarity = w.clarity || queue;
      }
      state.clarity = 'on';
      // A result page's step comes from its view (trackResultState), so a direct visit to a finished video ad is never tagged 'making'.
      if (kind === 'opt-in') setStep('landing');
    }
    state.start = { mode, ga: state.ga === 'on', clarity: state.clarity === 'on' };
    for (const event of early.splice(0)) send(event.name, event.params);
    return state.start;
  } catch {
    state.mode = null;
    state.ga = 'off';
    state.clarity = 'off';
    state.start = null;
    return null;
  } finally {
    early.length = 0;
  }
}

/** Google Analytics off for the rest of this page load (the ga-disable switch: no later hit, the history page_view of a move included). */
function stopGoogleAnalytics(): void {
  if (state.ga !== 'on') return;
  state.ga = 'stopped';
  (window as unknown as Record<string, unknown>)[GA_DISABLE_KEY] = true;
  if (state.mode === 'debug') console.log('[gtag]', 'ga-disable', GA_MEASUREMENT_ID);
}

/** Clarity off for the rest of this page load: a running Clarity gets 'stop'; one whose script has not run yet never starts (the v mark). */
function stopClarity(): void {
  if (state.clarity !== 'on') return;
  state.clarity = 'stopped';
  const clarity = (window as TrackedWindow).clarity;
  if (typeof clarity !== 'function') return;
  if (state.mode === 'debug' || (clarity.v && clarity.v !== CLARITY_BLOCKED)) clarity('stop');
  else clarity.v = CLARITY_BLOCKED;
}

/**
 * Every page change inside the funnel (FunnelTracking): anywhere but the opt-in page, Google Analytics stops (a
 * backstop: trackLead stops it before the move); anywhere but the opt-in page and the result pages, Clarity stops too.
 * Neither starts again on this page load.
 */
export function updateTrackedPage(pathname: string): void {
  if (!state.mode) return;
  try {
    const kind = pageKindOf(pathname);
    if (kind !== 'opt-in') stopGoogleAnalytics();
    if (!kind) stopClarity();
  } catch {
    // Measurement must never break the page.
  }
}

/**
 * The result page's view state (FunnelTracking reads it from the page's own status query): Clarity's funnel_step
 * 'making' while the video ad is queued, made or checked, 'ready' once it is on the page. Other states (unreadable,
 * failed) add no step. Only on a result page while Clarity records. Never throws.
 */
export function trackResultState(viewState: string): void {
  try {
    if (state.clarity !== 'on' || pageKindOf(window.location.pathname) !== 'result') return;
    if (viewState === 'ready') setStep('ready');
    else if (MAKING_STATES.includes(viewState)) setStep('making');
  } catch {
    // Measurement must never break the page.
  }
}

/**
 * One event to Google Analytics (while it runs: the opt-in page only) and to Clarity (while it records). Before
 * startTracking it waits (at most 10 events); after it, a no-op when nothing runs. Never throws.
 */
function send(name: string, params: Record<string, unknown>): void {
  if (!state.started) {
    if (early.length < 10) early.push({ name, params });
    return;
  }
  if (!state.mode) return;
  try {
    const w = window as TrackedWindow;
    if (state.ga === 'on') w.gtag?.('event', name, params);
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
 * Google Analytics stops here, before the move. Clarity keeps recording onto the thank-you page.
 */
export function trackLead(): void {
  send('generate_lead', { lead_source: 'free_video_ad' });
  try {
    stopGoogleAnalytics();
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
 * begin_checkout: a click on the AI Media Machine offer button, the same moment as the pixel's InitiateCheckout. On the
 * result pages Clarity alone gets the event name; the opt-in page's offer (fvland) opens the sales page since
 * 2026-10-18, which is not a checkout and sends nothing. Never a key event (see the top of this file).
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

/**
 * offer_open: the offer card opened (from the download button under the video ad, or the phone buy bar), the same
 * moment as the first-party offer_open event. On the result pages that is Clarity only: the event name, and the tag
 * offer_open_from ('download' or 'bar') for filtering recordings. Never throws.
 */
export function trackOfferOpen(from: OfferOpenSource): void {
  send('offer_open', { from });
  try {
    if (state.clarity === 'on') (window as TrackedWindow).clarity?.('set', 'offer_open_from', from);
  } catch {
    // Measurement must never break the page.
  }
}
