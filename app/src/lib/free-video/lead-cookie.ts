/**
 * The bfx_fv cookie: a lead's view token, set on .bluefx.net while they look at their free video ad (/v/<token>,
 * /v/<token>/unlock, /free-video-ad/thanks/<token>). bluefx.net's ClickBank OTO3 page (the free website check,
 * client-bluefx netlify/functions/website-check.js) reads it to show the findings for this buyer's own website. The
 * token is the same one already in the page's address, so the cookie reveals nothing new.
 */

const TOKEN_PATHS = [/^\/v\/([A-Za-z0-9_-]{22})(?:\/unlock)?\/?$/, /^\/free-video-ad\/thanks\/([A-Za-z0-9_-]{22})\/?$/];
const COOKIE = 'bfx_fv';
const MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

/** The view token in a funnel page's path, null on any other page. */
export function leadTokenOfPath(pathname: string): string | null {
  for (const pattern of TOKEN_PATHS) {
    const match = pattern.exec(pathname);
    if (match) return match[1];
  }
  return null;
}

/** Sets bfx_fv for this page's token, only on a bluefx.net host. Never throws. */
export function rememberLeadToken(pathname: string): void {
  try {
    const token = leadTokenOfPath(pathname);
    const host = window.location.hostname;
    if (!token || !(host === 'bluefx.net' || host.endsWith('.bluefx.net'))) return;
    document.cookie = `${COOKIE}=${token}; Domain=.bluefx.net; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
  } catch {
    // A cookie must never break the page.
  }
}
