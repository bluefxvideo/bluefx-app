import { createAdminClient } from '@/app/supabase/server';
import { STATS_EXCLUDED_EMAILS, STATS_EXCLUDED_VISITS } from '@/lib/free-video/config';
import { isCardPlacement, OFFER_BUTTON_PLACEMENTS } from '@/lib/free-video/offer';
import { REFUSAL_EVENT } from '@/lib/free-video/refusals';
import { emailKeyOf } from '@/lib/free-video/website';

/**
 * The free video ad funnel in numbers, for the admin panel (owner 2026-10-11: "i want to know the conversion rate,
 * except my test accounts contact@bluefx.net and sziliblue@gmail.com"). Server only, read only, exact: every table
 * read pages through all matching rows.
 *
 * What each number is:
 * - visitors: distinct browsers (visitor id) with a landing_view in the range. A row without a visitor id counts once.
 * - formStarts: distinct browsers with a form_start in the range (same rule).
 * - optIns: PEOPLE who sent the opt-in page's form (leads with source 'landing' created in the range, grouped by
 *   emailKeyOf). Someone whose first website was refused and who tried two more counts once. The steps below are about
 *   these same people (a cohort), whenever the step happened; a person reaches a step when any of their leads did.
 * - videosMade: a lead with status 'done'.
 * - viewed: first_viewed_at (the emailed /v/ page was opened), unless it looks like the owner's own open: an event from
 *   one of the owner's browsers on that lead from 5 s before to 5 minutes after it, and none from any other browser.
 *   Since 2026-10-12 the owner's browser (the fv_internal cookie) never sets first_viewed_at at all.
 * - played: a video_play event on the lead from a browser that is not one of the owner's. played_at is not used: it
 *   also holds the owner's own plays from the admin.
 * - offerOpens: an offer_open event on the lead (the offer card on a result page opened, since 2026-10-12) from a
 *   browser that is not one of the owner's; offerOpensDownload and offerOpensBar split it by what opened the card (the
 *   event's placement column: 'download', the "Download without the watermark" button under the video ad, or 'bar', the
 *   phone buy bar). Someone who opened it both ways counts in both, so the two can add up to more than offerOpens.
 * - offerClicks: a cta_click on a lifetime offer button of the funnel's pages (OFFER_BUTTON_PLACEMENTS: /go/fvthank,
 *   /go/fvpage, /go/fvland and the offer card's /go/fvthankcard and /go/fvpagecard), not from one of the owner's
 *   browsers. clicked_at is not used: the email buttons (fvmail1-4, which only open the video ad page) stamp it too. A
 *   click carries its browser (visitor_id) since 2026-10-12; an older click without one is taken as the owner's when
 *   one of his browsers sent an event on that lead in the 10 minutes before it and no other browser did. cardClicks:
 *   the same clicks, on the offer card's button only (CARD_PLACEMENTS). cardOpenClicks: people with both a counted
 *   offer_open and a counted card click, the share of card openers who clicked (cardClicks alone can be higher: a click
 *   still lands on /go when the offer_open beacon was lost to a content blocker or the event route's rate cap).
 * - purchases: bought_at, any AI Media Machine purchase the sweep matched to the lead's email after the lead was made
 *   (sweep.ts attributeSales: a ClickBank sale of the vendor or a FastSpring subscription), not only the lifetime offer.
 * Rates: optIn = optIns / visitors, view = viewed / videosMade, open = offerOpens / videosMade, click = offerClicks /
 * videosMade (the offer shows with the finished video ad, on the thank-you page as well as on /v/), purchase =
 * purchases / optIns, visitorToSale = purchases / visitors; null when the divisor is 0.
 *
 * Left out everywhere: leads whose email is in STATS_EXCLUDED_EMAILS (compared by emailKeyOf), leads with source
 * 'test' or ref 'owner-test' (an opt-in from a browser marked internal); the owner's browsers, which are the browsers
 * that sent an event about one of those leads (none of their landing views, form starts, plays or clicks count); page
 * events tagged ref=owner-test; the browsers of STATS_EXCLUDED_VISITS (link checks). Visits marked internal
 * (fv_internal) are never stored by the event route, so they need nothing here.
 * Leads made another way (email replies, by hand, a Facebook lead form) never saw the page: they are counted apart
 * (notFromPage, and their own rows in the source tables), never in the page's totals and rates.
 */

