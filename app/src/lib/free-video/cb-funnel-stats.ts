import { createAdminClient } from '@/app/supabase/server';
import { CB_BLOCKED_REASON_PREFIX, cbAffiliateRows, type CbAffiliateRow, type CbAffiliateStatus } from '@/lib/free-video/cb-affiliates';
import { STATS_EXCLUDED_EMAILS } from '@/lib/free-video/config';
import { affiliateOfRef, CB_REF_PREFIX, isClickBankRef } from '@/lib/free-video/funnel';
import { chunks, DEFAULT_STATS_TZ, ID_CHUNK, isExcludedLead, keysetPage, ownerBrowsersOf, readAll, validTimeZone } from '@/lib/free-video/funnel-stats';
import { countryOfIp } from '@/lib/free-video/geo';
import { CB_UNLOCK } from '@/lib/free-video/offer';
import { emailKeyOf } from '@/lib/free-video/website';

/**
 * The ClickBank affiliate funnel per affiliate, for its admin tab (owner 2026-11-14: "a per-affiliate report and a
 * per-affiliate block switch"). Server only (no 'server-only' import, so a tsx check can load it), read only, exact:
 * every read pages through all matching rows by id, because PostgREST caps a read at 1000 rows on this project.
 *
 * One row per affiliate, the nickname in the lead's ref ('cbaff-<nick>', funnel.ts affiliateOfRef), plus "No affiliate"
 * (nickname null: a link without a valid ?affiliate=, for example an encrypted one, which can't be blocked by name).
 * Each counts the leads created in the range, with whatever they did later (a cohort, like funnel-stats.ts):
 * - leads: lead rows, refused and blocked ones included; people: different addresses among them (emailKeyOf).
 * - blocked: leads turned away because the affiliate was blocked (reason CB_BLOCKED_REASON_PREFIX, cb-affiliates.ts).
 * - countries: the 3 most common countries of the leads' IPs (geo.ts countryOfIp); a lead without one is not listed.
 * - videosMade: status 'done'. videoCostUsd: est_cost_usd summed (the AI cost of every attempt and the next ads).
 * - opened: first_viewed_at (the emailed /v/ page; the owner's marked browsers never set it) or an unlock_view event
 *   (the $49 page) from a browser that is not one of the owner's.
 * - played: a video_play event from a browser that is not one of the owner's (funnel-stats.ts ownerBrowsersOf, the
 *   same rule as the conversion panel). played_at is not used: it also holds the owner's own plays.
 * - unlocks, unlockUsd: the $49 clean video ad paid on ClickBank (unlock_order_id 'cb:<receipt>', unlock_status paid,
 *   rendering, ready or failed: the money came in even when the render failed), the amount from unlock_amount.
 *   refunds: the same orders now 'refunded'; they are not in the money.
 * - aimmSales, aimmUsd: AI Media Machine purchases the sweep matched to the lead (bought_at, sweep.ts attributeSales);
 *   the amount is the lineItems total of the ClickBank SALE row its sale_ref names ('clickbank:<receipt>'), which is
 *   the order's first payment, gross. A purchase with no such amount to read (a FastSpring one) counts in aimmUnpriced.
 * - moneyInUsd: unlockUsd + aimmUsd (gross order amounts). afterCommissionUsd: moneyInUsd minus the affiliate's
 *   CB_COMMISSION_RATE of each order ClickBank credited to an affiliate, read per order from the webhook rows (the
 *   CB_VIDEO_AD_SALE rows of a $49 receipt, the SALE row of an AI Media Machine sale): an order whose rows name no
 *   affiliate was sold directly and pays none; an order with no row to read counts as commissioned. ClickBank's own fee
 *   is not taken off. costPerLeadUsd: videoCostUsd / leads.
 * - lastLeadAt: the affiliate's newest lead, any date.
 * Affiliates with a saved switch (free_video_cb_affiliates) get a row even without leads in the range, so a blocked
 * one can always be unblocked. Left out everywhere: source 'test', the owner test refs and STATS_EXCLUDED_EMAILS
 * (funnel-stats.ts isExcludedLead, the conversion panel's rule).
 */

/** ClickBank pays the affiliate 50% of each order their hop is credited with (the $49 and the AI Media Machine). */
export const CB_COMMISSION_RATE = 0.5;

