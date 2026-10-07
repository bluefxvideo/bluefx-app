/**
 * Free video ad funnel, Offer 1: the $99 unlock (FastSpring one-time product `video-creation`, $99).
 *
 * The visitor pays on FastSpring's hosted checkout (unlockCheckoutUrl, reached through /go/fvunlock), with
 * the lead's view token as the tag `freeVideoLead`. FastSpring's webhook then lands in
 * api/webhooks/fastspring/route.ts, whose one early branch hands every event of this product to
 * handleFreeVideoUnlockEvent(). Nothing here creates an app user or touches credits.
 *
 * - order.completed → handleFreeVideoUnlock(): the lead is found (tag first, else the newest lead of the
 *   buyer's email), the order is confirmed with the FastSpring API when the keys are there, and the lead
 *   becomes unlock_status 'paid' with its order id (unique, so a webhook delivered twice unlocks once).
 * - renderCleanVersion(): the saved props of the finished video ad, without the watermark, rendered again
 *   (render cost only, no AI calls) and stored at an unguessable name next to video.mp4, then emailed.
 * - order.canceled, return.created and refund events → unlock_status 'refunded' plus an owner alert.
 * A payment that arrives before the video ad is done waits as 'paid': settleLead starts the render when the
 * video ad is done, and the cron sweep retries renders that failed or died.
 *
 * Server only. NEVER re-export anything from here in a server-action file.
 */

import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/app/supabase/server';
import { alertOwner, type AlertItem } from '@/lib/free-video/alerts';
import { CLEAN_RENDER, fakeMode, GATE, isLive, renderTargetAllowed, remotionServerUrl } from '@/lib/free-video/config';
import { frameOf, probeFile } from '@/lib/free-video/gate';
import { asLead, getLead, getLeadByToken, leadsTable, readSettings, transitionUnlock } from '@/lib/free-video/leads';
import { deliverUnlock } from '@/lib/free-video/notify';
import { UNLOCK } from '@/lib/free-video/offer';
import { displayDomain, emailKeyOf } from '@/lib/free-video/website';
import { jobDir, readPlan, upload } from '@/lib/smart-video/jobs';
import { levelLoudness, renderSmartVideo } from '@/lib/smart-video/render';
import { FREE_VIDEO_TOKEN_PATTERN, type FreeVideoLead } from '@/types/free-video';

// ---------------------------------------------------------------------------------------------
// Background work
// ---------------------------------------------------------------------------------------------

/**
 * Runs `task` without making the caller wait. viaAfter: inside a request (the payment webhook, the cron),
 * after() runs it once the answer is sent; elsewhere (a job's own finally, a script) it simply starts now.
 * Never throws.
 */
export function inBackground(label: string, task: () => Promise<unknown>, viaAfter = false): void {
  const run = () => task().then(
    () => undefined,
    (error) => console.error(`❌ [free-video] ${label} failed:`, error)
  );
  if (viaAfter) {
    try {
      after(run);
      return;
    } catch {
      /* outside a request: start it now */
    }
  }
  void run();
}

// ---------------------------------------------------------------------------------------------
// The FastSpring order
// ---------------------------------------------------------------------------------------------

const text = z.string().optional().catch(undefined);
const amount = z.union([z.number(), z.string()]).optional().catch(undefined);
const OrderRefSchema = z.object({ id: text, order: text, reference: text }).passthrough();

