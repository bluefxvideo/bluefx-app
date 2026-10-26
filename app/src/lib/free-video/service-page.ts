import { SERVICE, serviceGoUrl, type ServicePhase } from '@/lib/free-video/offer';
import { isLive } from '@/lib/free-video/config';
import { offerSwitchOf } from '@/lib/free-video/offer-switch';
import { SERVICE_PAGE_HTML } from '@/lib/free-video/service-page-html';
import { WELCOME_PATH } from '@/lib/free-video/welcome-page';
import { eventsTable } from '@/lib/free-video/leads';
import { displayDomain } from '@/lib/free-video/website';
import type { FreeVideoLead, FreeVideoNextAdCard } from '@/types/free-video';

/**
 * Unlimited Video Ads, the done-for-you video ad service (owner 2026-10-25), on a page made for one lead:
 * /v/<token>/unlimited. The owner-approved page (service-page-html.ts) with the lead's own free video ad at the top
 * and in the last price box, the business's domain, and the 3 next video ads written for that website (when there
 * are 3). The price climbs on the lead's own clock (SERVICE.phases): $99 a month held for 3 days, then $299 a month
 * held for 7 days, then $599 a month for good. The clock starts at the video ad's email or the first time the lead
 * opens the page in a browser (the page's own service_view event, so an email link scanner never starts it),
 * whichever came first. The page never says a price ended: it shows the current price and its own countdown.
 */

/** The page's videos and pictures (uploaded 2026-10-25 from the approved page). */
export const SERVICE_MEDIA_BASE =
  'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/service';

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The first service_view of the lead, or null when the page was never opened in a browser. Throws on a database error. */
export async function firstServiceView(leadId: string): Promise<Date | null> {
  const { data, error } = await eventsTable()
    .select('at')
    .eq('lead_id', leadId)
    .eq('event', 'service_view')
    .order('at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`service_view not read: ${error.message}`);
  const at = (data as Array<{ at: string }> | null)?.[0]?.at;
  return at ? new Date(at) : null;
}

/** When the lead's price clock started: the video ad's email or the first open of the page, whichever came first; null = not yet. Throws on a database error. */
export async function serviceClockStart(lead: Pick<FreeVideoLead, 'id' | 'emailed_at'>): Promise<Date | null> {
  // Switched to the service by the owner (offer-switch.ts): the held $99 price counts from the switch.
  const sw = await offerSwitchOf(lead.id);
  if (sw?.offer === 'service') return sw.at;
  const starts = [lead.emailed_at ? new Date(lead.emailed_at) : null, await firstServiceView(lead.id)].filter(
    (d): d is Date => d !== null && !Number.isNaN(d.getTime())
  );
  return starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
}

export interface ServicePhaseNow {
  phase: ServicePhase;
  /** The next phase's price, while this one is held; null in the last phase. */
  nextPrice: number | null;
  /** When this phase's price ends (ms); null in the last phase. */
  endsAt: number | null;
}

/** The lead's phase at `now`. A clock that has not started counts from now (the first visit starts it). */
export function servicePhaseAt(start: Date | null, now = Date.now()): ServicePhaseNow {
  const phases: readonly ServicePhase[] = SERVICE.phases;
  let edge = start ? start.getTime() : now;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (phase.hours === null) return { phase, nextPrice: null, endsAt: null };
    edge += phase.hours * 3600 * 1000;
    if (now < edge) return { phase, nextPrice: phases[i + 1]?.price ?? null, endsAt: edge };
  }
  return { phase: phases[phases.length - 1], nextPrice: null, endsAt: null };
}

export interface ServicePageInput {
  token: string;
  lead: Pick<FreeVideoLead, 'first_name' | 'website_domain'>;
  videoUrl: string;
  poster?: string | null;
  nextAds?: FreeVideoNextAdCard[] | null;
  now: ServicePhaseNow;
  /** The owner's own visit: the page sends no service_view. */
  internal?: boolean;
  /** Another template (the public page, service-public.ts); default the per-lead page. */
  template?: string;
  /** Where the buttons go instead of /go/fvservice (the public page: the public price's checkout). */
  checkoutUrl?: string;
  /** With checkoutUrl: the FastSpring product the popup cart opens with; null = the buttons stay plain links. Without checkoutUrl the page's price's product. */
  popupProduct?: string | null;
  /** The page title instead of "Unlimited Video Ads for <domain>". */
  title?: string;
}

