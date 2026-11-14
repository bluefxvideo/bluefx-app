/**
 * ClickBank affiliate funnel: the sale of its $49 clean video ad, ClickBank item 12 of vendor bluefx02 (offer.ts
 * CB_UNLOCK, docs/cb-affiliate-funnel.md §5), sold to leads whose ref starts with 'cbaff-' (funnel.ts).
 *
 * Both zaps post every bluefx02 sale to api/webhooks/clickbank, whose first branch hands each post that holds item 12 to
 * handleClickBankVideoAdPost. Zap A is thin (receipt, itemNo, email); zap B also carries vendorVariables with the lead's
 * view token (fvt) and the vtid fvcb49_<lead8>. They arrive in any order, minutes apart, so:
 * - Every post is recorded in webhook_events: processor 'clickbank', event id cbva:<receipt>:<zap>:<type>, event types
 *   CB_VIDEO_AD_*, NEVER 'SALE' (attributeSales, the reconcile cron and the entitlement code read every clickbank SALE
 *   row as an AI Media Machine purchase).
 * - The lead is found by its token (fvt), else by its id in the vtid, ClickBank funnel leads only. Never by email here:
 *   zap A alone would race zap B. The sweep (retryPendingClickBankSales) merges the posts of a receipt and, after 3
 *   minutes, may take the one unpaid ClickBank funnel lead of the buyer's email.
 * - With CLICKBANK_CLERK_KEY the receipt is checked with ClickBank's order API first (orders2, as the reconcile cron
 *   reads it); without the key the sale is applied the way the AI Media Machine path applies its own.
 * - The unlock is the idempotent step: unlock_order_id 'cb:<receipt>' (unique) through applyUnlockPayment (unlock.ts),
 *   the FastSpring $49's own steps without Facebook, then the CB Funnel - Paid group (notify.ts joinCbPaidGroup).
 * - Refunds and chargebacks mark the lead refunded (unlock.ts refundUnlock) and tell the owner.
 * The return from the thank-you page confirms a receipt itself (confirmClickBankReceipt) or finds its lead
 * (cbPaidTokenOfReceipt: the buyer's email and a fresh payment only). Never creates a user and never touches
 * user_subscriptions, user_credits or profiles.
 *
 * Server only. NEVER re-export anything from here in a server-action file. The parsers are pure and never throw
 * (src/scripts/cb-funnel-sale-checks.ts).
 */

import { createAdminClient } from '@/app/supabase/server';
import { alertOwner, type AlertItem } from '@/lib/free-video/alerts';
import { claimsTestLeads, OWNER_TEST_EMAILS, STATS_EXCLUDED_EMAILS } from '@/lib/free-video/config';
import { CB_REF_PREFIX, isClickBankRef, isOwnerTestRef } from '@/lib/free-video/funnel';
import { asLead, getLeadByToken, isoMinutesAgo, leadsTable } from '@/lib/free-video/leads';
import { joinCbPaidGroup } from '@/lib/free-video/notify';
import { CB_UNLOCK } from '@/lib/free-video/offer';
import { applyUnlockPayment, inBackground, leadByOrder, manualUnlockSql, recordUnlockEvent, refundUnlock, startCleanRender, type UnlockOutcome } from '@/lib/free-video/unlock';
import { displayDomain, emailKeyOf } from '@/lib/free-video/website';
import { FREE_VIDEO_TOKEN_PATTERN, type FreeVideoLead } from '@/types/free-video';

// ---------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------

/** The webhook_events types this module writes (processor 'clickbank'). Never 'SALE': see the header. */
export const CB_VIDEO_AD_EVENTS = {
  /** A sale post: applied, waiting for its lead, or a duplicate. payload.leadId names the lead once one is known. */
  sale: 'CB_VIDEO_AD_SALE',
  /** A refund or chargeback post, with or without a lead. */
  refund: 'CB_VIDEO_AD_REFUND',
  /** A ClickBank test purchase for a lead that is not the owner's own test: nothing unlocked. */
  testIgnored: 'CB_VIDEO_AD_TEST_IGNORED',
  /** ClickBank's order API contradicts the sale (no item 12, another vendor, refunded): nothing unlocked, the owner told. */
  rejected: 'CB_VIDEO_AD_REJECTED',
} as const;

/** A receipt as the cb-confirm and cb-paid routes take it: ClickBank's receipt, with or without a split-pay suffix (ABCD1234__2_ACTIVE). */
export const CB_RECEIPT_PATTERN = /^[A-Za-z0-9]{6,20}(__[A-Za-z0-9_]+)?$/;

/** The sweep's clock for a receipt no lead carries yet, in minutes since its first post. */
const EMAIL_FALLBACK_MINUTES = 3;
const UNMATCHED_ALERT_MINUTES = 30;
/** ClickBank's order API is asked again for an hour at most; the owner has had the alert since minute 30. */
const PROOF_RETRY_MINUTES = 60;
const PENDING_DAYS = 2;
/** Receipts one sweep looks at, newest first. */
const PENDING_BATCH = 25;
/** The parsed post a record keeps, at most (about 8 KB). */
const RAW_MAX = 8000;

const orderIdOf = (receipt: string) => `cb:${receipt}`;

/** cbva:<receipt>:<source>:<type>: one row per post (source = the zap, the sweep or the thank-you page). */
const eventIdOf = (receipt: string, source: string, type: string) =>
  `cbva:${receipt}:${source}:${type.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'unknown'}`;

const dayKey = () => new Date().toISOString().slice(0, 10);

const alertLater = (items: AlertItem[], subject: string) => inBackground('ClickBank alert', () => alertOwner(items, subject), true);

/** unlock.ts's hand-unlock SQL, with the lead's own token when it is known. */
const unlockSqlFor = (receipt: string, lead?: FreeVideoLead | null) =>
  lead ? manualUnlockSql(orderIdOf(receipt)).replace('<the lead token>', lead.view_token) : manualUnlockSql(orderIdOf(receipt));

// ---------------------------------------------------------------------------------------------
// The post (pure, never throws)
// ---------------------------------------------------------------------------------------------

/** ClickBank's refund and chargeback codes (RFND, CGBK, INSF) and the spelled-out ones a zap may send, test ones included. */
const REFUND_TYPES: readonly string[] = ['RFND', 'REFUND', 'TEST_RFND', 'TEST_REFUND', 'CGBK', 'TEST_CGBK', 'INSF'];

