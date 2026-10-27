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
export const PLACEMENTS = [
  'fvthank',
  'fvpage',
  'fvland',
  'fvthankcard',
  'fvpagecard',
  'fvready',
  'fvreadyend',
  'fvres1',
  'fvres2',
  'fvres3',
  'fvresads',
  'fvresbar',
  'fvres4',
  'fvres5',
  'fvres6',
  'fvrestools',
  'fvsplit',
  'fvrestut',
  'fvmail1',
  'fvmail2',
  'fvmail3',
  'fvmail4',
] as const;
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

/**
 * The checkout buttons of the result page (owner 2026-10-19: "we have payment buttons again", with the price, the
 * discount and the card logos): under the comparison (fvres1), under the bonus timer (fvres2), after the walkthrough
 * (fvres3), after the next 3 video ads (fvresads, owner 2026-10-19: "how do i get it? maybe some button there?") and the
 * bar at the bottom of a phone's screen (fvresbar). The sales-way page (result-sales-page.tsx, 2026-10-22) adds fvres4 (old
 * way), fvres5 (value table), fvres6 (still thinking) and fvrestools (the 4 tool groups' buttons). /go opens ClickBank's checkout with the placement
 * and the lead's id as the vendor tracking id (resultCheckoutUrl), so a sale paid with another email still finds its
 * lead, and the click is an InitiateCheckout like every checkout click.
 */
export const RESULT_PAGE_PLACEMENTS = ['fvres1', 'fvres2', 'fvres3', 'fvresads', 'fvresbar', 'fvres4', 'fvres5', 'fvres6', 'fvrestools', 'fvsplit', 'fvrestut'] as const satisfies readonly Placement[];
export type ResultPagePlacement = (typeof RESULT_PAGE_PLACEMENTS)[number];
export function isResultPagePlacement(value: string): value is ResultPagePlacement {
  return (RESULT_PAGE_PLACEMENTS as readonly string[]).includes(value);
}

/** The 8 characters of a lead's id inside a vtid that carries one ("fvready_1a2b3c4d", "fvres1_1a2b3c4d" → "1a2b3c4d"), null for any other tracking id. */
export function leadPrefixOfVtid(vtid: string | null | undefined): string | null {
  const match = /^(?:fvready|fvreadyend|fvland|fvres1|fvres2|fvres3|fvres4|fvres5|fvres6|fvresads|fvresbar|fvrestools|fvsplit|fvrestut)_([0-9a-f]{8})$/.exec(String(vtid ?? '').trim().toLowerCase());
  return match ? match[1] : null;
}
/** Every lifetime offer button on a funnel page: the pages' own buttons, the offer card's, the result page's buttons to the sales page and its checkout buttons. A cta_click on one of these is an offer click. */
export const OFFER_BUTTON_PLACEMENTS = [...PAGE_PLACEMENTS, ...CARD_PLACEMENTS, ...SALES_PAGE_PLACEMENTS, ...RESULT_PAGE_PLACEMENTS] as const satisfies readonly Placement[];
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

/**
 * The same lifetime deal in 3 payments of $100, 30 days apart (ClickBank item 2; the webhook gives lifetime on the
 * first payment). Owner 2026-10-23, after price objections: back as one link under the price box's button (fvsplit).
 */
export const SPLIT_CHECKOUT_URL = 'https://bluefx02.pay.clickbank.net/?cbitems=2&cbfid=55851&template=aimmbt';

/** The checkout with the placement as ClickBank's vendor tracking id (vtid: letters, digits and underscores). */
export const checkoutUrl = (placement: Placement) => `${LIFETIME_CHECKOUT_URL}&vtid=${placement}`;

/** A result page button's checkout: its placement and the lead's id in the vtid ("fvres1_1a2b3c4d", at most 17 of ClickBank's 24 characters). */
export function resultCheckoutUrl(placement: ResultPagePlacement, leadId?: string | null): string {
  const short = String(leadId ?? '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 8);
  const base = placement === 'fvsplit' ? SPLIT_CHECKOUT_URL : LIFETIME_CHECKOUT_URL;
  return `${base}&vtid=${short.length === 8 ? `${placement}_${short}` : placement}`;
}

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
  /** The regular price's product, $99 (after the launch clock). */
  product: 'video-creation',
  /**
   * The launch price (owner 2026-10-27): $49 on FastSpring's custom-video-ad for LAUNCH_DAYS from the lead's first visit
   * to the unlock page, then video-creation at $99. Both products unlock the video ad.
   */
  launchProduct: 'custom-video-ad',
  launchDays: 7,
  regularPrice: '$99',
  storefront: 'https://bluefx.onfastspring.com',
  tagKey: 'freeVideoLead',
  /** $49 since 2026-10-27 (owner: the unlock page sells the video ad itself, /v/<token>/unlock); the FastSpring product's own price must match. */
  price: '$49',
  /** Not a ClickBank tid: /go/fvunlock is special-cased to the FastSpring checkout. */
  placement: 'fvunlock',
} as const;