/** The fields of a FastSpring order (or return) event this module reads. Every field is optional; a wrong type reads as missing. */
export const FastSpringOrderSchema = z
  .object({
    id: text,
    order: z.union([z.string(), OrderRefSchema]).optional().catch(undefined),
    reference: text,
    /** A return (refund) event carries its own id here and the original order in `original`. */
    return: text,
    original: OrderRefSchema.optional().catch(undefined),
    completed: z.boolean().optional().catch(undefined),
    live: z.boolean().optional().catch(undefined),
    currency: text,
    payoutCurrency: text,
    total: amount,
    totalInPayoutCurrency: amount,
    subtotal: amount,
    subtotalInPayoutCurrency: amount,
    account: z
      .union([z.string(), z.object({ contact: z.object({ email: text }).passthrough().optional().catch(undefined) }).passthrough()])
      .optional()
      .catch(undefined),
    customer: z.object({ email: text }).passthrough().optional().catch(undefined),
    product: z.union([z.string(), z.object({ product: text }).passthrough()]).optional().catch(undefined),
    items: z
      .array(z.object({ product: text, subtotal: amount, subtotalInPayoutCurrency: amount }).passthrough())
      .optional()
      .catch(undefined),
    tags: z.union([z.record(z.unknown()), z.string()]).optional().catch(undefined),
  })
  .passthrough();

export interface UnlockOrder {
  /** The FastSpring order id (unlock_order_id); for a return, the return's own id. */
  id: string | null;
  reference: string | null;
  /** The order ids a return or cancellation points at. */
  orderIds: string[];
  isReturn: boolean;
  email: string | null;
  /** The view token from tags.freeVideoLead, when it has the token's shape. */
  token: string | null;
  amount: number | null;
  currency: string | null;
  live: boolean | null;
  products: string[];
}

const num = (value: unknown) => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** tags arrive as an object; a JSON string is read too. */
function tagValue(tags: unknown, key: string): string | null {
  let record: unknown = tags;
  if (typeof tags === 'string') {
    try {
      record = JSON.parse(tags);
    } catch {
      return null;
    }
  }
  const value = record && typeof record === 'object' ? (record as Record<string, unknown>)[key] : null;
  return typeof value === 'string' ? value.trim() : null;
}

/** Every product path in an order or return event, lowercased. */
function productsOf(order: z.infer<typeof FastSpringOrderSchema>): string[] {
  const direct = typeof order.product === 'string' ? order.product : order.product?.product;
  return [...(order.items ?? []).map((item) => item.product), direct].filter((p): p is string => Boolean(p)).map((p) => p.toLowerCase());
}

/** The order as this module needs it. Never throws. */
export function readUnlockOrder(data: unknown): UnlockOrder {
  const parsed = FastSpringOrderSchema.safeParse(data ?? {});
  const order = parsed.success ? parsed.data : ({} as z.infer<typeof FastSpringOrderSchema>);
  const products = productsOf(order);
  const orderRef = typeof order.order === 'object' ? order.order : null;
  const ownId = order.return || order.id || (typeof order.order === 'string' ? order.order : null) || null;
  const isReturn = Boolean(order.return || order.original);
  const orderIds = [
    ...(isReturn ? [] : [order.id, typeof order.order === 'string' ? order.order : undefined]),
    order.original?.id,
    order.original?.order,
    orderRef?.id,
    orderRef?.order,
  ].filter((id): id is string => Boolean(id));
  const email =
    (typeof order.account === 'object' ? order.account?.contact?.email : undefined) || order.customer?.email || null;
  const token = tagValue(order.tags, UNLOCK.tagKey);
  // What the owner is paid for the unlock: the item's own subtotal in the payout currency when FastSpring sends it.
  const item = (order.items ?? []).find((i) => i.product?.toLowerCase() === UNLOCK.product);
  const payout = num(item?.subtotalInPayoutCurrency) ?? num(order.subtotalInPayoutCurrency) ?? num(order.totalInPayoutCurrency);
  const local = num(item?.subtotal) ?? num(order.subtotal) ?? num(order.total);
  return {
    id: ownId,
    reference: order.reference || null,
    orderIds: [...new Set(orderIds)],
    isReturn,
    email: email ? email.trim().toLowerCase() : null,
    token: token && FREE_VIDEO_TOKEN_PATTERN.test(token) ? token : null,
    amount: payout ?? local,
    currency: (payout !== null ? order.payoutCurrency || order.currency : order.currency) || null,
    live: typeof order.live === 'boolean' ? order.live : null,
    products,
  };
}

