/**
 * The BlueFx Meta pixel on the free video ad funnel (Facebook ads test, owner 2026-10-08): the ids, the event ids that
 * let Facebook count a browser event and its Conversions API twin once, and the browser calls.
 *
 * Client-safe: no process.env and no server imports. The server side is meta.ts.
 *
 * - Lead: a free video ad request the server accepted. Browser (the landing page, with the id from the answer) and server
 *   (POST /api/free-video), the same event id.
 * - InitiateCheckout: a click on the AI Media Machine lifetime offer. Browser (OfferButton) and server (/go/<placement>),
 *   the same event id, carried to the server as ?e=. Email clicks are server only.
 * - Purchase: the $99 clean video ad, server only (the FastSpring webhook), with the click id saved at the request.
 */

import { OFFER } from './offer';

/** The BlueFx pixel: the same one bluefx.net, ai.bluefx.net and the 24-Hour Video Ad pages use. */
export const META_PIXEL_ID = '1505435609743490';

/** The live funnel's host. The pixel loads only there, so local and preview servers never send events. */
export const PIXEL_HOST = 'app.bluefx.net';

/** localStorage key: '1' makes fbq log to the console instead of loading Facebook's script (for checks on localhost). */
export const PIXEL_DEBUG_KEY = 'fv_pixel_debug';

/** The lifetime price as a number, from the one the offer shows ($297). */
export const LIFETIME_VALUE_USD = Number(OFFER.now.replace(/[^\d.]/g, ''));

/** custom_data of each event, the same in the browser and on the server. */
export const PIXEL_DATA = {
  lead: { content_name: 'Free video ad', content_category: 'free_video_ad' },
  checkout: { content_name: 'AI Media Machine lifetime', content_category: 'free_video_ad', value: LIFETIME_VALUE_USD, currency: 'USD' },
  purchase: { content_name: 'Free video ad: clean version', content_category: 'free_video_ad', content_type: 'product' },
} as const;

/** The Lead's event id: the browser gets it in the form's answer, the server sends the same one. */
export const leadEventId = (leadId: string) => `fvlead-${leadId}`;

/** The $99 unlock's event id: the FastSpring order id. */
export const purchaseEventId = (orderId: string) => `fvunlock-${orderId}`;

/** An InitiateCheckout event id made in the browser and passed to /go as ?e=. */
export const CHECKOUT_EVENT_ID = /^fvic-[A-Za-z0-9-]{8,40}$/;

export function newCheckoutEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `fvic-${crypto.randomUUID()}`;
  } catch {
    // An old browser without randomUUID: fall through.
  }
  return `fvic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** The query parameter /go reads the browser's event id from. */
export const CHECKOUT_EVENT_PARAM = 'e';

/** A /go link with the browser's event id added. */
export function withCheckoutEventId(href: string, eventId: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}${CHECKOUT_EVENT_PARAM}=${encodeURIComponent(eventId)}`;
}

/**
 * The EU and EEA, the UK and Switzerland need a cookie banner before a pixel may run. The ads target none of them, so
 * visitors from there get no pixel and no Conversions API event. The browser knows only its time zone: every Europe/*
 * zone and the Atlantic islands of Spain, Portugal, Iceland and the Faroes count (the rest of Europe gets no ads either).
 */
const EUROPEAN_TIME_ZONE = /^(Europe\/|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe|Faeroe)$|Arctic\/Longyearbyen$|GB$|GB-Eire$|Eire$|Iceland$|Portugal$|WET$|CET$|MET$|EET$)/;

export function europeanTimeZone(timeZone: string | null | undefined): boolean {
  return Boolean(timeZone && EUROPEAN_TIME_ZONE.test(timeZone));
}

/** The browser's time zone (Intl), or undefined. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** The fbclid of the address the visitor landed on (the Facebook ad click), when it has a clean shape. */
export function clickIdFromUrl(): string | undefined {
  try {
    const value = new URLSearchParams(window.location.search).get('fbclid')?.trim() ?? '';
    return /^[\w.-]{10,500}$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

type Fbq = (command: 'track' | 'init', name: string, data?: Record<string, unknown>, options?: { eventID: string }) => void;

/** 'live' on app.bluefx.net outside Europe, 'debug' with the localStorage flag (console only), else null: no pixel. */
export function pixelMode(): 'live' | 'debug' | null {
  if (typeof window === 'undefined') return null;
  try {
    if (window.localStorage.getItem(PIXEL_DEBUG_KEY) === '1') return 'debug';
  } catch {
    // Storage blocked: no debug mode.
  }
  if (window.location.hostname !== PIXEL_HOST) return null;
  return europeanTimeZone(browserTimeZone()) ? null : 'live';
}

/** One pixel event with its event id. A no-op without the pixel (Europe, ad blockers, local servers). Never throws. */
export function trackPixel(name: 'Lead' | 'InitiateCheckout', data: Record<string, unknown>, eventId: string): void {
  try {
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    if (typeof fbq === 'function') fbq('track', name, data, { eventID: eventId });
  } catch {
    // Measurement must never break the page.
  }
}
