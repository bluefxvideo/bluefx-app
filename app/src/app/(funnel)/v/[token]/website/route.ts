import { type NextRequest, NextResponse } from 'next/server';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { WEBSITE_CHECKOUT, WEBSITE_PLANS, type WebsitePlan } from '@/lib/free-video/website-plans';
import { hasInternalCookie } from '@/lib/free-video/internal-visit';
import { getLeadByToken } from '@/lib/free-video/leads';
import { displayDomain } from '@/lib/free-video/website';
import { recordWebsiteEvent, WEBSITE_EVENTS, websiteDemoOf, type WebsiteDemo, type WebsiteEvent } from '@/lib/free-video/website-demo';
import { fetchWebsiteCheck, renderWebsiteCheck, WEBSITE_CHECK_CSS, type WebsiteCheck } from '@/lib/free-video/website-check';
import { FREE_VIDEO_TOKEN_PATTERN, type FreeVideoLead } from '@/types/free-video';

/**
 * /v/<token>/website (owner 2026-11-03): the lead's personal website video (website-demo.ts), and since 2026-11-04 the
 * whole sales page around it (copy: docs/website-demo-sales-page-copy.md, final and approved; plans: website-plans.ts).
 * A full HTML page of its own, like /unlimited: no funnel header, no ad pixels.
 * GET: the page (404 when the lead has no demo). POST {e, v, p}: the page's events (play, watched, interest, checkout + plan).
 * ?internal=1 or the owner's fv_internal cookie: nothing is stored and nobody is emailed.
 */
export const dynamic = 'force-dynamic';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const notFound = () => new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const BOT = /bot|crawler|spider|preview|scan|headless/i;
/**
 * "Let's talk" opens the owner's 30 minute "Your New Website" Calendly event in a popup over the page (owner 2026-11-03).
 * Pre-filled so the lead only picks a time: name, email and their website (question a3) from the lead, plus the website as
 * utm_content. a1 (phone) and a2 (biggest challenge) are optional and left empty (owner 2026-11-03: a business number
 * from their site may be a support desk, so no phone is guessed).
 */
const CALENDAR_URL = 'https://calendly.com/szilardgyorfi/new-website';
const REACH_EMAIL = 'support@bluefx.net';
const PHOTO_URL = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/website-demos/_shared/szilard-founder.jpg';

/**
 * The whole page behind a before/after picture (owner 2026-11-03: a click opens it big). publish_demo.mjs uploads
 * before-full.jpg / after-full.jpg next to before.jpg / after.jpg; the viewer falls back to the cropped one if missing.
 */
const fullShot = (cropped: string) => cropped.replace(/\/(before|after)\.jpg(\?|$)/, '/$1-full.jpg$2');

/**
 * The Ascent Equipment case study's pictures (owner 2026-11-04): Dov's photo and the grader / AI score images from
 * aispartan.com/assets, plus our own screenshots of ascentequipment.com (phone top screen, computer top screen, and the
 * whole phone page in 11 pieces of 4000 px, small enough for iPhones to show). All in the public script-videos bucket.
 */
const ASCENT = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/website-demos/_shared/ascent';
const ASCENT_FULL_PIECES = 11;
/** Whiteboard drawings for the old way / new way rows (owner 2026-11-05): old-1..3 and new-1..3, 720 px wide. */
const WHITEBOARD = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/website-demos/_shared/whiteboard';
const WHITEBOARD_V = '2'; // cache-buster: bump when the drawings are re-uploaded

async function load(token: string): Promise<{ lead: FreeVideoLead; demo: WebsiteDemo } | null> {
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token)) return null;
  const lead = await getLeadByToken(token);
  if (!lead) return null;
  const demo = await websiteDemoOf(lead.id);
  return demo ? { lead, demo } : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // The website check from bluefx.net (owner 2026-11-06) runs next to the lead lookup; it never waits more than 2.5 s.
  const checkPromise = FREE_VIDEO_TOKEN_PATTERN.test(token) ? fetchWebsiteCheck(token) : Promise.resolve(null);
  let found;
  try {
    found = await load(token);
  } catch (error) {
    console.error('❌ [website-demo] Page could not read the lead:', error);
    return new NextResponse('Please try again in a minute.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!found) return notFound();
  const internal = req.nextUrl.searchParams.get('internal') === '1' || hasInternalCookie(req.headers.get('cookie'));
  const check = await checkPromise; // null when it isn't ready yet: the page shows without it
  // The sales page is the default for every lead since 2026-11-05 (owner); ?preview=sales links keep working.
  return new NextResponse(renderPage(token, found.lead, found.demo, internal, check), { status: 200, headers: HTML_HEADERS });
}

function sameOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.origin === new URL(SITE_URL).origin || url.origin === new URL(PROD_SITE_URL).origin) return true;
    return !isLive() && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