export const DEFAULT_STATS_TZ = 'Europe/Bucharest';
/** The ref of the owner's own leads (leads.ts createLead) and of an opt-in from a browser marked internal. */
const OWNER_TEST_REF = 'owner-test';
/** PostgREST's row cap on this project (max rows 1,000): a shorter page is the last one. */
const PAGE_ROWS = 1000;
const ID_CHUNK = 100;
const MAX_DAYS = 400;
/** An open is the owner's when one of his browsers sent an event on the lead in this window around first_viewed_at. */
const OPEN_BEFORE_MS = 5_000;
const OPEN_AFTER_MS = 5 * 60_000;
/** An older click without a browser is the owner's when one of his browsers sent an event on the lead this long before it. */
const CLICK_BEFORE_MS = 10 * 60_000;
/** The page event of an offer card opening (the first-party beacon, since 2026-10-12); its placement column says what opened the card. */
const OFFER_OPEN_EVENT = 'offer_open';
/** A lifetime offer button on the funnel's pages: the pages' own buttons and the offer card's. */
const isOfferButton = (placement: string | null) => (OFFER_BUTTON_PLACEMENTS as readonly string[]).includes(placement ?? '');

export interface FunnelCounts {
  visitors: number;
  formStarts: number;
  optIns: number;
  videosMade: number;
  viewed: number;
  played: number;
  offerOpens: number;
  offerOpensDownload: number;
  offerOpensBar: number;
  offerClicks: number;
  cardClicks: number;
  cardOpenClicks: number;
  purchases: number;
}

export interface FunnelRates {
  optIn: number | null;
  view: number | null;
  open: number | null;
  click: number | null;
  purchase: number | null;
  visitorToSale: number | null;
}

export type FunnelChannel = 'youtube' | 'facebook' | 'website' | 'email' | 'clickbank' | 'other' | 'direct' | 'not_page';

export interface FunnelSourceRow {
  /** tag:<ref>, facebook:click, clickbank:<affiliate>, direct, way:<lead source>; on the channel rows the channel (or way:<source>). */
  key: string;
  label: string;
  channel: FunnelChannel;
  channelLabel: string;
  /** False for leads made without the page (email replies, by hand): no visitors, no opt-in rate. */
  fromPage: boolean;
  counts: FunnelCounts;
  rates: FunnelRates;
}

export interface FunnelDayRow {
  /** YYYY-MM-DD in the requested time zone. */
  day: string;
  counts: FunnelCounts;
  rates: FunnelRates;
}

export interface FunnelStats {
  from: string | null;
  to: string;
  tz: string;
  totals: FunnelCounts;
  rates: FunnelRates;
  /**
   * About the people who opted in on the page in the range: refused at the form (every website they tried was
   * unreadable or not allowed), still waiting or being made, $99 clean versions bought.
   */
  extras: { refused: number; inProgress: number; unlocks: number };
  /**
   * Form sends of the range that did not become a free video ad (refusals.ts, kept since 2026-10-18): every one, the
   * people among them (by email), the count per reason and the newest ones with what was typed, so support can write.
   */
  turnedAway: TurnedAway;
  /** People with leads made without the page in the range (email replies, by hand), counted the same way. visitors and formStarts stay 0. */
  notFromPage: FunnelCounts;
  /** One row per tag (ref), Facebook click, ClickBank affiliate, "direct" and other lead source. */
  bySource: FunnelSourceRow[];
  /** The same rows summed per channel (YouTube, Facebook ads, bluefx.net website, ...). */
  byChannel: FunnelSourceRow[];
  /** Newest day first. A visitor seen on two days counts on both, so the visitors column can add up to more than the total. */
  byDay: FunnelDayRow[];
  excluded: {
    emails: string[];
    /** Lead rows of the range left out (the owner's addresses, source 'test', ref 'owner-test'). */
    leadsInRange: number;
    /** The owner's browsers (all time). */
    browsers: number;
    /** Link-check browsers (STATS_EXCLUDED_VISITS) with a page event in the range, and what those checks were. */
    linkChecks: number;
    linkCheckNotes: string[];
    /** Opens and offer clicks of the range's leads taken as the owner's own (see viewed and offerClicks above). */
    ownerOpens: number;
    ownerClicks: number;
  };
}

