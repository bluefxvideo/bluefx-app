import { SERVICE } from '@/lib/free-video/offer';
import { SERVICE_PAGE_HTML } from '@/lib/free-video/service-page-html';
import { renderServicePage, SERVICE_MEDIA_BASE } from '@/lib/free-video/service-page';

/**
 * The official, public Weekly Video Plan page (was Unlimited Video Ads until 2026-10-26) (owner 2026-10-25): /unlimited-video-ads. The same approved page as
 * the per-lead one, at the public price (the last phase of SERVICE.phases, $599 a month, no countdown), made for
 * anyone instead of one lead: a sample video ad on top instead of their own, and the 13 example video ads numbered as styles (#styles) so members can ask for "Style 3".
 * Members' emails link here so they can always see the samples and the public price next to their own locked price.
 * Built from SERVICE_PAGE_HTML by exact replacements: a line that is not found is logged, never silently skipped.
 */

/** The 12 example video ads in page order, as styles (style 13 is added after them). */
const STYLES: Array<{ business: string; style: string; text: string }> = [
  { business: 'Hauling company', style: 'News studio', text: 'a news anchor puts the business in the local spotlight' },
  { business: 'Realtor', style: 'Presenter on camera', text: 'a presenter on camera, in front of a home for sale' },
  { business: 'Landscaping', style: 'Happy customer', text: 'a happy customer tells her story on camera' },
  { business: 'Bakery', style: 'Owner on camera', text: 'the owner on camera, then the fresh bakes' },
  { business: 'Barbershop', style: 'Vintage TV', text: 'a 1950s black-and-white TV ad' },
  { business: 'Roofing', style: 'Bold captions', text: 'bold captions over photos of the roof' },
  { business: 'Dentist', style: 'Cartoon', text: 'friendly drawings and speech bubbles' },
  { business: 'Auto repair shop', style: 'Comic book', text: 'bold comic panels and big speech bubbles' },
  { business: 'Café', style: 'Chalkboard', text: 'a hand draws the menu in chalk' },
  { business: 'Plumber', style: 'Clay', text: 'a stop-motion clay look' },
  { business: 'Family bakery', style: 'Scrapbook', text: 'photos pinned to a cork board' },
  { business: 'Honey brand', style: 'Product shots', text: 'product shots that move, from the beehive to the breakfast table' },
];

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const article = (noun: string) => (/^[aeiou]/i.test(noun) ? 'an' : 'a');

/** Exact swaps from the per-lead page to the public one. */
function publicSwaps(): Array<[string, string]> {
  const swaps: Array<[string, string]> = [
    ['<meta name="robots" content="noindex, nofollow">', ''],
    // The owner's 3-minute video on top, wide (owner 2026-11-11), so the line above it names it.
    ['<p class="congrats">Congratulations, {{NAME}}!<br>Your video ad is ready.</p>', '<p class="congrats">Watch my 3-minute video: how my team makes your video ads</p>'],
    ['<span class="stamp" aria-hidden="true">SAMPLE<small>bluefx.net</small></span>', ''],
    ['<p>Want your video ad without the SAMPLE stamp, plus a new video for your business every week?</p>', '<p>Want a video like this for your business, plus a new video every week?</p>'],
    ['<button type="button" class="replay">Watch your video ad again</button>', '<button type="button" class="replay">Watch the video ad again</button>'],
    [
      '<p class="samplenote">Join today, and my team removes the SAMPLE stamp and makes every change you want, back the same day.</p>',
      // No free sample link on the $599 page (owner 2026-10-25: "a bit strange", then "why even add it at the bottom?").
      '',
    ],
    [
      '<p class="big">A new video like yours every week, made by my team, so more customers can find your business on social media</p>',
      '<p class="big">A new video for your business every week, made by my team, so more customers can find your business on social media</p>',
    ],
    [
      '<p class="firsthead">Your first video ad: the video ad above, without the SAMPLE stamp and with every change you want.</p>',
      '<p class="firsthead">Send your first idea today, and your first video arrives within 1 business day.</p>',
    ],
    [
      '<p>You just watched your own video ad. Before you see 12 more example video ads, let me answer 3 questions you might have about this offer:</p>',
      '<p>You just watched a video ad my team made. Before you see 12 more example video ads, let me answer 3 questions you might have about this offer:</p>',
    ],
    [
      '<p><b>PROOF:</b> You already have your first video ad, made from {{DOMAIN}}. Join, and you can get a new video every week.</p>',
      '<p><b>PROOF:</b> Every example video ad on this page was made by my team. Join, and you can get a new video every week.</p>',
    ],
    ["      <p>We're offering this service first to the people who tried our free video ad maker.</p>\n", ''],
    // Question 3 ("Why are you doing this?") without the free video ad the reader never made
    [
      '{{S_Q3}}',
      "<p><b>Answer:</b> Because video ads bring in customers, and most business owners don't have the time to make them. My team makes you a new video every week.</p>\n",
    ],
    [
      '<details><summary>What about the free video ad you made for me?</summary><p>That video ad becomes your first video ad: we remove the SAMPLE stamp and make any changes you want.</p></details>',
      // No free sample on the $599 page at all (owner 2026-10-25): the question about it simply goes.
      '',
    ],
    [
      '<div class="ff-thumb">{{THUMB}}<span>SAMPLE</span></div><p><b>Your first video ad:</b> the free video ad we made for {{DOMAIN}}, without the SAMPLE stamp and with every change you want.</p>',
      '<div class="ff-thumb">{{THUMB}}</div><p><b>Your first video:</b> within 1 business day of your first idea, with every change you want.</p>',
    ],
    [
      '<p class="ps"><b>P.S.</b> Your first video ad is already made. Join today, and my team removes the SAMPLE stamp and makes every change you want, back the same day.',
      '<p class="ps"><b>P.S.</b> Send your first idea today, and your first video arrives within 1 business day. Then you can get a new video every week, and any change comes back the same day.',
    ],
    // the examples become numbered styles, so members can ask for "Style 3"
    ["<section class=\"alt\">\n  <div class=\"wrap\">\n    <h2>Here's what you can request</h2>", "<section class=\"alt\" id=\"styles\">\n  <div class=\"wrap\">\n    <h2>Pick your style</h2>"],
    [
      '<p class="sub">12 example video ads my team made. Tap any video ad to watch the whole video ad with sound.</p>',
      '<p class="sub">13 styles, each with an example video ad my team made. Tap any video ad to watch it with sound. Then tell us the style you want, like "Style 3", or let my team pick for you.</p>',
    ],
  ];
  return swaps;
}