/** The page's events. Always 204: the page never shows an error for tracking. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!sameOrigin(req.headers.get('origin'))) return noContent();
    if (hasInternalCookie(req.headers.get('cookie')) || BOT.test(req.headers.get('user-agent') || '')) return noContent();
    const body = (await req.json().catch(() => null)) as { e?: unknown; v?: unknown; p?: unknown } | null;
    const event = typeof body?.e === 'string' && (WEBSITE_EVENTS as readonly string[]).includes(body.e) ? (body.e as WebsiteEvent) : null;
    if (!event) return noContent();
    const visitorId = typeof body?.v === 'string' && /^[a-z0-9-]{8,40}$/i.test(body.v) ? body.v : null;
    const { token } = await params;
    const found = await load(token);
    const plan = typeof body?.p === 'string' && /^[a-z]{2,10}$/.test(body.p) ? body.p : null;
    if (found) await recordWebsiteEvent(found.lead, found.demo, event, visitorId, plan);
  } catch (error) {
    console.error('❌ [website-demo] Event failed:', error);
  }
  return noContent();
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const check = (items: string[]) => items.map((item) => `<li>${item}</li>`).join('');

/** What each plan's "See everything included" lists (the copy file, word for word). */
const INCLUDED: Record<WebsitePlan['key'], { lead?: string; items: string[] }> = {
  seo: {
    items: [
      'Up to 8 custom-designed pages',
      'Hosting, security, daily backups and your web address, all handled',
      'Built to load fast and work perfectly on a phone',
      'Connected to your ChatGPT, so you can change anything yourself, no tech skills needed',
      "The Google rankings you've earned move over safely",
      'Every page answers a question your buyers actually ask, the kind AI repeats',
      'Built in the clean format AI programs can read',
      'Your Google Business Profile (your Google Maps listing) optimized',
      'We find and fix the hidden setting that tells ChatGPT not to read many sites',
      'Monthly scoreboard: how often AI names you vs your competitors',
      'Alerts when a competitor starts winning your questions',
      'A direct line to real humans, with replies within 1 business day',
      'Cancel anytime, no contracts',
    ],
  },
  growth: {
    lead: 'Everything above, plus',
    items: [
      'Up to 40 pages, so every service and buyer question gets its own page',
      '2 to 3 new pages every month',
      '1 long video per month, scripted and edited for you',
      '2 short videos per month (Shorts and Reels)',
      'YouTube channel set up, the #1 place AI engines pull answers from',
      'Review system: every customer invited, problems caught privately',
      'Review responses written for you',
      'Monthly report with before and after AI answers',
      'Quarterly 1-on-1 strategy call with Szilard',
      'Bonus: the Client Wake-Up Campaign',
    ],
  },
  allin: {
    lead: 'Everything above, plus',
    items: [
      'AI chatbot trained on your business, answering on your site 24/7',
      'AI phone receptionist: answers, books appointments, takes messages',
      'Instant text back to missed calls',
      'Automatic texts and emails: follow-ups, reminders, "come back" offers',
      'Same-day support',
      'Monthly 1-on-1 strategy call with Szilard',
    ],
  },
};

/** Each card's line under the price and its short list (the copy file, word for word). */
const CARD: Record<WebsitePlan['key'], { for: string; items: string[] }> = {
  seo: {
    for: 'Your new website, live and looked after, plus showing up when people ask AI.',
    items: [
      'The new website you just saw, up to 8 pages',
      'Hosting, security, daily backups and your web address, all handled',
      'Update it yourself anytime from your own ChatGPT: prices, offers, new projects, blog posts',
      "Set up so ChatGPT and Google's AI can find and recommend you",
      'A monthly scoreboard showing how often AI names you vs your competitors',
    ],
  },
  growth: {
    for: 'For businesses that want a steady stream of new customers, not only a better website.',
    items: [
      'Everything in Website + AI SEO',
      '2 to 3 new pages every month, each one built to win a question your buyers ask',
      '1 long video and 2 short videos a month, made for you',
      'More Google reviews, with replies written for you',
    ],
  },
  allin: {
    for: 'Everything in Growth Engine, plus nothing slips through the cracks.',
    items: [
      'An AI receptionist that answers your phone, books appointments and takes messages',
      'A chatbot on your site that answers customers 24/7',
      'Missed a call? The customer gets a text back right away, before they call your competitor',
      'Automatic follow-ups, appointment reminders and "come back" offers',
      'Same-day support and a monthly 1-on-1 strategy call with Szilard',
    ],
  },
};

function planCard(plan: WebsitePlan, token: string): string {
  const card = CARD[plan.key];
  const inc = INCLUDED[plan.key];
  const hosted = `${WEBSITE_CHECKOUT.storefront}/${plan.products[0]}?tags=${WEBSITE_CHECKOUT.tagKey}:${encodeURIComponent(token)}`;
  const setup = plan.setupFee
    ? `<div class="price">${money(plan.price)}<span>/mo</span></div><div class="setup">+ ${money(plan.setupFee)} one-time setup</div>`
    : `<div class="price">${money(plan.price)}<span>/mo</span></div><div class="setup">Setup: <s>${money(plan.setupWas ?? 0)}</s> <b>$0</b></div>`;
  const bonus =
    plan.key === 'growth'
      ? '<li class="bonus"><span><b>Bonus: the Client Wake-Up Campaign.</b> We wake up your old customers and dead leads and turn them into new calls, no ads needed.</span></li>'
      : '';
  return `<article class="plan${plan.popular ? ' pop' : ''}">
${plan.popular ? '<span class="badge">MOST POPULAR</span>' : ''}<h3>${esc(plan.name)}</h3>
${setup}
<p class="for">${esc(card.for)}</p>
<ul>${check(card.items.map(esc))}${bonus}</ul>
<a class="btn js-buy" data-plan="${plan.key}" href="${esc(hosted)}" target="_blank" rel="noopener">Yes, start my new website</a>
<p class="fine">Cancel anytime. 60-day guarantee.</p>
<p class="talk">Prefer to talk first? <button type="button" class="link js-talk">Book a call</button></p>
<details><summary>See everything included</summary>${inc.lead ? `<p class="inc-lead">${inc.lead}</p>` : ''}<ul>${check(inc.items.map(esc))}</ul></details>
</article>`;
}

