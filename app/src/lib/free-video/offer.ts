/**
 * The lifetime offer behind the free video ad funnel: placements (ClickBank tids),
 * the click-through links and the price ladder.
 *
 * Client-safe: no process.env and no server imports. The page components import this file.
 */

import { PHANTOM_CREDITS, PHANTOM_PRESENTER_CREDITS } from '@/lib/smart-video/pricing';

/**
 * Every place an offer button can sit: the thank-you page, the video ad page, the form's "one free video ad per
 * business" note, the offer card on the two result pages and the automation emails. A page button's value rides to
 * ClickBank's checkout as the vendor tracking id (vtid: letters, digits and underscores), so ClickBank's reports show
 * sales per placement.
 */
export const PLACEMENTS = ['fvthank', 'fvpage', 'fvland', 'fvthankcard', 'fvpagecard', 'fvready', 'fvreadyend', 'fvmail1', 'fvmail2', 'fvmail3', 'fvmail4'] as const;
export type Placement = (typeof PLACEMENTS)[number];

/**
 * The pages of the funnel, as placements: the thank-you page, /v/<token>, and the form's "one per business" refusal
 * (fvland, which opens the sales page since 2026-10-18, SALES_PAGE_PLACEMENTS). Each page's own "Get the AI Media
 * Machine" buttons use its placement. Also the type of a page's placement prop.
 */
export const PAGE_PLACEMENTS = ['fvthank', 'fvpage', 'fvland'] as const satisfies readonly Placement[];
export type PagePlacement = (typeof PAGE_PLACEMENTS)[number];
/**
 * The offer card's button (offer-card.tsx, owner 2026-10-12: the offer at the moment they act), one per result page:
 * fvthankcard on the thank-you page, fvpagecard on /v/<token>. The card opens from "Download without the watermark"
 * under the video ad and from the buy bar on phones. /go treats these like the page placements (a checkout click:
 * clicked_at, a cta_click row, Facebook's InitiateCheckout), and ClickBank's reports show the card's sales apart.
 */
export const CARD_PLACEMENTS = ['fvthankcard', 'fvpagecard'] as const satisfies readonly Placement[];
export type CardPlacement = (typeof CARD_PLACEMENTS)[number];
/**
 * The buttons to the proven AI Media Machine sales page (owner 2026-10-16: "we over-engineered it ... start from an
 * empty page"; the sales page is one of "our anchors, those things we know work"): the result page's, under the video
 * ad (fvready) and after the walkthrough (fvreadyend), and the form's "one free video ad per business" box (fvland,
 * owner 2026-10-18: "it should go to the sales page, not the checkout, just like we do with the thank you page"). /go
 * logs the click on a lead when there is one and opens LIFETIME_PAGE_URL with the affiliate's hop.
 */
export const SALES_PAGE_PLACEMENTS = ['fvready', 'fvreadyend', 'fvland'] as const satisfies readonly Placement[];
export type SalesPagePlacement = (typeof SALES_PAGE_PLACEMENTS)[number];
export function isSalesPagePlacement(value: string): value is SalesPagePlacement {
  return (SALES_PAGE_PLACEMENTS as readonly string[]).includes(value);
}
/** The AI Media Machine's own sales page, the one ClickBank sells from: the price, the stack, the guarantee and the checkout. */
export const LIFETIME_PAGE_URL = 'https://ai.bluefx.net/lifetime/';

/**
 * The vendor tracking id a sales page button sends on (owner 2026-10-19, after a $297 sale nobody could place): the
 * placement and, when the click comes from a lead, the first 8 characters of the lead's id ("fvready_1a2b3c4d": at most
 * 19 of ClickBank's 24 characters, letters, digits and underscores only). The sales page passes ?vtid= on to its
 * ClickBank buttons, ClickBank returns it with the sale (Zapier's trackingId), and the sweep pairs the sale with the
 * lead even when the buyer pays with another email.
 */
