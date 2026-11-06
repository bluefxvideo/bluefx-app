/**
 * "Your free website check" on the website page (/v/<token>/website, owner 2026-11-06): the same results the ClickBank
 * upsell shows (bluefx.net /ai-coaching-call-cbup/, client-bluefx src/website-check-oto3.njk): who ChatGPT and Google
 * recommend for the lead's customers, what's good on their site, and up to 3 quick wins. Owner: "stay as close to it as
 * possible on the result stuff", so the wording, order and styles below are copied from that page.
 *
 * The check itself runs on bluefx.net (netlify/functions/_lib/website-check.js, results in Netlify Blobs). Every new lead
 * with a website is already checked there every 20 minutes, so showing it here adds no cost. Asking for a lead with no
 * stored result starts its check; the section then shows from the next page view. Stored results are not refreshed
 * (owner 2026-11-06: "the old checks are ok").
 */

const CHECK_URL = process.env.WEBSITE_CHECK_URL || 'https://bluefx.net/.netlify/functions/website-check';
const CHECK_ORIGIN = new URL(CHECK_URL).origin;
const TIMEOUT_MS = 2500;

type Finding = { title?: string; sees?: string; costs?: string; body?: string; cartoon_url?: string };
type SearchList = { engine: string; label: string; names: string[]; you_rank: number | null };
export type WebsiteCheck = {
  status: 'ready';
  domain: string;
  customer_word?: string;
  problems?: Finding[];
  working?: Finding | null;
  shot?: string | null;
  search?: { question?: string; checked_on?: string; business?: string; town?: string; lists?: SearchList[] } | null;
};

