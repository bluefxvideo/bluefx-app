import { alertsTable, sendBrevoTo } from '@/lib/free-video/alerts';
import { FREE_DIRECTOR, SITE_URL, STATS_EXCLUDED_EMAILS, VIP_ALERT_FROM_NAME, VIP_ALERT_TO } from '@/lib/free-video/config';
import { affiliateOfRef, isClickBankRef, isOwnerTestRef, isServiceRef } from '@/lib/free-video/funnel';
import { eventsTable, getLead, recordEvent } from '@/lib/free-video/leads';
import { safeFetchWith } from '@/lib/free-video/safe-fetch';
import { displayDomain } from '@/lib/free-video/website';
import { BROWSER_UA } from '@/lib/smart-video/sources';
import type { FreeVideoLead } from '@/types/free-video';

/**
 * VIP leads (owner 2026-11-07): the few "whales" among the free video leads, businesses with the money and the need for
 * his premium work (websites at $250 to $899 a month, custom video). He takes them over himself (checks their video,
 * gives it clean, upgrades it, makes their website page first, writes and calls), so he must KNOW who they are as soon
 * as they come in. Nothing here changes what the lead gets, and nothing is ever emailed to the lead.
 *
 * Every lead is scored once, while its video is being made, from the website text the video step already read plus
 * the homepage's footer, structured data and tracking tags: one Gemini Flash call, about a third of a cent. The mark
 * is a 'vip_scored' event on the lead (meta: VipMark), so there is no new table; the newest mark wins. A VIP sends the
 * owner one email, "VIP lead: <business> (<what they do>, since <year>, <city>)", to VIP_ALERT_TO.
 *
 * The marks (checked against 318 past leads on 2026-11-07, about 9 VIPs a week): a real business on its own domain
 * where one customer is worth $1,000+, with at least 2 signs of an established business: an email on their own
 * domain, 10+ years or 20+ reviews (50+ reviews count twice), a phone and street address on the site, already paying
 * for marketing. Never VIP, not even by paying: authors, churches, charities, marketing agencies and marketing
 * software, network marketing, personal sites, sites on a free platform address. Coaches, course sellers and sites not
 * in English are VIP only once they buy. The owner's own test videos are never scored.
 *
 * Later, an action can make a lead VIP (vipAfterAction, promotes): buying AI Media Machine or paying $290+, or
 * paying anything, clicking Let's talk or clicking a website plan when one customer is worth $200+ to them. A VIP's
 * website emails say "VIP lead" (website-demo.ts); a VIP's payment and purchase each send a VIP email (vipPing).
 * Every VIP email starts with "VIP lead": a Gmail filter on that subject in support@ labels and stars them.
 */

/** What one customer is worth to the business: high = $1,000 or more, medium = $200 to $1,000, low = less. */
export type VipValue = 'high' | 'medium' | 'low';
/** 'business' is a real operating business; every other kind is never VIP. */
export type VipKind = 'business' | 'author' | 'coach' | 'church' | 'nonprofit' | 'agency' | 'mlm' | 'personal';

/** What the model read on their website. Every field is what the site says, or null / false. */
export interface VipFacts {
  business: string;
  /** What they do, in a few plain words ("pool builder"). */
  industry: string;
  city: string | null;
  /** The year the business started. */
  since: number | null;
  /** Years in business or of experience, when the site gives a number. */
  years: number | null;
  /** The largest review count the site shows. */
  reviews: number | null;
  phone: string | null;
  /** A street address is on the site. */
  address: boolean;
  value: VipValue;
  kind: VipKind;
  /** The web agency in a footer credit ("Website by X"), a sign they pay for marketing. */
  siteBy: string | null;
  /** The site's main language is English (the owner's websites and videos are in English). */
  english: boolean;
}

export interface VipMark {
  vip: boolean;
  facts: VipFacts;
  /** Why, as the owner reads it in the email: what a customer is worth, then each sign found. */
  reasons: string[];
  /** Why this lead can never be VIP, not even by paying (an author, an agency, a free platform site), else null. */
  never: string | null;
  /** Why this lead is VIP only once it buys AI Media Machine or pays $290+ (a coach, a site not in English), else null. */
  needsPurchase: string | null;
  /** Marketing tags in their homepage (Meta pixel, Google Ads, GoHighLevel, HubSpot, CallRail). */
  tags: string[];
  ownEmail: boolean;
  /** Who made the mark: the live scorer, the backfill script, or an action that made the lead VIP. */
  source: 'new' | 'backfill' | 'action';
  /** The action that made the lead VIP ("clicked Let's talk"), for source 'action'. */
  action?: string;
}

