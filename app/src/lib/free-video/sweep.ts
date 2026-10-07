/**
 * Free video ad funnel: the sweep the cron runs every 3 minutes (GET /api/cron/free-video), and the
 * watchdog that notices when the cron itself stops.
 *
 * The sweep settles running leads (deploy kills included), retries emails, keeps the $99 clean renders
 * moving, attributes sales (P1), trips the circuit breaker, and sends the owner one batched, deduped
 * alert. Its report is the live dashboard. The live server handles only real leads and any other server
 * only source='test' ones, the same split the claim function makes, so neither ever settles or emails the
 * other's leads.
 *
 * Server only. NEVER re-export anything from here in a server-action file.
 */

import { createAdminClient } from '@/app/supabase/server';
import { alertOwner, type AlertItem, unsentAlerts } from '@/lib/free-video/alerts';
import {
  BREAKER,
  CLEAN_RENDER,
  claimsTestLeads,
  EMAIL_MAX_ATTEMPTS,
  EMAIL_RECLAIM_MINUTES,
  isLive,
  ML_GROUP_READY,
  ML_GROUP_UNLOCKED,
  staleMinutes,
  STUCK_QUEUE_MINUTES,
  SWEEP_BATCH,
  UNLOCK_EMAIL,
  UNREADABLE,
  WATCHDOG_MINUTES,
} from '@/lib/free-video/config';
import { isoMinutesAgo, leadsTable, readSettings, settingsTable } from '@/lib/free-video/leads';
import { addToBoughtGroup, deliverLead, deliverUnlock, viewUrl } from '@/lib/free-video/notify';
import { type SettleOutcome, settleLead } from '@/lib/free-video/runner';
import { cleanRendersRunning, startCleanRender } from '@/lib/free-video/unlock';
import { claimBoughtLeads } from '@/lib/free-video/claim';
import { cleanWorkingFiles } from '@/lib/free-video/cleanup';
import { displayDomain } from '@/lib/free-video/website';
import { jobsTable } from '@/lib/smart-video/jobs';
import type { FreeVideoGateResult, FreeVideoSettings } from '@/types/free-video';

export interface SweepReport {
  dry: boolean;
  /** True on the live server (a production build serving app.bluefx.net): only then are real leads handled. */
  live: boolean;
  /** settings.starting; null when the settings row cannot be read. */
  starting: boolean | null;
  /** Leads running after this sweep. */
  running: number;
  /** Leads this sweep moved, and where to. */
  settled: number;
  requeued: number;
  held: number;
  failed: number;
  rejected: number;
  done: number;
  /** Emails this sweep handed to MailerLite (sent or page-only), and email attempts that failed. */
  delivered: number;
  emailFailed: number;
  /** Queued leads, and how long the oldest one that may start now has waited. */
  queued: number;
  oldestQueuedMin: number | null;
  /** Rolling 24 h, counted exactly like the claim function: attempts (retries included) and spend of this server's kind of lead. */
  started24h: number;
  spent24hUsd: number;
  capReached: boolean;
  /** Paying users' Phantom jobs working now (free starts wait at paid_busy_limit, Clone Studio runs count there too). */
  paidBusy: number | null;
  /** The $99 unlock: paid and waiting for a render, rendering, renders started by this sweep, clean emails retried. */
  unlock: { waiting: number; rendering: number; started: number; emailed: number };
  /** P1: leads newly marked as bought. */
  bought: number;
  /** Bought leads whose video ad this sweep started copying into the buyer's account (claim.ts). */
  claimed: number;
  /** Once an hour: free video ads whose working files this sweep deleted (cleanup.ts); null in the other sweeps. */
  cleaned: { leads: number; files: number } | null;
  breaker: { bad: number; finished: number; tripped: boolean };
  alertsNew: number;
  alertsUnsent: number | null;
}

type Query = any;

/** The live server sweeps real leads, any other server only its own test leads. */
const own = (query: Query): Query => (claimsTestLeads() ? query.eq('source', 'test') : query.neq('source', 'test'));