export interface TurnedAwayRow {
  at: string;
  /** RefusalCode: the form's error code, 'bot' or 'error'. */
  code: string;
  /** RefusalCheck, when the code has more than one cause. */
  check: string | null;
  firstName: string | null;
  email: string | null;
  website: string | null;
  ref: string | null;
}

export interface TurnedAway {
  sends: number;
  /** Different emails among the sends (a send without an email is not counted here). */
  people: number;
  /** Most sends first. */
  byReason: { code: string; check: string | null; sends: number }[];
  /** Newest first, at most TURNED_AWAY_ROWS. */
  recent: TurnedAwayRow[];
}

/** Rows of the turned-away list the panel shows. */
const TURNED_AWAY_ROWS = 50;

export interface FunnelStatsInput {
  /** ISO instant, inclusive; null = all time. */
  from: string | null;
  /** ISO instant, exclusive. */
  to: string;
  /** IANA time zone for the day rows. */
  tz: string;
}

interface LeadRow {
  id: string;
  created_at: string;
  source: string;
  ref: string | null;
  email: string | null;
  status: string;
  first_viewed_at: string | null;
  bought_at: string | null;
  unlock_status: string | null;
}

interface PageEventRow {
  id: number;
  at: string;
  event: string;
  visitor_id: string | null;
  ref: string | null;
}

interface LeadEventRow {
  id: number;
  at: string;
  event: string;
  lead_id: string;
  visitor_id: string | null;
  placement: string | null;
  ref: string | null;
  fbc: string | null;
}

const LEAD_COLUMNS = 'id, created_at, source, ref, email, status, first_viewed_at, bought_at, unlock_status';

const CHANNEL_LABELS: Record<FunnelChannel, string> = {
  youtube: 'YouTube',
  facebook: 'Facebook ads',
  website: 'bluefx.net website',
  email: 'Newsletter and emails',
  clickbank: 'ClickBank affiliates',
  other: 'Other tags',
  direct: 'No tag (direct)',
  not_page: 'Not from the page',
};

const WAY_LABELS: Record<string, string> = {
  email_reply: 'Email replies (made by hand)',
  manual: 'Added by hand',
  fb_lead: 'Facebook lead form',
};

const EXCLUDED_KEYS = new Set(STATS_EXCLUDED_EMAILS.map((email) => emailKeyOf(email)));

/** An address the statistics leave out: one of STATS_EXCLUDED_EMAILS, compared by emailKeyOf (a +tag, Gmail dots, googlemail.com). */
export function isStatsExcludedEmail(email: string | null | undefined): boolean {
  return Boolean(email) && EXCLUDED_KEYS.has(emailKeyOf(email ?? ''));
}

const isExcludedLead = (lead: Pick<LeadRow, 'email' | 'source' | 'ref'>) =>
  lead.source === 'test' || lead.ref?.trim() === OWNER_TEST_REF || isStatsExcludedEmail(lead.email);