/**
 * Whether a FastSpring event is about the unlock product: 'only' when the unlock is every product in it,
 * 'mixed' when it comes with other products (those keep their normal handling), null when it is not there.
 */
export function freeVideoUnlockIn(data: unknown): 'only' | 'mixed' | null {
  const { products } = readUnlockOrder(data);
  if (!products.includes(UNLOCK.product)) return null;
  return products.every((product) => product === UNLOCK.product) ? 'only' : 'mixed';
}

// ---------------------------------------------------------------------------------------------
// Records and alerts
// ---------------------------------------------------------------------------------------------

/** A webhook_events row for the owner's records, written once per event id. Throws on a database error (FastSpring then retries). */
async function recordUnlockEvent(eventId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
  const admin = createAdminClient() as any;
  const { data: existing, error: readError } = await admin.from('webhook_events').select('id').eq('event_id', eventId).eq('processor', 'fastspring').limit(1);
  if (readError) throw new Error(`webhook_events not read: ${readError.message}`);
  if (existing?.length) return;
  const { error } = await admin.from('webhook_events').insert({ event_id: eventId, event_type: eventType, processor: 'fastspring', payload });
  if (error && error.code !== '23505') throw new Error(`webhook_events not written: ${error.message}`);
}

const alertLater = (items: AlertItem[], subject: string) => inBackground('unlock alert', () => alertOwner(items, subject), true);

const dayKey = () => new Date().toISOString().slice(0, 10);

/** The SQL that unlocks a lead by hand, for alerts about a payment the code could not apply. */
const manualUnlockSql = (orderId: string) =>
  `update free_video_leads set unlock_status = 'paid', unlock_order_id = '${orderId.replace(/'/g, "''")}', unlocked_at = now(), updated_at = now() where view_token = '<the lead token>' and unlock_status = 'none';`;

// ---------------------------------------------------------------------------------------------
// The payment
// ---------------------------------------------------------------------------------------------

/**
 * Asks FastSpring whether the order is real, completed, live and holds the unlock product (GET /orders/<id>,
 * Basic auth, exactly as the webhook route reads accounts). The webhook route does not reject a bad
 * signature, so on the live server this check is the only proof of payment: missing or refused API keys
 * and test orders are 'rejected' there (the owner gets the SQL to unlock by hand). 'unchecked' only when
 * FastSpring itself is down (5xx, network): the unlock then goes ahead and the owner is alerted once a day.
 */