/** A video that shows its first frame on phones too when there is no poster picture. */
const withFirstFrame = (url: string) => (url.includes('#') ? url : `${url}#t=0.1`);

function nextFigures(cards: FreeVideoNextAdCard[], fallbackImage: string | null): string {
  return cards
    .map((card, index) => {
      const image = card.imageUrl || fallbackImage;
      const picture = image ? `<img src="${esc(image)}" alt="">` : '';
      return `        <figure>${picture}<figcaption><small>Idea #${index + 1}</small>${esc(card.title)}</figcaption></figure>\n`;
    })
    .join('');
}

/** Fills every [data-enddate-short] with the price's end day in the visitor's own time zone, like "Fri, Oct 30". */
function shortDateScript(endsAt: number | null): string {
  if (!endsAt) return '';
  return `<script>(function(){try{var t=new Date(${Math.round(endsAt)}).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});document.querySelectorAll('[data-enddate-short]').forEach(function(e){e.textContent=t})}catch(e){}})();</script>`;
}

/**
 * The page's events, sent like the funnel's other page events: service_view on the first open in a browser (it starts
 * the clock), video_play and video_complete for the lead's own video ad (once each per page view), and service_click
 * when a buy button opens FastSpring's popup cart (the buttons skip /go/fvservice, so this is the only click record).
 */
function pageBeacons(token: string): string {
  return `<script>(function(){try{var T=${JSON.stringify(token)};function send(e){try{var o={e:e,t:T};var v=null;try{v=localStorage.getItem('fv_vid')}catch(x){}if(v&&/^[\\w-]{1,40}$/.test(v))o.v=v;var b=JSON.stringify(o);if(!(navigator.sendBeacon&&navigator.sendBeacon('/api/free-video/event',new Blob([b],{type:'application/json'}))))fetch('/api/free-video/event',{method:'POST',body:b,headers:{'Content-Type':'application/json'},keepalive:true}).catch(function(){})}catch(x){}}send('service_view');var own=document.querySelector('video[data-fv-own]');if(own){var played=false,done=false;own.addEventListener('play',function(){if(!played){played=true;send('video_play')}});own.addEventListener('ended',function(){if(!done){done=true;send('video_complete')}})}var clicked=false;document.addEventListener('click',function(ev){var a=ev.target&&ev.target.closest?ev.target.closest('[data-fsc-action]'):null;if(a&&!clicked){clicked=true;send('service_click')}},true)}catch(e){}})();</script>`;
}

/**
 * FastSpring's Store Builder script for its popup cart, the same tag as the AI Media Machine's sales page (owner
 * 2026-10-25), with FastSpring's popup-closed callback like that page: a paid order goes on to the thank-you page
 * (welcome-page.ts), a closed cart without an order stays here.
 */
function fastSpringScript(welcomeUrl: string): string {
  const storefront = isLive() ? SERVICE.popupStorefront : SERVICE.popupTestStorefront;
  return `<script>
    function onFSPopupClosed(orderReference) {
      if (orderReference) {
        if (window.fastspring && window.fastspring.builder) window.fastspring.builder.reset();
        window.location.href = ${JSON.stringify(welcomeUrl).replace(/</g, '\\u003c')};
      }
    }
  </script>
  <script
    id="fsc-api"
    src="https://sbl.onfastspring.com/sbl/1.0.5/fastspring-builder.min.js"
    type="text/javascript"
    data-storefront="${storefront}"
    data-popup-closed="onFSPopupClosed">
  </script>`;
}

/** FastSpring's own popup cart button attributes (developer.fastspring.com, Actions): empty the cart, add the product, open checkout. */
const fastSpringButton = (product: string) => `data-fsc-item-path-value="${esc(product)}" data-fsc-action="Reset, Add, Checkout"`;

/** Every buy button of the template as written: a link to {{CHECKOUT}} in a new tab. */
const CHECKOUT_LINK = 'href="{{CHECKOUT}}" target="_blank" rel="noopener"';

/**
 * The price and deadline sentences of the page for one phase. While a price is held (phases 1 and 2) they keep the
 * approved wording with that phase's price, the next price and the days held; in the last phase every deadline
 * sentence goes and the price lock stays. The date spans are filled by the page's script from END_MS.
 */
