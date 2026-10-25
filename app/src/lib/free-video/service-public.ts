import { SERVICE } from '@/lib/free-video/offer';
import { SERVICE_PAGE_HTML } from '@/lib/free-video/service-page-html';
import { renderServicePage, SERVICE_MEDIA_BASE } from '@/lib/free-video/service-page';

/**
 * The official, public Unlimited Video Ads page (owner 2026-10-25): /unlimited-video-ads. The same approved page as
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
    ['<p class="congrats">Congratulations, {{NAME}}!<br>Your video ad is ready.</p>', '<p class="congrats">A video ad my team made for a local hauling company.</p>'],
    ['<span class="stamp" aria-hidden="true">SAMPLE<small>bluefx.net</small></span>', ''],
    ['<p>Want your video ad without the SAMPLE stamp, and a new video ad any business day you ask?</p>', '<p>Want video ads like this for your business, a new video ad any business day you ask?</p>'],
    ['<button type="button" class="replay">Watch your video ad again</button>', '<button type="button" class="replay">Watch the video ad again</button>'],
    [
      '<p class="samplenote">Join today, and my team removes the SAMPLE stamp and makes every change you want, back the same day.</p>',
      // No free sample link on the $599 page (owner 2026-10-25: "a bit strange", then "why even add it at the bottom?").
      '',
    ],
    [
      '<p class="big">New video ads like yours, made by my team, so more customers can find your business on social media</p>',
      '<p class="big">New video ads for your business, made by my team, so more customers can find your business on social media</p>',
    ],
    [
      '<p class="firsthead">Your first video ad: the video ad above, without the SAMPLE stamp and with every change you want.</p>',
      '<p class="firsthead">Send your first request today, and your first video ad arrives within 1 business day.</p>',
    ],
    [
      '<p>You just watched your own video ad. Before you see 12 more example video ads, let me answer 3 questions you might have about this offer:</p>',
      '<p>You just watched a video ad my team made. Before you see 12 more example video ads, let me answer 3 questions you might have about this offer:</p>',
    ],
    [
      '<p><b>PROOF:</b> You already have your first video ad, made from {{DOMAIN}}. Join, and my team makes you a new video ad any business day you ask.</p>',
      '<p><b>PROOF:</b> Every example video ad on this page was made by my team. Join, and my team makes you a new video ad any business day you ask.</p>',
    ],
    ["      <p>We're offering this service first to the people who tried our free video ad maker.</p>\n", ''],
    // Question 3 ("Why are you doing this?") without the free video ad the reader never made
    [
      '{{S_Q3}}',
      "<p><b>Answer:</b> Because video ads bring in customers, and most business owners don't have the time to make them. My team makes your video ads for you, one video ad at a time.</p>\n",
    ],
    [
      '<details><summary>What about the free video ad you made for me?</summary><p>That video ad becomes your first video ad: we remove the SAMPLE stamp and make any changes you want.</p></details>',
      // No free sample on the $599 page at all (owner 2026-10-25): the question about it simply goes.
      '',
    ],
    [
      '<div class="ff-thumb">{{THUMB}}<span>SAMPLE</span></div><p><b>Your first video ad:</b> the free video ad we made for {{DOMAIN}}, without the SAMPLE stamp and with every change you want.</p>',
      '<div class="ff-thumb">{{THUMB}}</div><p><b>Your first video ad:</b> within 1 business day of your first request, with every change you want.</p>',
    ],
    [
      '<p class="ps"><b>P.S.</b> Your first video ad is already made. Join today, and my team removes the SAMPLE stamp and makes every change you want, back the same day.',
      '<p class="ps"><b>P.S.</b> Send your first request today, and your first video ad arrives within 1 business day. Any change comes back the same day.',
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

let cached: string | null = null;

/** The public page's template: the per-lead template with the public swaps (built once per server). */
function publicTemplate(): string {
  if (cached) return cached;
  let html = SERVICE_PAGE_HTML;
  for (const [from, to] of publicSwaps()) {
    if (!html.includes(from)) console.error(`❌ [service-public] Line not found, not swapped: ${from.slice(0, 80)}`);
    html = html.split(from).join(to);
  }
  cached = numberStyles(html);
  return cached;
}

/** The whole public page, at the public (last phase) price. */
export function renderPublicServicePage(): string {
  const phase = SERVICE.phases[SERVICE.phases.length - 1];
  const checkout = phase.product ? `${SERVICE.storefront}/${phase.product}` : 'mailto:support@bluefx.net';
  return renderServicePage({
    token: '',
    lead: { first_name: '', website_domain: 'your website' },
    videoUrl: `${SERVICE_MEDIA_BASE}/full-hauling.mp4`,
    poster: `${SERVICE_MEDIA_BASE}/full-hauling.jpg`,
    nextAds: null,
    now: { phase, nextPrice: null, endsAt: null },
    internal: true,
    template: publicTemplate(),
    checkoutUrl: checkout,
    popupProduct: phase.product,
    title: 'Unlimited Video Ads by BlueFX',
  });
}