/** The stored check for this lead, or null (none yet, still running, or bluefx.net slow). Never throws. */
export async function fetchWebsiteCheck(token: string): Promise<WebsiteCheck | null> {
  try {
    const res = await fetch(`${CHECK_URL}?v=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string };
    return data && data.status === 'ready' ? (data as WebsiteCheck) : null;
  } catch (error) {
    console.warn('⚠️ [website-check] No check for the website page:', error instanceof Error ? error.message : error);
    return null;
  }
}

const esc = (text: string) => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const abs = (url: string) => (/^https?:\/\//.test(url) ? url : `${CHECK_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`);
const WORDS = ['no', 'one', 'two', 'three'];
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** The section's HTML, or '' when the check found nothing to show. Text and order follow the upsell page's render(). */
export function renderWebsiteCheck(r: WebsiteCheck): string {
  const problems = (r.problems || []).filter((f) => f && f.title);
  const word = r.customer_word || 'customers';
  const n = problems.length;
  const sr = r.search || null;
  const lists = (sr && sr.lists ? sr.lists : []).filter((L) => L && Array.isArray(L.names) && L.names.length);
  const town = (sr && (sr.town || ((sr.question || '').match(/near ([^,?]+)/i) || [])[1])) || '';
  if (!lists.length && !n && !r.working) return '';

  let title = '';
  let test = '';
  if (sr && lists.length) {
    const byEngine: Record<string, SearchList> = {};
    lists.forEach((L) => { byEngine[L.engine] = L; });
    const C = byEngine.chatgpt;
    const G = byEngine.google;
    const inC = C && C.you_rank;
    const inG = G && G.you_rank;
    const firstOther = (L?: SearchList) => {
      if (!L) return '';
      for (let i = 0; i < L.names.length; i++) if (L.you_rank !== i + 1) return L.names[i];
      return '';
    };
    const who = `your ${word}${town ? ` in ${town}` : ''}`;
    const red = (text: string) => `<span class="oto-title-red">${esc(text)}</span>`;
    if (!inC && !inG) title = `${esc(`I asked ChatGPT and Google who ${who} should call. `)}${red("Right now they're sending them to someone else.")}`;
    else if (inC && !inG) title = `${esc(`ChatGPT sends ${word} to you. `)}${red(`Google sends them to ${firstOther(G) || 'someone else'} first.`)}`;
    else if (!inC && inG) title = `${esc('Google shows you. ')}${red(`ChatGPT sends ${word} to ${firstOther(C) || 'someone else'} instead.`)}`;
    else if (inC === 1 && inG === 1) title = `${esc('ChatGPT and Google both recommend you first. ')}${red("Let's keep it that way.")}`;
    else title = `${esc('ChatGPT and Google know you. ')}${red(`But they send some ${word} to ${(inC !== 1 ? firstOther(C) : firstOther(G)) || 'someone else'} first.`)}`;

    const boxes = lists.map((L) => {
      const rows = L.names.slice(0, 3).map((nm, i) => {
        const you = L.you_rank === i + 1;
        return `<li${you ? ' class="is-you"' : ''}><i>${i + 1}</i>${esc(nm + (you ? ' (you)' : ''))}</li>`;
      });
      if (L.you_rank && L.you_rank > 3) rows.push(`<li class="is-you"><i>${L.you_rank}</i>${esc(`${sr.business || r.domain} (you)`)}</li>`);
      return `<div class="oto-test-list"><p>${esc(L.label)}:</p><ol>${rows.join('')}</ol>${L.you_rank ? '' : `<p class="oto-test-miss">You're not on this list yet.</p>`}</div>`;
    }).join('');
    const lost = [C && !inC ? C.names[0] : '', G && !inG ? G.names[0] : ''].filter((x, i, a) => x && a.indexOf(x) === i);
    let cost = '';
    if (lost.length && !inC && !inG) cost = `Today, people who ask this get sent to ${lost.join(' or ')}. Nobody gets sent to you.`;
    else if (lost.length) cost = `Today, people who ask ${inC ? 'Google' : 'ChatGPT'} get sent to ${lost[0]} first.`;
    const praise = !inC && r.working ? `<p class="oto-test-praise">${esc(`You clearly do good work. The next ${word.replace(/s$/, '')} who asks ChatGPT gets sent somewhere else.`)}</p>` : '';
    test = `<div class="oto-test"><p class="oto-test-q"><span>Your ${esc(word)} ask:</span> <b>${esc(`“${sr.question || ''}”`)}</b></p>
<div>${boxes}</div>${cost ? `<p class="oto-test-cost">${esc(cost)}</p>` : ''}${praise}
<p class="oto-test-note">${esc(`We asked on ${sr.checked_on || 'a recent day'}. Answers can change from day to day.`)}</p></div>`;
  } else {
    title = `${esc(`When new ${word} search Google or ask ChatGPT, do they find ${r.domain}, `)}<span class="oto-title-red">or someone else?</span>`;
  }

  let found = '';
  if (n || r.working) {
    const shot = r.shot ? `<figure class="oto-shotbig"><figcaption>Your website today, on a phone</figcaption><img src="${esc(abs(r.shot))}" alt="${esc(`${r.domain} on a phone`)}" loading="lazy"></figure>` : '';
    const working = r.working && r.working.title
      ? `<p class="oto-working"><b>&#x2713; What's good: </b>${esc(`${r.working.title}. ${r.working.costs || ''}`.trim())}</p>`
      : '';
    const fixes = n
      ? `<div class="oto-fixes"><p class="oto-fixes-t">${esc(n === 1 ? 'A quick win I spotted (an easy one, I promise)' : `${WORDS[n] ? cap(WORDS[n]) : n} quick wins I spotted (easy ones, I promise)`)}</p><ul>${problems.map((f) => `<li><img src="${esc(abs(f.cartoon_url || '/cb-funnel/oto3/cartoons/general_problem.jpg'))}" alt="" loading="lazy"><div><b>${esc(f.title || '')}</b><span>${esc(f.costs || f.sees || f.body || '')}</span></div></li>`).join('')}</ul></div>`
      : '';
    found = `<div class="oto-band oto-band--soft"><div class="fv-inner"><h2 class="oto-h2">I Also Looked At <span>${esc(r.domain)}</span></h2>${shot}${working}${fixes}</div></div>`;
  }

  // The one line the upsell page doesn't have: it ties the findings to the new website shown above (owner OK'd the mock).
  const fixWord = n === 1 ? 'fixes it' : n === 2 ? 'fixes both' : n ? 'fixes all three' : '';
  const tie = fixWord
    ? `Your new website above already ${fixWord}, and it's built so ChatGPT and Google can find you and recommend you.`
    : "Your new website above is built so ChatGPT and Google can find you and recommend you.";

  return `<section class="wc fv" id="check" aria-labelledby="wc-h">
<div class="oto-band oto-top"><div class="fv-inner"><p class="wc-kicker">Your free website check</p><h2 class="oto-title" id="wc-h">${title}</h2>${test}</div></div>
${found}
<div class="wc-tie-wrap"><div class="fv-inner"><p class="wc-tie">${esc(tie)}</p></div></div>
</section>`;
}

/** The upsell page's styles for these blocks (copied from the live page's stylesheet 2026-11-06), plus its colors. */
export const WEBSITE_CHECK_CSS = `
.wc{--fv-ink:#0f172a;--fv-text:#334155;--fv-muted:#64748b;--fv-line:#e2e8f0;--fv-card-blue:#f1f6fc;--fv-green:#7cb342;--fv-green-dark:#689f38;--fv-green-ink:#33691e;--fv-green-tint:#f1f8e9;--fv-shadow-card:0 10px 30px rgba(15,23,42,.08);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--fv-text);margin:48px 0 0;text-align:left}
.wc *{box-sizing:border-box}
.fv .fv-inner{max-width:720px;margin:0 auto;padding:0 20px}
.fv .oto-h2{margin:0 auto 14px;max-width:720px;color:var(--fv-ink);font-size:clamp(26px,4.4vw,40px);font-weight:800;line-height:1.15;text-align:center;text-wrap:balance}
.fv .oto-band{padding:40px 0;background:#fff;border-top:1px solid var(--fv-line)}
.fv .oto-band--soft{background:var(--fv-card-blue)}
.fv .oto-top{background:#fff}
.fv .oto-title{margin:0 0 12px;text-align:center;color:var(--fv-ink);font-size:clamp(26px,6.6vw,40px);font-weight:800;line-height:1.15;letter-spacing:-.5px;text-wrap:balance}
.fv .oto-title-red{color:#c2412d}
.fv .oto-test{margin:16px 0 6px;padding:16px;border-radius:16px;background:#fff;border:2px solid var(--fv-ink);box-shadow:var(--fv-shadow-card)}
.fv .oto-test-q{margin:0 0 12px;padding:10px 12px;border-radius:12px 12px 12px 2px;background:var(--fv-card-blue);color:var(--fv-ink);font-size:16px;line-height:1.4}
.fv .oto-test-q>span{display:block;color:var(--fv-muted);font-size:13px;font-weight:700}
.fv .oto-test-list{margin:0 0 12px}
.fv .oto-test-list p{margin:0 0 6px;color:var(--fv-ink);font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
.fv .oto-test-list ol{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.fv .oto-test-list li{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;background:#f6f7f9;color:var(--fv-ink);font-size:16px;font-weight:700}
.fv .oto-test-list li i{flex:0 0 24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--fv-ink);color:#fff;font-style:normal;font-size:13px}
.fv .oto-h2,.fv .oto-title,.fv .oto-test-miss,.fv .oto-test-q{overflow-wrap:anywhere}
.fv .oto-test-list li.is-you{background:var(--fv-green-tint);color:var(--fv-green-ink);border:2px solid var(--fv-green)}
.fv .oto-test-list li.is-you i{background:var(--fv-green)}
.fv .oto-test-list p.oto-test-miss{margin:6px 0 0;padding:8px 10px;border-radius:10px;background:#fff4f2;color:#9a3412;font-size:15px;font-weight:700;text-transform:none;letter-spacing:0;border:1px dashed #f3b6a8}
.fv .oto-test-note{margin:8px 0 0;color:var(--fv-muted);font-size:12px}
.fv .oto-fixes{max-width:640px;margin:18px auto 0;padding:16px;border-radius:16px;background:#fff;border:1px solid var(--fv-line)}
.fv .oto-fixes-t{margin:0 0 10px;color:var(--fv-ink);font-size:17px;font-weight:800}
.fv .oto-fixes ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.fv .oto-fixes li{display:grid;grid-template-columns:84px 1fr;gap:12px;align-items:center}
.fv .oto-fixes img{width:84px;height:56px;object-fit:contain;border-radius:8px;background:#fff;border:1px solid var(--fv-line)}
.fv .oto-fixes b{display:block;color:var(--fv-ink);font-size:16px;line-height:1.3}
.fv .oto-fixes span{display:block;color:var(--fv-text);font-size:14px;line-height:1.4;margin-top:2px}
.fv .oto-top .oto-title{margin:14px 0 12px;text-align:left;font-size:clamp(23px,5.8vw,34px);line-height:1.2}
.fv .oto-test-cost{margin:10px 0 0;color:var(--fv-ink);font-size:16px;font-weight:700;line-height:1.4}
.fv .oto-test-praise{margin:8px 0 0;color:var(--fv-text);font-size:15px;line-height:1.45}
.fv .oto-working{margin:14px auto 0;max-width:640px;padding:12px 14px;border-radius:12px;background:var(--fv-green-tint);color:var(--fv-green-ink);font-size:15px;line-height:1.45}
.fv .oto-working b{color:var(--fv-green-ink)}
.fv .oto-shotbig{margin:16px auto 0;max-width:260px}
.fv .oto-shotbig figcaption{margin-bottom:6px;text-align:center;color:var(--fv-ink);font-size:14px;font-weight:700}
.fv .oto-shotbig img{display:block;width:100%;aspect-ratio:9/16;object-fit:cover;object-position:center top;border-radius:18px;border:4px solid var(--fv-ink)}
.wc .wc-kicker{margin:0;text-align:center;text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:13px;color:var(--fv-green-dark)}
.wc .wc-tie-wrap{padding:28px 0 8px;border-top:1px solid var(--fv-line)}
.wc .wc-tie{margin:0;text-align:center;color:var(--fv-ink);font-size:18px;font-weight:700;line-height:1.45;text-wrap:balance}
`;