export type CbPostKind = 'sale' | 'refund' | 'other';
/** Zap B carries vendorVariables or lineItemData, zap A neither. */
export type CbZap = 'A' | 'B';

/** One post of a zap, read. Every field is null (or empty) when the post does not have it in a usable shape. */
export interface CbVideoAdPost {
  /** R: the receipt without a split-pay suffix, upper case (normaliseReceipt). */
  receipt: string | null;
  rawReceipt: string | null;
  /** SALE, TEST_SALE, RFND, ... upper case. */
  transactionType: string | null;
  kind: CbPostKind;
  /** A ClickBank test transaction (TEST_SALE, TEST_RFND, ...). */
  test: boolean;
  /** Every item number the post names (flat itemNo, lineItemData, the cbitems seller variable). */
  items: string[];
  vendor: string | null;
  email: string | null;
  affiliate: string | null;
  trackingId: string | null;
  /** The lead's view token from the seller variables, when it has the token's shape. */
  fvt: string | null;
  vtid: string | null;
  /** The 8 hex characters of the lead id in fvcb49_<lead8> (the trackingId first, else the vtid seller variable). */
  leadPrefix: string | null;
  amount: string | null;
  totalOrderAmount: string | null;
  accountAmount: string | null;
  customerAmount: string | null;
  country: string | null;
  zap: CbZap;
}

const EMPTY_POST: CbVideoAdPost = {
  receipt: null,
  rawReceipt: null,
  transactionType: null,
  kind: 'other',
  test: false,
  items: [],
  vendor: null,
  email: null,
  affiliate: null,
  trackingId: null,
  fvt: null,
  vtid: null,
  leadPrefix: null,
  amount: null,
  totalOrderAmount: null,
  accountAmount: null,
  customerAmount: null,
  country: null,
  zap: 'A',
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** ClickBank's way of saying "no value" (Zapier sends trackingId__@nil), and the words a printed null leaves. */
const NIL = /^(?:@nil|null|undefined|none)$/i;

/** A trimmed text value (a number as text), at most `max` characters; null for anything else or a "no value". */
function textOf(value: unknown, max = 200): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && !NIL.test(trimmed) ? trimmed.slice(0, max) : null;
}

/** The first of the values that is a usable text (the old route's `a || b || c`). */
const firstText = (max: number, ...values: unknown[]): string | null => {
  for (const value of values) {
    const found = textOf(value, max);
    if (found) return found;
  }
  return null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailText = (value: unknown): string | null => {
  const email = textOf(value, 254)?.toLowerCase() ?? null;
  return email && EMAIL.test(email) ? email : null;
};

const tokenOf = (value: unknown): string | null => {
  const token = textOf(value, 40);
  return token && FREE_VIDEO_TOKEN_PATTERN.test(token) ? token : null;
};

/** JSON, or Python's print of it (single quotes, None / True / False) as some zap steps send nested values; undefined when neither parses. */
function parseLoose(value: string): unknown {
  if (value.length > 100_000) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    /* Python's print next */
  }
  try {
    return JSON.parse(value.replace(/'/g, '"').replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false'));
  } catch {
    return undefined;
  }
}

const parsedOf = (value: unknown): unknown => (typeof value === 'string' ? parseLoose(value) : value);

/** The line items of a lineItemData: a JSON (or Python) string, an array or one object. A string nobody can parse still gives its item numbers. */
function lineItemsOf(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 3 || value === null || value === undefined || value === '') return [];
  const data = parsedOf(value);
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data)) {
    if ('itemNo' in data || 'item_no' in data) return [data];
    const inner = data.lineItemData ?? data.lineItems ?? data.items ?? data.item;
    return inner === undefined ? [] : lineItemsOf(inner, depth + 1);
  }
  if (typeof value !== 'string') return [];
  // An apostrophe in a product title breaks the quote swap: the item numbers are still readable.
  const lines: Record<string, unknown>[] = [];
  const itemNo = /["']?item_?no["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{1,20})/gi;
  for (let match = itemNo.exec(value); match && lines.length < 20; match = itemNo.exec(value)) lines.push({ itemNo: match[1] });
  return lines;
}

const itemNoOf = (line: Record<string, unknown>) => textOf(line.itemNo ?? line.item_no, 20);

/**
 * The seller variables of an order (vendorVariables): a JSON (or Python) string or an object whose `item` is a list of
 * {name, value} or a single one; a list of them or a plain {name: value} object is read too. Names lowercased.
 */
export function vendorVariablesOf(value: unknown): Map<string, string> {
  const vars = new Map<string, string>();
  const take = (entry: unknown) => {
    if (!isRecord(entry)) return;
    const name = textOf(entry.name, 60);
    const val = textOf(entry.value, 200);
    if (name && val !== null) vars.set(name.toLowerCase(), val);
  };
  try {
    const data = parsedOf(value);
    const list = isRecord(data) && 'item' in data ? parsedOf(data.item) : data;
    if (Array.isArray(list)) list.forEach(take);
    else if (isRecord(list) && 'name' in list) take(list);
    else if (isRecord(list)) {
      for (const [name, val] of Object.entries(list)) {
        const text = textOf(val, 200);
        if (text !== null) vars.set(name.toLowerCase(), text);
      }
    }
  } catch {
    /* garbage: no seller variables */
  }
  return vars;
}

/** R: the receipt without a split-pay suffix ('abcd1234__2_ACTIVE' → 'ABCD1234'), upper case; null when there is none or it is not a receipt. */
export function normaliseReceipt(raw: unknown): string | null {
  const value = textOf(raw, 80);
  if (!value) return null;
  const receipt = value.split('__')[0].trim().toUpperCase();
  return /^[A-Z0-9]{4,40}$/.test(receipt) ? receipt : null;
}

/** The transaction type, upper case, and what it means here: a sale, a refund or chargeback, or nothing to do. */
export function cbTransactionOf(raw: unknown): { type: string | null; kind: CbPostKind; test: boolean } {
  const type = textOf(raw, 40)?.toUpperCase().replace(/\s+/g, '') ?? null;
  if (!type) return { type: null, kind: 'other', test: false };
  const kind: CbPostKind = type === 'SALE' || type === 'TEST_SALE' ? 'sale' : REFUND_TYPES.includes(type) ? 'refund' : 'other';
  return { type, kind, test: type.startsWith('TEST') };
}