/** The prefix of a ClickBank $49 order in unlock_order_id ('cb:<receipt>', clickbank-video-ad.ts). */
const CB_ORDER_PREFIX = 'cb:';
/** The prefix of a ClickBank sale in sale_ref ('clickbank:<webhook_events.event_id>', sweep.ts attributeSales). */
const CB_SALE_PREFIX = 'clickbank:';
/** unlock_status of a paid $49 order: paid, and still so while the clean version renders or after its render failed. */
const PAID_UNLOCK = new Set(['paid', 'rendering', 'ready', 'failed']);
/** The lead events the report reads: the $49 page opening and the video playing. */
const LEAD_EVENTS = ['unlock_view', 'video_play'];
const TOP_COUNTRIES = 3;

const CB_LEAD_COLUMNS =
  'id, created_at, source, ref, email, status, reason, ip, est_cost_usd, first_viewed_at, bought_at, sale_ref, unlock_status, unlock_order_id, unlock_amount';

export interface CbLeadRow {
  id: string;
  created_at: string;
  source: string;
  ref: string | null;
  email: string | null;
  status: string;
  reason: string | null;
  ip: string | null;
  est_cost_usd: number | string | null;
  first_viewed_at: string | null;
  bought_at: string | null;
  sale_ref: string | null;
  unlock_status: string | null;
  unlock_order_id: string | null;
  unlock_amount: number | string | null;
}

export interface CbLeadEventRow {
  id: number;
  at: string;
  event: string;
  lead_id: string;
  visitor_id: string | null;
}

export interface CbCountryCount {
  /** ISO 3166 alpha-2 code. */
  code: string;
  leads: number;
}

export interface CbReportCounts {
  leads: number;
  people: number;
  blocked: number;
  /** Most leads first, at most TOP_COUNTRIES. */
  countries: CbCountryCount[];
  videosMade: number;
  videoCostUsd: number;
  opened: number;
  played: number;
  unlocks: number;
  unlockUsd: number;
  refunds: number;
  aimmSales: number;
  aimmUsd: number;
  /** AI Media Machine sales with no ClickBank amount to read (a FastSpring purchase), counted without money. */
  aimmUnpriced: number;
  moneyInUsd: number;
  afterCommissionUsd: number;
  /** null without leads. */
  costPerLeadUsd: number | null;
  lastLeadAt: string | null;
}

export interface CbReportRow extends CbReportCounts {
  /** Lowercase ClickBank nickname; null for the "No affiliate" row. */
  nickname: string | null;
  /** The block switch; no saved row (and the "No affiliate" row) = active. */
  status: CbAffiliateStatus;
  note: string | null;
  /** When and by whom the switch was last set; null when it never was. */
  statusChangedAt: string | null;
  statusChangedBy: string | null;
}

export interface CbFunnelReport {
  from: string | null;
  to: string;
  tz: string;
  /** Affiliates, most leads first; the "No affiliate" row last. */
  rows: CbReportRow[];
  /** Every row summed; people and countries over all the leads (one person who came through two affiliates counts once). */
  totals: CbReportCounts;
  commissionRate: number;
  excluded: {
    emails: string[];
    /** ClickBank funnel lead rows of the range left out (source 'test', the owner test ref, his addresses). */
    leadsInRange: number;
  };
  /** Set when the saved switches could not be read: every affiliate then shows as active. */
  affiliatesError: string | null;
}

export interface CbReportInput {
  /** ISO instant, inclusive; null = all time. */
  from: string | null;
  /** ISO instant, exclusive. */
  to: string;
  tz: string;
  /** The ClickBank funnel's leads of all time (the left-out ones are dropped here). */
  leads: CbLeadRow[];
  /** The unlock_view and video_play events of the range's leads. */
  events: CbLeadEventRow[];
  /** The owner's browsers (funnel-stats.ts ownerBrowsersOf). */
  ownerBrowsers: ReadonlySet<string>;
  /** Gross amount per ClickBank SALE event id (sale_ref without 'clickbank:'); null when the row has no readable amount. */
  aimmAmounts: ReadonlyMap<string, number | null>;
  /**
   * Who ClickBank credited each order to, from the webhook rows: key 'cb:<receipt>' for a $49 order (its
   * CB_VIDEO_AD_SALE rows), 'clickbank:<event_id>' for an AI Media Machine sale (its SALE row). The affiliate's nickname,
   * or '' when ClickBank sold it directly (no commission). An order missing here is counted as commissioned.
   */
  orderAffiliates?: ReadonlyMap<string, string>;
  /** The saved switches. */
  affiliates: readonly CbAffiliateRow[];
  affiliatesError?: string | null;
  /** The country of an IP (geo.ts countryOfIp; a check passes its own). */
  countryOf?: (ip: string | null) => string | null;
}