/** Something the lead did. Only paid, bought, talk and checkout can make a lead VIP (promotes). */
export type VipAction =
  | { kind: 'paid'; amount: number | null; label: string }
  | { kind: 'bought'; label: string }
  | { kind: 'talk'; label: string }
  | { kind: 'checkout'; label: string }
  | { kind: 'watched'; label: string };

const VIP_EVENT = 'vip_scored';
/** Characters of the video step's website text and of the homepage extras the model reads. */
const SITE_CHARS = 12_000;
const EXTRA_CHARS = 3_000;
const MODEL_TIMEOUT_MS = 45_000;

// ---------------------------------------------------------------------------------------------
// The marks (pure)
// ---------------------------------------------------------------------------------------------

/** Free mailbox providers: an email there is not "on their own domain". */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'ymail.com', 'rocketmail.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'comcast.net', 'att.net', 'sbcglobal.net', 'verizon.net', 'bellsouth.net', 'cox.net', 'charter.net', 'earthlink.net',
  'protonmail.com', 'proton.me', 'pm.me', 'mail.com', 'zoho.com', 'optonline.net', 'frontier.com', 'frontiernet.net',
  'windstream.net', 'centurylink.net', 'embarqmail.com', 'roadrunner.com', 'rr.com', 'twc.com', 'shaw.ca', 'rogers.com',
  'sympatico.ca', 'btinternet.com', 'sky.com', 'web.de', 't-online.de', 'orange.fr', 'free.fr', 'wanadoo.fr', 'libero.it',
  'qq.com', '163.com', 'juno.com', 'netzero.net', 'fastmail.com', 'hey.com', 'tutanota.com', 'gmx.com', 'mail.ru',
  // AT&T's old mailboxes
  'ameritech.net', 'pacbell.net', 'prodigy.net', 'swbell.net', 'flash.net', 'snet.net', 'wans.net', 'nvbell.net',
]);
const FREE_MAIL_FAMILY = /^(yahoo|hotmail|outlook|live|gmx|yandex|aim)\.[a-z.]+$/i;

/** True when the email is on a business's own domain, not a free mailbox (nor a subdomain of one, like cfl.rr.com). */
export function isOwnDomainEmail(email: string): boolean {
  const domain = (email.split('@')[1] || '').trim().toLowerCase();
  if (!domain || FREE_MAIL_FAMILY.test(domain)) return false;
  return ![...FREE_MAIL].some((free) => domain === free || domain.endsWith(`.${free}`));
}

/** Free site builders and profiles: a site there is not the business's own domain. */
const PLATFORM_HOSTS = [
  'wixsite.com', 'wix.com', 'weebly.com', 'weeblysite.com', 'squarespace.com', 'godaddysites.com', 'wordpress.com',
  'blogspot.com', 'business.site', 'sites.google.com', 'linktr.ee', 'linktree.com', 'facebook.com', 'fb.com',
  'instagram.com', 'tiktok.com', 'youtube.com', 'etsy.com', 'amazon.com', 'kajabi.com', 'mykajabi.com', 'thinkific.com',
  'teachable.com', 'podia.com', 'myshopify.com', 'square.site', 'carrd.co', 'webflow.io', 'strikingly.com',
  'mystrikingly.com', 'jimdosite.com', 'site123.me', 'yolasite.com', 'ueniweb.com', 'hs-sites.com', 'myclickfunnels.com',
  'systeme.io', 'gumroad.com', 'beacons.ai', 'stan.store', 'substack.com', 'medium.com', 'vercel.app', 'netlify.app',
  'github.io', 'framer.website', 'durable.co', 'canva.site',
];

/** True when the website is on the business's own domain. */
export function onOwnDomain(domain: string): boolean {
  const host = domain.trim().toLowerCase().replace(/^www\./, '');
  return !PLATFORM_HOSTS.some((platform) => host === platform || host.endsWith(`.${platform}`));
}