const CB_VTID = new RegExp(`^${CB_UNLOCK.vtidPrefix}_([0-9a-f]{8})$`);

/** The 8 characters of a lead's id in the ClickBank funnel's vtid ('fvcb49_1a2b3c4d' → '1a2b3c4d'), null for any other tracking id. */
export function leadPrefixOfCbVtid(vtid: unknown): string | null {
  const match = CB_VTID.exec((textOf(vtid, 64) ?? '').toLowerCase());
  return match ? match[1] : null;
}

function emailOf(post: Record<string, unknown>): string | null {
  const customer = parsedOf(post.customer);
  const billing = isRecord(customer) ? parsedOf(customer.billing) : undefined;
  for (const candidate of [isRecord(customer) ? customer.email : undefined, isRecord(billing) ? billing.email : undefined, post.customer_email, post.email, post.customerEmail]) {
    const email = emailText(candidate);
    if (email) return email;
  }
  return null;
}

function itemsOf(post: Record<string, unknown>, lines: Record<string, unknown>[], vars: Map<string, string>): string[] {
  const items = new Set<string>();
  const add = (value: unknown) => {
    for (const part of (textOf(value, 200) ?? '').split(',')) {
      const item = part.trim();
      if (/^[A-Za-z0-9_-]{1,20}$/.test(item)) items.add(item);
    }
  };
  // itemNo, item_no, lineItemDataItemNo, lineItemData__itemNo: the flat shapes Zapier gives lineItemData.
  for (const [key, value] of Object.entries(post)) if (/itemno$/i.test(key.replace(/[^a-z]/gi, ''))) add(value);
  for (const line of lines) add(itemNoOf(line));
  add(vars.get('cbitems'));
  return [...items];
}

/** One zap post as this module needs it. Never throws: a post it cannot read gives empty fields. */
export function readClickBankVideoAdPost(payload: unknown): CbVideoAdPost {
  try {
    const post = isRecord(payload) ? payload : {};
    const lines = lineItemsOf(post.lineItemData);
    const vars = vendorVariablesOf(post.vendorVariables);
    const { type, kind, test } = cbTransactionOf(firstText(40, post.transaction_type, post.transactionType));
    const trackingId = firstText(64, post.trackingId, post.tracking_id, post.vtid, post.tid);
    const vtid = textOf(vars.get('vtid'), 64);
    const line = lines.find((l) => itemNoOf(l) === CB_UNLOCK.item);
    const present = (value: unknown) => value !== undefined && value !== null && value !== '';
    const rawReceipt = firstText(80, post.receipt, post.order_id, post.transaction_id);
    return {
      receipt: normaliseReceipt(rawReceipt),
      rawReceipt,
      transactionType: type,
      kind,
      test,
      items: itemsOf(post, lines, vars),
      vendor: firstText(40, post.vendor, post.account)?.toLowerCase() ?? null,
      email: emailOf(post),
      affiliate: firstText(64, post.affiliate, post.affiliate_id),
      trackingId,
      fvt: tokenOf(vars.get(CB_UNLOCK.tokenParam)) ?? tokenOf(post[CB_UNLOCK.tokenParam]),
      vtid,
      leadPrefix: leadPrefixOfCbVtid(trackingId) ?? leadPrefixOfCbVtid(vtid),
      amount: firstText(20, post.amount, post.total),
      totalOrderAmount: textOf(post.totalOrderAmount, 20),
      accountAmount: firstText(20, line?.accountAmount, post.accountAmount),
      customerAmount: firstText(20, line?.customerAmount, post.customerAmount),
      country: firstText(10, post.country, post.customer_country, post.billingCountry, post.countryCode),
      zap: present(post.vendorVariables) || present(post.lineItemData) ? 'B' : 'A',
    };
  } catch {
    return { ...EMPTY_POST, items: [] };
  }
}

/**
 * The webhook's first branch: 'only' when the post is vendor bluefx02 and item 12 is all it holds, 'mixed' when item 12
 * comes with other items (those go on to the AI Media Machine code as today), null otherwise (bluefx01's own item 12,
 * any other item, a post without a vendor). Never throws.
 */
export function clickBankVideoAdIn(payload: unknown): 'only' | 'mixed' | null {
  try {
    const post = readClickBankVideoAdPost(payload);
    if (post.vendor !== CB_UNLOCK.vendor || !post.items.includes(CB_UNLOCK.item)) return null;
    return post.items.every((item) => item === CB_UNLOCK.item) ? 'only' : 'mixed';
  } catch {
    return null;
  }
}

/** What the sweep needs from every recorded post of one receipt: the first token, lead id and email any of them carries. */
export interface CbMergedPosts {
  fvt: string | null;
  leadPrefix: string | null;
  email: string | null;
  affiliate: string | null;
  /** Every post is a ClickBank test transaction. */
  test: boolean;
  types: string[];
}

/** The recorded payloads of one receipt's posts as one (pure). */
export function mergeCbPosts(posts: readonly Record<string, unknown>[]): CbMergedPosts {
  const pick = (read: (post: Record<string, unknown>) => string | null): string | null => {
    for (const post of posts) {
      const value = read(isRecord(post) ? post : {});
      if (value) return value;
    }
    return null;
  };
  const types = [...new Set(posts.map((post) => (isRecord(post) ? cbTransactionOf(post.transactionType).type : null)).filter((t): t is string => Boolean(t)))];
  return {
    fvt: pick((post) => tokenOf(post.fvt)),
    leadPrefix: pick((post) => leadPrefixOfCbVtid(post.trackingId) ?? leadPrefixOfCbVtid(post.vtid)),
    email: pick((post) => emailText(post.email)),
    affiliate: pick((post) => textOf(post.affiliate, 64)),
    test: types.length > 0 && types.every((type) => type.startsWith('TEST')),
    types,
  };
}

/** What ClickBank's order API (GET orders2/<receipt>) says about a receipt. */
export interface CbOrderInfo {
  items: string[];
  vendor: string | null;
  email: string | null;
  affiliate: string | null;
  fvt: string | null;
  vtid: string | null;
  trackingId: string | null;
  /** The transaction types of its entries (SALE, RFND, ...). */
  types: string[];
  /** The earliest transactionTime of its entries (ms since epoch), or null when ClickBank sent none readable. */
  firstAt: number | null;
}