/** The 12 example cards renamed as Style 1 to 12, and Style 13 (the hand-drawn whiteboard) added after the last one. */
function numberStyles(html: string): string {
  let out = html;
  STYLES.forEach((s, i) => {
    const pattern = new RegExp(`<h3>${s.business.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3><p>[^<]*</p>`, 'g');
    const card = `<h3>Style ${i + 1}: ${s.style}</h3><p>${cap(s.text)}. Made for ${article(s.business)} ${s.business.toLowerCase()}.</p>`;
    if (!pattern.test(out)) console.error(`❌ [service-public] Example card not found: ${s.business}`);
    out = out.replace(pattern, card);
  });
  const lastBusiness = STYLES[STYLES.length - 1].business;
  const last = `Made for ${article(lastBusiness)} ${lastBusiness.toLowerCase()}.</p></div>`;
  const style13 = `<div class="ad"><video src="${SERVICE_MEDIA_BASE}/look-whiteboard.mp4" poster="${SERVICE_MEDIA_BASE}/look-whiteboard.jpg" controls playsinline preload="none"></video><h3>Style 13: Hand-drawn whiteboard</h3><p>A hand draws your story on a whiteboard.</p></div>`;
  const at = out.indexOf(last);
  if (at === -1) console.error('❌ [service-public] Last example card not found: Style 13 not added');
  else out = out.slice(0, at + last.length) + style13 + out.slice(at + last.length);
  return out;
}

/** The owner's sales video, re-edited with captions and example ads (owner 2026-11-11). */
const TOP_VIDEO = { src: `${SERVICE_MEDIA_BASE}/weekly-vsl-v2.mp4`, poster: `${SERVICE_MEDIA_BASE}/weekly-vsl-v2.jpg` };

/**
 * Owner 2026-11-11: his 3-minute video replaces the sample ad at the top, in a wide 16:9 frame above the headline,
 * and the same talk lower down (the old "Watch my 3-minute video" block) goes. Lead pages keep their own ad on top.
 */