function phaseSlots({ phase, nextPrice, endsAt }: ServicePhaseNow): Array<[string, string]> {
  const p = `$${phase.price}`;
  if (endsAt !== null && nextPrice !== null && phase.hours !== null) {
    const nx = `$${nextPrice}`;
    const days = Math.round(phase.hours / 24);
    const date = '<span data-enddate></span>';
    return [
      ['{{S_TOPBAR}}', `<div class="deadline" role="note">\n  <div class="wrap">\n    <span>Your ${p} price is held for</span>\n    <span class="clock" data-clock></span>\n  </div>\n</div>`],
      // Under the first price, kept simple (owner 2026-10-25): "(Regular price $299, offer ends Wed, Oct 28)".
      ['{{S_WAS}}', `<span class="was">(Regular price <s>${nx}</s>, offer ends <span data-enddate-short></span>)</span>`],
      // The struck-out regular price in the price boxes, labelled "regular price" (owner 2026-10-25).
      [
        '{{S_STRIKE}}',
        `<span style="display:inline-flex;flex-direction:column;align-items:center;line-height:1.05"><s>${nx}</s><small style="font:700 12px/1.2 Lato,Arial,sans-serif;color:#5e5e5e;letter-spacing:0;text-transform:none;margin-top:4px">regular price</small></span>`,
      ],
      ['{{S_BOXDEADLINE}}', `<p class="boxdeadline" id="buy">${p} a month is the price only for business owners who made a free video ad with us. Your ${p} price is held for you until ${date}. After that, new members pay ${nx} a month.</p>`],
      ['{{S_LOCK1}}', `<b>Price lock:</b> join before then, and your price stays ${p} a month for as long as you stay a member, even when the price goes up for new members.`],
      ['{{S_Q3}}', `<p><b>Answer:</b> You just tried our free video ad maker and saw your first video ad. This price is my thank-you for trying our free video ad maker, and it's held for you for ${days} days.</p>\n`],
      ['{{S_Q3B}}', `<p>After your ${days} days, new members pay the regular price of ${nx} a month. Join before, and you're locked in at ${p} a month for as long as you stay.</p>`],
      ['{{S_REASON3}}', `<p>Your ${p} price is my thank-you for making a free video ad with us. Your ${p} price is held for you until ${date}. After that, new members pay ${nx} a month.</p>`],
      [
        '{{S_COUNTER}}',
        `<div class="counter" aria-label="Time left at ${p}" style="margin-top:0">\n        <div><b data-d>00</b><small>Days</small></div>\n        <div><b data-h>00</b><small>Hours</small></div>\n        <div><b data-m>00</b><small>Minutes</small></div>\n        <div><b data-s>00</b><small>Seconds</small></div>\n      </div>\n      <p class="enddate">Your ${p} price ends ${date}.</p>\n      `,
      ],
      ['{{S_LOCK2}}', `<b>Price lock:</b> join before your ${days} days end, and your price stays ${p} a month for as long as you stay a member, even when the price goes up for new members.`],
      ['{{S_FAQPRICE}}', `<p>Your price stays ${p} a month for as long as you stay a member. Join while your ${days} days run, and ${p} a month is locked in. When the price goes up for new members, your price stays ${p}.</p>`],
      ['{{S_SIGNOFF}}', `<p>If you want a new video ad any business day you ask, join before your ${p} price ends on ${date}.</p>`],
    ];
  }
  const lock = `<b>Price lock:</b> your price stays ${p} a month for as long as you stay a member, even when the price goes up for new members.`;
  return [
    ['{{S_TOPBAR}}', ''],
    ['{{S_WAS}}', ''],
    ['{{S_STRIKE}}', ''],
    ['{{S_BOXDEADLINE}}', '<p class="boxdeadline" id="buy" hidden></p>'],
    ['{{S_LOCK1}}', lock],
    ['{{S_Q3}}', `<p><b>Answer:</b> You just tried our free video ad maker and saw your first video ad. My team can make every video ad after that one for you.</p>\n`],
    ['{{S_Q3B}}', `<p>Join, and you're locked in at ${p} a month for as long as you stay.</p>`],
    ['{{S_REASON3}}', `<p>Your price stays ${p} a month for as long as you stay a member, even when the price goes up for new members.</p>`],
    ['{{S_COUNTER}}', ''],
    ['{{S_LOCK2}}', lock],
    ['{{S_FAQPRICE}}', `<p>Your price stays ${p} a month for as long as you stay a member. When the price goes up for new members, your price stays ${p}.</p>`],
    ['{{S_SIGNOFF}}', '<p>If you want a new video ad any business day you ask, join today.</p>'],
  ];
}