/** Never VIP, not even by paying (both refunds and cancels so far were authors who paid). */
const NEVER: Partial<Record<VipKind, string>> = {
  author: 'a book author',
  church: 'a church or ministry',
  nonprofit: 'a charity or nonprofit',
  agency: 'a marketing agency or marketing software',
  mlm: 'network marketing or make-money-online',
  personal: 'a personal site, not a business',
};

/** The marks applied to what was read: VIP or not, the reasons, and why never or why only after a purchase. */
export function judgeVip(
  facts: VipFacts,
  ownEmail: boolean,
  ownSite: boolean,
  tags: string[],
  thisYear = new Date().getUTCFullYear()
): Pick<VipMark, 'vip' | 'reasons' | 'never' | 'needsPurchase'> {
  const never = !ownSite ? 'their site is on a free platform address' : (NEVER[facts.kind] ?? null);
  const needsPurchase = facts.kind === 'coach' ? 'a coach or course seller' : !facts.english ? 'their site is not in English' : null;
  const sinceAge = facts.since ? thisYear - facts.since : 0;
  const age = Math.max(facts.years ?? 0, sinceAge);
  const reviews = facts.reviews ?? 0;
  const marketing = [...tags, ...(facts.siteBy ? [`site by ${facts.siteBy}`] : [])];
  const signs: { line: string; points: number }[] = [];
  if (ownEmail) signs.push({ line: 'email on their own domain', points: 1 });
  if (age >= 10 || reviews >= 20) {
    const ageLine = sinceAge >= 10 ? `in business since ${facts.since}` : age >= 10 ? `${age}+ years in business` : '';
    const parts = [ageLine, reviews >= 20 ? `${reviews} reviews` : ''];
    signs.push({ line: parts.filter(Boolean).join(', '), points: reviews >= 50 ? 2 : 1 });
  }
  if (facts.phone && facts.address) signs.push({ line: 'phone and street address on their site', points: 1 });
  if (marketing.length) signs.push({ line: `already pays for marketing (${marketing.join(', ')})`, points: 1 });
  const points = signs.reduce((sum, sign) => sum + sign.points, 0);
  const worth =
    facts.value === 'high'
      ? `one customer is worth $1,000+ to them (${facts.industry})`
      : facts.value === 'medium'
        ? `one customer is worth $200 to $1,000 to them (${facts.industry})`
        : `small orders (${facts.industry})`;
  return {
    vip: !never && !needsPurchase && facts.value === 'high' && points >= 2,
    reasons: [worth, ...signs.map((sign) => sign.line)],
    never,
    needsPurchase,
  };
}

/** Whether this action makes a lead that is not VIP yet a VIP. */
export function promotes(mark: Pick<VipMark, 'never' | 'needsPurchase' | 'facts'>, action: VipAction): boolean {
  if (mark.never) return false;
  if (action.kind === 'bought') return true;
  if (action.kind === 'paid' && (action.amount ?? 0) >= 290) return true;
  if (mark.needsPurchase) return false;
  return (action.kind === 'paid' || action.kind === 'talk' || action.kind === 'checkout') && mark.facts.value !== 'low';
}

// ---------------------------------------------------------------------------------------------
// Reading the site
// ---------------------------------------------------------------------------------------------