/**
 * Item 12 sold the old "AI Stock Image Bundle #2" before it became the $49 AI Video Ad (renamed 2026-11-13). An order
 * from before this moment can only unlock a lead through its own token (fvt), never through an email match: an earlier
 * bundle buyer who later asks for a free video ad with the same email must not unlock the clean version with an old receipt.
 */
export const CB_ITEM12_SWITCH_AT = Date.parse('2026-11-13T00:00:00Z');

/** An orders2 answer: orderData is one object, or a list of them (one per transaction). null when it has no order. Never throws. */
export function readOrders2(body: unknown): CbOrderInfo | null {
  try {
    const data = isRecord(body) ? body.orderData : undefined;
    const entries = (Array.isArray(data) ? data : [data]).filter(isRecord);
    if (!entries.length) return null;
    const items = new Set<string>();
    const types = new Set<string>();
    const info: CbOrderInfo = { items: [], vendor: null, email: null, affiliate: null, fvt: null, vtid: null, trackingId: null, types: [], firstAt: null };
    for (const entry of entries) {
      for (const line of lineItemsOf(entry.lineItemData)) {
        const item = itemNoOf(line);
        if (item) items.add(item);
      }
      const vars = vendorVariablesOf(entry.vendorVariables);
      info.fvt ??= tokenOf(vars.get(CB_UNLOCK.tokenParam));
      info.vtid ??= textOf(vars.get('vtid'), 64);
      info.vendor ??= textOf(entry.vendor, 40)?.toLowerCase() ?? null;
      info.email ??= emailOf(entry);
      info.affiliate ??= textOf(entry.affiliate, 64);
      info.trackingId ??= textOf(entry.trackingId, 64);
      const type = cbTransactionOf(entry.transactionType).type;
      if (type) types.add(type);
      const at = typeof entry.transactionTime === 'string' ? Date.parse(entry.transactionTime) : NaN;
      if (Number.isFinite(at) && (info.firstAt === null || at < info.firstAt)) info.firstAt = at;
    }
    return { ...info, items: [...items], types: [...types] };
  } catch {
    return null;
  }
}

export type CbOrderVerdict = { verdict: 'confirmed' } | { verdict: 'not-found' } | { verdict: 'mismatch'; note: string };

/** Whether an orders2 answer proves a sale of item 12 by bluefx02 that is not refunded (pure). */
export function judgeOrders2(order: CbOrderInfo | null): CbOrderVerdict {
  if (!order) return { verdict: 'not-found' };
  if (!order.items.includes(CB_UNLOCK.item)) return { verdict: 'mismatch', note: `ClickBank's order API shows item(s) ${order.items.join(', ') || 'none'}, not item ${CB_UNLOCK.item}` };
  if (order.vendor && order.vendor !== CB_UNLOCK.vendor) return { verdict: 'mismatch', note: `ClickBank's order API shows vendor ${order.vendor}, not ${CB_UNLOCK.vendor}` };
  if (order.types.some((type) => REFUND_TYPES.includes(type))) return { verdict: 'mismatch', note: `ClickBank's order API shows the order refunded or charged back (${order.types.join(', ')})` };
  return { verdict: 'confirmed' };
}

/** What a record keeps of a post: the read fields (leadId is added per record) and the post itself, cut to about 8 KB. */
function recordOf(post: CbVideoAdPost, raw: unknown, contentType: string | null): Record<string, unknown> {
  let kept: unknown = null;
  try {
    const json = JSON.stringify(raw ?? null);
    kept = json.length <= RAW_MAX ? JSON.parse(json) : { truncated: true, json: json.slice(0, RAW_MAX) };
  } catch {
    kept = null;
  }
  return {
    receipt: post.receipt,
    rawReceipt: post.rawReceipt,
    items: post.items,
    vendor: post.vendor,
    affiliate: post.affiliate,
    trackingId: post.trackingId,
    fvt: post.fvt,
    vtid: post.vtid,
    email: post.email,
    amount: post.amount,
    totalOrderAmount: post.totalOrderAmount,
    accountAmount: post.accountAmount,
    customerAmount: post.customerAmount,
    country: post.country,
    transactionType: post.transactionType,
    zap: post.zap,
    contentType: contentType ? contentType.slice(0, 100) : null,
    raw: kept,
  };
}

// ---------------------------------------------------------------------------------------------
// The proof (ClickBank's order API)
// ---------------------------------------------------------------------------------------------

type CbProof = { verdict: 'confirmed'; order: CbOrderInfo } | { verdict: 'not-found' | 'mismatch' | 'unchecked'; note: string };

const clerkKey = () => process.env.CLICKBANK_CLERK_KEY || process.env.APP_CLICKBANK_CLERK_KEY || '';

/**
 * GET https://api.clickbank.com/rest/1.3/orders2/<receipt> with the clerk key, the request the reconcile cron makes.
 * 'not-found' on a clear "no such order" (400/404, or an answer without one); 'mismatch' when the order is not a sale of
 * item 12 by bluefx02; 'unchecked' without a key, with a refused key, or when ClickBank does not answer (the sale then
 * goes ahead, as the AI Media Machine path does). Never throws.
 */
async function checkReceipt(receipt: string): Promise<CbProof> {
  const key = clerkKey();
  if (!key) return { verdict: 'unchecked', note: 'unverified-no-key' };
  let note = 'unverified-network';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const res = await fetch(`https://api.clickbank.com/rest/1.3/orders2/${encodeURIComponent(receipt)}`, {
        headers: { Authorization: key, Accept: 'application/json' },
        signal: AbortSignal.timeout(6_000),
      });
      if (res.status === 400 || res.status === 404) return { verdict: 'not-found', note: `ClickBank's order API does not know receipt ${receipt} (HTTP ${res.status})` };
      if (res.status === 401 || res.status === 403) return { verdict: 'unchecked', note: `unverified-refused-${res.status}` };
      if (res.ok) {
        const body = await res.json().catch(() => undefined);
        if (body === undefined) return { verdict: 'unchecked', note: 'unverified-unreadable' };
        const order = readOrders2(body);
        const judged = judgeOrders2(order);
        if (judged.verdict === 'confirmed' && order) return { verdict: 'confirmed', order };
        if (judged.verdict === 'mismatch') return judged;
        return { verdict: 'not-found', note: `ClickBank's order API has no order for receipt ${receipt}` };
      }
      note = `unverified-http-${res.status}`;
    } catch {
      note = 'unverified-network';
    }
  }
  return { verdict: 'unchecked', note };
}