export interface CbFunnelReportInput {
  from: string | null;
  to: string;
  tz: string;
}

type Db = ReturnType<typeof createAdminClient>;

/** A finite number from a numeric column (PostgREST may send numeric as a string), else null. */
function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

const cents = (value: number) => Math.round(value * 100) / 100;

/** The receipt (webhook_events.event_id) a ClickBank sale_ref names, else null (no sale, or a FastSpring one). */
export function receiptOfSaleRef(saleRef: string | null | undefined): string | null {
  return saleRef?.startsWith(CB_SALE_PREFIX) ? saleRef.slice(CB_SALE_PREFIX.length) || null : null;
}

/**
 * The gross amount of a ClickBank SALE row: its lineItems amounts summed (route.ts stores [{ amount: '297.00' }], zap
 * B's being the order total). Takes the array, one object, or the same as a JSON string (also with single quotes, as
 * Zapier sends lineItemData). null when there is no amount to read.
 */
export function saleAmountOf(lineItems: unknown): number | null {
  let items = lineItems;
  if (typeof items === 'string') {
    const text = items.trim();
    try {
      items = JSON.parse(text);
    } catch {
      try {
        items = JSON.parse(text.replace(/'/g, '"'));
      } catch {
        return null;
      }
    }
  }
  if (items && typeof items === 'object' && !Array.isArray(items)) items = [items];
  if (!Array.isArray(items)) return null;
  let total = 0;
  let found = false;
  for (const item of items) {
    const raw = item && typeof item === 'object' ? (item as { amount?: unknown }).amount : undefined;
    const amount = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw.replace(/[^0-9.-]/g, '')) : NaN;
    if (!Number.isFinite(amount)) continue;
    total += amount;
    found = true;
  }
  return found ? cents(total) : null;
}

/** One row's running counts. */
interface Bucket {
  nickname: string | null;
  leads: number;
  people: Set<string>;
  blocked: number;
  countries: Map<string, number>;
  videosMade: number;
  videoCostUsd: number;
  opened: number;
  played: number;
  unlocks: number;
  unlockUsd: number;
  refunds: number;
  aimmSales: number;
  aimmUsd: number;
  aimmUnpriced: number;
  /** The affiliate's share of the orders credited to one (none on an order sold directly). */
  commissionUsd: number;
}

const newBucket = (nickname: string | null): Bucket => ({
  nickname,
  leads: 0,
  people: new Set(),
  blocked: 0,
  countries: new Map(),
  videosMade: 0,
  videoCostUsd: 0,
  opened: 0,
  played: 0,
  unlocks: 0,
  unlockUsd: 0,
  refunds: 0,
  aimmSales: 0,
  aimmUsd: 0,
  aimmUnpriced: 0,
  commissionUsd: 0,
});

function countsOf(bucket: Bucket, lastLeadAt: string | null): CbReportCounts {
  const moneyIn = bucket.unlockUsd + bucket.aimmUsd;
  return {
    leads: bucket.leads,
    people: bucket.people.size,
    blocked: bucket.blocked,
    countries: [...bucket.countries]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_COUNTRIES)
      .map(([code, leads]) => ({ code, leads })),
    videosMade: bucket.videosMade,
    videoCostUsd: cents(bucket.videoCostUsd),
    opened: bucket.opened,
    played: bucket.played,
    unlocks: bucket.unlocks,
    unlockUsd: cents(bucket.unlockUsd),
    refunds: bucket.refunds,
    aimmSales: bucket.aimmSales,
    aimmUsd: cents(bucket.aimmUsd),
    aimmUnpriced: bucket.aimmUnpriced,
    moneyInUsd: cents(moneyIn),
    afterCommissionUsd: cents(moneyIn - bucket.commissionUsd),
    costPerLeadUsd: bucket.leads > 0 ? cents(bucket.videoCostUsd / bucket.leads) : null,
    lastLeadAt,
  };
}

