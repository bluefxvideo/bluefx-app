/**
 * The lifetime offer behind the free video ad funnel: placements (ClickBank tids),
 * the click-through links and the price ladder.
 *
 * Client-safe: no process.env and no server imports. The page components import this file.
 */

import { PHANTOM_CREDITS } from '@/lib/smart-video/pricing';

/**
 * Every place an offer button can sit. Each value is also the ClickBank tid, so the
 * ClickBank TID report shows sales per placement: the thank-you page, the video ad page
 * and the 3 automation emails.
 */
export const PLACEMENTS = ['fvthank', 'fvpage', 'fvland', 'fvmail1', 'fvmail2', 'fvmail3'] as const;
export type Placement = (typeof PLACEMENTS)[number];

/** The placements shown on the funnel pages: the thank-you page, /v/<token>, and the form's "one per business" refusal (fvland). */
export const PAGE_PLACEMENTS = ['fvthank', 'fvpage', 'fvland'] as const satisfies readonly Placement[];
/** The placements used by the email buttons, in send order (E1, E2, E3). */
export const EMAIL_PLACEMENTS = ['fvmail1', 'fvmail2', 'fvmail3'] as const satisfies readonly Placement[];

/** True for an allow-listed placement; /go/<placement> answers 404 for anything else, so it is never an open redirect. */
export function isPlacement(value: string): value is Placement {
  return (PLACEMENTS as readonly string[]).includes(value);
}

/** The live lifetime page (ClickBank vendor bluefx02). Its hop.min.js forwards affiliate and tid to the checkout. */
export const OFFER_PAGE_URL = 'https://ai.bluefx.net/lifetime/';
/** The owner's own ClickBank nickname, the same one his YouTube links use. */
export const OFFER_AFFILIATE = 'bluefx01';

/** Where every offer click lands, with the placement as the ClickBank tid. */
export const offerUrl = (tid: Placement) => `${OFFER_PAGE_URL}?affiliate=${OFFER_AFFILIATE}&tid=${tid}`;

/** The same-origin link the buttons use: /go logs the click on the lead, then 302s to offerUrl(placement). */
export const goUrl = (placement: Placement, token: string) => (token ? `/go/${placement}?t=${encodeURIComponent(token)}` : `/go/${placement}`);

/**
 * The owner's price ladder, exactly as the live /lifetime/ page shows it: $997 struck through,
 * $297, and the "$700 off" badge. Funnel pages only. Emails never print the buy price
 * ("$700 off" is the only number an email may carry).
 */
export const OFFER = { was: '$997', now: '$297', off: '$700 off' } as const;

/**
 * Credits a lifetime member gets every month. Checked in code at 4bab646: a ClickBank lifetime
 * sale gets an active subscription with credits_per_month 600 and a 30-day credit period
 * (clickbank/route.ts grantCredits), and ensureCreditsForUsage tops an active account back up to
 * 600 whenever that period has lapsed (every dashboard visit calls /api/credits/ensure).
 */
export const LIFETIME_MONTHLY_CREDITS = 600;
/** 600 / 50 credits per Phantom video ad = 12 video ads a month: the number the offer copy uses. */
export const VIDEO_ADS_PER_MONTH = Math.floor(LIFETIME_MONTHLY_CREDITS / PHANTOM_CREDITS);

/** Where an existing customer goes instead of the offer: The Phantom inside the app. */
export const PHANTOM_PATH = '/dashboard/smart-video';

/**
 * Offer 1: the $99 unlock (owner 2026-10-06). The owner's FastSpring one-time product video-creation
 * (https://bluefx.onfastspring.com/video-creation, $99). Its path must never contain "credit": the webhook's
 * credit-pack routing matches on it. Every order of this product is read as a free video ad unlock.
 * The hosted link carries the lead's view token as a FastSpring tag, the same ?tags=key:value form
 * buy-credits-dialog.tsx uses for userId; the webhook reads it back at data.tags.freeVideoLead.
 */
export const UNLOCK = {
  product: 'video-creation',
  storefront: 'https://bluefx.onfastspring.com',
  tagKey: 'freeVideoLead',
  price: '$99',
  /** Not a ClickBank tid: /go/fvunlock is special-cased to the FastSpring checkout. */
  placement: 'fvunlock',
} as const;

/** The FastSpring checkout for one lead's unlock. */
export const unlockCheckoutUrl = (token: string) =>
  `${UNLOCK.storefront}/${UNLOCK.product}?tags=${UNLOCK.tagKey}:${encodeURIComponent(token)}`;

/** The same-origin link the unlock button uses: /go/fvunlock logs the click, then 302s to unlockCheckoutUrl(token). */
export const unlockGoUrl = (token: string) => `/go/${UNLOCK.placement}?t=${encodeURIComponent(token)}`;