export function salesPageVtid(placement: SalesPagePlacement, leadId?: string | null): string {
  const short = String(leadId ?? '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 8);
  return short.length === 8 ? `${placement}_${short}` : placement;
}

/** The sales page with the button's vendor tracking id on it (salesPageVtid). */
export const salesPageUrl = (placement: SalesPagePlacement, leadId?: string | null) => `${LIFETIME_PAGE_URL}?vtid=${salesPageVtid(placement, leadId)}`;

/** The 8 characters of a lead's id inside a sales page vtid ("fvready_1a2b3c4d" → "1a2b3c4d"), null for any other tracking id. */
export function leadPrefixOfVtid(vtid: string | null | undefined): string | null {
  const match = /^(?:fvready|fvreadyend|fvland)_([0-9a-f]{8})$/.exec(String(vtid ?? '').trim().toLowerCase());
  return match ? match[1] : null;
}
/** Every lifetime offer button on a funnel page: the pages' own buttons, the offer card's and the result page's buttons to the sales page. A cta_click on one of these is an offer click. */
export const OFFER_BUTTON_PLACEMENTS = [...PAGE_PLACEMENTS, ...CARD_PLACEMENTS, ...SALES_PAGE_PLACEMENTS] as const satisfies readonly Placement[];
/** The placements used by the email buttons, in send order (E1, E2, E3). They open the lead's own video ad page, where the offer sits under the video ad. */
export const EMAIL_PLACEMENTS = ['fvmail1', 'fvmail2', 'fvmail3', 'fvmail4'] as const satisfies readonly Placement[];

/** The offer card's placement on a result page: fvpagecard on /v/<token>, fvthankcard on the thank-you page (fvland has no card). */
export const cardPlacementOf = (page: PagePlacement): CardPlacement => (page === 'fvpage' ? 'fvpagecard' : 'fvthankcard');

export function isEmailPlacement(value: string): value is (typeof EMAIL_PLACEMENTS)[number] {
  return (EMAIL_PLACEMENTS as readonly string[]).includes(value);
}

/** True for a placement of the offer card (fvthankcard, fvpagecard). */
export function isCardPlacement(value: string): value is CardPlacement {
  return (CARD_PLACEMENTS as readonly string[]).includes(value);
}

/** True for an allow-listed placement; /go/<placement> answers 404 for anything else, so it is never an open redirect. */
export function isPlacement(value: string): value is Placement {
  return (PLACEMENTS as readonly string[]).includes(value);
}

/**
 * ClickBank's checkout for the AI Media Machine lifetime deal (vendor bluefx02), the same link the lifetime page's buy
 * buttons use. The offer card on the funnel pages already shows what the buyer gets, the price and the guarantee, so its
 * button opens this checkout directly (owner 2026-10-08: sending people on to the lifetime page told them a different
 * story and added a step). No affiliate nickname: these come in as the vendor's own sales.
 */
export const LIFETIME_CHECKOUT_URL = 'https://bluefx02.pay.clickbank.net/?cbitems=1&cbfid=55851&template=aimmbt';

/** The checkout with the placement as ClickBank's vendor tracking id (vtid: letters, digits and underscores). */
export const checkoutUrl = (placement: Placement) => `${LIFETIME_CHECKOUT_URL}&vtid=${placement}`;

/** The same-origin link the buttons use: /go logs the click on the lead, then 302s to checkoutUrl(placement) (an email button: to the video ad page). */
export const goUrl = (placement: Placement, token: string) => (token ? `/go/${placement}?t=${encodeURIComponent(token)}` : `/go/${placement}`);

/**
 * The owner's price ladder, exactly as the live ai.bluefx.net/lifetime/ page shows it: $997 struck through,
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
/** 600 / 50 credits per Phantom video ad = 12 video ads a month without an AI presenter. */
export const VIDEO_ADS_PER_MONTH = Math.floor(LIFETIME_MONTHLY_CREDITS / PHANTOM_CREDITS);
/**
 * 600 / 60 = 10 video ads a month like the free one, which opens with an AI presenter (runner.ts presenter: true, 10
 * credits more): the number the thank-you offer uses (owner 2026-10-08, one number everywhere).
 */
export const VIDEO_ADS_LIKE_FREE_PER_MONTH = Math.floor(LIFETIME_MONTHLY_CREDITS / (PHANTOM_CREDITS + PHANTOM_PRESENTER_CREDITS));

/**
 * What one video ad like the free one works out to: the lifetime price over a year of VIDEO_ADS_LIKE_FREE_PER_MONTH
 * ($297 / 120 = $2.48), said as "under $3" (the owner's own words in a reply, 2026-10-08: "just under $3 when we break
 * down the math"). The page never shows the division (his girlfriend, same day: "so its 10 or 100 or ??").
 */
export const PRICE_PER_VIDEO_AD_UNDER = `$${Math.ceil(Number(OFFER.now.replace(/\D/g, '')) / (VIDEO_ADS_LIKE_FREE_PER_MONTH * 12))}`;

/**
 * The 3-day bonus (owner 2026-10-08: "i love the deadline but its too long, 24h or 3 days"): a lead who buys the AI
 * Media Machine within CLEAN_COPY_HOURS of the free video ad being ready gets this video ad in the account without the
 * watermark (claim.ts renders the copy clean); a later buyer gets the watermarked file, which one edit makes clean.
 * Existing customers, and a signed-in customer claiming from the page with another email, always get it clean. 72
 * hours, so the day-1 email still lands inside the window.
 */
export const CLEAN_COPY_HOURS = 72;
const HOUR_MS = 3_600_000;

/** Until when this video ad goes into a buyer's account clean, as an ISO time; null when unknown, past or cleaned up. */
export function cleanCopyUntil(
  lead: { status: string; video_url: string | null; finished_at: string | null; files_cleaned_at?: string | null },
  now = Date.now()
): string | null {
  if (lead.status !== 'done' || !lead.video_url || !lead.finished_at || lead.files_cleaned_at) return null;
  const until = Date.parse(lead.finished_at) + CLEAN_COPY_HOURS * HOUR_MS;
  return Number.isFinite(until) && until > now ? new Date(until).toISOString() : null;
}

/** Whether a copy of this lead's video ad is rendered clean (see CLEAN_COPY_HOURS). An unknown time counts for the buyer. */
export function cleanCopyEarned(lead: { is_customer: boolean; bought_at: string | null; finished_at: string | null }): boolean {
  if (lead.is_customer || !lead.bought_at || !lead.finished_at) return true;
  const bought = Date.parse(lead.bought_at);
  const finished = Date.parse(lead.finished_at);
  return !Number.isFinite(bought) || !Number.isFinite(finished) || bought <= finished + CLEAN_COPY_HOURS * HOUR_MS;
}

/** Where an existing customer goes instead of the offer: The Phantom inside the app. */
export const PHANTOM_PATH = '/dashboard/smart-video';

/** "Open this video ad in the AI Media Machine": a copy of the finished video ad in the signed-in customer's account (claim.ts). */
export const claimUrl = (token: string) => `/go/claim?t=${encodeURIComponent(token)}`;

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