const TAGS: [string, RegExp][] = [
  ['Meta pixel', /connect\.facebook\.net\/[^"'\s]*\/fbevents\.js|fbq\(\s*['"]init['"]/i],
  ['Google Ads', /['"]AW-\d{6,}['"]|googleadservices\.com|googleads\.g\.doubleclick\.net/i],
  ['GoHighLevel', /leadconnectorhq\.com|msgsndr\.com|gohighlevel/i],
  ['HubSpot', /js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/i],
  ['CallRail', /cdn\.callrail\.com|calltrk\.com/i],
];

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * The homepage once more (the video step keeps only its text): the tracking tags, and for the model the footer text,
 * the structured data (schema.org often has the phone, address and review count) and the tel: links. Empty when the
 * page cannot be fetched. Never throws.
 */
async function readHomepage(lead: Pick<FreeVideoLead, 'website_url' | 'website_domain'>): Promise<{ tags: string[]; extra: string }> {
  try {
    const res = await safeFetchWith(
      lead.website_url || `https://${lead.website_domain}`,
      { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' } },
      { htmlBytes: 2_000_000, truncateHtml: true, skipErrorBody: true }
    );
    if (!res.ok) return { tags: [], extra: '' };
    const html = await res.text();
    const tags = TAGS.filter(([, pattern]) => pattern.test(html)).map(([name]) => name);
    const data = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((match) => match[1])
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, EXTRA_CHARS);
    const visible = html
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#?\w+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const phones = [...new Set([...html.matchAll(/href=["']tel:([^"']{7,30})["']/gi)].map((match) => decode(match[1]).trim()))].slice(0, 3);
    const extra = [
      visible ? `END OF THE HOMEPAGE (footer): ${visible.slice(-EXTRA_CHARS)}` : '',
      data ? `STRUCTURED DATA ON THE HOMEPAGE: ${data}` : '',
      phones.length ? `PHONE LINKS ON THE HOMEPAGE: ${phones.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    return { tags, extra };
  } catch {
    return { tags: [], extra: '' };
  }
}

function factsPrompt(site: string, extra: string, domain: string): string {
  return `You read a small business's own website for a sales team. Answer ONLY from the website text below; never guess. Return JSON with exactly these keys:
- "business": the business's name as the site writes it.
- "industry": what they do, in 1 to 4 plain words (e.g. "pool builder", "commercial lender", "septic service", "flag maker").
- "city": their main city with its state or country when the site says it (e.g. "Dallas, TX"), else null.
- "since": the year the business started when the site says it ("since 1998", "est. 2004", "founded in 1972", "family owned since 1985"), else null.
- "years": the number of years in business or of experience when the site says one ("30 years of experience"), else null.
- "reviews": the largest number of customer reviews the site shows ("125 Google reviews", "based on 300 reviews"), else null.
- "phone": the main phone number as written on the site, else null.
- "address": true when the site shows a street address (a number and a street name), else false.
- "value": what ONE customer is usually worth to them. Be strict: "high" only when a typical customer clearly pays $1,000 or more.
  "high" = $1,000 or more: big home projects (pools, roofing, foundations, windows and doors, HVAC installs, solar, remodeling, construction, septic systems, tree removal, paving, fencing, landscape design and installation); B2B, manufacturing, equipment, wholesale, logistics; clinics (laser, dental, med spa, medical, cosmetic surgery); law firms; financial advisors, lenders, insurance and accounting firms; real estate agents and brokers; dealers of cars, trucks, boats or equipment; private schools and childcare; event venues, wedding planners, film locations, limousine services; commercial cleaning or security contracts.
  "medium" = $200 to $1,000: smaller home services (lawn mowing, junk hauling, pest control, handyman, plumbing or electrical repairs), house cleaning, photographers, DJs and entertainers, wedding officiants, auto repair, chiropractors, therapists, personal trainers, credit repair, tutoring, small-event catering.
  "low" = under $200: restaurants, cafes, food trucks, salons, barbers, retail shops, online stores, apps, books, courses, memberships, online programs.
- "kind": "business" for any real operating business (insurance, real estate, travel and staffing agencies are businesses); "author" when they mainly sell their own books; "coach" for coaching, mentoring, speaking or personal development, online schools or academies selling courses, programs or certifications, and wellness or spiritual practitioners (Reiki, energy healing, holistic health advocates); "church" for a church or ministry; "nonprofit" for a charity or nonprofit; "agency" for marketing, advertising, web design, SEO, social media or lead generation agencies, and for companies that sell marketing or sales software, platforms or tools; "mlm" for network marketing, affiliate offers, make-money-online or crypto schemes; "personal" for a personal blog, hobby or portfolio without a real business.
- "site_by": the web agency named in a credit such as "Website by X" or "Designed by X", else null. Website builders (Wix, Squarespace, WordPress, GoDaddy, Shopify) do not count.
- "english": true when the website's main language is English, else false.

THE WEBSITE (${domain}):
"""
${site}
"""
${extra ? `\n${extra}\n` : ''}`;
}

/** The model's answer as VipFacts, or null when a needed field is missing. */
export function readFacts(raw: unknown, domain: string, thisYear = new Date().getUTCFullYear()): VipFacts | null {
  if (!raw || typeof raw !== 'object') return null;
  const answer = raw as Record<string, unknown>;
  const text = (value: unknown, max: number) => {
    if (typeof value !== 'string') return null;
    const clean = value.replace(/\s+/g, ' ').trim();
    return clean && clean.toLowerCase() !== 'null' ? clean.slice(0, max) : null;
  };
  const count = (value: unknown) => {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[^\d.]/g, '')) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const value = answer.value === 'high' || answer.value === 'medium' || answer.value === 'low' ? answer.value : null;
  const kinds: VipKind[] = ['business', 'author', 'coach', 'church', 'nonprofit', 'agency', 'mlm', 'personal'];
  const kind = kinds.find((k) => k === answer.kind) ?? null;
  if (!value || !kind) return null;
  const since = count(answer.since);
  const years = count(answer.years);
  const reviews = count(answer.reviews);
  return {
    business: text(answer.business, 80) || displayDomain(domain),
    industry: text(answer.industry, 40) || 'business',
    city: text(answer.city, 50),
    since: since && since >= 1800 && since <= thisYear ? since : null,
    years: years && years < 200 ? years : null,
    reviews: reviews && reviews < 1_000_000 ? reviews : null,
    phone: text(answer.phone, 40),
    address: answer.address === true,
    value,
    kind,
    siteBy: text(answer.site_by, 60),
    english: answer.english !== false,
  };
}

/** One Gemini call (a second try after a timeout or a 5xx/429). null when it fails. Never throws. */
async function askFacts(site: string, extra: string, domain: string): Promise<VipFacts | null> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key || !site.trim()) return null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FREE_DIRECTOR.model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: factsPrompt(site.slice(0, SITE_CHARS), extra, domain) }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingLevel: 'low' } },
        }),
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`⚠️ [vip] ${domain}: the model answered ${res.status}: ${(await res.text()).slice(0, 160)}`);
        if (res.status !== 429 && res.status < 500) return null;
        continue;
      }
      const json = await res.json();
      const text: string = (json.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text || '').join('');
      return readFacts(JSON.parse(text), domain);
    } catch (error) {
      console.warn(`⚠️ [vip] ${domain}: the model call failed:`, String(error).slice(0, 160));
    }
  }
  return null;
}

/** Scores a lead from its website text. null when the model gives nothing usable. Never throws. */
export async function scoreLead(
  lead: Pick<FreeVideoLead, 'email' | 'website_domain' | 'website_url'>,
  siteText: string,
  source: VipMark['source']
): Promise<VipMark | null> {
  const homepage = await readHomepage(lead);
  const facts = await askFacts(siteText, homepage.extra, lead.website_domain);
  if (!facts) return null;
  const ownEmail = isOwnDomainEmail(lead.email);
  return { ...judgeVip(facts, ownEmail, onOwnDomain(lead.website_domain), homepage.tags), facts, tags: homepage.tags, ownEmail, source };
}

// ---------------------------------------------------------------------------------------------
// Marks on the lead
// ---------------------------------------------------------------------------------------------

function isVipMark(meta: unknown): meta is VipMark {
  const mark = meta as VipMark | null;
  return Boolean(mark && typeof mark.vip === 'boolean' && mark.facts && typeof mark.facts.business === 'string' && Array.isArray(mark.reasons));
}

/** The lead's newest VIP mark, or null when it was never scored (or the mark cannot be read). Never throws. */
export async function vipMarkOf(leadId: string): Promise<VipMark | null> {
  try {
    const { data, error } = await eventsTable().select('meta').eq('lead_id', leadId).eq('event', VIP_EVENT).order('at', { ascending: false }).limit(1);
    if (error) {
      console.warn(`⚠️ [vip] Mark of lead ${leadId} not read:`, error.message);
      return null;
    }
    const meta = (data as Array<{ meta: unknown }> | null)?.[0]?.meta;
    return isVipMark(meta) ? meta : null;
  } catch {
    return null;
  }
}

export async function saveMark(lead: Pick<FreeVideoLead, 'id' | 'ref'>, mark: VipMark): Promise<void> {
  await recordEvent({ event: VIP_EVENT, leadId: lead.id, ref: lead.ref, meta: mark as unknown as Record<string, unknown> });
}

// ---------------------------------------------------------------------------------------------
// The owner's emails
// ---------------------------------------------------------------------------------------------

/** Where the lead came from, in the owner's words. */
function funnelOf(lead: Pick<FreeVideoLead, 'ref' | 'source'>): string {
  const ref = lead.ref || '';
  // The ClickBank affiliate funnel (spec §6): the affiliate's nickname, so the owner sees whose lead it is.
  if (isClickBankRef(ref)) {
    const nick = affiliateOfRef(ref);
    return nick ? `ClickBank funnel (${nick})` : 'ClickBank funnel';
  }
  if (isServiceRef(ref)) return `$49 funnel (${ref})`;
  if (ref.startsWith('fb-')) return `AI Media Machine funnel (${ref})`;
  if (ref === 'bfxhome') return 'bluefx.net homepage';
  if (lead.source === 'email_reply' || ref.includes('email')) return `email reply${ref ? ` (${ref})` : ''}`;
  return ref || lead.source;
}

/** True when the lead has a website page (a 'website_demo' event). Never throws. */
async function hasWebsitePage(leadId: string): Promise<boolean> {
  try {
    const { data } = await eventsTable().select('id').eq('lead_id', leadId).eq('event', 'website_demo').limit(1);
    return Boolean((data as unknown[] | null)?.length);
  } catch {
    return false;
  }
}

/** The contact block of every VIP email. */
async function contactLines(lead: FreeVideoLead, mark: VipMark): Promise<string[]> {
  const page = (await hasWebsitePage(lead.id)) ? `${SITE_URL}/v/${lead.view_token}/website?internal=1` : null;
  return [
    `Name: ${lead.first_name || '?'}`,
    `Email: ${lead.email}`,
    `Phone: ${mark.facts.phone ? `${mark.facts.phone} (from their website)` : 'not on their website'}`,
    `Website: https://${lead.website_domain}`,
    `Their video page: ${SITE_URL}/v/${lead.view_token}?internal=1`,
    ...(page ? [`Their website page: ${page}`] : []),
    `Came from: ${funnelOf(lead)}`,
  ];
}

/** "VIP lead: Bloom Painting (painting contractor, since 2004, Dallas, TX)" and its text. */
export async function vipIntro(lead: FreeVideoLead, mark: VipMark): Promise<{ subject: string; text: string }> {
  const { facts } = mark;
  const where = [facts.since ? `since ${facts.since}` : '', facts.city || ''].filter(Boolean).join(', ');
  return {
    subject: `VIP lead: ${facts.business} (${facts.industry}${where ? `, ${where}` : ''})`.slice(0, 180),
    text: [`${facts.business} looks like a VIP lead. Their free video is being made now.`, '', `Why: ${mark.reasons.join('; ')}.`, '', ...(await contactLines(lead, mark))].join('\n'),
  };
}

/**
 * One VIP email to the owner (VIP_ALERT_TO, sender name "VIP lead"), once per key. It goes out at once, outside the
 * routine alerts' daily cap; the row in free_video_alerts is the dedupe, and a failed send is left unsent there, so the
 * routine alert email carries it later. Returns true when it was sent now. Never throws.
 */
export async function sendVipAlert(key: string, subject: string, text: string): Promise<boolean> {
  try {
    const { data, error } = await alertsTable()
      .upsert([{ key: key.slice(0, 200), subject: subject.slice(0, 200), body: `${subject}\n${text}`.slice(0, 2000), sent: true }], {
        onConflict: 'key',
        ignoreDuplicates: true,
      })
      .select('key');
    if (error) {
      console.error(`❌ [vip] ${subject} (not stored: ${error.message})`);
      return false;
    }
    if (!(data as unknown[] | null)?.length) return false; // already sent once
    const result = await sendBrevoTo(VIP_ALERT_TO, subject, text, VIP_ALERT_FROM_NAME);
    if (!result.ok) {
      await alertsTable().update({ sent: false, error: (result.error || 'send failed').slice(0, 300) }).eq('key', key.slice(0, 200));
      console.error(`❌ [vip] ${subject} (email failed, the routine alert email carries it later):`, result.error);
      return false;
    }
    console.log(`⭐ [vip] Emailed the owner: ${subject}`);
    return true;
  } catch (error) {
    console.error(`❌ [vip] ${subject} (failed):`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------

/** The owner's own test videos (his addresses, any funnel's owner-test ref, a test lead) are never scored. */
export function isOwnTest(lead: Pick<FreeVideoLead, 'source' | 'ref' | 'email'>): boolean {
  return lead.source === 'test' || isOwnerTestRef(lead.ref) || STATS_EXCLUDED_EMAILS.includes(lead.email.trim().toLowerCase());
}

/**
 * The live scorer: runner.ts calls it once the video step has read the lead's website, in the background, so the video
 * never waits on it. One mark per lead (a second attempt keeps the first); a VIP emails the owner once. Test leads are
 * skipped. Never throws.
 */
export async function scoreNewLead(lead: FreeVideoLead, siteText: string): Promise<void> {
  try {
    if (isOwnTest(lead) || (await vipMarkOf(lead.id))) return;
    const mark = await scoreLead(lead, siteText, 'new');
    if (!mark) {
      console.warn(`⚠️ [vip] Lead ${lead.id} (${lead.website_domain}) was not scored`);
      return;
    }
    await saveMark(lead, mark);
    console.log(`${mark.vip ? '⭐' : 'ℹ️'} [vip] ${lead.website_domain}: ${mark.vip ? 'VIP' : 'not VIP'} (${mark.reasons.join('; ')}${mark.never ? `; never: ${mark.never}` : ''})`);
    if (mark.vip) {
      const { subject, text } = await vipIntro(lead, mark);
      await sendVipAlert(`vip:${lead.id}`, subject, text);
    }
  } catch (error) {
    console.error(`❌ [vip] Scoring lead ${lead.id} failed:`, error);
  }
}

/**
 * The lead's VIP mark after an action. A lead that is not VIP yet becomes one when the action promotes it: a new mark
 * (source 'action'). mark is null when the lead was never scored. Never throws.
 */
export async function vipAfterAction(lead: Pick<FreeVideoLead, 'id' | 'ref'>, action: VipAction): Promise<{ mark: VipMark | null; promoted: boolean }> {
  const mark = await vipMarkOf(lead.id);
  if (!mark || mark.vip || !promotes(mark, action)) return { mark, promoted: false };
  const promoted: VipMark = { ...mark, vip: true, source: 'action', action: action.label, reasons: [...mark.reasons, action.label] };
  await saveMark(lead, promoted);
  return { mark: promoted, promoted: true };
}

/** A VIP did something worth a call: one email to the owner per key (an action may also make the lead VIP). Never throws. */
export async function vipPing(lead: FreeVideoLead, action: VipAction, key: string, details: string[] = []): Promise<void> {
  try {
    const { mark, promoted } = await vipAfterAction(lead, action);
    if (!mark?.vip) return;
    const name = lead.first_name || lead.email;
    const business = mark.facts.business;
    await sendVipAlert(
      key,
      `VIP lead: ${name} (${business}) ${action.label}`.slice(0, 180),
      [
        promoted ? `${business} is now a VIP lead: ${name} ${action.label}.` : `${name} (${business}, a VIP lead) ${action.label}.`,
        ...(details.length ? ['', ...details] : []),
        '',
        `Why VIP: ${mark.reasons.join('; ')}.`,
        '',
        ...(await contactLines(lead, mark)),
      ].join('\n')
    );
  } catch (error) {
    console.error(`❌ [vip] Ping for lead ${lead.id} failed:`, error);
  }
}

/** A lead that bought AI Media Machine (sweep.ts attributeSales). Never throws. */
export async function vipBought(leadId: string): Promise<void> {
  try {
    const lead = await getLead(leadId);
    if (lead) await vipPing(lead, { kind: 'bought', label: 'bought AI Media Machine' }, `vip-bought:${leadId}`);
  } catch (error) {
    console.error(`❌ [vip] Purchase ping for lead ${leadId} failed:`, error);
  }
}