// ---------------------------------------------------------------------------------------------
// The lead
// ---------------------------------------------------------------------------------------------

/** The owner's own test lead: a ClickBank test purchase unlocks only these. */
function isOwnerTestLead(lead: FreeVideoLead): boolean {
  if (lead.source === 'test' || isOwnerTestRef(lead.ref)) return true;
  const key = emailKeyOf(lead.email);
  return [...OWNER_TEST_EMAILS, ...STATS_EXCLUDED_EMAILS].some((email) => emailKeyOf(email) === key);
}

/** The one ClickBank funnel lead whose id starts with these 8 hex characters (a uuid range: a uuid column has no prefix match). Throws on a database error. */
async function cbLeadByPrefix(prefix: string): Promise<FreeVideoLead | null> {
  const { data, error } = await leadsTable()
    .select('*')
    .gte('id', `${prefix}-0000-0000-0000-000000000000`)
    .lte('id', `${prefix}-ffff-ffff-ffff-ffffffffffff`)
    .like('ref', `${CB_REF_PREFIX}%`)
    .limit(2);
  if (error) throw new Error(`Could not read the lead of a ClickBank vtid: ${error.message}`);
  const leads = ((data ?? []) as Record<string, unknown>[]).map(asLead).filter((lead) => isClickBankRef(lead.ref));
  return leads.length === 1 ? leads[0] : null;
}

/**
 * The sweep's email fallback: the one unpaid (or refunded) ClickBank funnel lead of the buyer's address made before the
 * sale. A lead whose website could not be read has no video ad to pay for, so one other lead of the address decides.
 * The owner's test leads carry their own email keys and never match. Throws on a database error.
 */
async function cbLeadByEmail(email: string, saleAt: number): Promise<FreeVideoLead | null> {
  const { data, error } = await leadsTable()
    .select('*')
    .eq('email_key', emailKeyOf(email))
    .like('ref', `${CB_REF_PREFIX}%`)
    .in('unlock_status', ['none', 'refunded'])
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw new Error(`Could not read the ClickBank funnel leads of a buyer: ${error.message}`);
  const leads = ((data ?? []) as Record<string, unknown>[]).map(asLead).filter((lead) => isClickBankRef(lead.ref) && Date.parse(lead.created_at) < saleAt);
  const made = leads.filter((lead) => lead.status !== 'rejected');
  if (made.length === 1) return made[0];
  return leads.length === 1 ? leads[0] : null;
}

/** The lead a sale is for: its token, else its id in the vtid, else (the sweep only) its email. ClickBank funnel leads only. Throws on a database error. */
async function matchCbLead(
  keys: { fvt: string | null; leadPrefix: string | null; email: string | null },
  byEmail: { saleAt: number } | null
): Promise<FreeVideoLead | null> {
  if (keys.fvt) {
    const lead = await getLeadByToken(keys.fvt);
    if (lead && isClickBankRef(lead.ref)) return lead;
  }
  if (keys.leadPrefix) {
    const lead = await cbLeadByPrefix(keys.leadPrefix);
    if (lead) return lead;
  }
  return byEmail && keys.email ? cbLeadByEmail(keys.email, byEmail.saleAt) : null;
}

// ---------------------------------------------------------------------------------------------
// The sale
// ---------------------------------------------------------------------------------------------

type CbSaleOutcome = UnlockOutcome | 'unverified' | 'rejected';

/**
 * A sale of receipt R applied to its lead: the proof (none for a test purchase, which only an owner test lead gets
 * here), then applyUnlockPayment with order id 'cb:<R>', $49, no Facebook, then the CB Funnel - Paid group. 'unverified'
 * when ClickBank's order API does not know the receipt yet: nothing changes and the sweep asks again. Throws only on a
 * database error.
 */
async function settleCbSale(
  lead: FreeVideoLead,
  receipt: string,
  ctx: { source: string; test: boolean; email: string | null; data: Record<string, unknown>; proof?: CbProof }
): Promise<CbSaleOutcome> {
  const proof: CbProof = ctx.proof ?? (ctx.test ? { verdict: 'unchecked', note: 'test-purchase' } : await checkReceipt(receipt));
  if (proof.verdict === 'not-found') {
    console.warn(`⚠️ [free-video] ClickBank receipt ${receipt} (lead ${lead.id}): ${proof.note}; not unlocked yet, the sweep asks again`);
    return 'unverified';
  }
  if (proof.verdict === 'mismatch') {
    await recordUnlockEvent(eventIdOf(receipt, ctx.source, 'rejected'), CB_VIDEO_AD_EVENTS.rejected, { ...ctx.data, receipt, leadId: lead.id, reason: proof.note }, 'clickbank');
    console.error(`❌ [free-video] ClickBank receipt ${receipt} NOT applied to lead ${lead.id}: ${proof.note}`);
    // Its own key: the sweep's "ClickBank does not know the receipt yet" alert (cb-unverified-<R>) may have gone out first.
    alertLater(
      [{ key: `cb-rejected-${receipt}`, line: `A ${CB_UNLOCK.price} ClickBank sale (receipt ${receipt}) for ${displayDomain(lead.website_domain)} (lead ${lead.id}) was NOT unlocked: ${proof.note}. If the sale is real, unlock it by hand: ${unlockSqlFor(receipt, lead)}` }],
      'a ClickBank $49 sale did not check out'
    );
    return 'rejected';
  }
  if (proof.verdict === 'unchecked') {
    console.warn(`⚠️ [free-video] ClickBank receipt ${receipt} applied without ClickBank's order API (${proof.note})`);
    if (proof.note.startsWith('unverified-refused')) {
      alertLater(
        [{ key: `cb-key-refused:${dayKey()}`, line: `ClickBank's order API refused CLICKBANK_CLERK_KEY (${proof.note}), so ${CB_UNLOCK.price} ClickBank sales are unlocked without that check. Check the key in Coolify.` }],
        'the ClickBank order check is off'
      );
    }
  }
  const outcome = await applyUnlockPayment(
    lead,
    { orderId: orderIdOf(receipt), amount: CB_UNLOCK.priceUsd, currency: 'USD', email: ctx.email, data: { ...ctx.data, verification: proof.verdict === 'confirmed' ? 'confirmed' : proof.note } },
    { facebook: false, processor: 'clickbank' }
  );
  // The CB Funnel - Paid group at payment time, once: only the first application of the receipt is 'paid'.
  if (outcome === 'paid') inBackground('ClickBank paid group', () => joinCbPaidGroup(lead), true);
  return outcome;
}