async function confirmOrder(orderId: string): Promise<{ verdict: 'confirmed' | 'rejected' | 'unchecked'; note?: string }> {
  const username = process.env.FASTSPRING_USERNAME;
  const apiKey = process.env.FASTSPRING_API_KEY;
  if (!username || !apiKey) {
    if (isLive()) return { verdict: 'rejected', note: 'FASTSPRING_USERNAME / FASTSPRING_API_KEY are not set on the server, so the order could not be checked' };
    console.warn(`⚠️ [free-video] Unlock order ${orderId} applied without an API check: FASTSPRING_USERNAME / FASTSPRING_API_KEY are not set`);
    return { verdict: 'unchecked' };
  }
  try {
    const auth = Buffer.from(`${username}:${apiKey}`).toString('base64');
    const res = await fetch(`https://api.fastspring.com/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 400 || res.status === 404) return { verdict: 'rejected', note: `the FastSpring API does not know order ${orderId} (HTTP ${res.status})` };
    if ((res.status === 401 || res.status === 403) && isLive()) return { verdict: 'rejected', note: `the FastSpring API refused the server's API keys (HTTP ${res.status}); check FASTSPRING_USERNAME / FASTSPRING_API_KEY` };
    if (!res.ok) return { verdict: 'unchecked', note: `the FastSpring API answered HTTP ${res.status}` };
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const list = Array.isArray(body?.orders) ? (body?.orders as unknown[]) : [body];
    const match = list.map((entry) => FastSpringOrderSchema.safeParse(entry ?? {})).find((r) => r.success && (r.data.id === orderId || r.data.order === orderId));
    if (!match?.success) return { verdict: 'rejected', note: `the FastSpring API returned no order ${orderId}` };
    if (match.data.completed === false) return { verdict: 'rejected', note: `order ${orderId} is not completed` };
    if (!productsOf(match.data).includes(UNLOCK.product)) return { verdict: 'rejected', note: `order ${orderId} does not contain ${UNLOCK.product}` };
    if (match.data.live === false && isLive()) return { verdict: 'rejected', note: `order ${orderId} is a FastSpring test order` };
    return { verdict: 'confirmed' };
  } catch (error) {
    return { verdict: 'unchecked', note: `the FastSpring API did not answer (${error instanceof Error ? error.message : String(error)})` };
  }
}

/** The lead an order id was already applied to. Throws on a database error. */
async function leadByOrder(orderIds: string[]): Promise<FreeVideoLead | null> {
  if (!orderIds.length) return null;
  const { data, error } = await leadsTable().select('*').in('unlock_order_id', orderIds).limit(1);
  if (error) throw new Error(`Could not read the unlocked leads: ${error.message}`);
  return data?.length ? asLead(data[0]) : null;
}

/** The newest lead of this address (by email key), a non-rejected one first. Throws on a database error. */
async function newestLeadByEmail(email: string): Promise<FreeVideoLead | null> {
  const { data, error } = await leadsTable().select('*').eq('email_key', emailKeyOf(email)).order('created_at', { ascending: false }).limit(5);
  if (error) throw new Error(`Could not read the leads of the buyer: ${error.message}`);
  const leads = ((data ?? []) as Record<string, unknown>[]).map(asLead);
  return leads.find((lead) => lead.status !== 'rejected') ?? leads[0] ?? null;
}

export type UnlockOutcome = 'paid' | 'duplicate' | 'unmatched' | 'unverified' | 'second-payment' | 'invalid';

/**
 * order.completed for the unlock product. Idempotent: an order id that is already on a lead changes
 * nothing (a paid unlock whose video ad is done gets its render started). Throws only on a database
 * error, so FastSpring retries the webhook. Never creates a user and never touches credits.
 */
export async function handleFreeVideoUnlock(orderData: unknown): Promise<UnlockOutcome> {
  const order = readUnlockOrder(orderData);
  const raw = (orderData ?? {}) as Record<string, unknown>;

  if (!order.id) {
    await recordUnlockEvent(`free_video_unlock_${order.reference || Date.now()}_invalid`, 'FREE_VIDEO_UNLOCK_UNMATCHED', { data: raw, reason: 'order without an id' });
    alertLater([{ key: `unlock-unmatched:${order.reference || dayKey()}`, line: `A $99 unlock order arrived without an order id (reference ${order.reference || 'none'}). Nothing was unlocked; see webhook_events FREE_VIDEO_UNLOCK_UNMATCHED.` }], 'an unlock order could not be read');
    return 'invalid';
  }

  // 1. The same order again (a webhook delivered twice).
  const known = await leadByOrder([order.id]);
  if (known) {
    if (known.unlock_status === 'paid' && known.status === 'done') startCleanRender(known.id, true);
    console.log(`ℹ️ [free-video] Unlock order ${order.id} is already on lead ${known.id}`);
    return 'duplicate';
  }

  // 2. A real, completed, live order? (The route's signature check does not stop a forged POST.) Anyone can
  // pay a test order with FastSpring's public test card, so the live server never unlocks one.
  const check: Awaited<ReturnType<typeof confirmOrder>> =
    order.live === false && isLive() ? { verdict: 'rejected', note: `order ${order.id} is a FastSpring test order` } : await confirmOrder(order.id);
  if (check.verdict === 'rejected') {
    await recordUnlockEvent(`free_video_unlock_${order.id}_unverified`, 'FREE_VIDEO_UNLOCK_UNVERIFIED', { data: raw, reason: check.note ?? null });
    alertLater(
      [{ key: `unlock-unverified:${order.id}`, line: `A $99 unlock webhook for order ${order.id} was NOT applied: ${check.note}. If the order is real, unlock it by hand: ${manualUnlockSql(order.id)}` }],
      'an unlock order did not check out'
    );
    return 'unverified';
  }
  if (check.verdict === 'unchecked' && check.note) {
    alertLater(
      [{ key: `unlock-unconfirmed:${dayKey()}`, line: `$99 unlock order ${order.id} was applied without confirmation: ${check.note}. Check FASTSPRING_USERNAME / FASTSPRING_API_KEY.` }],
      'unlocks applied without an API check'
    );
  }

  // 3. The lead: the token tag first, else the newest lead of the buyer's email.
  let lead = order.token ? await getLeadByToken(order.token) : null;
  if (!lead && order.email) lead = await newestLeadByEmail(order.email);
  if (!lead) {
    await recordUnlockEvent(`free_video_unlock_${order.id}_unmatched`, 'FREE_VIDEO_UNLOCK_UNMATCHED', { data: raw, email: order.email, token: order.token });
    alertLater(
      [{ key: `unlock-unmatched:${order.id}`, line: `A $99 unlock was paid (order ${order.id}${order.reference ? `, ${order.reference}` : ''}, ${order.email || 'no email'}) but matches no free video lead. Find the lead and unlock it by hand: ${manualUnlockSql(order.id)}` }],
      'an unlock payment matches no lead'
    );
    return 'unmatched';
  }

  // 4. Paid. The unique unlock_order_id makes a parallel delivery of the same order a no-op. A lead whose
  // earlier unlock was refunded is offered the unlock again (unlockViewOf), so it may be paid again: that
  // starts the clean version from scratch.
  const again = lead.unlock_status === 'refunded';
  let updated: FreeVideoLead | null = null;
  try {
    if (lead.unlock_status === 'none' || again) {
      updated = await transitionUnlock(
        lead.id,
        { from: [lead.unlock_status], strict: true },
        {
          unlock_status: 'paid',
          unlock_order_id: order.id,
          unlock_amount: order.amount,
          unlock_currency: order.currency,
          unlocked_at: new Date().toISOString(),
          ...(again ? { clean_attempts: 0, clean_claimed_at: null, clean_ready_at: null, clean_video_url: null, unlock_emailed_at: null } : {}),
        }
      );
    }
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return 'duplicate';
    throw error;
  }
  if (!updated) {
    // The same order delivered twice at once: the other delivery applied it a moment ago.
    if ((await leadByOrder([order.id]))?.id === lead.id) return 'duplicate';
    await recordUnlockEvent(`free_video_unlock_${order.id}_second`, 'FREE_VIDEO_UNLOCK_DUPLICATE', { data: raw, lead: lead.id, unlockStatus: lead.unlock_status });
    alertLater(
      [{ key: `unlock-duplicate:${order.id}`, line: `A second $99 unlock payment (order ${order.id}) arrived for ${displayDomain(lead.website_domain)} (lead ${lead.id}, unlock already ${lead.unlock_status} by order ${lead.unlock_order_id || '?'}). Refund order ${order.id} in FastSpring.` }],
      'a second unlock payment'
    );
    return 'second-payment';
  }
  console.log(`✅ [free-video] Lead ${lead.id} (${lead.website_domain}) unlocked by order ${order.id}${order.live === false ? ' (a FastSpring test order)' : ''}`);
  if (updated.status === 'done') startCleanRender(updated.id, true);
  else if (updated.status === 'failed' || updated.status === 'rejected') {
    alertLater(
      [{ key: `unlock-novideo:${lead.id}:${order.id}`, line: `$99 unlock paid (order ${order.id}) for ${displayDomain(lead.website_domain)}, but that free video ad ${updated.status === 'rejected' ? 'could not be made (website not readable)' : 'failed'}. Make a new one (it is rendered clean as soon as it is done) or refund the order: update free_video_leads set status = 'queued', attempts = 0, reason = null, not_before = null, updated_at = now() where id = '${lead.id}';` }],
      'an unlock paid for a video ad that does not exist'
    );
  }
  return 'paid';
}

/**
 * order.canceled, return.created and refund events for the unlock product: the lead's unlock becomes
 * 'refunded' (the clean file stays; it is not worth chasing) and the owner is told.
 */
async function handleUnlockRefund(eventType: string, order: UnlockOrder, raw: Record<string, unknown>): Promise<void> {
  const ids = [...new Set([...order.orderIds, ...(order.isReturn ? [] : order.id ? [order.id] : [])])];
  let lead = await leadByOrder(ids);
  // The token only decides when the event names no order: a refund of a second payment (never applied) must
  // not take back the unlock the first payment bought.
  if (!lead && !ids.length && order.token) {
    const byToken = await getLeadByToken(order.token);
    if (byToken && byToken.unlock_status !== 'none') lead = byToken;
  }
  const eventKey = `${order.id || ids[0] || order.reference || Date.now()}`;
  if (!lead) {
    await recordUnlockEvent(`free_video_unlock_${eventKey}_refund_unmatched`, 'FREE_VIDEO_UNLOCK_REFUND_UNMATCHED', { data: raw, eventType });
    // A cancelled order that never unlocked anything needs no one's attention.
    if (eventType !== 'order.canceled') {
      alertLater(
        [{ key: `unlock-refund:${eventKey}`, line: `A $99 unlock ${eventType} (${eventKey}) matches no unlocked lead: no unlock was taken back (a refunded second payment needs nothing else). See webhook_events FREE_VIDEO_UNLOCK_REFUND_UNMATCHED.` }],
        'an unlock refund matches no lead'
      );
    }
    return;
  }
  const updated = await transitionUnlock(lead.id, { from: ['paid', 'rendering', 'ready', 'failed'], strict: true }, { unlock_status: 'refunded' });
  if (!updated) {
    console.log(`ℹ️ [free-video] ${eventType} for lead ${lead.id}: the unlock is already ${lead.unlock_status}`);
    return;
  }
  await recordUnlockEvent(`free_video_unlock_${eventKey}_refund`, 'FREE_VIDEO_UNLOCK_REFUND', { data: raw, eventType, lead: lead.id });
  console.warn(`⚠️ [free-video] Lead ${lead.id}: $99 unlock ${eventType}, now refunded`);
  alertLater(
    [{ key: `unlock-refund:${lead.id}:${lead.unlock_order_id || eventKey}`, line: `$99 unlock of ${displayDomain(lead.website_domain)} (lead ${lead.id}, order ${lead.unlock_order_id || '?'}): ${eventType}. The lead is marked refunded; the clean file stays where it is.` }],
    'an unlock was refunded'
  );
}

/**
 * Every FastSpring event that carries the unlock product (the webhook's early branch). order.completed
 * unlocks; order.canceled, return.created and any refund or chargeback event refunds; anything else
 * (payment pending, failed) needs nothing. Throws only on a database error, so FastSpring retries.
 */
export async function handleFreeVideoUnlockEvent(eventType: string, data: unknown): Promise<void> {
  const order = readUnlockOrder(data);
  const raw = (data ?? {}) as Record<string, unknown>;
  if (order.isReturn || eventType === 'order.canceled' || eventType === 'return.created' || /refund|chargeback/i.test(eventType)) {
    await handleUnlockRefund(eventType, order, raw);
    return;
  }
  if (eventType === 'order.completed') {
    const outcome = await handleFreeVideoUnlock(data);
    console.log(`💳 [free-video] Unlock order ${order.id || order.reference || '?'}: ${outcome}`);
    return;
  }
  console.log(`ℹ️ [free-video] FastSpring ${eventType} for ${UNLOCK.product}: nothing to do`);
}

// ---------------------------------------------------------------------------------------------
// The clean render
// ---------------------------------------------------------------------------------------------

/** The saved props of a free video ad without the watermark: the clean version (original length, no end card). */
export function cleanProps(props: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...props };
  delete clean.watermark;
  return clean;
}