/** The whole page for one lead, as HTML. */
export function renderServicePage(input: ServicePageInput): string {
  const domain = esc(displayDomain(input.lead.website_domain));
  const name = input.lead.first_name?.trim();
  const poster = input.poster || null;
  const video = esc(poster ? input.videoUrl : withFirstFrame(input.videoUrl));
  const thumb = poster
    ? `<img src="${esc(poster)}" alt="Your free video ad">`
    : `<video src="${esc(withFirstFrame(input.videoUrl))}" muted playsinline preload="metadata" aria-label="Your free video ad" style="width:74px;aspect-ratio:9/16;object-fit:cover;border-radius:8px;display:block"></video>`;
  const cards = input.nextAds?.length === 3 ? input.nextAds : null;

  // split/join, not replace(): a $ in a name or a link must never act as a replacement pattern.
  const put = (page: string, slot: string, value: string) => page.split(slot).join(value);
  let html = put(input.template ?? SERVICE_PAGE_HTML, 'Congratulations, {{NAME}}!', name ? `Congratulations, ${esc(name)}!` : 'Congratulations!');
  if (cards) {
    html = put(put(put(html, '{{NEXT3_START}}', ''), '{{NEXT3_END}}', ''), '{{NEXT3_FIGURES}}', nextFigures(cards, poster));
  } else {
    const start = html.indexOf('{{NEXT3_START}}');
    const end = html.indexOf('{{NEXT3_END}}');
    html = html.slice(0, start) + html.slice(end + '{{NEXT3_END}}'.length);
  }
  for (const [slot, value] of phaseSlots(input.now)) html = put(html, slot, value);
  const slots: Array<[string, string]> = [
    ['{{TITLE}}', input.title ? esc(input.title) : `Unlimited Video Ads for ${domain}`],
    ['{{VIDEO}}', video],
    ['{{POSTER_ATTR}}', poster ? ` poster="${esc(poster)}"` : ''],
    ['{{THUMB}}', thumb],
    ['{{END_MS}}', String(Math.round(input.now.endsAt ?? 0))],
    ['{{DOMAIN}}', domain],
    ['{{CHECKOUT}}', esc(input.checkoutUrl ?? serviceGoUrl(input.token))],
    ['{{MEDIA}}', SERVICE_MEDIA_BASE],
    ['{{P}}', `$${input.now.phase.price}`],
  ];
  // The buy buttons open FastSpring's popup cart with the product of the page's price, in FastSpring's plain markup.
  // The webhook finds the buyer's free video ad by their email (service-order.ts).
  const popupProduct = input.checkoutUrl === undefined ? input.now.phase.product : input.popupProduct ?? null;
  if (popupProduct) {
    html = put(html, CHECKOUT_LINK, fastSpringButton(popupProduct));
    const welcome = input.token ? `${WELCOME_PATH}?t=${encodeURIComponent(input.token)}` : WELCOME_PATH;
    html = put(html, '</head>', `${fastSpringScript(welcome)}\n</head>`);
  }
  // A video ad the owner gave away without the watermark (gift-clean-free-video.ts puts a clean-*.mp4 in video_url):
  // the page drops its own SAMPLE label over the player and on the thumbnail too. Owner 2026-10-26, for Paul only.
  if (/\/clean-[^/]+\.mp4$/.test(input.videoUrl)) {
    html = put(html, '<span class="stamp" aria-hidden="true">SAMPLE<small>bluefx.net</small></span>', '');
    html = put(html, '{{THUMB}}<span>SAMPLE</span>', '{{THUMB}}');
  }
  // The lead's own video ad, so the page's beacons can tell its play from the samples'.
  html = put(html, '<video src="{{VIDEO}}"', '<video data-fv-own src="{{VIDEO}}"');
  for (const [slot, value] of slots) html = put(html, slot, value);
  html = put(html, '</body>', `${shortDateScript(input.now.endsAt)}\n</body>`);

  if (!input.internal) html = put(html, '</body>', `${pageBeacons(input.token)}\n</body>`);
  return html;
}