const rows = async <T>(query: Query, what: string): Promise<T[]> => {
  const { data, error } = await query;
  if (error) {
    console.error(`❌ [free-video] Sweep: ${what} not read:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
};

const counted = async (query: Query, what: string): Promise<number | null> => {
  const { count, error } = await query;
  if (error) {
    console.error(`❌ [free-video] Sweep: ${what} not counted:`, error.message);
    return null;
  }
  return count ?? 0;
};

/** UTC keys for the alert dedupe: '2026-10-05' and '2026-10-05-14'. */
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const hourKey = (d = new Date()) => d.toISOString().slice(0, 13).replace('T', '-');
const twoHourKey = (d = new Date()) => `${dayKey(d)}-${String(Math.floor(d.getUTCHours() / 2) * 2).padStart(2, '0')}`;

const RELEASE_SQL = (id: string) => `update free_video_leads set status = 'done', email_status = 'pending', updated_at = now() where id = '${id}' and status = 'held';`;
const RERUN_SQL = (id: string) =>
  `update free_video_leads set status = 'queued', attempts = 0, reason = null, not_before = null, updated_at = now() where id = '${id}' and status in ('held','failed');`;
const RERENDER_SQL = (id: string) =>
  `update free_video_leads set unlock_status = 'paid', clean_attempts = 0, updated_at = now() where id = '${id}' and unlock_status = 'failed';`;

function emptyReport(dry: boolean): SweepReport {
  return {
    dry,
    live: isLive(),
    starting: null,
    running: 0,
    settled: 0,
    requeued: 0,
    held: 0,
    failed: 0,
    rejected: 0,
    done: 0,
    delivered: 0,
    emailFailed: 0,
    queued: 0,
    oldestQueuedMin: null,
    started24h: 0,
    spent24hUsd: 0,
    capReached: false,
    paidBusy: null,
    unlock: { waiting: 0, rendering: 0, started: 0, emailed: 0 },
    bought: 0,
    claimed: 0,
    cleaned: null,
    breaker: { bad: 0, finished: 0, tripped: false },
    alertsNew: 0,
    alertsUnsent: null,
  };
}

/**
 * One sweep. dry = read and report only: no writes, no starts, no emails.
 * 1. settings.last_sweep_at = now (the watchdog reads it).
 * 2. settleLead for every running lead (SWEEP_BATCH at most).
 * 3. deliverLead for every done lead still owed its email (pending, failed, or 'sending' for 5 min).
 * 4. The $99 unlock: clean renders for paid leads whose video ad is done and for renders whose claim went
 *    stale (in the background, at most CLEAN_RENDER.maxParallel at once), and the clean email retried.
 * 5. P1: sales from webhook_events → bought_at and the Bought group, then a copy of each bought video ad in the
 *    buyer's AI Media Machine account (claim.ts); once an hour (the sweep at minute 0 to 2) the working files of
 *    free video ads FILES_KEEP_DAYS old whose clean version nobody bought (cleanup.ts).
 * 6. The circuit breaker.
 * 7. One batched alert: breaker, held, failed, rejected during the job, email, unlock, stuck, cap; plus any
 *    earlier alert that could not be sent.
 */
export async function sweepFreeVideos({ dry }: { dry: boolean }): Promise<SweepReport> {
  const report = emptyReport(dry);
  const settings = await readSettings(true);
  if (!settings) return report;
  report.starting = settings.starting;

  // 1. Only the live server: a local sweep must not hide a dead live cron from the watchdog.
  if (!dry && isLive()) {
    const { error } = await settingsTable().update({ last_sweep_at: new Date().toISOString() }).eq('id', 1);
    if (error) console.error('❌ [free-video] Sweep: last_sweep_at not saved:', error.message);
  }

  // 2. Running leads.
  const running = await rows<{ id: string }>(
    own(leadsTable().select('id').eq('status', 'running')).order('claimed_at', { ascending: true }).limit(SWEEP_BATCH),
    'running leads'
  );
  if (!dry) {
    for (const { id } of running) {
      const outcome: SettleOutcome = await settleLead(id).catch((error) => {
        console.error(`❌ [free-video] Sweep: settling lead ${id} failed:`, error);
        return 'none' as const;
      });
      if (outcome === 'none' || outcome === 'running') continue;
      report.settled++;
      if (outcome === 'queued') report.requeued++;
      else if (outcome === 'held') report.held++;
      else if (outcome === 'failed') report.failed++;
      else if (outcome === 'rejected') report.rejected++;
      else if (outcome === 'done') report.done++;
    }
  }

  // 3. Emails still owed.
  const reclaimBefore = Date.now() - EMAIL_RECLAIM_MINUTES * 60_000;
  const owed = (
    await rows<{ id: string; email_status: string; email_claimed_at: string | null }>(
      own(
        leadsTable()
          .select('id, email_status, email_claimed_at')
          .eq('status', 'done')
          .is('emailed_at', null)
          .lt('email_attempts', EMAIL_MAX_ATTEMPTS)
          .in('email_status', ['pending', 'failed', 'sending'])
      )
        .order('finished_at', { ascending: true })
        .limit(SWEEP_BATCH * 2),
      'leads owed an email'
    )
  )
    .filter((lead) => lead.email_status !== 'sending' || !lead.email_claimed_at || Date.parse(lead.email_claimed_at) < reclaimBefore)
    .slice(0, SWEEP_BATCH);
  if (!dry) {
    for (const { id } of owed) {
      const result = await deliverLead(id);
      if (result === 'sent' || result === 'inactive') report.delivered++;
      else if (result === 'failed') report.emailFailed++;
    }
  }

  // 4. The $99 unlock.
  const unlockOwed = await sweepUnlocks(dry, report);

  // 5. P1: sales; once an hour, the old working files.
  if (!dry) report.bought = await attributeSales();
  if (!dry) report.claimed = await claimBoughtLeads(own);
  if (!dry && new Date().getUTCMinutes() < 3) report.cleaned = await cleanWorkingFiles(own, settings.system_user_id);

  // Numbers for the report, the cap alert and the breaker.
  const since24h = isoMinutesAgo(24 * 60);
  const [runningNow, queuedCount, queuedOldest, claimed24h, paidBusy] = await Promise.all([
    counted(own(leadsTable().select('id', { count: 'exact', head: true }).eq('status', 'running')), 'running leads'),
    counted(own(leadsTable().select('id', { count: 'exact', head: true }).eq('status', 'queued')), 'queued leads'),
    rows<{ created_at: string; not_before: string | null }>(
      own(leadsTable().select('created_at, not_before').eq('status', 'queued')).order('created_at', { ascending: true }).limit(200),
      'the queue'
    ),
    // Exactly like the claim function's caps: this server's kind of lead, every attempt counted (review F6).
    rows<{ attempts: number | string; est_cost_usd: number | string; reserved_usd: number | string }>(
      own(leadsTable().select('attempts, est_cost_usd, reserved_usd').gt('claimed_at', since24h)).limit(5000),
      '24 h starts'
    ),
    settings.system_user_id
      ? counted(
          jobsTable()
            .select('id', { count: 'exact', head: true })
            .neq('user_id', settings.system_user_id)
            .not('status', 'in', '(done,failed)')
            .gt('updated_at', isoMinutesAgo(staleMinutes()))
            .gt('created_at', isoMinutesAgo(120)),
          'paying Phantom jobs'
        )
      : Promise.resolve(null),
  ]);
  report.running = runningNow ?? running.length;
  report.queued = queuedCount ?? queuedOldest.length;
  const now = Date.now();
  const eligible = queuedOldest.find((lead) => !lead.not_before || Date.parse(lead.not_before) <= now);
  report.oldestQueuedMin = eligible ? Math.round((now - Date.parse(eligible.created_at)) / 60_000) : null;
  report.started24h = claimed24h.reduce((sum, lead) => sum + (Number(lead.attempts) || 1), 0);
  report.spent24hUsd = Math.round(claimed24h.reduce((sum, lead) => sum + (Number(lead.est_cost_usd) || 0) + (Number(lead.reserved_usd) || 0), 0) * 100) / 100;
  report.capReached = report.started24h >= settings.daily_starts || report.spent24hUsd + settings.est_usd > settings.daily_usd;
  report.paidBusy = paidBusy;

  // 6. The circuit breaker.
  report.breaker = await circuitBreaker(settings, dry);

  // 7. Alerts (also when there is nothing new: earlier alerts that could not be sent go out now).
  if (!dry) {
    const { items, subject } = await collectAlerts(settings, report, owed.length, unlockOwed);
    report.alertsNew = await alertOwner(items, subject);
  }
  report.alertsUnsent = await unsentAlerts();
  return report;
}

/**
 * The $99 unlock's share of the sweep. Paid leads whose video ad is done, and renders whose claim went
 * stale (CLEAN_RENDER.staleMinutes), get a clean render in the background: the cron answers long before a
 * render ends, and the guarded claim inside renderCleanVersion keeps two sweeps from rendering one lead
 * twice. Clean emails that did not go out are retried for UNLOCK_EMAIL.retryHours. Returns how many clean
 * emails are owed (for the setup alert).
 */
async function sweepUnlocks(dry: boolean, report: SweepReport): Promise<number> {
  const staleBefore = isoMinutesAgo(CLEAN_RENDER.staleMinutes);
  const [paid, rendering, stale, emails] = await Promise.all([
    rows<{ id: string }>(own(leadsTable().select('id').eq('unlock_status', 'paid').eq('status', 'done')).order('unlocked_at', { ascending: true }).limit(SWEEP_BATCH), 'paid unlocks'),
    counted(own(leadsTable().select('id', { count: 'exact', head: true }).eq('unlock_status', 'rendering')), 'clean renders'),
    rows<{ id: string }>(
      own(leadsTable().select('id').eq('unlock_status', 'rendering').eq('status', 'done').lt('clean_claimed_at', staleBefore)).limit(SWEEP_BATCH),
      'stale clean renders'
    ),
    rows<{ id: string }>(
      own(leadsTable().select('id').eq('unlock_status', 'ready').is('unlock_emailed_at', null).gt('clean_ready_at', isoMinutesAgo(UNLOCK_EMAIL.retryHours * 60))).limit(SWEEP_BATCH),
      'clean videos owed an email'
    ),
  ]);
  report.unlock.waiting = paid.length;
  report.unlock.rendering = rendering ?? 0;
  if (dry) return emails.length;

  let room = CLEAN_RENDER.maxParallel - cleanRendersRunning();
  for (const { id } of [...paid, ...stale]) {
    if (room <= 0) break;
    startCleanRender(id, true);
    room--;
    report.unlock.started++;
  }
  for (const { id } of emails) {
    const result = await deliverUnlock(id);
    if (result === 'sent' || result === 'inactive') report.unlock.emailed++;
  }
  return emails.length;
}

/**
 * Over the last 2 h (or since the owner last changed the settings, whichever is later, so turning
 * starting back on gives a fresh window): bad = leads held by the gate + failed leads. At least
 * BREAKER.minBad bad results that are at least half of everything finished → starting = false.
 */
async function circuitBreaker(settings: FreeVideoSettings, dry: boolean): Promise<SweepReport['breaker']> {
  const windowStart = Math.max(Date.now() - BREAKER.windowHours * 3600_000, Date.parse(settings.updated_at) || 0);
  const finished = await rows<{ status: string; gate: FreeVideoGateResult | null }>(
    own(leadsTable().select('status, gate').in('status', ['done', 'held', 'failed']).gt('finished_at', new Date(windowStart).toISOString())).limit(1000),
    'finished leads'
  );
  const bad = finished.filter((lead) => lead.status === 'failed' || (lead.status === 'held' && lead.gate?.pass === false)).length;
  const result = { bad, finished: finished.length, tripped: false };
  // Only the live server pauses the funnel: the settings row is shared, and local tests fake failures on purpose.
  if (dry || !isLive() || !settings.starting || bad < BREAKER.minBad || bad < BREAKER.minShare * finished.length) return result;

  const { data, error } = await settingsTable().update({ starting: false, updated_at: new Date().toISOString() }).eq('id', 1).eq('starting', true).select('id');
  if (error) {
    console.error('❌ [free-video] The circuit breaker could not pause the funnel:', error.message);
    return result;
  }
  result.tripped = Boolean(data?.length);
  if (result.tripped) console.error(`❌ [free-video] Circuit breaker: ${bad} of ${finished.length} recent video ads were held or failed, new starts paused`);
  return result;
}

interface AlertLead {
  id: string;
  first_name: string;
  email: string;
  website_domain: string;
  view_token: string;
  status: string;
  reason: string | null;
  video_url: string | null;
  attempts: number;
  job_id: string | null;
  email_status: string;
  email_attempts: number;
  ml_status: string | null;
  unlock_status: string;
  unlock_order_id: string | null;
  clean_attempts: number;
  clean_ready_at: string | null;
}

/** Every alert this sweep may raise (alertOwner keeps only the new keys). Keys carry the attempt, so a rerun that is held or fails again alerts again (review F2). */
async function collectAlerts(
  settings: FreeVideoSettings,
  report: SweepReport,
  owedEmails: number,
  owedUnlockEmails: number
): Promise<{ items: AlertItem[]; subject: string }> {
  const items: AlertItem[] = [];
  const counts: Record<string, number> = {};
  const add = (kind: string, key: string, line: string) => {
    items.push({ key, line });
    counts[kind] = (counts[kind] ?? 0) + 1;
  };

  if (report.breaker.tripped) {
    // Keyed by the settings change that opened the window: restarting the funnel opens a new one, so a second trip alerts too.
    add(
      'breaker',
      `breaker:${settings.updated_at}`,
      `Circuit breaker: ${report.breaker.bad} of ${report.breaker.finished} recent video ads were held or failed, so new starts are paused (starting = false). Read the held reasons below, fix the cause, then start again with: update free_video_settings set starting = true, updated_at = now() where id = 1;`
    );
  }

  const columns =
    'id, first_name, email, website_domain, view_token, status, reason, video_url, attempts, job_id, email_status, email_attempts, ml_status, unlock_status, unlock_order_id, clean_attempts, clean_ready_at';
  const week = isoMinutesAgo(7 * 24 * 60);
  const [held, failed, rejected, email, unlockFailed, unlockEmail] = await Promise.all([
    rows<AlertLead>(own(leadsTable().select(columns).eq('status', 'held').gt('updated_at', week)).order('updated_at', { ascending: true }).limit(50), 'held leads'),
    rows<AlertLead>(own(leadsTable().select(columns).eq('status', 'failed').gt('updated_at', week)).order('updated_at', { ascending: true }).limit(50), 'failed leads'),
    // Rejected by the job (attempts > 0), not at the form: the visitor was told to close the page and wait (review F3).
    rows<AlertLead>(
      own(leadsTable().select(columns).eq('status', 'rejected').gt('attempts', 0).like('reason', `${UNREADABLE}%`).gt('updated_at', week))
        .order('updated_at', { ascending: true })
        .limit(50),
      'leads rejected during the job'
    ),
    rows<AlertLead>(
      own(leadsTable().select(columns).eq('status', 'done').is('emailed_at', null).in('email_status', ['inactive', 'failed', 'sending']).gt('updated_at', week))
        .order('updated_at', { ascending: true })
        .limit(50),
      'email problems'
    ),
    rows<AlertLead>(own(leadsTable().select(columns).eq('unlock_status', 'failed').gt('updated_at', week)).limit(50), 'failed clean renders'),
    rows<AlertLead>(
      own(leadsTable().select(columns).eq('unlock_status', 'ready').is('unlock_emailed_at', null).lt('clean_ready_at', isoMinutesAgo(UNLOCK_EMAIL.alertAfterMinutes)).gt('clean_ready_at', week)).limit(50),
      'clean videos not emailed'
    ),
  ]);
  const who = (lead: AlertLead) => `${lead.first_name} <${lead.email}>, ${displayDomain(lead.website_domain)}`;
  const attempt = (lead: AlertLead) => lead.job_id || `try${lead.attempts}`;
  for (const lead of held) {
    const why = lead.reason === 'review' ? 'waiting for your review' : `held by the quality check: ${lead.reason || 'no reason saved'}`;
    add('held', `held:${lead.id}:${attempt(lead)}`, `Held (${who(lead)}): ${why}. Video ad: ${lead.video_url || 'none'}. Release it: ${RELEASE_SQL(lead.id)} Or make a new one: ${RERUN_SQL(lead.id)}`);
  }
  for (const lead of failed) {
    add('failed', `failed:${lead.id}:${attempt(lead)}`, `Failed after ${lead.attempts} attempt(s) (${who(lead)}): ${lead.reason || 'no reason saved'}. The page tells the visitor our team will email. Make a new one: ${RERUN_SQL(lead.id)}`);
  }
  for (const lead of rejected) {
    add(
      'rejected',
      `rejected:${lead.id}:${attempt(lead)}`,
      `Website not readable during the job (${who(lead)}): ${lead.reason || 'no reason saved'}. Nothing was spent and the visitor got no email; the page offers "Try another page". Maybe write to them: ${viewUrl(lead.view_token)}`
    );
  }
  for (const lead of email) {
    if (lead.email_status !== 'inactive' && lead.email_attempts < EMAIL_MAX_ATTEMPTS) continue;
    const why =
      lead.email_status === 'inactive'
        ? `MailerLite will not email this subscriber (status ${lead.ml_status || 'unknown'}, no resubscribe)`
        : `the email failed ${lead.email_attempts} times (${lead.reason || 'no reason saved'})`;
    add('email', `email:${lead.id}:${attempt(lead)}`, `Email (${who(lead)}): ${why}. The video ad page is the only delivery: ${viewUrl(lead.view_token)}`);
  }
  for (const lead of unlockFailed) {
    add(
      'unlock',
      `unlock-failed:${lead.id}:${lead.unlock_order_id || 'manual'}:${lead.clean_attempts}`,
      `The $99 clean video of ${who(lead)} failed ${lead.clean_attempts} times (order ${lead.unlock_order_id || '?'}). Render it again: ${RERENDER_SQL(lead.id)} Or refund the order in FastSpring.`
    );
  }
  for (const lead of unlockEmail) {
    add(
      'unlock',
      `unlock-email:${lead.id}`,
      `The $99 clean video of ${who(lead)} is ready but its email did not go out (MailerLite status ${lead.ml_status || 'unknown'}). The page shows the download: ${viewUrl(lead.view_token)}`
    );
  }

  // Stuck queue and caps matter only while the funnel is meant to start video ads.
  if (settings.starting && report.oldestQueuedMin !== null && report.oldestQueuedMin > STUCK_QUEUE_MINUTES) {
    add(
      'stuck',
      `stuck:${twoHourKey()}`,
      `The oldest queued video ad has waited ${report.oldestQueuedMin} min (${report.queued} queued, ${report.running} running, max_running ${settings.max_running}, paying jobs working ${report.paidBusy ?? '?'}). Check the cron JSON, the caps and the Remotion server.`
    );
  }
  if (settings.starting && report.capReached && report.queued > 0) {
    add(
      'cap',
      `cap:${dayKey()}`,
      `The rolling 24 h cap is reached (${report.started24h}/${settings.daily_starts} starts, $${report.spent24hUsd}/$${settings.daily_usd}) while ${report.queued} video ads wait. If the spend is fine: update free_video_settings set daily_starts = 250, daily_usd = 250, updated_at = now() where id = 1;`
    );
  }
  if (isLive() && !ML_GROUP_READY && owedEmails > 0) {
    add('setup', `email-setup:${dayKey()}`, `${owedEmails} finished video ads wait for their email: the MailerLite group ids in lib/free-video/config.ts are still empty.`);
  }
  if (isLive() && !ML_GROUP_UNLOCKED && owedUnlockEmails > 0) {
    add('setup', `unlock-setup:${dayKey()}`, `${owedUnlockEmails} clean $99 video ads wait for their email: ML_GROUP_UNLOCKED in lib/free-video/config.ts is still empty (the pages show the downloads).`);
  }

  const subject =
    Object.entries(counts)
      .map(([kind, n]) => (kind === 'breaker' ? 'breaker tripped' : `${n} ${kind}`))
      .join(', ') || 'nothing new';
  return { items, subject };
}

/**
 * P1: ClickBank (vendor bluefx02) and FastSpring sales of the last 3 days whose buyer has a lead created
 * before the sale → bought_at and sale_ref (set once), then the 'Free Video - Bought' group, the
 * automation's exit. Returns the leads newly marked.
 */
async function attributeSales(): Promise<number> {
  try {
    const sales = (
      await rows<{ processor: string; event_type: string; event_id: string; created_at: string; vendor: string | null; cb_email: string | null; fs_email: string | null }>(
        (createAdminClient() as any)
          .from('webhook_events')
          .select('processor, event_type, event_id, created_at, vendor:payload->>vendor, cb_email:payload->customer->>email, fs_email:payload->>customerEmail')
          .in('processor', ['clickbank', 'fastspring'])
          .in('event_type', ['SALE', 'SUBSCRIPTION'])
          .gt('created_at', isoMinutesAgo(3 * 24 * 60))
          .limit(1000),
        'sales'
      )
    )
      .filter((e) => (e.processor === 'clickbank' && e.event_type === 'SALE' && e.vendor === 'bluefx02') || (e.processor === 'fastspring' && e.event_type === 'SUBSCRIPTION'))
      .map((e) => ({ email: String(e.cb_email || e.fs_email || '').trim().toLowerCase(), at: e.created_at, ref: `${e.processor}:${e.event_id}` }))
      .filter((sale) => sale.email.includes('@'));
    if (!sales.length) return 0;

    const leads = await rows<{ id: string; email: string; created_at: string }>(
      own(leadsTable().select('id, email, created_at').in('email', [...new Set(sales.map((s) => s.email))]).is('bought_at', null)).limit(500),
      'leads of buyers'
    );
    let bought = 0;
    for (const lead of leads) {
      const sale = sales.find((s) => s.email === lead.email && Date.parse(s.at) > Date.parse(lead.created_at));
      if (!sale) continue;
      const { data, error } = await leadsTable()
        .update({ bought_at: sale.at, sale_ref: sale.ref.slice(0, 200), updated_at: new Date().toISOString() })
        .eq('id', lead.id)
        .is('bought_at', null)
        .select('id');
      if (error || !data?.length) continue;
      bought++;
      console.log(`✅ [free-video] Lead ${lead.id} bought (${sale.ref})`);
      await addToBoughtGroup(lead.email);
    }
    return bought;
  } catch (error) {
    console.error('❌ [free-video] attributeSales failed:', error);
    return 0;
  }
}

/**
 * Live server only. When the sweep has not run for WATCHDOG_MINUTES while leads are queued or running,
 * one alert per hour says so. The POST's after() calls it, so the next visitor notices a silent cron.
 * Never throws.
 */
export async function sweepWatchdog(): Promise<void> {
  if (!isLive()) return;
  try {
    const settings = await readSettings(true);
    if (!settings) return;
    const last = settings.last_sweep_at ? Date.parse(settings.last_sweep_at) : NaN;
    const silentMin = Number.isNaN(last) ? null : Math.round((Date.now() - last) / 60_000);
    if (silentMin !== null && silentMin < WATCHDOG_MINUTES) return;
    const waiting = await counted(leadsTable().select('id', { count: 'exact', head: true }).neq('source', 'test').in('status', ['queued', 'running']), 'waiting leads');
    if (!waiting) return;
    await alertOwner(
      [
        {
          key: `cron-silent:${hourKey()}`,
          line: `The free video cron has not run for ${silentMin === null ? 'as long as the funnel exists' : `${silentMin} min`} while ${waiting} video ads are queued or running: check the Coolify scheduled task (the Authorization header needs double quotes).`,
        },
      ],
      'the cron is silent'
    );
  } catch (error) {
    console.error('❌ [free-video] sweepWatchdog failed:', error);
  }
}