/** A sale post (SALE or TEST_SALE). */
async function handleSalePost(post: CbVideoAdPost, receipt: string, data: Record<string, unknown>): Promise<string> {
  const eventId = eventIdOf(receipt, post.zap, post.transactionType ?? 'sale');
  const record = (eventType: string, leadId: string | null) => recordUnlockEvent(eventId, eventType, { ...data, leadId }, 'clickbank');

  // 1. Applied already: the other zap, a retry, the thank-you page or the sweep was first.
  const known = await leadByOrder([orderIdOf(receipt)]);
  if (known) {
    await record(CB_VIDEO_AD_EVENTS.sale, known.id);
    if (known.unlock_status === 'paid' && known.status === 'done') startCleanRender(known.id, true);
    return 'duplicate';
  }

  // 2. The lead: its token (zap B's fvt), else its id in the vtid. Never the email here: zap A alone would race zap B.
  const lead = await matchCbLead(post, null);

  // 3. A ClickBank test purchase unlocks only the owner's own test leads.
  if (lead && post.test && !isOwnerTestLead(lead)) {
    await record(CB_VIDEO_AD_EVENTS.testIgnored, lead.id);
    console.log(`ℹ️ [free-video] ClickBank test purchase ${receipt} for lead ${lead.id} ignored: not an owner test`);
    return 'test-ignored';
  }

  // 4. Recorded before anything is applied: if the unlock fails half way, the sweep finds this row and finishes it.
  await record(CB_VIDEO_AD_EVENTS.sale, lead?.id ?? null);
  if (!lead) {
    console.log(`ℹ️ [free-video] ClickBank receipt ${receipt} (zap ${post.zap}) matches no lead yet; the sweep tries again`);
    return 'pending';
  }
  return settleCbSale(lead, receipt, { source: post.zap, test: post.test, email: post.email, data: { ...data, leadId: lead.id } });
}

/** A refund or chargeback post (RFND, REFUND, CGBK, INSF and their test forms). */
async function handleRefundPost(post: CbVideoAdPost, receipt: string, data: Record<string, unknown>): Promise<string> {
  const eventId = eventIdOf(receipt, post.zap, post.transactionType ?? 'refund');
  const type = post.transactionType ?? 'refund';
  const lead = await leadByOrder([orderIdOf(receipt)]);
  if (lead && post.test && !isOwnerTestLead(lead)) {
    await recordUnlockEvent(eventId, CB_VIDEO_AD_EVENTS.testIgnored, { ...data, leadId: lead.id }, 'clickbank');
    return 'test-ignored';
  }
  // Recorded with or without a lead: the refund of a sale still waiting for its lead keeps the sweep from unlocking it.
  await recordUnlockEvent(eventId, CB_VIDEO_AD_EVENTS.refund, { ...data, leadId: lead?.id ?? null }, 'clickbank');
  if (!lead) {
    console.log(`ℹ️ [free-video] ClickBank ${type} of receipt ${receipt} matches no unlocked lead (recorded)`);
    return 'unmatched';
  }
  const updated = await refundUnlock(lead.id);
  if (!updated) {
    console.log(`ℹ️ [free-video] ClickBank ${type} for lead ${lead.id}: the unlock is already ${lead.unlock_status}`);
    return 'duplicate';
  }
  console.warn(`⚠️ [free-video] Lead ${lead.id}: ClickBank ${type} of receipt ${receipt}, now refunded`);
  alertLater(
    [{ key: `cb-refund:${lead.id}:${receipt}`, line: `The ${CB_UNLOCK.price} ClickBank video ad of ${displayDomain(lead.website_domain)} (lead ${lead.id}, receipt ${receipt}${post.affiliate ? `, affiliate ${post.affiliate}` : ''}): ${type}. The lead is marked refunded; the clean file stays where it is.` }],
    'a ClickBank $49 sale was refunded'
  );
  return 'refunded';
}

/**
 * Every webhook post that holds item 12 of bluefx02 (api/webhooks/clickbank's first branch). Answers 500 only on a
 * database error (everything else throws nothing), so Zapier shows that run as failed; a duplicate, a sale still waiting
 * for its lead, an unmatched refund or a post with nothing to do answer 200.
 */
export async function handleClickBankVideoAdPost(payload: unknown, contentType: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const post = readClickBankVideoAdPost(payload);
    const receipt = post.receipt;
    if (!receipt) {
      console.error(`❌ [free-video] A ClickBank item ${CB_UNLOCK.item} post (${post.transactionType || 'no type'}) without a readable receipt; nothing done`);
      alertLater(
        [{ key: `cb-noreceipt:${dayKey()}`, line: `A ClickBank item ${CB_UNLOCK.item} post (${post.transactionType || 'no type'}, ${post.email || 'no email'}) came without a readable receipt, so nothing was unlocked or refunded. Check the receipt field of the zaps.` }],
        'a ClickBank $49 post could not be read'
      );
      return { status: 200, body: { success: true, outcome: 'invalid' } };
    }
    const data = recordOf(post, payload, contentType);
    const outcome =
      post.kind === 'sale' ? await handleSalePost(post, receipt, data) : post.kind === 'refund' ? await handleRefundPost(post, receipt, data) : 'ignored';
    console.log(`💳 [free-video] ClickBank ${post.transactionType || 'post'} for item ${CB_UNLOCK.item}, receipt ${receipt} (zap ${post.zap}): ${outcome}`);
    return { status: 200, body: { success: true, outcome } };
  } catch (error) {
    // The post's row is written before the unlock, so the sweep finishes a sale this failure left half way.
    console.error('❌ [free-video] ClickBank $49 post failed:', error);
    return { status: 500, body: { error: 'Processing failed' } };
  }
}