/** Old way / new way (owner 2026-11-05): each pain of their website today next to what the new website does instead. */
const PAIRS: Array<{ oldH: string; oldP: string; oldList?: string[]; oldEnd?: string; newH: string; newP: string }> = [
  {
    oldH: 'Customers call the next business.',
    oldP: 'A customer looks up a local business on their phone, and the website:',
    oldList: ['loads slowly', 'has tiny text', 'hides the phone number'],
    oldEnd: 'So the customer hits back and calls the next business on the list. One missed call can be the biggest job of the month.',
    newH: 'Customers call you.',
    newP: 'Your new site is built for the phone first: it loads quickly, has big buttons, is easy to read, and lets customers call you with one tap.',
  },
  {
    oldH: 'Business owners pay every month for websites that bring no calls.',
    oldP: 'Wix, GoDaddy or a web developer gets paid every month, whether the website brings ten calls or none.',
    newH: 'Your website brings you new customers.',
    newP: 'More and more people ask ChatGPT and Google\'s AI "who should I call?" Your new site is written and built so AI can read it and recommend you. Hosting is included, so you stop paying for the old one.',
  },
  {
    oldH: 'Every small change means waiting.',
    oldP: 'A new price, a new photo, new Saturday hours. The business owner emails the web developer, waits days, and sometimes pays extra for the change.',
    newH: 'You change your website yourself in minutes.',
    newP: 'We connect your website to your ChatGPT account. Tell ChatGPT what changed, add a photo if you like, and your website updates itself in minutes, from your phone or computer. No waiting days for a web developer, and no tech skills needed.',
  },
];

const FAQ: Array<[string, string]> = [
  ["I'm already paying Wix, GoDaddy or someone else. Do I have to wait?", "No. Most of those plans only cover hosting, and our plans include hosting, so you'd stop paying them. If you're locked into a contract, tell us when it ends and we'll switch you that day. Your new site waits for you."],
  ['How does the ChatGPT (or Claude) connection work?', 'We connect your website to your own ChatGPT or Claude account. Then you just tell it what you want, like "change our Saturday hours to 9 to 2" or "add this job we just finished" with a few photos, and your website updates itself in minutes. It works from your phone or computer, wherever you are.'],
  ['Do I need to buy hosting or an SSL certificate?', 'No. Hosting, security, SSL and backups are all included in every plan, so there are no extra bills. The only thing you keep is your web address, and we connect it for you.'],
  ['Another company runs my site right now. Can you take it over?', 'Yes. We move everything over for you, and you keep your web address.'],
  ['Do I keep my web address?', "Yes. Your domain always belongs to you. We connect it to the new site for you, and only after you've approved it."],
  ['What if I want to change something on the new site?', 'What you saw is a preview, so anything can be changed. Before launch you get a private link to review every page of the full website, and we change whatever you ask. We only switch your web address to the new site once you approve it. After launch, you can change anything yourself from your own ChatGPT.'],
  ['How will people find my new site?', 'Every page is written to answer the questions your customers search for, on Google and in AI tools like ChatGPT. AI usually starts picking up new pages within 30 to 60 days, and you get a monthly scoreboard so you can see it happening.'],
  ['Will I lose my Google rankings?', "No. Protecting your rankings is step one. Your old page addresses forward to the new ones, so nothing you've earned gets lost."],
  ['Can I cancel?', 'Yes, anytime, with no contracts. Your site stays online until the end of your paid month, and if you leave, we hand you all your content.'],
  ['What do I have to do?', "Almost nothing. Pick a plan, review the pages we send you, and maybe spend 15 minutes a month telling us what's new in your business."],
  ["Why did you make this for free? What's the catch?", "No catch. Showing you is easier than explaining it. If you don't want it, no hard feelings, it just sits here."],
];

const STEPS: Array<[string, string]> = [
  ['You pick your plan.', 'It takes a minute, and you can cancel anytime.'],
  ['We build out your full website.', 'What you saw is a preview, so tell us anything you want changed. My team turns it into your complete site.'],
  ['You review every page.', "You get a private link where you can check every page of the new site, and we change whatever you ask until you're happy."],
  ['You approve it, and only then it goes live.', 'Your current website stays exactly as it is until you say yes. Then we switch your web address over to the new site.'],
];