/** The time zone when the runtime knows it, else null. */
export function validTimeZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD of an instant in a time zone. */
function dayFormatter(tz: string): (instant: string | number | Date) => string {
  const format = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (instant) => {
    const parts = format.formatToParts(new Date(instant));
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
}

/** Every calendar day from first to last, both included (at most MAX_DAYS, the newest kept). */
function daysBetween(first: string, last: string): string[] {
  const days: string[] = [];
  const [y, m, d] = first.split('-').map(Number);
  for (let i = 0; ; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    if (day > last) break;
    days.push(day);
  }
  return days.slice(-MAX_DAYS);
}

const emptyCounts = (): FunnelCounts => ({
  visitors: 0,
  formStarts: 0,
  optIns: 0,
  videosMade: 0,
  viewed: 0,
  played: 0,
  offerOpens: 0,
  offerOpensDownload: 0,
  offerOpensBar: 0,
  offerClicks: 0,
  cardClicks: 0,
  cardOpenClicks: 0,
  purchases: 0,
});

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export function ratesOf(counts: FunnelCounts): FunnelRates {
  return {
    optIn: ratio(counts.optIns, counts.visitors),
    view: ratio(counts.viewed, counts.videosMade),
    open: ratio(counts.offerOpens, counts.videosMade),
    click: ratio(counts.offerClicks, counts.videosMade),
    purchase: ratio(counts.purchases, counts.optIns),
    visitorToSale: ratio(counts.purchases, counts.visitors),
  };
}

function addCounts(into: FunnelCounts, add: FunnelCounts): void {
  for (const key of Object.keys(into) as (keyof FunnelCounts)[]) into[key] += add[key];
}

/** A clean tag from a ref, or null (empty, or the owner's test tag). */
function tagOf(ref: string | null | undefined): string | null {
  const tag = ref?.trim();
  return tag && tag !== OWNER_TEST_REF ? tag : null;
}

/** The channel a ref tag belongs to (the funnel's link conventions: yt-/ytc- YouTube, fb- Facebook ads, bfx bluefx.net). */
function channelOfTag(tag: string): FunnelChannel {
  if (/^ytc?-/i.test(tag)) return 'youtube';
  if (/^fb[-_]/i.test(tag)) return 'facebook';
  if (/^bfx/i.test(tag)) return 'website';
  if (/^(nl|newsletter|ml|mail|email|video-email)/i.test(tag)) return 'email';
  return 'other';
}

interface SourceKey {
  key: string;
  label: string;
  channel: FunnelChannel;
  fromPage: boolean;
}

const tagSource = (tag: string): SourceKey => ({ key: `tag:${tag}`, label: tag, channel: channelOfTag(tag), fromPage: true });
const DIRECT: SourceKey = { key: 'direct', label: 'No tag', channel: 'direct', fromPage: true };

type Db = ReturnType<typeof createAdminClient>;
type PageQuery = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * Every row a query matches, a page at a time by id (keyset: each page starts after the last id of the one before, so
 * no row is skipped or read twice and a page costs the same however far in). `page` builds the query for one page.
 */
async function readAll<T extends { id: string | number }>(page: (afterId: T['id'] | null) => PageQuery): Promise<T[]> {
  const rows: T[] = [];
  let afterId: T['id'] | null = null;
  for (;;) {
    const { data, error } = await page(afterId);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_ROWS) return rows;
    afterId = batch[batch.length - 1].id;
  }
}

const chunks = <T>(list: T[], size: number): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/** One person in the range: their leads (oldest first) and the steps any of them reached. */
interface Person {
  leads: LeadRow[];
  fromPage: boolean;
  counts: FunnelCounts;
}