/** The report from rows already read (pure: no database, so a check can feed it made-up rows). */
export function buildCbFunnelReport(input: CbReportInput): CbFunnelReport {
  const { from, to, tz, ownerBrowsers, aimmAmounts, orderAffiliates, countryOf = countryOfIp } = input;
  const fromMs = from ? Date.parse(from) : -Infinity;
  const toMs = Date.parse(to);
  const inRange = (iso: string) => {
    const ms = Date.parse(iso);
    return ms >= fromMs && ms < toMs;
  };
  const isOwner = (visitorId: string | null) => Boolean(visitorId && ownerBrowsers.has(visitorId));
  // An order pays the affiliate's share unless its webhook rows say ClickBank sold it directly ('' in orderAffiliates).
  const commissioned = (orderKey: string | null) => !orderKey || orderAffiliates?.get(orderKey) !== '';

  const funnelLeads = input.leads.filter((lead) => isClickBankRef(lead.ref));
  const leads = funnelLeads.filter((lead) => !isExcludedLead(lead));
  const excludedInRange = funnelLeads.filter((lead) => isExcludedLead(lead) && inRange(lead.created_at)).length;

  const eventsOf = new Map<string, CbLeadEventRow[]>();
  for (const row of input.events) {
    const list = eventsOf.get(row.lead_id);
    if (list) list.push(row);
    else eventsOf.set(row.lead_id, [row]);
  }

  // Each affiliate's newest lead, any date ('' = No affiliate).
  const lastLeadOf = new Map<string, string>();
  let lastLead: string | null = null;
  for (const lead of leads) {
    const key = affiliateOfRef(lead.ref) ?? '';
    const newest = lastLeadOf.get(key);
    if (!newest || Date.parse(lead.created_at) > Date.parse(newest)) lastLeadOf.set(key, lead.created_at);
    if (!lastLead || Date.parse(lead.created_at) > Date.parse(lastLead)) lastLead = lead.created_at;
  }

  const buckets = new Map<string, Bucket>();
  const bucketOf = (nickname: string | null) => {
    const key = nickname ?? '';
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = newBucket(nickname)));
    return bucket;
  };
  const total = newBucket(null);

  for (const lead of leads) {
    if (!inRange(lead.created_at)) continue;
    const events = eventsOf.get(lead.id) ?? [];
    const country = countryOf(lead.ip);
    const blocked = Boolean(lead.reason?.startsWith(CB_BLOCKED_REASON_PREFIX));
    const opened = Boolean(lead.first_viewed_at) || events.some((row) => row.event === 'unlock_view' && !isOwner(row.visitor_id));
    const played = events.some((row) => row.event === 'video_play' && !isOwner(row.visitor_id));
    const cbOrder = Boolean(lead.unlock_order_id?.startsWith(CB_ORDER_PREFIX));
    const paid = cbOrder && PAID_UNLOCK.has(lead.unlock_status ?? '');
    const refunded = cbOrder && lead.unlock_status === 'refunded';
    // The webhook stores CB_UNLOCK.priceUsd; the list price stands in should a paid order ever lack its amount.
    const unlockUsd = paid ? (num(lead.unlock_amount) ?? CB_UNLOCK.priceUsd) : 0;
    const receipt = receiptOfSaleRef(lead.sale_ref);
    const aimmUsd = lead.bought_at && receipt ? (aimmAmounts.get(receipt) ?? null) : null;
    // Per order, so the No affiliate row's direct orders and the Total keep their full amount.
    const commissionUsd =
      ((paid && commissioned(lead.unlock_order_id) ? unlockUsd : 0) + (aimmUsd !== null && commissioned(lead.sale_ref) ? aimmUsd : 0)) * CB_COMMISSION_RATE;
    for (const bucket of [bucketOf(affiliateOfRef(lead.ref)), total]) {
      bucket.leads += 1;
      bucket.people.add(lead.email ? emailKeyOf(lead.email) : `lead:${lead.id}`);
      if (blocked) bucket.blocked += 1;
      if (country) bucket.countries.set(country, (bucket.countries.get(country) ?? 0) + 1);
      if (lead.status === 'done') bucket.videosMade += 1;
      bucket.videoCostUsd += num(lead.est_cost_usd) ?? 0;
      if (opened) bucket.opened += 1;
      if (played) bucket.played += 1;
      if (paid) {
        bucket.unlocks += 1;
        bucket.unlockUsd += unlockUsd;
      }
      if (refunded) bucket.refunds += 1;
      if (lead.bought_at) {
        bucket.aimmSales += 1;
        if (aimmUsd === null) bucket.aimmUnpriced += 1;
        else bucket.aimmUsd += aimmUsd;
      }
      bucket.commissionUsd += commissionUsd;
    }
  }

  // A saved switch gets its row even without leads in the range (a blocked affiliate stays in reach of Unblock).
  const saved = new Map(input.affiliates.map((row) => [row.nickname, row]));
  for (const row of input.affiliates) bucketOf(row.nickname);

  const rowOf = (bucket: Bucket): CbReportRow => {
    const switchRow = bucket.nickname ? saved.get(bucket.nickname) : undefined;
    return {
      nickname: bucket.nickname,
      status: switchRow?.status === 'blocked' ? 'blocked' : 'active',
      note: switchRow?.note ?? null,
      statusChangedAt: switchRow?.updated_at ?? null,
      statusChangedBy: switchRow?.updated_by ?? null,
      ...countsOf(bucket, lastLeadOf.get(bucket.nickname ?? '') ?? null),
    };
  };
  const rows = [...buckets.values()]
    .filter((bucket) => bucket.nickname !== null)
    .map(rowOf)
    .sort((a, b) => b.leads - a.leads || b.moneyInUsd - a.moneyInUsd || (a.nickname ?? '').localeCompare(b.nickname ?? ''));
  const noAffiliate = buckets.get('');
  if (noAffiliate) rows.push(rowOf(noAffiliate));

  return {
    from,
    to,
    tz,
    rows,
    totals: countsOf(total, lastLead),
    commissionRate: CB_COMMISSION_RATE,
    excluded: { emails: [...STATS_EXCLUDED_EMAILS], leadsInRange: excludedInRange },
    affiliatesError: input.affiliatesError ?? null,
  };
}