const CSS = `
:root{--ink:#0f172a;--muted:#1e293b;--line:#e2e8f0;--navy:#143d70;--green:#15803d;--green-d:#0f5f2c;--bg:#f4f6fa;--card:#fff;--soft:#eaf1f8;--gold:#b45309;--gold-bg:#fff7e6;--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color-scheme:light}
*{box-sizing:border-box}html{scroll-behavior:smooth}html,body{margin:0;background:var(--bg);color:var(--ink);font:19px/1.6 var(--font)}
main{max-width:980px;margin:0 auto;padding:28px 16px 56px}
.narrow{max-width:680px;margin-left:auto;margin-right:auto}
h1,h2,h3{text-wrap:balance;letter-spacing:-.01em}
h1{font-size:clamp(28px,4.6vw,42px);line-height:1.12;margin:0 0 12px}
h2{font-size:clamp(23px,3.4vw,32px);line-height:1.2;margin:0 0 16px;text-align:center}
p{margin:0}section{margin-top:56px}
.from{color:var(--muted);font-size:16px;margin:0 0 10px}.from b{color:var(--ink)}
.lede{color:var(--muted);margin:0 0 20px}
.player{position:relative;max-width:980px;margin:0 auto;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 14px 40px rgba(15,23,42,.22);aspect-ratio:16/9}
video{display:block;width:100%;height:100%;background:#000}
.ghost{display:block;margin:12px auto 0;background:var(--card);color:var(--navy);border:2px solid var(--navy);border-radius:14px;font:600 17px var(--font);padding:10px 20px;cursor:pointer}
.btn{display:block;width:100%;border:0;border-radius:14px;background:var(--green);color:#fff;font:700 21px/1.2 var(--font);padding:19px 22px;cursor:pointer;box-shadow:0 6px 0 var(--green-d);text-align:center;text-decoration:none;transition:transform .08s}
.btn:active{transform:translateY(3px);box-shadow:0 3px 0 var(--green-d)}
.btn:focus-visible,.link:focus-visible,summary:focus-visible,.ghost:focus-visible{outline:3px solid var(--navy);outline-offset:3px}
.cta-pair{display:flex;flex-direction:column;gap:12px;align-items:center;max-width:520px;margin:22px auto 0}
.link{background:none;border:0;color:var(--navy);font:700 18px var(--font);text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:6px}
.ba-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.ba figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 6px 18px rgba(15,23,42,.08)}
.ba img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;object-position:top}
.ba figcaption{padding:10px 14px;font-weight:700;font-size:16px;display:flex;justify-content:space-between;gap:10px;align-items:center;text-align:left;margin:0}
.ba .before figcaption{color:var(--muted)}.ba .after figcaption{color:var(--green)}
.ba small{font-weight:600;font-size:14px;color:var(--navy);white-space:nowrap}
.ba .shot{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in}
.hint{color:var(--muted);font-size:16.5px;text-align:center;margin-top:12px}
.vs-intro{text-align:center;color:var(--muted);margin:-6px auto 20px;max-width:620px}
.vs{max-width:940px;margin:0 auto;display:grid;gap:20px}
.vs-head{display:grid;grid-template-columns:1fr 1fr;border-radius:14px;overflow:hidden;margin-bottom:-6px;font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.vs-head div{padding:14px 24px}.h-old{background:#b91c1c;color:#fff}.h-new{background:var(--green);color:#fff}
.vs-row{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cbd5e1;border-radius:16px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,.10)}
.c{display:flex;flex-direction:column;gap:14px;padding:22px 24px}
.wb{display:block;width:100%;max-width:360px;height:auto;aspect-ratio:4/3;object-fit:cover;margin:0 auto;border-radius:12px;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.06)}
.c.old{background:#fdf4f4}.c.new{background:#fff}
.mk{width:42px;height:42px;border-radius:12px;display:grid;place-items:center}.mk svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.old .mk{background:#fde2e2;color:#b91c1c}.new .mk{background:#dcfce7;color:var(--green)}
.c h3{font-size:19px;line-height:1.3;margin:0 0 6px}.old h3{color:var(--ink)}
.c p{font-size:18.5px;color:var(--muted)}.old p{color:#1e293b}
.c .lbl{display:none}
.bad{margin:8px 0;padding:0;list-style:none;display:grid;gap:4px;font-size:18px;color:#7f1d1d;font-weight:600}.bad li::before{content:"\\2715";color:#b91c1c;font-weight:800;margin-right:8px;font-size:13px}
.c .end{margin-top:2px}
@media (max-width:700px){.vs{gap:16px}.vs-head{display:none}.vs-row{grid-template-columns:1fr}
 .c{padding:18px 18px;gap:12px}.c .lbl{display:block;font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;margin-bottom:4px}
 .old .lbl{color:#b91c1c}.new .lbl{color:var(--green)}.c.new{border-top:1px solid var(--line)}}
.case-intro{color:var(--muted);margin:-4px 0 18px;text-align:center}
.case-shots{display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,1fr);gap:14px;align-items:end}
.case-shots figure,.graders figure,.score{margin:0}
.case-shots img{display:block;width:100%;height:auto;border-radius:12px;border:1px solid var(--line);box-shadow:0 8px 22px rgba(15,23,42,.12)}
.case-shots .phone img{border:6px solid #111827;border-radius:22px}
figcaption{font-size:15.5px;color:var(--muted);text-align:center;margin-top:6px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:22px}
.stats div{background:var(--navy);color:#fff;border-radius:14px;padding:14px 12px;text-align:center;display:flex;flex-direction:column;gap:4px}
.stats .k{font-size:14px;color:#bfdbfe;letter-spacing:.04em;text-transform:uppercase;font-weight:700}
.stats .v{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.15}.stats i{font-style:normal;font-size:15px;color:#93c5fd;font-weight:600}
.stats-note{font-size:15.5px;color:var(--muted);text-align:center;margin-top:8px}
.graders{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
.graders img,.score img{display:block;width:100%;height:auto;border-radius:12px;border:1px solid var(--line);background:#fff}
.score{margin-top:14px}
.testi{margin:22px 0 0;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;font-size:18px;color:var(--ink)}
.testi p+p{margin-top:10px}
.testi .who{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.testi .who img{width:72px;height:72px;border-radius:50%;object-fit:cover}
.testi .who b{display:block;font-size:18px}.testi .who span{color:var(--muted);font-size:16px}
.trust{color:var(--muted);font-size:16.5px;text-align:center;margin-top:14px}
.plans-intro{color:var(--muted);text-align:center;max-width:560px;margin:-6px auto 22px}
.plans{display:grid;grid-template-columns:1fr 1.08fr 1fr;gap:16px;align-items:start}
.plan{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 20px;display:flex;flex-direction:column;gap:12px;min-width:0}
.plan.pop{border:3px solid var(--green);box-shadow:0 14px 34px rgba(21,128,61,.16);position:relative}
.badge{position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;font-size:13px;font-weight:800;letter-spacing:.08em;padding:5px 12px;border-radius:20px;white-space:nowrap}
.plan h3{font-size:21px;margin:0}
.price{font-size:40px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}.price span{font-size:18px;font-weight:600;color:var(--muted)}
.setup{font-size:17px;color:var(--muted)}.setup s{margin-right:4px}.setup b{color:var(--green)}
.for{font-size:17.5px;color:var(--muted)}
.plan ul{margin:0;padding:0;list-style:none;display:grid;gap:8px;font-size:17.5px}
.plan li{display:grid;grid-template-columns:20px 1fr;gap:8px}
.plan li::before{content:"";width:16px;height:16px;margin-top:4px;border-radius:50%;background:var(--green);box-shadow:inset 0 0 0 4px #dcfce7}
.plan li.bonus{background:var(--gold-bg);border-radius:10px;padding:8px 10px;margin:0 -4px}
.plan li.bonus::before{background:var(--gold);box-shadow:inset 0 0 0 4px #fde68a}
.plan .btn{font-size:19px;padding:16px 18px;margin-top:4px}
.fine{font-size:15.5px;color:var(--muted);text-align:center}
.talk{text-align:center;font-size:17px;color:var(--muted);margin-top:-4px}.talk .link{font-size:17px;padding:2px}
details{border-top:1px solid var(--line);padding-top:10px}
summary{cursor:pointer;color:var(--navy);font-weight:700;font-size:17px}
details ul{margin-top:10px!important;font-size:16.5px!important}
.inc-lead{font-size:16.5px;font-weight:700;margin-top:10px}
.guarantee{display:grid;grid-template-columns:56px 1fr;gap:16px;align-items:start;background:var(--card);border:2px dashed var(--green);border-radius:16px;padding:20px;margin-top:22px}
.seal{width:56px;height:56px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px;line-height:1.05;text-align:center}
.guarantee h3{margin:0 0 6px;font-size:20px}.guarantee p{font-size:18px;color:var(--muted)}
.guarantee a{color:var(--navy);font-weight:700;font-size:16.5px;display:inline-block;margin-top:8px}
.bigger{text-align:center;color:var(--muted);margin-top:18px;font-size:18px}.bigger .link{font-size:18px}
.steps{list-style:none;margin:0;padding:0;display:grid;gap:14px;counter-reset:s}
.steps li{display:grid;grid-template-columns:40px 1fr;gap:14px;counter-increment:s}
.steps li::before{content:counter(s);width:40px;height:40px;border-radius:50%;background:var(--navy);color:#fff;font-weight:800;display:grid;place-items:center}
.steps b{display:block}.steps span{color:var(--muted);font-size:18.5px}
.steps-note{color:var(--muted);font-size:17px;margin-top:14px;text-align:center}
.about{display:grid;grid-template-columns:96px 1fr;gap:18px;align-items:start;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px}
.about .photo{width:96px;height:96px;border-radius:50%;object-fit:cover}
.about p{font-size:18.5px;color:var(--muted)}.about p+p{margin-top:10px}
.about .btn{margin-top:16px;font-size:19px;padding:15px 18px}
.about .mail{font-size:16.5px;margin-top:10px}.about .mail a{color:var(--navy);font-weight:700}
.faq{display:grid;gap:10px}
.faq details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px}
.faq summary{color:var(--ink);font-size:18px}
.faq p{color:var(--muted);font-size:18.5px;margin-top:8px}
.final{text-align:center;background:var(--soft);border-radius:18px;padding:30px 20px}
.final p{color:var(--muted);max-width:520px;margin:0 auto}
.lb{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.94);display:none;flex-direction:column}
.lb.open{display:flex}
.lb-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;flex:none;color:#fff;font-size:15px}
.lb-bar button{font:600 16px var(--font);padding:10px 16px;border-radius:10px;border:0;background:#fff;color:var(--ink);cursor:pointer}
.lb-bar .tab.on{background:var(--green);color:#fff}
.lb-bar .x{margin-left:auto;background:transparent;color:#fff;border:2px solid #fff}
.lb-scroll{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 12px 24px}
.lb-scroll img{display:block;width:100%;max-width:1100px;height:auto;margin:0 auto;background:#fff}
#alb .lb-scroll img{max-width:430px}
#lbi{border-radius:10px}
@media (max-width:820px){.plans{grid-template-columns:1fr;gap:26px}}
@media (max-width:640px){html,body{font-size:18px}main{padding:18px 16px 40px}.player{margin:0 -10px}.ba-grid{grid-template-columns:1fr}.about{grid-template-columns:1fr;justify-items:start}.player{border-radius:12px}.stats .v{font-size:19px}.stats .k{font-size:12px}.lb-bar button{font-size:15px;padding:9px 12px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}html{scroll-behavior:auto}}
`;