/** The funnel for one range. Reads free_video_leads and free_video_events with the service key; writes nothing. */
export async function computeFunnelStats({ from, to, tz: tzInput }: FunnelStatsInput, db: Db = createAdminClient()): Promise<FunnelStats> {
  const tz = validTimeZone(tzInput) ?? DEFAULT_STATS_TZ;
  const dayOf = dayFormatter(tz);
  const table = (name: string) => (db as any).from(name);
  const keyset = (query: any, afterId: string | number | null) => (afterId === null ? query : query.gt('id', afterId)).order('id', { ascending: true }).limit(PAGE_ROWS);
  const fromMs = from ? Date.parse(from) : -Infinity;
  const toMs = Date.parse(to);
  const inRange = (iso: string) => {
    const ms = Date.parse(iso);
    return ms >= fromMs && ms < toMs;
  };

  // 1. Every lead (all time, a small table): the excluded ones (whose events name the owner's browsers) and the range's.
  const allLeads = await readAll<LeadRow>((afterId) => keyset(table('free_video_leads').select(LEAD_COLUMNS), afterId));
  const excludedLeadIds = allLeads.filter(isExcludedLead).map((lead) => lead.id);
  const rangeLeads = allLeads.filter((lead) => inRange(lead.created_at));
  const leads = rangeLeads.filter((lead) => !isExcludedLead(lead)).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));

  // 2. In parallel: the owner's browsers, every event about the range's leads, the page events of the range, and the
  //    page events of each link check window (all of them, so a browser half inside the range still goes).
  const pageEventsOf = (start: string | null, end: string) => (afterId: number | null) => {
    let query = table('free_video_events').select('id, at, event, visitor_id, ref').in('event', ['landing_view', 'form_start']).lt('at', end);
    if (start) query = query.gte('at', start);
    return keyset(query, afterId);
  };
  const [ownerRows, leadEventChunks, pageEvents, checkWindows] = await Promise.all([
    Promise.all(
      chunks(excludedLeadIds, ID_CHUNK).map((ids) =>
        readAll<{ id: number; visitor_id: string }>((afterId) => keyset(table('free_video_events').select('id, visitor_id').in('lead_id', ids).not('visitor_id', 'is', null), afterId))
      )
    ),
    Promise.all(
      chunks(
        leads.map((lead) => lead.id),
        ID_CHUNK
      ).map((ids) =>
        readAll<LeadEventRow>((afterId) =>
          keyset(table('free_video_events').select('id, at, event, lead_id, visitor_id, placement, ref, fbc:meta->>fbc').in('lead_id', ids), afterId)
        )
      )
    ),
    readAll<PageEventRow>(pageEventsOf(from, to)),
    Promise.all(STATS_EXCLUDED_VISITS.map((visit) => readAll<PageEventRow>(pageEventsOf(visit.from, visit.to)))),
  ]);
  const ownerBrowsers = new Set(ownerRows.flat().map((row) => row.visitor_id));
  const isOwner = (visitorId: string | null) => Boolean(visitorId && ownerBrowsers.has(visitorId));

  const linkCheckBrowsers = new Set<string>();
  const checkOf = new Map<string, string>();
  STATS_EXCLUDED_VISITS.forEach((visit, i) => {
    for (const row of checkWindows[i]) {
      if (!row.visitor_id || !visit.tag.test(row.ref?.trim() ?? '')) continue;
      linkCheckBrowsers.add(row.visitor_id);
      checkOf.set(row.visitor_id, `${visit.why} on ${visit.from.slice(0, 10)}`);
    }
  });

  // 3. What happened to each lead, from its events.
  const eventsOf = new Map<string, LeadEventRow[]>();
  for (const row of leadEventChunks.flat()) {
    const list = eventsOf.get(row.lead_id);
    if (list) list.push(row);
    else eventsOf.set(row.lead_id, [row]);
  }
  /** Events from known browsers on a lead between two instants: whether the owner's and whether anyone else's came. */
  const browsersBetween = (leadId: string, startMs: number, endMs: number) => {
    let owner = false;
    let other = false;
    for (const row of eventsOf.get(leadId) ?? []) {
      const ms = Date.parse(row.at);
      if (!row.visitor_id || ms < startMs || ms > endMs) continue;
      if (isOwner(row.visitor_id)) owner = true;
      else other = true;
    }
    return { owner, other };
  };

  let ownerOpens = 0;
  let ownerClicks = 0;
  const facebookLeads = new Set<string>();
  const affiliateOf = new Map<string, string>();
  const leadCounts = new Map<string, FunnelCounts>();
  for (const lead of leads) {
    const events = (eventsOf.get(lead.id) ?? []).sort((a, b) => a.id - b.id);
    const counts = emptyCounts();
    counts.optIns = 1;
    if (lead.status === 'done') counts.videosMade = 1;
    if (lead.first_viewed_at) {
      const at = Date.parse(lead.first_viewed_at);
      const near = browsersBetween(lead.id, at - OPEN_BEFORE_MS, at + OPEN_AFTER_MS);
      if (near.owner && !near.other) ownerOpens += 1;
      else counts.viewed = 1;
    }
    if (events.some((row) => row.event === 'video_play' && !isOwner(row.visitor_id))) counts.played = 1;
    const opens = events.filter((row) => row.event === OFFER_OPEN_EVENT && !isOwner(row.visitor_id));
    if (opens.length) counts.offerOpens = 1;
    if (opens.some((row) => row.placement === 'download')) counts.offerOpensDownload = 1;
    if (opens.some((row) => row.placement === 'bar')) counts.offerOpensBar = 1;
    const pageClicks = events.filter((row) => row.event === 'cta_click' && isOfferButton(row.placement));
    const realClicks = pageClicks.filter((row) => {
      if (row.visitor_id) return !isOwner(row.visitor_id);
      const at = Date.parse(row.at);
      const before = browsersBetween(lead.id, at - CLICK_BEFORE_MS, at);
      return !(before.owner && !before.other);
    });
    if (realClicks.length) counts.offerClicks = 1;
    else if (pageClicks.length) ownerClicks += 1;
    if (realClicks.some((row) => isCardPlacement(row.placement ?? ''))) {
      counts.cardClicks = 1;
      if (opens.length) counts.cardOpenClicks = 1;
    }
    if (lead.bought_at) counts.purchases = 1;
    leadCounts.set(lead.id, counts);
    for (const row of events) {
      if (row.event === 'meta_ids' && row.fbc) facebookLeads.add(lead.id);
      if (row.event === 'cb_hop' && row.ref && !affiliateOf.has(lead.id)) affiliateOf.set(lead.id, row.ref.startsWith('shield:') ? 'shield' : row.ref);
    }
  }

  // 4. People: the range's leads grouped by address (page leads and other leads apart), oldest lead first.
  const people = new Map<string, Person>();
  for (const lead of leads) {
    const fromPage = lead.source === 'landing';
    const key = `${fromPage ? 'page' : 'other'}|${lead.email ? emailKeyOf(lead.email) : `lead:${lead.id}`}`;
    let person = people.get(key);
    if (!person) people.set(key, (person = { leads: [], fromPage, counts: emptyCounts() }));
    person.leads.push(lead);
    const counts = leadCounts.get(lead.id) ?? emptyCounts();
    for (const step of Object.keys(counts) as (keyof FunnelCounts)[]) person.counts[step] = Math.max(person.counts[step], counts[step]);
  }

  /** A person's source: the first tag on any of their leads, else a Facebook click id, else a ClickBank affiliate, else direct. */
  const personSource = (person: Person): SourceKey => {
    const first = person.leads[0];
    if (!person.fromPage) return { key: `way:${first.source}`, label: WAY_LABELS[first.source] ?? first.source, channel: 'not_page', fromPage: false };
    const tag = person.leads.map((lead) => tagOf(lead.ref)).find(Boolean);
    if (tag) return tagSource(tag);
    if (person.leads.some((lead) => facebookLeads.has(lead.id))) return { key: 'facebook:click', label: 'Facebook click, no tag', channel: 'facebook', fromPage: true };
    const affiliate = person.leads.map((lead) => affiliateOf.get(lead.id)).find(Boolean);
    if (affiliate) return { key: `clickbank:${affiliate}`, label: `Affiliate ${affiliate}`, channel: 'clickbank', fromPage: true };
    return DIRECT;
  };

  // 5. The page's own events of the range: landing views and form starts, without the owner's browsers, test tags and link checks.
  const events = pageEvents.filter(
    (row) => !isOwner(row.visitor_id) && !(row.visitor_id && linkCheckBrowsers.has(row.visitor_id)) && row.ref?.trim() !== OWNER_TEST_REF
  );
  const checkedInRange = new Set(
    pageEvents.filter((row) => row.visitor_id && linkCheckBrowsers.has(row.visitor_id) && !isOwner(row.visitor_id)).map((row) => row.visitor_id as string)
  );

  // Each browser's source: the tag of its first tagged page event in the range, else direct.
  const browserOf = (row: PageEventRow) => (row.visitor_id ? `v:${row.visitor_id}` : `row:${row.id}`);
  const sourceOfBrowser = new Map<string, SourceKey>();
  for (const row of [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)) {
    const browser = browserOf(row);
    const tag = tagOf(row.ref);
    const current = sourceOfBrowser.get(browser);
    if (tag && (!current || current === DIRECT)) sourceOfBrowser.set(browser, tagSource(tag));
    else if (!current) sourceOfBrowser.set(browser, DIRECT);
  }

  // Counting.
  const totals = emptyCounts();
  const notFromPage = emptyCounts();
  const sources = new Map<string, SourceKey & { counts: FunnelCounts }>();
  const sourceRow = (source: SourceKey) => {
    let row = sources.get(source.key);
    if (!row) sources.set(source.key, (row = { ...source, counts: emptyCounts() }));
    return row.counts;
  };
  const dayRows = new Map<string, FunnelCounts>();
  const dayRow = (day: string) => {
    let row = dayRows.get(day);
    if (!row) dayRows.set(day, (row = emptyCounts()));
    return row;
  };

  // Browsers: once per range and per source, once per day.
  const seen = { visitors: new Set<string>(), formStarts: new Set<string>(), dayVisitors: new Set<string>(), dayFormStarts: new Set<string>() };
  for (const row of events) {
    const browser = browserOf(row);
    const step = row.event === 'landing_view' ? 'visitors' : 'formStarts';
    const daySet = step === 'visitors' ? seen.dayVisitors : seen.dayFormStarts;
    if (!seen[step].has(browser)) {
      seen[step].add(browser);
      totals[step] += 1;
      sourceRow(sourceOfBrowser.get(browser) ?? DIRECT)[step] += 1;
    }
    const day = dayOf(row.at);
    if (!daySet.has(`${day}|${browser}`)) {
      daySet.add(`${day}|${browser}`);
      dayRow(day)[step] += 1;
    }
  }

  // People: once each, on the day of their first lead in the range.
  const extras = { refused: 0, inProgress: 0, unlocks: 0 };
  for (const person of people.values()) {
    const source = personSource(person);
    addCounts(sourceRow(source), person.counts);
    if (!source.fromPage) {
      addCounts(notFromPage, person.counts);
      continue;
    }
    addCounts(totals, person.counts);
    addCounts(dayRow(dayOf(person.leads[0].created_at)), person.counts);
    const statuses = person.leads.map((lead) => lead.status);
    if (statuses.every((status) => status === 'rejected')) extras.refused += 1;
    if (!statuses.includes('done') && statuses.some((status) => status === 'queued' || status === 'running')) extras.inProgress += 1;
    if (person.leads.some((lead) => lead.unlock_status && lead.unlock_status !== 'none' && lead.unlock_status !== 'refunded')) extras.unlocks += 1;
  }

  // Rows.
  const bySource: FunnelSourceRow[] = [...sources.values()]
    .map(({ counts, ...source }) => ({ ...source, channelLabel: CHANNEL_LABELS[source.channel], counts, rates: ratesOf(counts) }))
    .sort((a, b) => Number(b.fromPage) - Number(a.fromPage) || b.counts.visitors - a.counts.visitors || b.counts.optIns - a.counts.optIns || a.label.localeCompare(b.label));

  const channels = new Map<string, FunnelSourceRow>();
  for (const row of bySource) {
    const key = row.fromPage ? row.channel : row.key;
    let channel = channels.get(key);
    if (!channel) {
      channel = { key, label: row.fromPage ? row.channelLabel : row.label, channel: row.channel, channelLabel: row.channelLabel, fromPage: row.fromPage, counts: emptyCounts(), rates: ratesOf(emptyCounts()) };
      channels.set(key, channel);
    }
    addCounts(channel.counts, row.counts);
  }
  const byChannel = [...channels.values()]
    .map((row) => ({ ...row, rates: ratesOf(row.counts) }))
    .sort((a, b) => Number(b.fromPage) - Number(a.fromPage) || b.counts.visitors - a.counts.visitors || b.counts.optIns - a.counts.optIns || a.label.localeCompare(b.label));

  const lastDay = dayOf(toMs - 1);
  const dataDays = [...dayRows.keys()].sort();
  const firstDay = from ? dayOf(from) : (dataDays[0] ?? lastDay);
  const byDay = daysBetween(firstDay < lastDay ? firstDay : lastDay, lastDay)
    .reverse()
    .map((day) => {
      const counts = dayRows.get(day) ?? emptyCounts();
      return { day, counts, rates: ratesOf(counts) };
    });

  const turnedAway = await turnedAwayOf(from, to, table, keyset);

  return {
    from,
    to,
    tz,
    totals,
    rates: ratesOf(totals),
    extras,
    turnedAway,
    notFromPage,
    bySource,
    byChannel,
    byDay,
    excluded: {
      emails: [...STATS_EXCLUDED_EMAILS],
      leadsInRange: rangeLeads.length - leads.length,
      browsers: ownerBrowsers.size,
      linkChecks: checkedInRange.size,
      linkCheckNotes: [...new Set([...checkedInRange].map((browser) => checkOf.get(browser) ?? ''))].filter(Boolean),
      ownerOpens,
      ownerClicks,
    },
  };
}