// ---------------------------------------------------------------------------------------------
// The thank-you page's return (cb-confirm, cb-paid)
// ---------------------------------------------------------------------------------------------

/** Order API checks from the thank-you page's return in this process: per token, and in all (the clerk key is shared with the reconcile cron). */
const confirmLog = new Map<string, number[]>();
let confirmAll: number[] = [];

function takeConfirmSlot(token: string, now = Date.now()): boolean {
  confirmAll = confirmAll.filter((at) => now - at < 60_000);
  const mine = (confirmLog.get(token) ?? []).filter((at) => now - at < 10 * 60_000);
  if (confirmAll.length >= 30 || mine.length >= 5) return false;
  mine.push(now);
  confirmAll.push(now);
  confirmLog.set(token, mine);
  if (confirmLog.size > 2000) for (const [key, times] of confirmLog) if (!times.some((at) => now - at < 10 * 60_000)) confirmLog.delete(key);
  return true;
}

/**
 * The $49 page back from the thank-you page (?paid=cb&r=<receipt>) asks to apply the receipt now instead of waiting for
 * the zaps. 'paid' when the lead is paid (by this receipt, or already before); 'pending' while nothing can tell yet (no
 * clerk key, ClickBank does not know the receipt yet, too many checks); 'invalid' for a token that is not a ClickBank
 * funnel lead's or a receipt ClickBank shows for another order. Applied exactly like the webhook's sale (same
 * idempotency), only when ClickBank's order API shows item 12 and the lead's token or the lead's email. Throws only on a
 * database error.
 */
export async function confirmClickBankReceipt(token: string, receipt: string): Promise<'paid' | 'pending' | 'invalid'> {
  const r = normaliseReceipt(receipt);
  if (!r || typeof token !== 'string' || !FREE_VIDEO_TOKEN_PATTERN.test(token)) return 'invalid';
  const lead = await getLeadByToken(token);
  if (!lead || !isClickBankRef(lead.ref)) return 'invalid';
  const known = await leadByOrder([orderIdOf(r)]);
  if (known) return known.id === lead.id && known.unlock_status !== 'refunded' ? 'paid' : 'invalid';
  // Paid by another receipt already: the page shows the paid view either way (a second payment is the webhook's to report).
  if (lead.unlock_status !== 'none' && lead.unlock_status !== 'refunded') return 'paid';
  if (!clerkKey() || !takeConfirmSlot(token)) return 'pending';
  const proof = await checkReceipt(r);
  if (proof.verdict === 'mismatch') return 'invalid';
  if (proof.verdict !== 'confirmed') return 'pending';
  const order = proof.order;
  // The order must name this lead: its token in the seller variables, or the lead's own email on an order placed after
  // item 12 became the AI Video Ad (an older bundle order with the same email never unlocks; CB_ITEM12_SWITCH_AT).
  const emailMatch = Boolean(order.email && emailKeyOf(order.email) === emailKeyOf(lead.email));
  const recent = order.firstAt !== null && order.firstAt >= CB_ITEM12_SWITCH_AT;
  const named = order.fvt === token || (emailMatch && recent);
  if (!named) return 'invalid';
  const test = order.types.length > 0 && order.types.every((type) => type.startsWith('TEST'));
  if (test && !isOwnerTestLead(lead)) return 'invalid';
  const data: Record<string, unknown> = {
    receipt: r,
    rawReceipt: receipt.trim().slice(0, 80),
    items: order.items,
    vendor: order.vendor,
    affiliate: order.affiliate,
    trackingId: order.trackingId,
    fvt: order.fvt,
    vtid: order.vtid,
    email: order.email,
    transactionType: test ? 'TEST_SALE' : 'SALE',
    zap: 'page',
    leadId: lead.id,
  };
  await recordUnlockEvent(eventIdOf(r, 'page', 'sale'), CB_VIDEO_AD_EVENTS.sale, data, 'clickbank');
  const outcome = await settleCbSale(lead, r, { source: 'page', test, email: order.email, data, proof });
  console.log(`💳 [free-video] ClickBank receipt ${r} confirmed from the thank-you page: ${outcome}`);
  if (outcome === 'paid' || outcome === 'duplicate' || outcome === 'second-payment') return 'paid';
  return outcome === 'rejected' ? 'invalid' : 'pending';
}

/**
 * How long after the unlock cb-paid still answers: the thank-you page asks for 3 minutes right after paying. Later a
 * receipt proves nothing about who asks (ClickBank sends every receipt to the affiliate too).
 */
export const CB_PAID_LOOKUP_MINUTES = 30;

/**
 * The view token of the ClickBank funnel lead that carries receipt R ('cb:<R>'), for the thank-you page without a token.
 * Only while that payment is fresh (paid, rendering or ready, unlocked within CB_PAID_LOOKUP_MINUTES) and only for the
 * buyer's own email (cemail on the thank-you address: vendor-only in ClickBank's notifications, so an affiliate never
 * has it). Throws on a database error.
 */
export async function cbPaidTokenOfReceipt(receipt: string, buyerEmail: string | null): Promise<string | null> {
  const r = normaliseReceipt(receipt);
  if (!r || !buyerEmail || !buyerEmail.trim()) return null;
  const lead = await leadByOrder([orderIdOf(r)]);
  if (!lead || !isClickBankRef(lead.ref) || !['paid', 'rendering', 'ready'].includes(lead.unlock_status)) return null;
  const paidAt = lead.unlocked_at ? Date.parse(lead.unlocked_at) : NaN;
  if (!Number.isFinite(paidAt) || Date.now() - paidAt > CB_PAID_LOOKUP_MINUTES * 60_000) return null;
  return emailKeyOf(buyerEmail) === emailKeyOf(lead.email) ? lead.view_token : null;
}

// ---------------------------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------------------------

/** Receipts ClickBank's order API did not know at this process's last look (a deploy forgets them: one more look each). */
const unknownToClickBank = new Set<string>();

/**
 * Every 3 minutes (sweep.ts): the CB_VIDEO_AD_SALE rows of the last 2 days whose receipt no lead carries yet and that
 * nothing settled (a refund, an ignored test purchase, a rejection, a second payment). All posts of a receipt are merged
 * and matched again (token, vtid; after 3 minutes also the one unpaid ClickBank funnel lead of the buyer's email), then
 * applied like the webhook's sale. Still unmatched after 30 minutes: one owner alert (cb-unmatched-<R>). ClickBank's
 * order API still without the receipt after 30 minutes: one owner alert (cb-unverified-<R>), and no more checks after
 * an hour. The live server settles real leads, any other server only its own test leads (the sweep's split). Never throws.
 */