function renderPage(token: string, lead: FreeVideoLead, demo: WebsiteDemo, internal: boolean, check: WebsiteCheck | null): string {
  const word = (lead.first_name || '').trim().split(/\s+/)[0] || '';
  const first = word ? word.charAt(0).toUpperCase() + word.slice(1) : ''; // "sam" typed in the form → "Sam"
  const business = demo.business || displayDomain(lead.website_domain);
  const domain = displayDomain(lead.website_domain);
  const title = first ? `${first}, we made ${business} a new website` : `We made ${business} a new website`;
  const storefront = isLive() ? WEBSITE_CHECKOUT.popupStorefront : WEBSITE_CHECKOUT.popupTestStorefront;
  const config = JSON.stringify({
    url: `/v/${token}/website`,
    token,
    internal,
    calendar: CALENDAR_URL,
    prefill: { name: first, email: lead.email, customAnswers: { a3: `https://${lead.website_domain}` } },
    utm: { utmSource: 'bluefx', utmCampaign: 'website-demo', utmContent: lead.website_domain },
    plans: Object.fromEntries(WEBSITE_PLANS.map((plan) => [plan.key, plan.products])),
    shots: demo.before && demo.after
      ? [
          { full: fullShot(demo.before), crop: demo.before, label: 'Your website today, full page' },
          { full: fullShot(demo.after), crop: demo.after, label: 'Your new homepage, full page' },
        ]
      : [],
  }).replace(/</g, '\\u003c');
  const talkFirst = '<button type="button" class="link js-talk">Book a call</button>';
  const wantIt = '<a class="btn" href="#plans">Yes, I want my new website</a>';
  const fullPieces = Array.from({ length: ASCENT_FULL_PIECES }, (_, i) => `<img src="${ASCENT}/full-${i + 1}.jpg" alt="" loading="lazy">`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
${demo.poster ? `<meta property="og:image" content="${esc(demo.poster)}">` : ''}
<style>${CSS}${check ? WEBSITE_CHECK_CSS : ''}</style></head><body><main>
<div class="narrow">
<p class="from">A video from <b>Szilard at BlueFX</b></p>
<h1>${esc(title)}</h1>
<p class="lede">When we made your video ad, I spent some time on ${esc(domain)} and couldn't help myself. Here's what I built for you. Watch the short video first.</p>
</div>
<div class="player"><video id="v" src="${esc(demo.video)}"${demo.poster ? ` poster="${esc(demo.poster)}"` : ''} controls playsinline preload="metadata"></video></div>
<button type="button" class="ghost" id="fs">&#x26F6; Watch full screen</button>
<div class="cta-pair">${wantIt}${talkFirst}</div>
${demo.before && demo.after ? `<section class="ba" aria-labelledby="ba-h"><h2 id="ba-h">Before and after</h2><div class="ba-grid">
<figure class="before"><button type="button" class="shot" data-shot="0" aria-label="See your website today, full page"><img src="${esc(demo.before)}" alt="Your website today" loading="lazy"></button><figcaption>Your website today <small>See full page</small></figcaption></figure>
<figure class="after"><button type="button" class="shot" data-shot="1" aria-label="See your new homepage, full page"><img src="${esc(demo.after)}" alt="Your new homepage" loading="lazy"></button><figcaption>Your new homepage <small>See full page</small></figcaption></figure>
</div><p class="hint">Tap either picture to see the whole page. This is a preview, so anything on it can be changed.</p></section>
<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Before and after, full page"><div class="lb-bar"><button type="button" class="tab" data-tab="0">Your website today</button><button type="button" class="tab" data-tab="1">Your new homepage</button><button type="button" class="x" id="lbx">&#x2715; Close</button></div><div class="lb-scroll" id="lbs"><img id="lbi" alt=""></div></div>` : ''}
${check ? renderWebsiteCheck(check) : ''}
<section aria-labelledby="pain-h"><h2 id="pain-h">Your next customer is looking you up right now</h2><p class="vs-intro">Here's what usually happens next, and what your new website does instead.</p>
<div class="vs"><div class="vs-head"><div class="h-old">Most websites today</div><div class="h-new">Your new website</div></div>
${PAIRS.map((pair, i) => `<div class="vs-row"><div class="c old"><img class="wb" src="${WHITEBOARD}/old-${i + 1}.jpg?v=${WHITEBOARD_V}" alt="" loading="lazy" width="720" height="540"><div><span class="lbl">Most websites today</span><h3>${esc(pair.oldH)}</h3><p>${esc(pair.oldP)}</p>${pair.oldList ? `<ul class="bad">${pair.oldList.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${pair.oldEnd ? `<p class="end">${esc(pair.oldEnd)}</p>` : ''}</div></div><div class="c new"><img class="wb" src="${WHITEBOARD}/new-${i + 1}.jpg?v=${WHITEBOARD_V}" alt="" loading="lazy" width="720" height="540"><div><span class="lbl">Your new website</span><h3>${esc(pair.newH)}</h3><p>${esc(pair.newP)}</p></div></div></div>`).join('\n')}
</div></section>
<section class="narrow" aria-labelledby="proof-h">
<h2 id="proof-h">A website my team rebuilt: Ascent Equipment</h2>
<p class="case-intro">Dave Rom's company makes machines that bend metal letters for sign shops all over the US, and has been in business for eleven years. His old site took 10 seconds to load, was clumsy on phones, and when buyers asked AI who to buy from, his name came up zero times.</p>
<div class="case-shots">
<figure class="phone"><img src="${ASCENT}/phone.jpg" alt="Ascent Equipment's new website on a phone" loading="lazy"><figcaption>On a phone</figcaption></figure>
<figure class="desk"><img src="${ASCENT}/desk.jpg" alt="Ascent Equipment's new website on a computer" loading="lazy"><figcaption>On a computer</figcaption></figure>
</div>
<button type="button" class="ghost" id="openfull">See the whole website</button>
<div class="stats">
<div><span class="k">Website grade</span><span class="v">71 <i>to</i> 93</span></div>
<div><span class="k">Time to load</span><span class="v">10.2s <i>to</i> 4.6s</span></div>
<div><span class="k">AI answers naming him</span><span class="v">0% <i>to</i> 50%</span></div>
</div>
<p class="stats-note">All three measured 14 days after the new site went live.</p>
<div class="graders">
<figure><img src="${ASCENT}/grader-before.png" alt="HubSpot Website Grader: old site scored 71 out of 100" loading="lazy"><figcaption>Old site: 71/100</figcaption></figure>
<figure><img src="${ASCENT}/grader-after.png" alt="HubSpot Website Grader: new site scored 93 out of 100" loading="lazy"><figcaption>New site: 93/100</figcaption></figure>
</div>
<figure class="score"><img src="${ASCENT}/shot-score.png" alt="Ascent's AI visibility 14 days after launch: 50% of AI answers" loading="lazy"><figcaption>How often AI names Ascent, 14 days after launch</figcaption></figure>
<blockquote class="testi">
<div class="who"><img src="${ASCENT}/dov-rom.jpg" alt="Dave Rom" width="72" height="72" loading="lazy"><div><b>Dave (Dov) Rom</b><span>President, Ascent Equipment</span></div></div>
<p>"I rarely give public endorsements, but my experience with BlueFx was so positive that I am compelled to share it. They recently completed the overhaul of our company website and integrated cutting-edge SEO AI solutions that have fundamentally transformed how we acquire and engage customers online.</p>
<p>They didn't just build a beautiful, fast, and highly responsive website; they engineered an intuitive user experience that has drastically improved our conversion rates.</p>
<p>What truly sets BlueFx apart is its forward-thinking approach to search engine optimization. By implementing a sophisticated SEO AI framework, they have automated and supercharged our content optimization, keyword targeting, and performance tracking. <b>Within just a few weeks of launching, we have seen a 45% increase in organic traffic</b> and a significant lift in our search engine rankings for highly competitive keywords.</p>
<p>They are not just a service provider; they are a true strategic partner invested in our growth. If you are looking for an agency that seamlessly blends top-tier web development with next-generation, AI-driven marketing strategies, <b>look no further than BlueFx</b>."</p>
</blockquote>
<p class="trust">17 years in online marketing. 36,000+ customers since 2008.</p>
</section>
<div class="lb" id="alb" role="dialog" aria-modal="true" aria-label="Ascent Equipment, whole website"><div class="lb-bar"><span>ascentequipment.com, whole page on a phone</span><button type="button" class="x" id="albx">&#x2715; Close</button></div><div class="lb-scroll" id="albs">${fullPieces}</div></div>
<section id="plans" aria-labelledby="plans-h">
<h2 id="plans-h">Your site is ready. Pick how you want it to grow.</h2>
<p class="plans-intro">No setup fee on the first two plans. You've seen your new site before you pay a cent. For scale: $299 a month is less than one new customer.</p>
<div class="plans">${WEBSITE_PLANS.map((plan) => planCard(plan, token)).join('\n')}</div>
<div class="guarantee narrow"><div class="seal">60<br>DAY</div><div><h3>Our guarantee</h3><p>You've already seen your new site, so there are no surprises. And once it's live, if AI doesn't name your business more often 60 days after launch than it did before, your next month is free.</p><a href="https://aispartan.com/terms/" target="_blank" rel="noopener">How it's measured</a></div></div>
<p class="bigger">Bigger company or more than one location? Let's price it together on a call. <button type="button" class="link js-talk">Book a call</button></p>
</section>
<section class="narrow" aria-labelledby="next-h"><h2 id="next-h">What happens next</h2><ol class="steps">
${STEPS.map(([b, t]) => `<li><div><b>${esc(b)}</b><span>${esc(t)}</span></div></li>`).join('\n')}
</ol><p class="steps-note">After launch, we start on the AI part and send your first scoreboard.</p></section>
<section class="narrow" aria-labelledby="who-h"><h2 id="who-h">Who's behind this</h2><div class="about">
<img class="photo" src="${PHOTO_URL}" alt="Szilard Gyorfi" width="96" height="96" loading="lazy">
<div><p>Hi, I'm Szilard, the founder of BlueFX. My team has been building websites, videos and marketing for small businesses since 2008. They built your new homepage, and I personally look over every project.</p>
<p>You can always reach me directly. If it's not a fit for you, I'll tell you straight and point you somewhere better.</p>
<button type="button" class="btn js-talk">Let's talk</button>
<p class="mail">Or just email me at <a href="mailto:${REACH_EMAIL}">${REACH_EMAIL}</a></p></div>
</div></section>
<section class="narrow" aria-labelledby="faq-h"><h2 id="faq-h">Questions business owners ask us</h2><div class="faq">
${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
</div></section>
<section class="narrow final" aria-labelledby="final-h"><h2 id="final-h">${esc(first ? `Your new website is ready, ${first}.` : 'Your new website is ready.')}</h2>
<p>Right now your customers are looking you up on their phones and asking AI who to call. Let's make sure they find the new ${esc(business)}.</p>
<div class="cta-pair">${wantIt}${talkFirst}</div></section>
</main>
<script>function onFSPopupClosed(order){if(order&&window.fastspring&&window.fastspring.builder){try{window.fastspring.builder.reset()}catch(e){}}}</script>
<script id="fsc-api" src="https://sbl.onfastspring.com/sbl/1.0.5/fastspring-builder.min.js" type="text/javascript" data-storefront="${storefront}" data-popup-closed="onFSPopupClosed" async></script>
<script>(function(){var c=${config};var vid;try{vid=localStorage.getItem('fv_vid')||(Math.random().toString(36).slice(2)+Date.now().toString(36));localStorage.setItem('fv_vid',vid)}catch(e){vid=null}
function send(e,p){if(c.internal)return;try{fetch(c.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({e:e,v:vid,p:p||null}),keepalive:true})}catch(x){}}
var v=document.getElementById('v'),played=false,watched=false;
document.getElementById('fs').addEventListener('click',function(){try{if(v.requestFullscreen){v.requestFullscreen()}else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen()}else if(v.webkitRequestFullscreen){v.webkitRequestFullscreen()}}catch(x){}var p=v.play();if(p&&p.catch)p.catch(function(){})});
v.addEventListener('play',function(){if(!played){played=true;send('website_play')}});
var pl=document.querySelector('#plans .plans');if(pl&&window.IntersectionObserver){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.disconnect();send('website_plans')}})},{rootMargin:'0px 0px -50% 0px'});io.observe(pl)}
v.addEventListener('timeupdate',function(){if(!watched&&v.duration&&v.currentTime/v.duration>=0.6){watched=true;send('website_watched')}});
function talk(){send('website_interest');
 var q=new URLSearchParams({name:c.prefill.name,email:c.prefill.email,utm_source:c.utm.utmSource,utm_campaign:c.utm.utmCampaign,utm_content:c.utm.utmContent});
 q.set('a3',c.prefill.customAnswers.a3);var link=c.calendar+'?'+q;
 if(window.Calendly&&Calendly.initPopupWidget){Calendly.initPopupWidget({url:link})}else{window.open(link,'_blank','noopener')}}
[].forEach.call(document.querySelectorAll('.js-talk'),function(b){b.addEventListener('click',talk)});
[].forEach.call(document.querySelectorAll('.js-buy'),function(a){a.addEventListener('click',function(ev){var key=a.getAttribute('data-plan'),paths=c.plans[key];send('website_checkout',key);
 var b=window.fastspring&&window.fastspring.builder;if(!b||!paths)return;
 try{b.push({reset:true,products:paths.map(function(p){return{path:p,quantity:1}}),tags:{freeVideoLead:c.token},checkout:true});ev.preventDefault()}catch(x){}})});
function dialog(lb,closeBtn,scroller){function close(){lb.classList.remove('open');document.body.style.overflow=''}
 closeBtn.addEventListener('click',close);scroller.addEventListener('click',function(e){if(e.target===scroller)close()});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&lb.classList.contains('open'))close()});
 return function(){lb.classList.add('open');document.body.style.overflow='hidden'}}
var alb=document.getElementById('alb'),albs=document.getElementById('albs'),openA=dialog(alb,document.getElementById('albx'),albs);
document.getElementById('openfull').addEventListener('click',function(){albs.scrollTop=0;openA()});
var lb=document.getElementById('lb');if(lb){var shots=c.shots,lbi=document.getElementById('lbi'),lbs=document.getElementById('lbs'),openB=dialog(lb,document.getElementById('lbx'),lbs);
 function show(i){lbi.onerror=function(){if(lbi.src!==shots[i].crop){lbi.src=shots[i].crop}};lbi.src=shots[i].full;lbi.alt=shots[i].label;lbs.scrollTop=0;
  [].forEach.call(lb.querySelectorAll('.tab'),function(t){t.classList.toggle('on',+t.getAttribute('data-tab')===i)})}
 [].forEach.call(document.querySelectorAll('.shot'),function(b){b.addEventListener('click',function(){show(+b.getAttribute('data-shot'));openB()})});
 [].forEach.call(lb.querySelectorAll('.tab'),function(t){t.addEventListener('click',function(){show(+t.getAttribute('data-tab'))})});}
})();</script>
<link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet"><script src="https://assets.calendly.com/assets/external/widget.js" async></script>
</body></html>`;
}