interface RefusalEventRow {
  id: number;
  at: string;
  placement: string | null;
  ref: string | null;
  meta: Record<string, unknown> | null;
}

const textOf = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** The range's refused form sends (refusals.ts), without the owner's: ref 'owner-test', a local dev server's, his addresses. */
async function turnedAwayOf(
  from: string | null,
  to: string,
  table: (name: string) => any,
  keyset: (query: any, afterId: string | number | null) => any
): Promise<TurnedAway> {
  const rows = await readAll<RefusalEventRow>((afterId) => {
    let query = table('free_video_events').select('id, at, placement, ref, meta').eq('event', REFUSAL_EVENT).lt('at', to);
    if (from) query = query.gte('at', from);
    return keyset(query, afterId);
  });
  const kept: TurnedAwayRow[] = rows
    .filter((row) => row.ref !== 'owner-test' && row.meta?.test !== true && !isStatsExcludedEmail(textOf(row.meta?.email)))
    .map((row) => ({
      at: row.at,
      code: row.placement ?? 'unknown',
      check: textOf(row.meta?.check),
      firstName: textOf(row.meta?.first_name),
      email: textOf(row.meta?.email),
      website: textOf(row.meta?.website),
      ref: row.ref,
    }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const reasons = new Map<string, { code: string; check: string | null; sends: number }>();
  for (const row of kept) {
    const key = `${row.code}/${row.check ?? ''}`;
    const reason = reasons.get(key) ?? { code: row.code, check: row.check, sends: 0 };
    reason.sends++;
    reasons.set(key, reason);
  }
  return {
    sends: kept.length,
    people: new Set(kept.flatMap((row) => (row.email ? [emailKeyOf(row.email)] : []))).size,
    byReason: [...reasons.values()].sort((a, b) => b.sends - a.sends || a.code.localeCompare(b.code)),
    recent: kept.slice(0, TURNED_AWAY_ROWS),
  };
}
