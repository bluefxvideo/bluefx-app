/**
 * Free video ad funnel: the leads table, the settings row and everything the routes ask of them.
 *
 * Server only (routes, the cron, lib/free-video/*, tsx scripts). There is no 'server-only' import on
 * purpose: the tsx test scripts import this file outside Next.js. NEVER re-export anything from here in
 * a server-action file: every export there becomes a public, unauthenticated action.
 *
 * Rules every writer follows:
 * - EVERY change of a lead's status goes through transitionLead(), a guarded update, and every change of
 *   its unlock status through transitionUnlock(). The job's own finally, the cron, the payment webhook and
 *   an owner's SQL edit can then race safely, and a late result of an earlier attempt can never touch a
 *   lead that has moved on.
 * - A lead is stored only by the SQL function create_free_video_lead(), which counts the per-IP, per-address
 *   and daily caps and inserts under one lock (review SEC-2). The partial unique indexes (email_key,
 *   website_domain where status <> 'rejected') are the real "one free video ad per person and per business"
 *   guard; the checks in createLead() only answer early.
 */

import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { createAdminClient } from '@/app/supabase/server';
import { INTAKE, IP_ROWS_PER_DAY, JOB_MINUTES, OWNER_TEST_EMAILS, SETTINGS_CACHE_MS, UNREADABLE } from '@/lib/free-video/config';
import { editableUntil, unlockOpen } from '@/lib/free-video/cleanup';
import { ERRORS } from '@/lib/free-video/copy';
import { isPlacement, unlockGoUrl } from '@/lib/free-video/offer';
import { displayDomain, emailKeyOf, normalizeWebsite, precheckSite } from '@/lib/free-video/website';
import { jobsTable } from '@/lib/smart-video/jobs';
import {
  FREE_VIDEO_TOKEN_PATTERN,
  type FreeVideoErrorCode,
  type FreeVideoLead,
  type FreeVideoLeadInput,
  type FreeVideoLeadPatch,
  type FreeVideoLeadStatus,
  type FreeVideoLive,
  type FreeVideoServerEvent,
  type FreeVideoSettings,
  type FreeVideoUnlockStatus,
  type FreeVideoUnlockView,
  type FreeVideoView,
  type LeadMeta,
} from '@/types/free-video';
import type { SmartVideoJob } from '@/types/smart-video';

// ---------------------------------------------------------------------------------------------
// Tables (newer than the generated database types, the same pattern as smart_video_jobs)
// ---------------------------------------------------------------------------------------------

export const leadsTable = () => (createAdminClient() as any).from('free_video_leads');
export const settingsTable = () => (createAdminClient() as any).from('free_video_settings');
export const eventsTable = () => (createAdminClient() as any).from('free_video_events');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An ISO time `minutes` ago. */
export const isoMinutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const numberOr = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** A free_video_leads row as PostgREST returns it, with every numeric column as a JS number. */
export function asLead(row: Record<string, unknown>): FreeVideoLead {
  const lead = row as unknown as FreeVideoLead;
  return {
    ...lead,
    attempts: numberOr(row.attempts, 0),
    email_attempts: numberOr(row.email_attempts, 0),
    est_cost_usd: numberOr(row.est_cost_usd, 0),
    reserved_usd: numberOr(row.reserved_usd, 0),
    duration_seconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : numberOr(row.duration_seconds, 0),
    job_ids: Array.isArray(row.job_ids) ? (row.job_ids as string[]) : [],
    unlock_status: (row.unlock_status as FreeVideoUnlockStatus | undefined) ?? 'none',
    unlock_amount: row.unlock_amount === null || row.unlock_amount === undefined ? null : numberOr(row.unlock_amount, 0),
    clean_attempts: numberOr(row.clean_attempts, 0),
    live: row.live && typeof row.live === 'object' ? (row.live as FreeVideoLive) : null,
  };
}