export async function retryPendingClickBankSales(): Promise<void> {
  try {
    const { data, error } = await (createAdminClient() as any)
      .from('webhook_events')
      .select('event_id, event_type, created_at, payload')
      .eq('processor', 'clickbank')
      .in('event_type', [...Object.values(CB_VIDEO_AD_EVENTS), 'FREE_VIDEO_UNLOCK_DUPLICATE'])
      .gt('created_at', isoMinutesAgo(PENDING_DAYS * 24 * 60))
      // Newest first, one read: PostgREST returns at most 1,000 rows on this project. A cut can only drop the oldest rows
      // (receipts with days of retries and their alert behind them); each receipt keeps its earliest row's time below.
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) throw new Error(`webhook_events not read: ${error.message}`);

    const receipts = new Map<string, { firstAt: number; posts: Record<string, unknown>[]; settled: boolean }>();
    for (const row of (data ?? []) as { event_id: string; event_type: string; created_at: string; payload: Record<string, unknown> | null }[]) {
      // A second payment (unlock.ts applyUnlockPayment) is the owner's to refund: its row names the receipt in its id.
      const second = /^free_video_unlock_cb:([A-Z0-9]+)_second$/.exec(row.event_id)?.[1] ?? null;
      const receipt = second ?? normaliseReceipt(row.payload?.receipt);
      if (!receipt) continue;
      const at = Date.parse(row.created_at);
      const entry = receipts.get(receipt) ?? { firstAt: at, posts: [], settled: false };
      // Rows come newest first: unshift keeps each receipt's posts oldest first for mergeCbPosts (first value wins).
      if (row.event_type === CB_VIDEO_AD_EVENTS.sale) entry.posts.unshift(row.payload ?? {});
      else entry.settled = true;
      if (at < entry.firstAt) entry.firstAt = at;
      receipts.set(receipt, entry);
    }
    const open = [...receipts].filter(([, entry]) => entry.posts.length > 0 && !entry.settled);
    if (!open.length) return;

    const { data: carried, error: carriedError } = await leadsTable()
      .select('unlock_order_id')
      .in('unlock_order_id', open.map(([receipt]) => orderIdOf(receipt)));
    if (carriedError) throw new Error(`Could not read the unlocked leads: ${carriedError.message}`);
    const applied = new Set(((carried ?? []) as { unlock_order_id: string | null }[]).map((row) => row.unlock_order_id));
    const pending = open
      .filter(([receipt]) => !applied.has(orderIdOf(receipt)))
      .sort((a, b) => b[1].firstAt - a[1].firstAt)
      .slice(0, PENDING_BATCH);

    const alerts: AlertItem[] = [];
    for (const [receipt, entry] of pending) {
      const minutes = (Date.now() - entry.firstAt) / 60_000;
      const keys = mergeCbPosts(entry.posts);
      const lead = await matchCbLead(keys, minutes >= EMAIL_FALLBACK_MINUTES ? { saleAt: entry.firstAt } : null);
      if (!lead) {
        if (minutes >= UNMATCHED_ALERT_MINUTES) {
          alerts.push({
            key: `cb-unmatched-${receipt}`,
            line: `A ${CB_UNLOCK.price} ClickBank sale (item ${CB_UNLOCK.item}, receipt ${receipt}${keys.email ? `, ${keys.email}` : ''}${keys.affiliate ? `, affiliate ${keys.affiliate}` : ''}${keys.test ? ', a test purchase' : ''}) matches no ClickBank funnel lead after ${UNMATCHED_ALERT_MINUTES} minutes, so nothing was unlocked. If it is a video ad buyer, find their lead and unlock it by hand: ${unlockSqlFor(receipt)} An older AI Stock Image Bundle #2 order needs nothing.`,
          });
        }
        continue;
      }
      // The other kind of server settles this lead (the sweep's live / test split).
      if ((lead.source === 'test') !== claimsTestLeads()) continue;
      if (keys.test && !isOwnerTestLead(lead)) {
        await recordUnlockEvent(eventIdOf(receipt, 'sweep', 'ignored'), CB_VIDEO_AD_EVENTS.testIgnored, { receipt, leadId: lead.id, transactionType: keys.types.join(','), zap: 'sweep' }, 'clickbank');
        console.log(`ℹ️ [free-video] ClickBank test purchase ${receipt} for lead ${lead.id} ignored: not an owner test`);
        continue;
      }
      // A receipt ClickBank's order API still did not know is asked about for an hour at most: by then the owner has the
      // alert and the SQL. A sale left pending by anything else keeps being tried.
      if (minutes >= PROOF_RETRY_MINUTES && unknownToClickBank.has(receipt)) continue;
      const outcome = await settleCbSale(lead, receipt, {
        source: 'sweep',
        test: keys.test,
        email: keys.email,
        data: { receipt, leadId: lead.id, fvt: keys.fvt, email: keys.email, affiliate: keys.affiliate, transactionType: keys.types.join(','), zap: 'sweep' },
      });
      if (outcome === 'unverified') unknownToClickBank.add(receipt);
      else unknownToClickBank.delete(receipt);
      console.log(`💳 [free-video] Pending ClickBank receipt ${receipt} (lead ${lead.id}): ${outcome}`);
      if (outcome === 'unverified' && minutes >= UNMATCHED_ALERT_MINUTES) {
        alerts.push({
          key: `cb-unverified-${receipt}`,
          line: `ClickBank's order API still does not know receipt ${receipt} after ${UNMATCHED_ALERT_MINUTES} minutes, so the ${CB_UNLOCK.price} video ad of ${displayDomain(lead.website_domain)} (lead ${lead.id}) is NOT unlocked. If the sale is real, unlock it by hand: ${unlockSqlFor(receipt, lead)}`,
        });
      }
    }
    if (alerts.length) await alertOwner(alerts, 'ClickBank $49 sales that need you');
  } catch (error) {
    console.error('❌ [free-video] retryPendingClickBankSales failed:', error);
  }
}