/** Clean renders running in this process right now. */
let cleanRunning = 0;
export const cleanRendersRunning = () => cleanRunning;

/** Starts renderCleanVersion without waiting for it (see inBackground). */
export function startCleanRender(leadId: string, viaAfter = false): void {
  inBackground(`Clean render of lead ${leadId}`, () => renderCleanVersion(leadId), viaAfter);
}

/** The clean file must be what the props describe: their length (no end card), the frame size and a sound track. */
export async function checkCleanFile(data: Buffer, props: Record<string, unknown>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'free-video-clean-'));
  try {
    const file = path.join(dir, 'clean.mp4');
    await fs.writeFile(file, data);
    const probe = await probeFile(file);
    const expected = Number(props.duration);
    // Full HD: the clean render runs at renderSmartVideo's default scale. Checked against the free video ad's 720p,
    // every clean render failed from 3fe62c4 until 2026-10-07 evening (a copy fell back to the marked file).
    const { width, height } = frameOf(typeof props.format === 'string' ? props.format : undefined, 1);
    const problems = [
      Number.isFinite(expected) && Math.abs(probe.seconds - expected) > GATE.probeTolerance ? `length ${probe.seconds.toFixed(2)} s instead of ${expected} s` : null,
      probe.width !== width || probe.height !== height ? `frame ${probe.width}x${probe.height}` : null,
      probe.hasAudio ? null : 'no sound',
      probe.bytes < GATE.minBytes ? 'file too small' : null,
    ].filter(Boolean);
    if (problems.length) throw new Error(`The clean render is not right: ${problems.join(', ')}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Renders the clean version on the render server, levels it like every Phantom video, checks it and stores it at an unguessable name. */
async function renderAndStore(lead: FreeVideoLead): Promise<string> {
  const settings = await readSettings(true);
  const systemUserId = settings?.system_user_id;
  if (!systemUserId || !lead.job_id) throw new Error('No system user or job for the clean render');
  const saved = await readPlan(systemUserId, lead.job_id);
  const props = cleanProps(saved.props);
  // Exactly as finish() does it: the render, then the loudness.
  const renderedUrl = await renderSmartVideo(props, () => undefined);
  const data = await levelLoudness(renderedUrl);
  await checkCleanFile(data, props);
  // video.mp4 sits in the same folder and its URL is public, so the clean file needs a name nobody can guess.
  const name = `clean-${randomBytes(18).toString('base64url')}.mp4`;
  return upload(`${jobDir(systemUserId, lead.job_id)}/${name}`, data, 'video/mp4');
}

/** Fake mode: a short pause, then the free file stands in for the clean one. */
async function fakeCleanFile(videoUrl: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return videoUrl;
}

export type CleanOutcome = 'ready' | 'waiting' | 'busy' | 'none' | 'retry' | 'failed';

/**
 * The $99 clean version of a lead's video ad:
 * 1. Guarded claim: paid (or a 'rendering' claim older than CLEAN_RENDER.staleMinutes) → rendering,
 *    clean_attempts + 1, clean_claimed_at now. A heartbeat keeps the claim fresh while the render runs.
 * 2. The saved props of the job (owner: the system user) without the watermark, rendered with
 *    renderSmartVideo + levelLoudness, checked with ffprobe.
 * 3. Stored as smart-video/<system user>/<job>/clean-<24 random characters>.mp4.
 * 4. unlock_status 'ready', clean_video_url, clean_ready_at; then the email (deliverUnlock).
 * A failed attempt goes back to 'paid' for the sweep; after CLEAN_RENDER.maxAttempts it is 'failed' and the
 * sweep alerts the owner. Runs even while free starts are paused or capped: this is a paying customer.
 * 'waiting' = the video ad itself is not done yet (settleLead starts the render when it is).
 */
export async function renderCleanVersion(leadId: string): Promise<CleanOutcome> {
  const lead = await getLead(leadId);
  if (!lead || (lead.unlock_status !== 'paid' && lead.unlock_status !== 'rendering')) return 'none';
  if (lead.status !== 'done' || !lead.job_id || !lead.video_url) return 'waiting';
  const staleBefore = Date.now() - CLEAN_RENDER.staleMinutes * 60_000;
  if (lead.unlock_status === 'rendering' && lead.clean_claimed_at && Date.parse(lead.clean_claimed_at) > staleBefore) return 'none';
  if (!fakeMode() && !renderTargetAllowed()) {
    console.error(`❌ [free-video] Clean render of lead ${lead.id} refused: off the live server only a local Remotion may render (now ${remotionServerUrl()})`);
    return 'none';
  }

  // Out of attempts (a render that kept dying): the sweep alerts the owner.
  if (lead.clean_attempts >= CLEAN_RENDER.maxAttempts) {
    await transitionUnlock(lead.id, { from: [lead.unlock_status], cleanAttempts: lead.clean_attempts }, { unlock_status: 'failed' });
    console.error(`❌ [free-video] Clean render of lead ${lead.id} failed ${lead.clean_attempts} times; marked failed`);
    return 'failed';
  }
  if (cleanRunning >= CLEAN_RENDER.maxParallel) return 'busy';
  // Counted before the claim, so two calls at the same moment cannot both pass the limit.
  cleanRunning++;
  try {
    // 1. The claim.
    const attempt = lead.clean_attempts + 1;
    const claimed = await transitionUnlock(
      lead.id,
      { from: [lead.unlock_status], cleanAttempts: lead.clean_attempts, ...(lead.unlock_status === 'rendering' ? { cleanClaimedAt: lead.clean_claimed_at } : {}) },
      { unlock_status: 'rendering', clean_attempts: attempt, clean_claimed_at: new Date().toISOString() }
    );
    if (!claimed) return 'none';
    return await renderClaimed(lead, lead.video_url, attempt);
  } finally {
    cleanRunning--;
  }
}

/** Steps 2-4 of renderCleanVersion, for an attempt this process has claimed. */
async function renderClaimed(lead: FreeVideoLead, freeUrl: string, attempt: number): Promise<CleanOutcome> {
  const heartbeat = setInterval(() => {
    leadsTable()
      .update({ clean_claimed_at: new Date().toISOString() })
      .eq('id', lead.id)
      .eq('unlock_status', 'rendering')
      .eq('clean_attempts', attempt)
      .then(
        () => undefined,
        () => undefined
      );
  }, 60_000);
  try {
    console.log(`🔄 [free-video] Clean render of lead ${lead.id} (${lead.website_domain}), attempt ${attempt}`);
    // 2 + 3. Fake mode ($0 tests) has no plan to render: the free file stands in for the clean one.
    const url = fakeMode() ? await fakeCleanFile(freeUrl) : await renderAndStore(lead);
    // 4.
    const ready = await transitionUnlock(
      lead.id,
      { from: ['rendering'], cleanAttempts: attempt },
      { unlock_status: 'ready', clean_video_url: url, clean_ready_at: new Date().toISOString() }
    );
    if (!ready) {
      console.warn(`⚠️ [free-video] Lead ${lead.id}: the unlock moved on while the clean video rendered (refunded or taken over); the file stays unused`);
      return 'none';
    }
    console.log(`✅ [free-video] Clean video of lead ${lead.id} is ready: ${url}`);
    await deliverUnlock(lead.id);
    return 'ready';
  } catch (error) {
    console.error(`❌ [free-video] Clean render of lead ${lead.id} failed (attempt ${attempt}):`, error);
    const next = attempt >= CLEAN_RENDER.maxAttempts ? 'failed' : 'paid';
    await transitionUnlock(lead.id, { from: ['rendering'], cleanAttempts: attempt }, { unlock_status: next });
    return next === 'failed' ? 'failed' : 'retry';
  } finally {
    clearInterval(heartbeat);
  }
}
