/**
 * The owner's own visits to the free video ad funnel (owner 2026-10-11: his visits must not count anywhere): a
 * first-party cookie fv_internal=1 marks a browser as internal for a year. While it is set, the funnel pages load no
 * Google Analytics, no Clarity and no Facebook pixel, the page events (POST /api/free-video/event) are dropped, and the
 * server sends no Conversions API event for the request.
 *
 * - Any funnel page with ?internal=1 sets the cookie, ?internal=0 clears it; the parameter is then taken out of the address.
 * - The admin panel sets it too, for every admin who opens it (dashboard/admin/page.tsx): a sign-in check on the funnel
 *   pages themselves would cost a Supabase call on every page.
 *
 * Client-safe: no server imports. hasInternalCookie() also runs on the server, on a Cookie header.
 */

export const INTERNAL_COOKIE = 'fv_internal';
/**
 * The browser's visitor id (localStorage fv_vid, the one the page events carry) on an offer button's /go link, so the
 * click's cta_click event names its browser and the admin numbers can leave out the owner's own clicks (funnel-stats.ts).
 */
export const CLICK_VISITOR_PARAM = 'vid';
/** The shape the event route accepts for a visitor id. */
export const VISITOR_ID_PATTERN = /^[\w-]{1,40}$/;
/** ?internal=1 marks this browser as internal, ?internal=0 unmarks it. */
export const INTERNAL_PARAM = 'internal';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const MARKED = new RegExp(`(?:^|;\\s*)${INTERNAL_COOKIE}=1(?:;|$)`);

/** True when a Cookie header (or document.cookie) carries fv_internal=1. */
export function hasInternalCookie(cookieHeader: string | null | undefined): boolean {
  return Boolean(cookieHeader && MARKED.test(cookieHeader));
}

/** Marks (or unmarks) this browser as internal: the fv_internal cookie for a year on this host. Never throws. */
export function markInternalBrowser(internal = true): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = internal
      ? `${INTERNAL_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`
      : `${INTERNAL_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // Cookies blocked: the visit simply counts.
  }
}

/** Reads ?internal=1 or ?internal=0 once, sets or clears the cookie, and takes the parameter out of the address. */
function applyInternalParam(): void {
  const url = new URL(window.location.href);
  const value = url.searchParams.get(INTERNAL_PARAM);
  if (value !== '1' && value !== '0') return;
  markInternalBrowser(value === '1');
  url.searchParams.delete(INTERNAL_PARAM);
  // The same call the landing page uses for ?website=: Next's router keeps its own history state.
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** True for the owner's own browser. Every tracker on the funnel pages asks this first. Never throws. */
export function isInternalVisit(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    applyInternalParam();
    return hasInternalCookie(document.cookie);
  } catch {
    return false;
  }
}