function asSettings(row: Record<string, unknown>): FreeVideoSettings {
  const s = row as unknown as FreeVideoSettings;
  return {
    ...s,
    max_running: numberOr(row.max_running, 0),
    daily_starts: numberOr(row.daily_starts, 0),
    daily_usd: numberOr(row.daily_usd, 0),
    daily_leads: numberOr(row.daily_leads, 0),
    per_ip_daily: numberOr(row.per_ip_daily, 0),
    paid_busy_limit: numberOr(row.paid_busy_limit, 0),
    est_usd: numberOr(row.est_usd, 1.3),
  };
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

let settingsCache: { at: number; value: FreeVideoSettings } | null = null;

/**
 * The one settings row (id = 1), cached for SETTINGS_CACHE_MS per process; fresh = true skips the cache.
 * null when the table or the row is missing (the migration has not run) or the read fails: every
 * caller then fails closed (no lead taken, nothing started).
 */
export async function readSettings(fresh = false): Promise<FreeVideoSettings | null> {
  if (!fresh && settingsCache && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) return settingsCache.value;
  try {
    const { data, error } = await settingsTable().select('*').eq('id', 1).maybeSingle();
    if (error || !data) {
      if (error) console.error('❌ [free-video] Could not read the settings:', error.message);
      return null;
    }
    const value = asSettings(data);
    settingsCache = { at: Date.now(), value };
    return value;
  } catch (error) {
    console.error('❌ [free-video] Could not read the settings:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Intake helpers (POST /api/free-video)
// ---------------------------------------------------------------------------------------------

/**
 * The visitor's IP: x-real-ip when it is a valid address, else the LAST x-forwarded-for entry (the one
 * our own proxy appended), else null. A request sent straight to :3000 can forge these headers, so the
 * per-IP limit is a soft layer; email and domain uniqueness and the 24 h caps are the hard limits.
 */
export function clientIp(req: Request): string | null {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real && net.isIP(real)) return real;
  const last = req.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return last && net.isIP(last) ? last : null;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** Every POST per IP in the last 24 h (timestamps), this process only. */
const attemptLog = new Map<string, number[]>();

/**
 * Counts one POST from this IP and says whether it may go on (review SEC-1). Every attempt counts, 400
 * answers included, so a visitor (or a script) cannot make the server pre-check site after site:
 * INTAKE.perIpPerMinute a minute and INTAKE.perIpPerDay a day. Per process, which is the one app container.
 */
export function takeAttempt(ip: string): boolean {
  const now = Date.now();
  const recent = (attemptLog.get(ip) ?? []).filter((at) => now - at < DAY_MS);
  const lastMinute = recent.filter((at) => now - at < MINUTE_MS).length;
  const allowed = lastMinute < INTAKE.perIpPerMinute && recent.length < INTAKE.perIpPerDay;
  if (allowed) recent.push(now);
  attemptLog.set(ip, recent);
  if (attemptLog.size > 5000) {
    for (const [key, times] of attemptLog) if (!times.length || now - times[times.length - 1] > DAY_MS) attemptLog.delete(key);
    // A flood of made-up IPs (port 3000 answers directly, so X-Real-IP can be forged) must not grow the map
    // without limit in the process that serves paying users. The daily caps in SQL still bound the spend.
    if (attemptLog.size > 50_000) attemptLog.clear();
  }
  return allowed;
}

/** Website pre-checks running in this process right now (at most INTAKE.precheckSlots, review SEC-1). */
let prechecksRunning = 0;

/** Below this many milliseconds between the form opening and the submit, the sender is a bot. */
export const MIN_FORM_MS = 1500;

/**
 * false for a bot: the honeypot fv_note is filled (no browser autofill knows the name, so a real
 * visitor never fills it), or the form was sent less than 1.5 s after it opened.
 * The time is elapsedMs, measured in the browser on one clock (review F4: comparing the server's clock with
 * the visitor's dropped real people whose computer clock runs fast). An older form's startedAt is only used
 * when elapsedMs is missing, and then a negative span (a clock running ahead) never counts against anyone.
 * This is the seam where Cloudflare Turnstile slots in before Facebook traffic.
 */
export function verifyHuman(body: Pick<FreeVideoLeadInput, 'fv_note' | 'elapsedMs' | 'startedAt'>): boolean {
  if (typeof body.fv_note === 'string' && body.fv_note.length > 0) return false;
  if (typeof body.elapsedMs === 'number') return body.elapsedMs >= MIN_FORM_MS;
  if (typeof body.startedAt === 'number') {
    const span = Date.now() - body.startedAt;
    if (span >= 0 && span < MIN_FORM_MS) return false;
  }
  return true;
}

/** A new view token: 16 random bytes, base64url (22 characters, FREE_VIDEO_TOKEN_PATTERN). */
export const newViewToken = () => randomBytes(16).toString('base64url');

export type CreateLeadStatus = 400 | 409 | 422 | 429 | 503;
export type CreateLeadResult =
  | { ok: true; lead: FreeVideoLead }
  | { ok: false; status: CreateLeadStatus; code: FreeVideoErrorCode; message: string; lead?: FreeVideoLead };

const fail = (status: CreateLeadStatus, code: FreeVideoErrorCode, message: string, lead?: FreeVideoLead): CreateLeadResult => ({
  ok: false,
  status,
  code,
  message,
  ...(lead ? { lead } : {}),
});

/** Columns limits from the migration (website_url <= 600, website_domain <= 253). */
const MAX_URL = 600;
const MAX_DOMAIN = 253;

type InsertOutcome = 'ok' | 'paused' | 'closed' | 'tooMany' | 'duplicateEmail' | 'duplicateSite' | 'duplicate';

/**
 * Stores a lead through create_free_video_lead(): the per-IP, per-address and daily caps are counted and
 * the row inserted under one lock, so parallel submits cannot all pass the counts (review SEC-2).
 */
async function insertLead(row: Record<string, unknown>, emailRows: number = INTAKE.emailRowsPerDay): Promise<{ outcome: InsertOutcome; lead?: FreeVideoLead }> {
  const { data, error } = await (createAdminClient() as any).rpc('create_free_video_lead', {
    p_lead: row,
    p_ip_rows: IP_ROWS_PER_DAY,
    p_email_rows: emailRows,
  });
  if (error) throw new Error(`create_free_video_lead failed: ${error.message}`);
  const answer = (data ?? {}) as { outcome?: InsertOutcome; lead?: Record<string, unknown> };
  return { outcome: answer.outcome ?? 'paused', ...(answer.lead ? { lead: asLead(answer.lead) } : {}) };
}

/**
 * A new lead from the form (or, later, the Facebook lead webhook with ip null). Cheapest checks first:
 * 1. normalizeWebsite → 400 invalid.
 * 2. the settings row → 503 paused (no row) or closed (accepting = false).
 * 3. the caps → 429 tooMany (per IP, per address), and a refused host (marketplace, social network,
 *    Google) is stored as 'rejected' so the email is kept (review F11) → 400 refused.
 * 4. the daily cap → 503 closed; an existing lead for the email key or the domain → 409.
 * 5. the website pre-check (at most INTAKE.precheckSlots at once, else 503 generic) → 400 notFound or
 *    refused; unreadable → a 'rejected' row (the email is captured, both keys stay free) and 422.
 * 6. is_customer: an ACTIVE AI Media Machine subscription (review F1).
 * 7. the insert, through the SQL function; a cap or unique-index race there → 429, 503 or 409.
 * It never throws: a database failure answers 503 paused.
 */
export async function createLead(input: FreeVideoLeadInput, meta: LeadMeta): Promise<CreateLeadResult> {
  // 1. The website.
  const site = normalizeWebsite(input.website);
  if (!site.ok && site.code === 'invalid') return fail(400, 'invalid', site.message);
  const url = site.url;
  const domain = site.domain;
  if (url.length > MAX_URL || domain.length > MAX_DOMAIN) return fail(400, 'invalid', ERRORS.invalid);

  try {
    // 2. Open at all?
    const settings = await readSettings();
    if (!settings) return fail(503, 'paused', ERRORS.paused);
    if (!settings.accepting) return fail(503, 'closed', ERRORS.closed);

    const email = input.email.trim().toLowerCase();
    const emailKey = emailKeyOf(email);
    const since = isoMinutesAgo(24 * 60);
    // The owner testing: no caps (the SQL counts per IP only with an ip), and his earlier finished tests of this
    // address or this site make way. Only leads of an owner address are retired, never a customer's.
    const ownerTest = OWNER_TEST_EMAILS.includes(email);
    if (ownerTest) {
      const retire = { status: 'rejected', reason: 'replaced by a new owner test', updated_at: new Date().toISOString() };
      const ownerKeys = OWNER_TEST_EMAILS.map(emailKeyOf);
      const finished = ['done', 'held', 'failed'];
      const results = await Promise.all([
        leadsTable().update(retire).eq('email_key', emailKey).in('status', finished),
        leadsTable().update(retire).eq('website_domain', domain).in('email_key', ownerKeys).in('status', finished),
      ]);
      const failed = results.find((result: { error: { message: string } | null }) => result.error);
      if (failed) throw new Error(failed.error.message);
    }
    const base = {
      source: meta.source,
      ref: input.ref || (ownerTest ? 'owner-test' : null),
      first_name: input.firstName.trim().slice(0, 60),
      email,
      email_key: emailKey,
      website_domain: domain,
      ip: ownerTest ? null : meta.ip,
      user_agent: meta.userAgent ? meta.userAgent.slice(0, 400) : null,
    };

    // 3 + 4. Caps and duplicates, read in parallel and judged in order (the insert counts again under a lock).
    const count = (query: any) =>
      query.then(({ count: n, error }: { count: number | null; error: { message: string } | null }) => {
        if (error) throw new Error(error.message);
        return n ?? 0;
      });
    const first = (query: any) =>
      query.then(({ data, error }: { data: unknown[] | null; error: { message: string } | null }) => {
        if (error) throw new Error(error.message);
        return Boolean(data?.length);
      });
    const [dailyLeads, ipLive, ipAll, emailRows, emailTaken, siteTaken] = await Promise.all([
      count(leadsTable().select('id', { count: 'exact', head: true }).neq('source', 'test').neq('status', 'rejected').gt('created_at', since)),
      meta.ip ? count(leadsTable().select('id', { count: 'exact', head: true }).eq('ip', meta.ip).neq('status', 'rejected').gt('created_at', since)) : 0,
      meta.ip ? count(leadsTable().select('id', { count: 'exact', head: true }).eq('ip', meta.ip).gt('created_at', since)) : 0,
      count(leadsTable().select('id', { count: 'exact', head: true }).eq('email_key', emailKey).gt('created_at', since)),
      first(leadsTable().select('id').eq('email_key', emailKey).neq('status', 'rejected').limit(1)),
      first(leadsTable().select('id').eq('website_domain', domain).neq('status', 'rejected').limit(1)),
    ]);
    if (!ownerTest && meta.ip && ipAll >= IP_ROWS_PER_DAY) return fail(429, 'tooMany', ERRORS.tooMany);
    if (!ownerTest && emailRows >= INTAKE.emailRowsPerDay) return fail(429, 'tooMany', ERRORS.tooMany);

    // A marketplace or social page: no video ad, but the visitor asked for one, so the email is kept.
    if (!site.ok) {
      const stored = await insertLead({ ...base, website_url: url, view_token: newViewToken(), status: 'rejected', reason: `refused host: ${domain}`, is_customer: false });
      if (stored.outcome === 'tooMany') return fail(429, 'tooMany', ERRORS.tooMany);
      console.log(`⚠️ [free-video] Refused host ${domain}${stored.lead ? `; lead ${stored.lead.id} kept as rejected` : ''}`);
      return fail(400, 'refused', site.message, stored.lead);
    }

    if (!ownerTest && meta.ip && ipLive >= settings.per_ip_daily) return fail(429, 'tooMany', ERRORS.tooMany);
    if (meta.source !== 'test' && dailyLeads >= settings.daily_leads) return fail(503, 'closed', ERRORS.closed);
    if (emailTaken) return fail(409, 'duplicateEmail', ERRORS.duplicateEmail);
    if (siteTaken) return fail(409, 'duplicateSite', ERRORS.duplicateSite(displayDomain(domain)));

    // 5 + 6. The website pre-check (one light GET through safeFetch) and the customer check, in parallel.
    if (prechecksRunning >= INTAKE.precheckSlots) return fail(503, 'generic', ERRORS.generic);
    prechecksRunning++;
    let precheck: Awaited<ReturnType<typeof precheckSite>>;
    let isCustomer: boolean;
    try {
      [precheck, isCustomer] = await Promise.all([precheckSite(url, domain, site.schemeTyped), isExistingCustomer(email)]);
    } finally {
      prechecksRunning--;
    }
    if (!precheck.ok && precheck.code !== 'unreadable') return fail(400, precheck.code, precheck.message);

    // 7. The insert.
    const stored = await insertLead({
      ...base,
      website_url: precheck.ok ? precheck.url : url,
      view_token: newViewToken(),
      status: precheck.ok ? 'queued' : 'rejected',
      reason: precheck.ok ? null : `${UNREADABLE}the pre-check could not read ${domain}`,
      // The owner tests what a visitor sees, not the customer view.
      is_customer: ownerTest ? false : isCustomer,
    }, ownerTest ? 1000 : INTAKE.emailRowsPerDay);
    switch (stored.outcome) {
      case 'ok':
        break;
      case 'closed':
        return fail(503, 'closed', ERRORS.closed);
      case 'tooMany':
        return fail(429, 'tooMany', ERRORS.tooMany);
      case 'duplicateEmail':
        return fail(409, 'duplicateEmail', ERRORS.duplicateEmail);
      case 'duplicateSite':
        return fail(409, 'duplicateSite', ERRORS.duplicateSite(displayDomain(domain)));
      case 'duplicate':
        return fail(503, 'generic', ERRORS.generic);
      default:
        return fail(503, 'paused', ERRORS.paused);
    }
    const lead = stored.lead;
    if (!lead) return fail(503, 'paused', ERRORS.paused);
    if (!precheck.ok) {
      console.log(`⚠️ [free-video] ${domain} is not readable; lead ${lead.id} saved as rejected`);
      return fail(422, 'unreadable', precheck.message, lead);
    }
    console.log(`✅ [free-video] Lead ${lead.id} queued for ${domain} (${meta.source}${base.ref ? `, ref ${base.ref}` : ''})`);
    return { ok: true, lead };
  } catch (error) {
    console.error('❌ [free-video] createLead failed:', error);
    return fail(503, 'paused', ERRORS.paused);
  }
}

/** The accounts (profile ids) of this email, case-insensitive, suspended accounts left out. Throws on a failed read. */
async function profileIdsByEmail(email: string): Promise<string[]> {
  const profiles = (createAdminClient() as any).from('profiles').select('id, is_suspended').limit(5);
  // ilike with LIKE's own wildcards escaped; PostgREST also reads '*' as a wildcard, so such an address uses eq.
  const query = email.includes('*') ? profiles.eq('email', email) : profiles.ilike('email', email.replace(/[\\%_]/g, (c: string) => `\\${c}`));
  const { data, error } = await query;
  if (error) throw new Error(`profiles: ${error.message}`);
  return ((data ?? []) as { id: string; is_suspended?: boolean | null }[]).filter((p) => !p.is_suspended).map((p) => p.id);
}

/** Of these accounts, the ones with an ACTIVE plan: lifetime, or a period that has not ended. Throws on a failed read. */
async function withActivePlan(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const { data, error } = await (createAdminClient() as any)
    .from('user_subscriptions')
    .select('user_id, plan_type, current_period_end')
    .in('user_id', userIds)
    .eq('status', 'active')
    .limit(10);
  if (error) throw new Error(`user_subscriptions: ${error.message}`);
  return ((data ?? []) as { user_id: string; plan_type: string; current_period_end: string | null }[])
    .filter((sub) => sub.plan_type === 'lifetime' || !sub.current_period_end || Date.parse(sub.current_period_end) > Date.now())
    .map((sub) => sub.user_id);
}

/**
 * True when this email belongs to an ACTIVE AI Media Machine customer (review F1): a profile with this
 * email (case-insensitive) that is not suspended and has an 'active' subscription (lifetime, or a period
 * that has not ended). Cancelled trials, lapsed subscribers and free accounts are not customers: they get
 * the normal offer and all 3 emails. A failed read counts as false.
 */
async function isExistingCustomer(email: string): Promise<boolean> {
  try {
    return (await withActivePlan(await profileIdsByEmail(email))).length > 0;
  } catch (error) {
    console.warn('⚠️ [free-video] Customer check failed, treating as a new visitor:', String(error).slice(0, 160));
    return false;
  }
}

/** The AI Media Machine account of this email with an active plan (the buyer of a free video ad), or null. Throws on a failed read. */
export async function customerIdByEmail(email: string): Promise<string | null> {
  return (await withActivePlan(await profileIdsByEmail(email.trim().toLowerCase())))[0] ?? null;
}

/** True when this signed-in account has an active plan (not suspended). A failed read counts as false. */
export async function isActiveCustomerId(userId: string): Promise<boolean> {
  try {
    const { data, error } = await (createAdminClient() as any).from('profiles').select('id, is_suspended, role, username').eq('id', userId).maybeSingle();
    if (error || !data || data.is_suspended) return false;
    // An admin uses every tool without a plan (admin-auth.ts). The owner's account only has an old starter row that
    // ended in 2025, so "Open this video ad in your account" sent him to the sales page (2026-10-07).
    if (data.role === 'admin' || data.username === 'admin') return true;
    return (await withActivePlan([userId])).length > 0;
  } catch (error) {
    console.warn('⚠️ [free-video] Customer check failed:', String(error).slice(0, 160));
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Reading and moving leads
// ---------------------------------------------------------------------------------------------

/** The lead behind a view token. The token is checked before any query runs. Throws on a database error. */
export async function getLeadByToken(token: string): Promise<FreeVideoLead | null> {
  if (typeof token !== 'string' || !FREE_VIDEO_TOKEN_PATTERN.test(token)) return null;
  const { data, error } = await leadsTable().select('*').eq('view_token', token).maybeSingle();
  if (error) throw new Error(`Could not read the lead: ${error.message}`);
  return data ? asLead(data) : null;
}

/** The lead with this id. Throws on a database error. */
export async function getLead(id: string): Promise<FreeVideoLead | null> {
  if (typeof id !== 'string' || !UUID.test(id)) return null;
  const { data, error } = await leadsTable().select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not read the lead: ${error.message}`);
  return data ? asLead(data) : null;
}

/**
 * The ONLY way a lead's status changes: update(patch + updated_at) where id matches, the status is one
 * of guard.from, and (when given) job_id is guard.jobId. True only when a row changed. A database error
 * is logged and counts as "nothing changed": the lead stays where it was and the next sweep tries again.
 */
export async function transitionLead(
  id: string,
  guard: { from: FreeVideoLeadStatus[]; jobId?: string | null },
  patch: FreeVideoLeadPatch
): Promise<boolean> {
  try {
    let query = leadsTable()
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', guard.from);
    if (guard.jobId) query = query.eq('job_id', guard.jobId);
    const { data, error } = await query.select('id');
    if (error) {
      console.error(`❌ [free-video] Lead ${id} update failed:`, error.message);
      return false;
    }
    return Boolean(data?.length);
  } catch (error) {
    console.error(`❌ [free-video] Lead ${id} update failed:`, error);
    return false;
  }
}

/**
 * The ONLY way a lead's unlock status changes (the $99 clean version): a guarded update where the unlock
 * status is one of guard.from and, when given, clean_attempts and clean_claimed_at are still as read.
 * Returns the updated row, or null when nothing changed. Throws on a database error when `strict` (the
 * payment webhook must fail loudly so FastSpring retries); otherwise logs and returns null.
 */
export async function transitionUnlock(
  id: string,
  guard: { from: FreeVideoUnlockStatus[]; cleanAttempts?: number; cleanClaimedAt?: string | null; strict?: boolean },
  patch: FreeVideoLeadPatch
): Promise<FreeVideoLead | null> {
  let query = leadsTable()
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('unlock_status', guard.from);
  if (guard.cleanAttempts !== undefined) query = query.eq('clean_attempts', guard.cleanAttempts);
  if (guard.cleanClaimedAt !== undefined) query = guard.cleanClaimedAt === null ? query.is('clean_claimed_at', null) : query.eq('clean_claimed_at', guard.cleanClaimedAt);
  const { data, error } = await query.select('*');
  if (error) {
    if (guard.strict) throw Object.assign(new Error(`Unlock update of lead ${id} failed: ${error.message}`), { code: error.code });
    console.error(`❌ [free-video] Unlock update of lead ${id} failed:`, error.message);
    return null;
  }
  return data?.length ? asLead(data[0]) : null;
}

/** How many queued video ads of the same kind (test or real) were created before this one (0 = next in line). */
export async function queuePosition(lead: Pick<FreeVideoLead, 'created_at' | 'source'>): Promise<number> {
  let query = leadsTable().select('id', { count: 'exact', head: true }).eq('status', 'queued').lt('created_at', lead.created_at);
  query = lead.source === 'test' ? query.eq('source', 'test') : query.neq('source', 'test');
  const { count, error } = await query;
  if (error) console.warn('⚠️ [free-video] Queue position read failed:', error.message);
  return count ?? 0;
}

/** How many leads of the same kind are being made right now. */
async function runningCount(test: boolean): Promise<number> {
  let query = leadsTable().select('id', { count: 'exact', head: true }).eq('status', 'running');
  query = test ? query.eq('source', 'test') : query.neq('source', 'test');
  const { count, error } = await query;
  if (error) console.warn('⚠️ [free-video] Running count read failed:', error.message);
  return count ?? 0;
}

/** Starts and spend of the rolling 24 h window, counted exactly like the claim function. Cached 30 s per process and kind. */
const usageCache = new Map<boolean, { at: number; started: number; spent: number }>();
export async function rollingUsage(test: boolean): Promise<{ started: number; spent: number } | null> {
  const cached = usageCache.get(test);
  if (cached && Date.now() - cached.at < 30_000) return cached;
  let query = leadsTable().select('attempts, est_cost_usd, reserved_usd').gt('claimed_at', isoMinutesAgo(24 * 60)).limit(5000);
  query = test ? query.eq('source', 'test') : query.neq('source', 'test');
  const { data, error } = await query;
  if (error) {
    console.warn('⚠️ [free-video] 24 h usage read failed:', error.message);
    return null;
  }
  const rows = (data ?? []) as { attempts: number | string; est_cost_usd: number | string; reserved_usd: number | string }[];
  const value = {
    at: Date.now(),
    started: rows.reduce((sum, row) => sum + numberOr(row.attempts, 1), 0),
    spent: rows.reduce((sum, row) => sum + numberOr(row.est_cost_usd, 0) + numberOr(row.reserved_usd, 0), 0),
  };
  usageCache.set(test, value);
  return value;
}

/** The free file's name when downloaded, and the clean one's. */
const downloadLink = (fileUrl: string, name: string) => `${fileUrl}?download=${encodeURIComponent(name)}`;

/**
 * Offer 1 on the status page, from the lead row alone.
 * paid / rendering / ready / failed follow the unlock status (ready carries the clean file). Otherwise:
 * 'available' with the checkout link once the video ad is ready (for UNLOCK_DAYS), 'unavailable' with the link while it is
 * still on its way, and 'unavailable' without a link when no video ad will come (unreadable or failed).
 * A refunded unlock is offered again like a new one.
 */
export function unlockViewOf(lead: FreeVideoLead): FreeVideoUnlockView {
  switch (lead.unlock_status) {
    case 'paid':
      return { state: 'paid' };
    case 'rendering':
      return { state: 'rendering' };
    case 'ready':
      return lead.clean_video_url
        ? {
            state: 'ready',
            cleanVideoUrl: lead.clean_video_url,
            cleanDownloadUrl: downloadLink(lead.clean_video_url, `${displayDomain(lead.website_domain)}-video-ad.mp4`),
          }
        : { state: 'rendering' };
    case 'failed':
      return { state: 'failed' };
    default:
      // The clean version is rendered from working files that go after FILES_KEEP_DAYS (cleanup.ts): the offer closes first.
      if (lead.status === 'done' && lead.video_url) return unlockOpen(lead) ? { state: 'available', checkoutPath: unlockGoUrl(lead.view_token) } : { state: 'unavailable' };
      if (lead.status === 'rejected' || lead.status === 'failed') return { state: 'unavailable' };
      return { state: 'unavailable', checkoutPath: unlockGoUrl(lead.view_token) };
  }
}

/**
 * What the status page may know about a lead. It never carries the email, ip, reason, gate or cost.
 * queued → position and ETA (null with etaNote 'paused' while starting = false, or 'capped' when the
 * rolling 24 h cap will not reach this lead: review F5); running → the job's step and render %;
 * done → the video; held → checking; failed → failed; rejected → unreadable. unlock = Offer 1.
 */
export async function toView(lead: FreeVideoLead, settings: FreeVideoSettings | null): Promise<FreeVideoView> {
  // A lead whose email bought the AI Media Machine since (bought_at) counts as a customer: its video ad goes into the account.
  const base = { firstName: lead.first_name, domain: displayDomain(lead.website_domain), isCustomer: lead.is_customer || Boolean(lead.bought_at), unlock: unlockViewOf(lead) };
  switch (lead.status) {
    case 'queued': {
      const position = await queuePosition(lead);
      if (!settings?.starting) return { ...base, state: 'queued', position, etaMinutes: null, etaNote: 'paused' };
      const usage = await rollingUsage(lead.source === 'test');
      const left = usage
        ? Math.min(settings.daily_starts - usage.started, Math.floor((settings.daily_usd - usage.spent) / Math.max(0.01, settings.est_usd)))
        : Infinity;
      if (position >= left) return { ...base, state: 'queued', position, etaMinutes: null, etaNote: 'capped' };
      // The leads ahead in the queue plus the ones being made now (2026-10-06: "next in line" on an idle queue said 16 minutes).
      const ahead = position + (await runningCount(lead.source === 'test'));
      const etaMinutes = Math.ceil((ahead + 1) / Math.max(1, settings.max_running)) * JOB_MINUTES;
      return { ...base, state: 'queued', position, etaMinutes };
    }
    case 'running': {
      let job: SmartVideoJob | null = null;
      if (lead.job_id) {
        const { data, error } = await jobsTable().select('job').eq('id', lead.job_id).maybeSingle();
        if (error) console.warn('⚠️ [free-video] Job read for the status page failed:', error.message);
        job = (data?.job as SmartVideoJob | undefined) ?? null;
      }
      return {
        ...base,
        state: 'making',
        step: job?.status ?? 'reading',
        ...(job?.status === 'rendering' ? { progress: job.renderProgress ?? 0 } : {}),
        ...(lead.photos?.length ? { photos: lead.photos } : {}),
        ...(job?.script?.length ? { script: job.script.map((scene) => scene.say) } : {}),
        ...(lead.live ? { live: lead.live } : {}),
      };
    }
    case 'done': {
      const until = editableUntil(lead);
      return lead.video_url
        ? {
            ...base,
            state: 'ready',
            videoUrl: lead.video_url,
            downloadUrl: downloadLink(lead.video_url, `${displayDomain(lead.website_domain)}-video-ad-free.mp4`),
            ...(until ? { editableUntil: until } : {}),
          }
        : { ...base, state: 'checking' };
    }
    case 'held':
      return { ...base, state: 'checking', ...(lead.live ? { live: lead.live } : {}) };
    case 'failed':
      return { ...base, state: 'failed' };
    case 'rejected':
    default:
      return { ...base, state: 'unreadable' };
  }
}

/** The first visit of /v/<token> (the email click-through metric). Never throws. */
export async function markViewed(lead: Pick<FreeVideoLead, 'id' | 'first_viewed_at'>): Promise<void> {
  if (lead.first_viewed_at) return;
  try {
    const { error } = await leadsTable().update({ first_viewed_at: new Date().toISOString() }).eq('id', lead.id).is('first_viewed_at', null);
    if (error) console.warn('⚠️ [free-video] markViewed failed:', error.message);
  } catch (error) {
    console.warn('⚠️ [free-video] markViewed failed:', String(error).slice(0, 160));
  }
}

/** P1: one free_video_events row. Never throws. */
export async function recordEvent(event: {
  event: FreeVideoServerEvent;
  leadId?: string | null;
  visitorId?: string | null;
  placement?: string | null;
  ref?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const { error } = await eventsTable().insert({
      event: event.event,
      lead_id: event.leadId ?? null,
      visitor_id: event.visitorId ?? null,
      placement: event.placement ?? null,
      ref: event.ref ?? null,
      meta: event.meta ?? null,
    });
    if (error) console.warn(`⚠️ [free-video] Event ${event.event} not saved:`, error.message);
  } catch (error) {
    console.warn(`⚠️ [free-video] Event ${event.event} not saved:`, String(error).slice(0, 160));
  }
}

/**
 * /go/<placement>?t=<token>: a 'cta_click' event on the lead, plus clicked_at (set once) for the lifetime
 * offer's placements. The $99 unlock's clicks ('fvunlock') are events only, so clicked_at stays the
 * lifetime offer's metric. Never throws.
 */
export async function markClicked(token: string, placement: string): Promise<void> {
  try {
    const lead = await getLeadByToken(token);
    if (!lead) return;
    if (isPlacement(placement) && !lead.clicked_at) {
      const { error } = await leadsTable().update({ clicked_at: new Date().toISOString() }).eq('id', lead.id).is('clicked_at', null);
      if (error) console.warn('⚠️ [free-video] clicked_at not saved:', error.message);
    }
    await recordEvent({ event: 'cta_click', leadId: lead.id, placement, ref: lead.ref });
  } catch (error) {
    console.warn('⚠️ [free-video] markClicked failed:', String(error).slice(0, 160));
  }
}

/** P1: the first play of the video ad (played_at, set once). Never throws. */
export async function markPlayed(leadId: string): Promise<void> {
  try {
    const { error } = await leadsTable().update({ played_at: new Date().toISOString() }).eq('id', leadId).is('played_at', null);
    if (error) console.warn('⚠️ [free-video] played_at not saved:', error.message);
  } catch (error) {
    console.warn('⚠️ [free-video] markPlayed failed:', String(error).slice(0, 160));
  }
}