/** The report for one range. Reads free_video_leads, free_video_events, webhook_events and the switches with the service key; writes nothing. */
export async function computeCbFunnelReport({ from, to, tz: tzInput }: CbFunnelReportInput, db: Db = createAdminClient()): Promise<CbFunnelReport> {
  const tz = validTimeZone(tzInput) ?? DEFAULT_STATS_TZ;
  const table = (name: string) => (db as any).from(name);
  const fromMs = from ? Date.parse(from) : -Infinity;
  const toMs = Date.parse(to);
  const inRange = (iso: string) => {
    const ms = Date.parse(iso);
    return ms >= fromMs && ms < toMs;
  };

  // 1. In parallel: every lead's exclusion fields (the owner's test leads, of any funnel, name his browsers), the
  //    ClickBank funnel's leads of all time (for each affiliate's newest lead), and the saved switches. A switch list
  //    that can't be read (the table missing) still gives the numbers, with every affiliate shown as active.
  const [allLeads, cbLeads, affiliates] = await Promise.all([
    readAll<{ id: string; source: string; ref: string | null; email: string | null }>((afterId) =>
      keysetPage(table('free_video_leads').select('id, source, ref, email'), afterId)
    ),
    readAll<CbLeadRow>((afterId) => keysetPage(table('free_video_leads').select(CB_LEAD_COLUMNS).like('ref', `${CB_REF_PREFIX}%`), afterId)),
    cbAffiliateRows().then(
      (rows) => ({ rows, error: null as string | null }),
      (error: unknown) => {
        console.warn('⚠️ [admin] ClickBank affiliate switches not read:', String(error).slice(0, 200));
        return { rows: [] as CbAffiliateRow[], error: error instanceof Error ? error.message : String(error) };
      }
    ),
  ]);
  const excludedLeadIds = allLeads.filter(isExcludedLead).map((lead) => lead.id);
  const rangeLeads = cbLeads.filter((lead) => isClickBankRef(lead.ref) && !isExcludedLead(lead) && inRange(lead.created_at));
  const receipts = [...new Set(rangeLeads.map((lead) => (lead.bought_at ? receiptOfSaleRef(lead.sale_ref) : null)).filter((r): r is string => Boolean(r)))];
  // The receipts of the range's paid $49 orders ('cb:<receipt>'), for who ClickBank credited them to.
  const cbReceipts = [
    ...new Set(
      rangeLeads
        .map((lead) => (lead.unlock_order_id?.startsWith(CB_ORDER_PREFIX) && PAID_UNLOCK.has(lead.unlock_status ?? '') ? lead.unlock_order_id.slice(CB_ORDER_PREFIX.length) : null))
        .filter((r): r is string => Boolean(r))
    ),
  ];

  // 2. In parallel: the owner's browsers, the page opens and plays of the range's leads, the ClickBank SALE rows of
  //    their AI Media Machine purchases (one row per receipt; never the item 12 rows, which are not 'SALE'), and the
  //    item 12 sale rows of their $49 orders (one per zap post; the affiliate on them says whether commission was paid).
  const [ownerBrowsers, eventChunks, saleChunks, cbSaleChunks] = await Promise.all([
    ownerBrowsersOf(excludedLeadIds, db),
    Promise.all(
      chunks(
        rangeLeads.map((lead) => lead.id),
        ID_CHUNK
      ).map((ids) =>
        readAll<CbLeadEventRow>((afterId) =>
          keysetPage(table('free_video_events').select('id, at, event, lead_id, visitor_id').in('lead_id', ids).in('event', LEAD_EVENTS), afterId)
        )
      )
    ),
    Promise.all(
      chunks(receipts, ID_CHUNK).map((ids) =>
        readAll<{ id: string | number; event_id: string; line_items: unknown; affiliate: string | null }>((afterId) =>
          keysetPage(
            table('webhook_events')
              .select('id, event_id, line_items:payload->lineItems, affiliate:payload->>affiliate')
              .eq('processor', 'clickbank')
              .eq('event_type', 'SALE')
              .in('event_id', ids),
            afterId
          )
        )
      )
    ),
    Promise.all(
      chunks(cbReceipts, ID_CHUNK).map((ids) =>
        readAll<{ id: string | number; receipt: string | null; affiliate: string | null }>((afterId) =>
          keysetPage(
            table('webhook_events')
              .select('id, receipt:payload->>receipt, affiliate:payload->>affiliate')
              .eq('processor', 'clickbank')
              .eq('event_type', 'CB_VIDEO_AD_SALE')
              .in('payload->>receipt', ids),
            afterId
          )
        )
      )
    ),
  ]);
  const aimmAmounts = new Map<string, number | null>();
  for (const row of saleChunks.flat()) if (!aimmAmounts.has(row.event_id)) aimmAmounts.set(row.event_id, saleAmountOf(row.line_items));
  // Who each order was credited to: '' = sold directly. A nickname on any row of the order wins (zap A carries the
  // affiliate, zap B may not), so a non-empty value is never overwritten.
  const orderAffiliates = new Map<string, string>();
  const noteAffiliate = (orderKey: string, affiliate: string) => {
    if (!orderAffiliates.get(orderKey)) orderAffiliates.set(orderKey, affiliate.trim());
  };
  // A SALE row keeps the affiliate as text since 2026-08-11 ('' = sold directly); a row without it says nothing (commissioned).
  for (const row of saleChunks.flat()) if (typeof row.affiliate === 'string') noteAffiliate(`${CB_SALE_PREFIX}${row.event_id}`, row.affiliate);
  // An item 12 row stores "no affiliate on this post" as null (clickbank-video-ad.ts recordOf).
  for (const row of cbSaleChunks.flat()) if (row.receipt) noteAffiliate(`${CB_ORDER_PREFIX}${row.receipt}`, row.affiliate ?? '');

  return buildCbFunnelReport({
    from,
    to,
    tz,
    leads: cbLeads,
    events: eventChunks.flat(),
    ownerBrowsers,
    aimmAmounts,
    orderAffiliates,
    affiliates: affiliates.rows,
    affiliatesError: affiliates.error,
  });
}