/** The unlock page of one lead (owner 2026-10-27): pay once, download the video ad without the watermark, changes included. */
export const unlockPagePath = (token: string) => `/v/${token}/unlock`;

/** Every FastSpring product that unlocks a free video ad. */
export const UNLOCK_PRODUCTS: readonly string[] = [UNLOCK.product, UNLOCK.launchProduct];

/** The FastSpring checkout for one lead's unlock, at the launch price or the regular one. */
export const unlockCheckoutUrl = (token: string, product: string = UNLOCK.launchProduct) =>
  `${UNLOCK.storefront}/${product}?tags=${UNLOCK.tagKey}:${encodeURIComponent(token)}`;

/** The same-origin link the unlock button uses: /go/fvunlock logs the click, then 302s to unlockCheckoutUrl(token). */
export const unlockGoUrl = (token: string) => `/go/${UNLOCK.placement}?t=${encodeURIComponent(token)}`;

/**
 * Unlimited Video Ads (owner 2026-10-25): the done-for-you video ad service, sold on its own page per lead
 * (/v/<token>/unlimited, service-page.ts) with the lead's free video ad on top. FastSpring subscriptions fulfilled by
 * the owner's team: the webhook only logs their events (the done-for-you branch of the FastSpring webhook: every path
 * containing 'editing-service'), never an app plan. The checkout carries the lead's view token as the tag
 * freeVideoLead so the owner sees whose free video ad the order belongs to.
 *
 * The price climbs on each lead's own clock (owner 2026-10-25): $99 a month for 3 days from the video ad's email,
 * then $299 a month for 7 days, then $599 a month for good. Whatever price a member joins at stays theirs.
 */
export interface ServicePhase {
  n: 1 | 2 | 3;
  /** The monthly price in dollars. */
  price: number;
  /** FastSpring product path; null while the owner has not made it yet (the buttons then ask to email support). */
  product: string | null;
  /** How long this price is held; null = for good. */
  hours: number | null;
}

export const SERVICE = {
  storefront: 'https://bluefx.onfastspring.com',
  /**
   * The popup cart the page's buttons open (FastSpring's plain popup code), the same one as the AI Media Machine's sales
   * page at ai.bluefx.net (owner 2026-10-25). A server that is not live opens the test copy, so a check never takes a live order.
   */
  popupStorefront: 'bluefx.onfastspring.com/popup-bluefx',
  popupTestStorefront: 'bluefx.test.onfastspring.com/popup-bluefx',
  tagKey: 'freeVideoLead',
  /** Not a ClickBank tid: /go/fvservice is special-cased to the FastSpring checkout of the lead's phase. */
  placement: 'fvservice',
  /** Any FastSpring path containing this is a service product (the webhook's done-for-you branch). */
  productMarker: 'editing-service',
  phases: [
    { n: 1, price: 99, product: 'starter-editing-service', hours: 72 },
    { n: 2, price: 299, product: 'growth-editing-service', hours: 168 },
    { n: 3, price: 599, product: 'VIP-Concierge-Editing-Service', hours: null },
  ] as const satisfies readonly ServicePhase[],
} as const;

/** The FastSpring checkout of one service product for one lead. */
export const serviceCheckoutUrl = (token: string, product: string) =>
  `${SERVICE.storefront}/${product}?tags=${SERVICE.tagKey}:${encodeURIComponent(token)}`;

/** The service emails' and old pages' checkout link: /go/fvservice logs the click, then 302s to serviceCheckoutUrl(token). */
export const serviceGoUrl = (token: string) => `/go/${SERVICE.placement}?t=${encodeURIComponent(token)}`;

/**
 * The Weekly Video Plan offered to an unlock buyer (owner 2026-10-27: one video ad first, then the monthly plan): always the
 * $99 product, whatever the lead's service clock says. /go/fvplan logs the click, then opens that checkout.
 */
export const PLAN_PLACEMENT = 'fvplan';
export const planGoUrl = (token: string) => `/go/${PLAN_PLACEMENT}?t=${encodeURIComponent(token)}`;
/** The public page that explains the plan at $99 (linked nowhere else, owner 2026-10-27). */
export const PLAN_INFO_PATH = '/weekly-video-plan-99';

/** The service page of one lead. */
export const servicePagePath = (token: string) => `/v/${token}/unlimited`;