function wideVideoTop(html: string): string {
  let out = html;
  const start = out.indexOf('<div class="samplead">');
  const end = out.indexOf('<div class="topcopy">', start);
  if (start === -1 || end === -1) {
    console.error('❌ [service-public] Sample video block not found: top video not swapped');
    return out;
  }
  // Top copy from the owner's original video service page (ai.bluefx.net/video-service), owner 2026-11-11:
  // the benefit headline above the video, then the price, one line on their part, the button and the guarantee.
  const copyEnd = out.indexOf('<div class="offer" id="join">', end);
  const copy = copyEnd === -1 ? '' : out.slice(end, copyEnd);
  const button = copy.match(/<a class="btn top-btn"[\s\S]*?<\/a>/)?.[0];
  const logos = copy.match(/<div class="paylogos"[\s\S]*?<\/div>/)?.[0] ?? '';
  const congratsAt = out.lastIndexOf('<p class="congrats">', start);
  if (!button || congratsAt === -1) {
    console.error('❌ [service-public] Top copy not found: top not rebuilt');
    return out;
  }
  const top = `<p class="kicker">Want us to do all the work for you?</p>
    <h1>My Team Makes You A New Video Every Week That Brings You <mark>Leads And Clients</mark></h1>
    <div class="vsl topvsl"><video src="${TOP_VIDEO.src}" poster="${TOP_VIDEO.poster}" controls playsinline preload="metadata"></video></div>
    <div class="topcopy">
    <p class="proofline">Our videos have brought <b>222,712 leads</b> and <b>36,000 customers</b> to our own business. Now my team makes them for yours.</p>
    <p class="priceline">A new video every week: <b>52 videos a year for {{P}} a month</b> {{S_WAS}} No contract. Cancel anytime.</p>
    <p class="part">Tell us what your video should be about, and my team makes it.</p>
    ${button}
    <div class="trust">${logos}<p class="guar"><b>30-day money-back guarantee.</b> Not happy? We refund your {{P}}.</p></div>
    </div>
    </div>
    `;
  out = out.slice(0, congratsAt) + top + out.slice(copyEnd);
  out = out.replace('<div class="top">', '<div class="top widetop">');
  const lower = out.indexOf('<p class="vsltitle">');
  const lowerEnd = lower === -1 ? -1 : out.indexOf('</div>', out.indexOf('<div class="vsl">', lower));
  if (lower === -1 || lowerEnd === -1) console.error('❌ [service-public] Lower video block not found: not removed');
  else out = out.slice(0, lower) + out.slice(lowerEnd + '</div>'.length);
  const css = `<style>
.hero .top.widetop { display: block; text-align: center; }
.hero .top.widetop .kicker { font-family: var(--body); font-weight: 900; font-size: 26px; line-height: 1.3; color: var(--red); margin: 0; }
.hero .top.widetop h1 { font-size: clamp(34px, 5.4vw, 56px); max-width: 980px; margin: 8px auto 0; text-wrap: balance; }
.hero .top.widetop .topvsl { margin: 22px auto 0; }
.hero .top.widetop .topcopy { max-width: 760px; margin: 18px auto 0; }
.hero .top.widetop .proofline { font-size: 22px; line-height: 1.5; }
.hero .top.widetop .priceline { font-size: 24px; line-height: 1.4; margin-top: 12px; }
.hero .top.widetop .priceline b { background: var(--yellow); padding: 0 .15em; }
.hero .top.widetop .priceline .was { color: var(--muted); }
.hero .top.widetop .part { margin: 10px auto 0; font-size: 22px; }
.hero .top.widetop .top-btn { margin-inline: auto; }
.hero .top.widetop .trust { margin-inline: auto; text-align: center; }
.hero .top.widetop .paylogos { justify-content: center; }
.hero .top.widetop .trust .guar { text-align: center; }
@media (max-width: 560px) { .hero .top.widetop .kicker { font-size: 21px; } .hero .top.widetop .proofline, .hero .top.widetop .part { font-size: 20px; } .hero .top.widetop .priceline { font-size: 21px; } }
</style>
`;
  out = out.replace('</head>', `${css}</head>`);
  return out;
}

/** Regular price shown struck out on the evergreen $99 page (owner 2026-11-11). */
const EVERGREEN_REGULAR_PRICE = 299;

let cached: string | null = null;

/** The public page's template: the per-lead template with the public swaps (built once per server). */
function publicTemplate(): string {
  if (cached) return cached;
  let html = SERVICE_PAGE_HTML;
  for (const [from, to] of publicSwaps()) {
    if (!html.includes(from)) console.error(`❌ [service-public] Line not found, not swapped: ${from.slice(0, 80)}`);
    html = html.split(from).join(to);
  }
  cached = wideVideoTop(numberStyles(html));
  return cached;
}

/**
 * The whole public page, at the public (last phase) price. With `price` (a phase price, the evergreen $99 page of
 * owner 2026-10-27, /weekly-video-plan-99): the same page at that price with no deadline, the public price struck out
 * as the regular price.
 */
export function renderPublicServicePage(price?: number): string {
  const publicPhase = SERVICE.phases[SERVICE.phases.length - 1];
  const phase = (price !== undefined && SERVICE.phases.find((p) => p.price === price)) || publicPhase;
  const checkout = phase.product ? `${SERVICE.storefront}/${phase.product}` : 'mailto:support@bluefx.net';
  return renderServicePage({
    token: '',
    lead: { first_name: '', website_domain: 'your website' },
    videoUrl: `${SERVICE_MEDIA_BASE}/full-hauling.mp4`,
    poster: `${SERVICE_MEDIA_BASE}/full-hauling.jpg`,
    nextAds: null,
    // The $99 page shows $299 as the regular price (owner 2026-11-11: $599 is too much); the full page keeps none.
    now: { phase, nextPrice: null, endsAt: null, regularPrice: phase === publicPhase ? null : EVERGREEN_REGULAR_PRICE },
    internal: true,
    template: publicTemplate(),
    checkoutUrl: checkout,
    popupProduct: phase.product,
    title: 'The Weekly Video Plan by BlueFX',
  });
}
