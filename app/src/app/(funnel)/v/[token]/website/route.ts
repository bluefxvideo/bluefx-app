import { type NextRequest, NextResponse } from 'next/server';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { hasInternalCookie } from '@/lib/free-video/internal-visit';
import { getLeadByToken } from '@/lib/free-video/leads';
import { displayDomain } from '@/lib/free-video/website';
import { recordWebsiteEvent, WEBSITE_EVENTS, websiteDemoOf, type WebsiteDemo, type WebsiteEvent } from '@/lib/free-video/website-demo';
import { FREE_VIDEO_TOKEN_PATTERN, type FreeVideoLead } from '@/types/free-video';

/**
 * /v/<token>/website (owner 2026-11-03): the lead's personal website video (website-demo.ts) and a
 * "Let's talk" button (opens the owner's calendar) and an email line with his photo. A full HTML page of its own, like /unlimited: no funnel header, no ad pixels.
 * GET: the page (404 when the lead has no demo). POST {e, v}: the page's events (play, watched, interest).
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

async function load(token: string): Promise<{ lead: FreeVideoLead; demo: WebsiteDemo } | null> {
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token)) return null;
  const lead = await getLeadByToken(token);
  if (!lead) return null;
  const demo = await websiteDemoOf(lead.id);
  return demo ? { lead, demo } : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let found;
  try {
    found = await load(token);
  } catch (error) {
    console.error('❌ [website-demo] Page could not read the lead:', error);
    return new NextResponse('Please try again in a minute.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!found) return notFound();
  const internal = req.nextUrl.searchParams.get('internal') === '1' || hasInternalCookie(req.headers.get('cookie'));
  return new NextResponse(renderPage(token, found.lead, found.demo, internal), { status: 200, headers: HTML_HEADERS });
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
    const body = (await req.json().catch(() => null)) as { e?: unknown; v?: unknown } | null;
    const event = typeof body?.e === 'string' && (WEBSITE_EVENTS as readonly string[]).includes(body.e) ? (body.e as WebsiteEvent) : null;
    if (!event) return noContent();
    const visitorId = typeof body?.v === 'string' && /^[a-z0-9-]{8,40}$/i.test(body.v) ? body.v : null;
    const { token } = await params;
    const found = await load(token);
    if (found) await recordWebsiteEvent(found.lead, found.demo, event, visitorId);
  } catch (error) {
    console.error('❌ [website-demo] Event failed:', error);
  }
  return noContent();
}

function renderPage(token: string, lead: FreeVideoLead, demo: WebsiteDemo, internal: boolean): string {
  const word = (lead.first_name || '').trim().split(/\s+/)[0] || '';
  const first = word ? word.charAt(0).toUpperCase() + word.slice(1) : ''; // "sam" typed in the form → "Sam"
  const business = demo.business || displayDomain(lead.website_domain);
  const title = first ? `${first}, I remade your website for ${business}. Take a look.` : `I remade your website for ${business}. Take a look.`;
  const config = JSON.stringify({
    url: `/v/${token}/website`,
    internal,
    calendar: CALENDAR_URL,
    prefill: { name: first, email: lead.email, customAnswers: { a3: `https://${lead.website_domain}` } },
    utm: { utmSource: 'bluefx', utmCampaign: 'website-demo', utmContent: lead.website_domain },
    shots: demo.before && demo.after
      ? [
          { full: fullShot(demo.before), crop: demo.before, label: 'Your website today, full page' },
          { full: fullShot(demo.after), crop: demo.after, label: 'Your new homepage, full page' },
        ]
      : [],
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
${demo.poster ? `<meta property="og:image" content="${esc(demo.poster)}">` : ''}
<style>
:root{--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--navy:#143d70;--green:#15803d;--bg:#f4f6fa}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 16px 48px}
.from{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:15px;margin:0 0 10px}
.from b{color:var(--ink)}
h1{font-size:clamp(26px,4.4vw,40px);line-height:1.15;margin:0 0 20px;letter-spacing:-.01em}
.player{position:relative;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 14px 40px rgba(15,23,42,.22);aspect-ratio:16/9}
video{display:block;width:100%;height:100%;background:#000}
.fs{display:block;margin:12px auto 0;width:auto;background:#fff;color:var(--navy);border:2px solid var(--navy);box-shadow:none;font-size:17px;padding:11px 20px}
.fs:active{transform:none;box-shadow:none}
.cta{margin:22px auto 0;max-width:520px;text-align:center}
button{width:100%;border:0;border-radius:14px;background:var(--green);color:#fff;font-family:inherit;font-weight:700;font-size:21px;line-height:1.2;padding:19px 22px;cursor:pointer;box-shadow:0 6px 0 #0f5f2c;transition:transform .08s}
button:active{transform:translateY(3px);box-shadow:0 3px 0 #0f5f2c}
.reach{display:flex;align-items:center;gap:14px;max-width:520px;margin:22px auto 0;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 18px}
.reach img{width:56px;height:56px;border-radius:50%;object-fit:cover;flex:none}
.reach img{width:64px;height:64px}.reach p{margin:0;font-size:15px;color:var(--muted);line-height:1.4}.reach .name{color:var(--ink);font-weight:700;font-size:17px}
.reach a{color:var(--navy);font-weight:700;font-size:17px;text-decoration:none;white-space:nowrap}
.ba{margin:44px 0 0}.ba h2{font-size:clamp(22px,3.2vw,30px);margin:0 0 16px;text-align:center}
.ba-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.ba figure{margin:0;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 6px 18px rgba(15,23,42,.08)}
.ba img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;object-position:top}
.ba figcaption{padding:10px 14px;font-weight:700;font-size:16px;display:flex;justify-content:space-between;gap:10px;align-items:center}.ba .before figcaption{color:var(--muted)}.ba .after figcaption{color:var(--green)}
.ba figcaption small{font-weight:600;font-size:14px;color:var(--navy);white-space:nowrap}
.ba .shot{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in;border-radius:0;box-shadow:none}
.ba .shot:active{transform:none;box-shadow:none}
@media (max-width:700px){.ba-grid{grid-template-columns:1fr}}
.lb{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.92);display:none;flex-direction:column}
.lb.open{display:flex}
.lb-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;flex:none}
.lb-bar button{width:auto;font-size:16px;padding:10px 16px;border-radius:10px;box-shadow:none;background:#fff;color:var(--ink)}
.lb-bar button:active{transform:none;box-shadow:none}
.lb-bar .tab.on{background:var(--green);color:#fff}
.lb-bar .x{margin-left:auto;background:transparent;color:#fff;border:2px solid #fff}
.lb-scroll{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 12px 24px}
.lb-scroll img{display:block;width:100%;max-width:1100px;height:auto;margin:0 auto;border-radius:10px;background:#fff}
@media (max-width:600px){.lb-bar button{font-size:15px;padding:9px 12px}}
@media (max-width:600px){main{padding:18px 12px 36px}.player{border-radius:12px}}
</style></head><body><main>
<p class="from">A video from <b>Szilard at BlueFX</b></p>
<h1>${esc(title)}</h1>
<div class="player"><video id="v" src="${esc(demo.video)}"${demo.poster ? ` poster="${esc(demo.poster)}"` : ''} controls preload="metadata"></video></div>
<button type="button" class="fs" id="fs">&#x26F6; Watch full screen</button>
<div class="cta"><button type="button" id="talk">Let's talk</button></div>
<div class="reach"><img src="${PHOTO_URL}" alt="Szilard Gyorfi" width="64" height="64"><p><span class="name">Szilard Gyorfi</span><br>Founder, BlueFX<br>Reach me here:<br><a href="mailto:${REACH_EMAIL}">${REACH_EMAIL}</a></p></div>
${demo.before && demo.after ? `<section class="ba"><h2>Before and after</h2><div class="ba-grid">
<figure class="before"><button type="button" class="shot" data-shot="0" aria-label="See your website today, full page"><img src="${esc(demo.before)}" alt="Your website today" loading="lazy"></button><figcaption>Your website today <small>See full page</small></figcaption></figure>
<figure class="after"><button type="button" class="shot" data-shot="1" aria-label="See your new homepage, full page"><img src="${esc(demo.after)}" alt="Your new homepage" loading="lazy"></button><figcaption>Your new homepage <small>See full page</small></figcaption></figure>
</div></section>
<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Before and after, full page"><div class="lb-bar"><button type="button" class="tab" data-tab="0">Your website today</button><button type="button" class="tab" data-tab="1">Your new homepage</button><button type="button" class="x" id="lbx">&#x2715; Close</button></div><div class="lb-scroll" id="lbs"><img id="lbi" alt=""></div></div>` : ''}
</main>
<script>(function(){var c=${config};var vid;try{vid=localStorage.getItem('fv_vid')||(Math.random().toString(36).slice(2)+Date.now().toString(36));localStorage.setItem('fv_vid',vid)}catch(e){vid=null}
function send(e){if(c.internal)return;try{fetch(c.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({e:e,v:vid}),keepalive:true})}catch(x){}}
var v=document.getElementById('v'),played=false,watched=false;
document.getElementById('fs').addEventListener('click',function(){try{if(v.requestFullscreen){v.requestFullscreen()}else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen()}else if(v.webkitRequestFullscreen){v.webkitRequestFullscreen()}}catch(x){}var p=v.play();if(p&&p.catch)p.catch(function(){})});
v.addEventListener('play',function(){if(!played){played=true;send('website_play')}});
v.addEventListener('timeupdate',function(){if(!watched&&v.duration&&v.currentTime/v.duration>=0.6){watched=true;send('website_watched')}});
document.getElementById('talk').addEventListener('click',function(){send('website_interest');
 var q=new URLSearchParams({name:c.prefill.name,email:c.prefill.email,utm_source:c.utm.utmSource,utm_campaign:c.utm.utmCampaign,utm_content:c.utm.utmContent});
 q.set('a3',c.prefill.customAnswers.a3);var link=c.calendar+'?'+q;
 if(window.Calendly&&Calendly.initPopupWidget){Calendly.initPopupWidget({url:link})}else{window.open(link,'_blank','noopener')}});
var lb=document.getElementById('lb');if(lb){var shots=c.shots,lbi=document.getElementById('lbi'),lbs=document.getElementById('lbs'),cur=0;
 function show(i){cur=i;lbi.onerror=function(){if(lbi.src!==shots[i].crop){lbi.src=shots[i].crop}};lbi.src=shots[i].full;lbi.alt=shots[i].label;lbs.scrollTop=0;
  [].forEach.call(lb.querySelectorAll('.tab'),function(t){t.classList.toggle('on',+t.getAttribute('data-tab')===i)})}
 function open(i){show(i);lb.classList.add('open');document.body.style.overflow='hidden'}
 function close(){lb.classList.remove('open');document.body.style.overflow=''}
 [].forEach.call(document.querySelectorAll('.shot'),function(b){b.addEventListener('click',function(){open(+b.getAttribute('data-shot'))})});
 [].forEach.call(lb.querySelectorAll('.tab'),function(t){t.addEventListener('click',function(){show(+t.getAttribute('data-tab'))})});
 document.getElementById('lbx').addEventListener('click',close);
 lbs.addEventListener('click',function(e){if(e.target===lbs)close()});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&lb.classList.contains('open'))close()});}
})();</script>
<link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet"><script src="https://assets.calendly.com/assets/external/widget.js" async></script>
</body></html>`;
}
