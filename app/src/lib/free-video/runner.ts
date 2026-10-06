/**
 * Free video ad funnel: starting free jobs and settling their leads.
 *
 * A free job is a normal Phantom job owned by the system user (settings.system_user_id), run by the
 * same runner as paying users' jobs (lib/smart-video/jobs.ts) with three hooks: the website is read
 * through the SSRF guard, the options force the free settings, and the render gets the BlueFX watermark
 * and end card. No credits are charged or refunded: the job has no creditsUsed and no listing.
 *
 * Server only. NEVER re-export anything from here in a server-action file: kickQueue() starts paid
 * API work, and every export of such a file becomes a public, unauthenticated action.
 */

import { createAdminClient } from '@/app/supabase/server';
import {
  CLAIM_GRACE_MINUTES,
  claimsTestLeads,
  END_CARD_SECONDS,
  fakeFailMode,
  fakeMode,
  FREE_PLAN,
  freeNote,
  GATE,
  isLive,
  localStartAllowed,
  MAX_ATTEMPTS,
  remotionServerUrl,
  renderTargetAllowed,
  RETRY_DELAY_MS,
  staleMinutes,
  UNREADABLE,
  WATERMARK,
} from '@/lib/free-video/config';
import { qualityGate } from '@/lib/free-video/gate';
import { asLead, getLead, leadsTable, readSettings, transitionLead } from '@/lib/free-video/leads';
import { liveRecorder } from '@/lib/free-video/live';
import { LIVE_DEMO } from '@/lib/free-video/live-demo';
import { deliverLead } from '@/lib/free-video/notify';
import { startCleanRender } from '@/lib/free-video/unlock';
import { displayDomain, isUnreadable, readBusinessSite } from '@/lib/free-video/website';
import { PHANTOM_EXAMPLES } from '@/lib/smart-video/examples';
import { libraryTrackUrl } from '@/lib/smart-video/music-library';
import {
  createJob,
  DEAD_JOB,
  failAndRefund,
  FINAL,
  fromRow,
  jobsTable,
  type JobRow,
  runSmartVideoJob,
  type SavedPlan,
  type SmartVideoRunHooks,
  scriptOf,
  writeJob,
} from '@/lib/smart-video/jobs';
import type { SmartVideoMedia, SmartVideoOptions, SmartVideoResult } from '@/lib/smart-video/pipeline';
import type { DirectorPlan, SmartAsset } from '@/lib/smart-video/types';
import type { FreeVideoLead, FreeVideoLeadStatus, FreeVideoLive } from '@/types/free-video';
import type { SmartVideoJob } from '@/types/smart-video';

type Usage = NonNullable<SmartVideoJob['usage']>;

const sumUsd = (usage: Usage | undefined) => (usage ?? []).reduce((sum, entry) => sum + (Number(entry.usd) || 0), 0);
const usd3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------------------------

/** One call never claims more than this (max_running is at most 4); a misbehaving claim cannot spin. */
const MAX_CLAIMS_PER_KICK = 8;

/**
 * Starts every lead the claim function hands out. The function (one advisory-locked SQL decision)
 * applies the kill switch, max_running, the paying-users deferral and the rolling 24 h caps, so extra
 * callers are harmless. Called from the POST's after(), from every run's finally and from the cron.
 * Returns 0 unless localStartAllowed(): a local server pointed at the PROD database never runs leads by
 * accident, and even with FREE_VIDEO_LOCAL_START=1 it claims only source='test' leads (p_test): only the
 * live server ever claims a real visitor's lead (review F8).
 */
export async function kickQueue(): Promise<number> {
  if (!localStartAllowed()) return 0;
  let started = 0;
  try {
    for (let i = 0; i < MAX_CLAIMS_PER_KICK; i++) {
      const { data, error } = await (createAdminClient() as any).rpc('claim_free_video_lead', { p_test: claimsTestLeads(), p_stale_minutes: staleMinutes() });
      if (error) {
        console.error('❌ [free-video] The claim failed:', error.message);
        break;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.id) break;
      started++;
      const lead = asLead(row);
      console.log(`🔄 [free-video] Starting lead ${lead.id} (${lead.website_domain}), attempt ${lead.attempts}, job ${lead.job_id}`);
      void runFreeVideoLead(lead).catch((error) => console.error('❌ free video run', error));
    }
  } catch (error) {
    console.error('❌ [free-video] kickQueue failed:', error);
  }
  return started;
}

/** Why an attempt stops when its lead has moved on (requeued by the sweep, or a newer attempt holds it). */
export const LOST_LEAD = 'This attempt was replaced by a newer one; it stopped before spending more.';

/**
 * Whether this attempt still owns its lead: the lead is 'running' with this attempt's job id. The sweep can
 * write an attempt off while its process still works (a slow first save, a hung heartbeat), and the claim
 * then starts a newer attempt, so every attempt checks before each paid step (review F1):
 * check() reads the row now; assert() throws on the last known answer (the synchronous hooks use it); a
 * poll refreshes that answer every 30 s.
 */
function watchOwnership(lead: Pick<FreeVideoLead, 'id' | 'job_id'>) {
  let owned = true;
  const check = async (): Promise<boolean> => {
    try {
      const { data, error } = await leadsTable().select('status, job_id').eq('id', lead.id).maybeSingle();
      // A failed read is no proof of anything: the answer stays as it was.
      if (!error) owned = Boolean(data && data.status === 'running' && data.job_id === lead.job_id);
    } catch {
      /* the answer stays as it was */
    }
    return owned;
  };
  const poll = setInterval(() => void check(), 30_000);
  poll.unref?.();
  return {
    check,
    assert: () => {
      if (!owned) throw new Error(LOST_LEAD);
    },
    stop: () => clearInterval(poll),
  };
}
type Ownership = ReturnType<typeof watchOwnership>;

/** One claimed lead: its job row, the job (or the fake one), then the settle and the next start. */
async function runFreeVideoLead(lead: FreeVideoLead): Promise<void> {
  let watch: Ownership | null = null;
  try {
    const settings = await readSettings(true);
    if (!settings?.system_user_id || !lead.job_id) {
      console.error(`❌ [free-video] Lead ${lead.id} was claimed but cannot start (no system user or job id); the sweep requeues it`);
      return;
    }
    const now = new Date().toISOString();
    const job: SmartVideoJob = {
      id: lead.job_id,
      userId: settings.system_user_id,
      status: 'reading',
      brief: freeNote(displayDomain(lead.website_domain)),
      link: lead.website_url,
      length: 'auto',
      format: 'vertical',
      look: 'auto',
      voiceOver: true,
      music: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await createJob(job);
    } catch (error) {
      // No job row: settleLead requeues the lead once its claim is staleMinutes() old.
      console.error(`❌ [free-video] Lead ${lead.id}: the job row was not saved:`, error);
      return;
    }
    watch = watchOwnership(lead);
    // The first save can land long after the claim (a slow database): the lead may already be someone else's.
    if (!(await watch.check())) {
      console.warn(`⚠️ [free-video] Lead ${lead.id}: job ${lead.job_id} started after the lead moved on; it stops at $0`);
      await failAndRefund(job, LOST_LEAD).catch(() => undefined);
      return;
    }
    if (fakeMode()) await runFakeJob(job, lead.website_domain, writeLive(lead.id, lead.job_id));
    else if (!renderTargetAllowed()) {
      // .env.local points at PROD Remotion: a local run must export REMOTION_SERVER_URL=http://localhost:<port>.
      await failAndRefund(job, `Off the live server a free video ad renders only on a local Remotion server (now ${remotionServerUrl()}).`);
    } else await runSmartVideoJob(job, [], freeHooks(lead, watch));
  } finally {
    watch?.stop();
    await settleLead(lead.id).catch((error) => console.error(`❌ [free-video] Settling lead ${lead.id} failed:`, error));
    void kickQueue();
  }
}

// ---------------------------------------------------------------------------------------------
// The free job's settings (pure; the local test script reuses them)
// ---------------------------------------------------------------------------------------------

/** Real photos among the prepared assets: images without a flat background (logos and flat artwork do not count). */
export const realPhotoCount = (assets: SmartAsset[]) => assets.filter((a) => a.kind === 'image' && !a.flatBackground).length;

/**
 * The free job's options (owner 2026-10-06: "just a short intro with ugc and after the whiteboard, no need to
 * animate all images"): a person says the script's first line on camera (presenter.ts), then a whiteboard video
 * with the website's real photos taped to the board (freeNote keeps thumbnails, banners and screenshots off it).
 * Library music, and shapeFreePlan between the director and the paid production step. `guard` runs before the
 * plan is shaped, so an attempt that lost its lead stops before production (review F1).
 */
export function freeOptions(
  base: SmartVideoOptions,
  guard?: () => void,
  onPlan?: (plan: DirectorPlan) => void,
  onMusic?: (url: string) => void
): SmartVideoOptions {
  return {
    ...base,
    look: 'whiteboard',
    stillCamera: true,
    presenter: true,
    adjustPlan: (plan) => {
      guard?.();
      const shaped = shapeFreePlan(plan);
      // The live status page shows the script the moment the director has it, as the job will make it.
      onPlan?.(shaped);
      return shaped;
    },
    // A ready-made track from the music library instead of a new song (owner 2026-10-06: $0.08 a video ad saved).
    pickMusic: async (musicPrompt) => {
      const url = await libraryTrackUrl(musicPrompt);
      if (url) onMusic?.(url);
      return url;
    },
  };
}

const wordsOf = (narration: string) => narration.split(/\s+/).filter(Boolean).length;

/** The start of the error a plan over the free limits throws: only the director call was paid for. */
export const PLAN_TOO_LONG = 'The director planned more than a free video ad allows: ';

/**
 * Hard limits by construction (review SEC-5): page text can ask for a long video, and the director lets
 * a length in the client's text win. At most FREE_PLAN.maxScenes scenes and FREE_PLAN.maxWords narration
 * words: the first scene (the hook) and the last one (the website address) always stay, and the middle
 * scenes are kept in order while they fit. A plan that cannot fit with FREE_PLAN.minScenes scenes throws:
 * that costs only the director call, and the retry asks the director again.
 */
export function trimFreePlan(plan: DirectorPlan): DirectorPlan {
  const scenes = plan.scenes;
  const total = scenes.reduce((sum, scene) => sum + wordsOf(scene.narration), 0);
  if (scenes.length <= FREE_PLAN.maxScenes && total <= FREE_PLAN.maxWords) return plan;
  const lastIndex = scenes.length - 1;
  const keep = new Set([0, lastIndex]);
  let words = wordsOf(scenes[0].narration) + (lastIndex > 0 ? wordsOf(scenes[lastIndex].narration) : 0);
  for (let i = 1; i < lastIndex && keep.size < FREE_PLAN.maxScenes; i++) {
    const add = wordsOf(scenes[i].narration);
    if (words + add > FREE_PLAN.maxWords) continue;
    keep.add(i);
    words += add;
  }
  const kept = [...keep].sort((a, b) => a - b);
  if (kept.length < Math.min(FREE_PLAN.minScenes, scenes.length) || words > FREE_PLAN.maxWords) {
    throw new Error(`${PLAN_TOO_LONG}${scenes.length} scenes and ${total} words (the limits are ${FREE_PLAN.maxScenes} scenes and ${FREE_PLAN.maxWords} words).`);
  }
  // The signature sound plays after a scene: it follows that scene, or the last kept one before it.
  const sound = plan.signatureSound;
  const soundAfter = sound ? kept.filter((i) => i <= sound.afterScene).length - 1 : -1;
  return {
    ...plan,
    scenes: kept.map((i) => scenes[i]),
    signatureSound: sound && soundAfter >= 0 ? { ...sound, afterScene: soundAfter } : null,
  };
}

/** Puts `to` where a scene shows `from` (a lifestyle photo that was not made falls back to its real photo). */
function replaceAsset(scene: DirectorPlan['scenes'][number], from: string, to: string): DirectorPlan['scenes'][number] {
  const swap = (id: string) => (id === from ? to : id);
  return {
    ...scene,
    background: scene.background.asset === from ? { ...scene.background, asset: to } : scene.background,
    blocks: scene.blocks.map((block) => {
      if ('assets' in block) return { ...block, assets: block.assets.map(swap) };
      if ('asset' in block) return { ...block, asset: swap(block.asset) };
      return block;
    }),
  };
}

/**
 * The director's plan, held to the free limits (trimFreePlan) and trimmed of what would be paid for and
 * never seen:
 * - lifestyle photos: at most FREE_PLAN.maxLifestyleShots; a scene that showed one more shows its real photo;
 *   a lifestyle photo that no scene shows is dropped ($0.08 for nothing);
 * - every animated photo of a whiteboard video (motion is applied to scene backgrounds, which whiteboard
 *   draws instead, so those clips would be paid for and never shown);
 * - in the photo looks, an animated photo that is no scene's background, for the same reason;
 * - drawings no kept scene uses.
 * The photo looks keep the director's other animated photos (the schema caps them at 2).
 */
export function shapeFreePlan(directed: DirectorPlan): DirectorPlan {
  let plan = trimFreePlan(directed);
  const shownIds = (scenes: DirectorPlan['scenes']) => {
    const ids = new Set<string>();
    for (const scene of scenes) {
      if (scene.background.asset) ids.add(scene.background.asset);
      for (const block of scene.blocks) {
        if ('assets' in block) block.assets.forEach((id) => ids.add(id));
        else if ('asset' in block) ids.add(block.asset);
      }
    }
    return ids;
  };

  // Lifestyle photos: only shown ones, at most the free limit; the others fall back to the photo they were made from.
  let scenes = plan.scenes;
  const shownLifestyle = (plan.lifestyleShots ?? []).filter((shot) => shownIds(scenes).has(shot.id));
  const keptLifestyle = shownLifestyle.slice(0, FREE_PLAN.maxLifestyleShots);
  const replaced = new Map<string, string>();
  for (const shot of shownLifestyle.slice(FREE_PLAN.maxLifestyleShots)) {
    replaced.set(shot.id, shot.fromAsset);
    scenes = scenes.map((scene) => replaceAsset(scene, shot.id, shot.fromAsset));
  }
  plan = { ...plan, scenes, lifestyleShots: plan.lifestyleShots ? keptLifestyle : plan.lifestyleShots };

  const backgrounds = new Set(plan.scenes.map((scene) => scene.background.asset).filter((id): id is string => Boolean(id)));
  const animate =
    plan.style === 'whiteboard'
      ? []
      : (plan.animate || [])
          .map((shot) => ({ ...shot, asset: replaced.get(shot.asset) ?? shot.asset }))
          .filter((shot, i, all) => backgrounds.has(shot.asset) && all.findIndex((other) => other.asset === shot.asset) === i);
  const shown = shownIds(plan.scenes);
  const drawings = plan.drawings ? plan.drawings.filter((drawing) => shown.has(drawing.id)) : plan.drawings;
  return { ...plan, animate: animate.length ? animate : null, drawings };
}

/** The BlueFX watermark and the 1 s end card; the job's length includes the card (the gate compares it with the file). */
export function withWatermark(result: SmartVideoResult): SmartVideoResult {
  return {
    ...result,
    props: { ...result.props, watermark: { ...WATERMARK } },
    durationSeconds: result.durationSeconds + END_CARD_SECONDS,
  };
}

/** P1: up to 4 of the visitor's photos on the status page while the job works. Fire and forget. */
async function recordPhotos(leadId: string, jobId: string | null, assets: SmartAsset[]): Promise<void> {
  const photos = assets
    .filter((a) => a.kind === 'image' && !a.flatBackground)
    .slice(0, 4)
    .map((a) => a.url);
  if (!photos.length) return;
  try {
    let query = leadsTable().update({ photos }).eq('id', leadId).eq('status', 'running');
    if (jobId) query = query.eq('job_id', jobId);
    const { error } = await query;
    if (error) console.warn('⚠️ [free-video] Photos for the status page not saved:', error.message);
  } catch (error) {
    console.warn('⚠️ [free-video] Photos for the status page not saved:', String(error).slice(0, 160));
  }
}

/** Saves the live status page's record on the lead, only while this attempt still holds it. Never throws. */
function writeLive(leadId: string, jobId: string | null) {
  return async (live: FreeVideoLive): Promise<void> => {
    try {
      let query = leadsTable().update({ live }).eq('id', leadId).eq('status', 'running');
      if (jobId) query = query.eq('job_id', jobId);
      const { error } = await query;
      if (error) console.warn('⚠️ [free-video] Live status not saved:', error.message);
    } catch (error) {
      console.warn('⚠️ [free-video] Live status not saved:', String(error).slice(0, 160));
    }
  };
}

/**
 * The hooks of a free job. Each paid step first checks that this attempt still owns its lead (review F1).
 * They also feed the live status page: the website photos, the plan, then every picture, clip, voice-over
 * and music file the moment it is saved.
 */
function freeHooks(lead: FreeVideoLead, watch: Ownership): SmartVideoRunHooks {
  const live = liveRecorder(writeLive(lead.id, lead.job_id));
  live.reset();
  return {
    readLink: async (link) => {
      if (!(await watch.check())) throw new Error(LOST_LEAD);
      return readBusinessSite(link);
    },
    options: (base, assets) => {
      watch.assert();
      void recordPhotos(lead.id, lead.job_id, assets);
      live.assets(assets);
      // The library track is not saved with the job, so the live page hears about it here (a made song comes as music.mp3).
      return freeOptions(base, watch.assert, (plan) => live.plan(plan, assets), (url) => live.stored('music.mp3', url));
    },
    beforeRender: (result) => {
      watch.assert();
      return withWatermark(result);
    },
    onStored: (name, url) => live.stored(name, url),
  };
}

// ---------------------------------------------------------------------------------------------
// Settling a lead (idempotent; the job's own finally and the cron both call it)
// ---------------------------------------------------------------------------------------------

/** What settleLead did; the sweep counts these. */
export type SettleOutcome = 'none' | 'running' | Exclude<FreeVideoLeadStatus, 'running'>;

interface JobRecord extends JobRow {
  status: string;
  plan: SavedPlan | null;
}

/**
 * Brings a running lead in line with its job. Every write is transitionLead(id, { from: ['running'],
 * jobId: lead.job_id }), so a late or repeated call changes nothing.
 * - No job row: once the claim is staleMinutes() old (never sooner than a silent job, review F1), the
 *   attempt failed ("never started").
 * - Job not final and silent for staleMinutes(): failDeadJob, then the attempt failed (died).
 * - Job 'failed': the attempt failed (unreadable website → rejected at $0).
 * - Job 'done': the quality gate; pass → 'done' and the email (or 'held' with reason 'review' in
 *   review mode); fail → 'held' with the reasons; a gate that could not run its file checks leaves the
 *   lead running for GATE.inconclusiveMinutes so the next sweep tries again (review F4). A paid $99 unlock
 *   waiting for this video ad starts its clean render.
 */
export async function settleLead(leadId: string): Promise<SettleOutcome> {
  const lead = await getLead(leadId);
  if (!lead || lead.status !== 'running' || !lead.job_id) return 'none';
  const guard = { from: ['running'] as FreeVideoLeadStatus[], jobId: lead.job_id };

  const { data, error } = await jobsTable().select('status, job, plan, updated_at').eq('id', lead.job_id).maybeSingle();
  if (error) {
    console.error(`❌ [free-video] Job read for lead ${lead.id} failed:`, error.message);
    return 'running';
  }
  const row = data as JobRecord | null;

  if (!row) {
    const claimedAt = lead.claimed_at ? Date.parse(lead.claimed_at) : 0;
    if (Date.now() - claimedAt < Math.max(CLAIM_GRACE_MINUTES, staleMinutes()) * 60_000) return 'running';
    // Nothing ran without a job row, so nothing was spent.
    return attemptFailed(lead, 'The job never started', [], false);
  }

  const job = fromRow(row);
  if (row.status !== 'done' && row.status !== 'failed') {
    const silentMs = Date.now() - Date.parse(row.updated_at);
    if (silentMs <= staleMinutes() * 60_000) return 'running';
    if (!(await failDeadJob(lead.job_id, row))) return 'running';
    console.warn(`⚠️ [free-video] Job ${lead.job_id} of lead ${lead.id} died (silent ${Math.round(silentMs / 60_000)} min)`);
    return attemptFailed(lead, DEAD_JOB, job.usage ?? [], true);
  }

  if (row.status === 'failed') {
    const reason = job.error || 'The job failed';
    return attemptFailed(lead, reason, job.usage ?? [], reason === DEAD_JOB);
  }

  // done
  const settings = await readSettings(true);
  if (!settings) return 'running'; // fail closed: the next sweep settles it
  const gate = await qualityGate(job, row.plan, { skipProbe: fakeMode(), domain: lead.website_domain });
  if (gate.inconclusive && Date.now() - Date.parse(row.updated_at) < GATE.inconclusiveMinutes * 60_000) {
    console.warn(`⚠️ [free-video] Lead ${lead.id}: the file check could not run (${gate.reasons.join('; ').slice(0, 160)}); the next sweep tries again`);
    return 'running';
  }
  const patch = {
    video_url: job.videoUrl ?? null,
    duration_seconds: typeof job.durationSeconds === 'number' ? Math.round(job.durationSeconds * 10) / 10 : null,
    look: row.plan?.plan?.style ?? null,
    gate,
    est_cost_usd: usd3(lead.est_cost_usd + sumUsd(job.usage)),
    reserved_usd: 0,
    finished_at: new Date().toISOString(),
  };
  if (gate.pass && !settings.review_mode) {
    if (!(await transitionLead(lead.id, guard, { ...patch, status: 'done', reason: null }))) return 'none';
    console.log(`✅ [free-video] Lead ${lead.id} (${lead.website_domain}) is done: ${job.videoUrl}`);
    await deliverLead(lead.id);
    await startWaitingUnlock(lead.id);
    return 'done';
  }
  const reason = gate.pass ? 'review' : gate.reasons.join('; ').slice(0, 500);
  if (!(await transitionLead(lead.id, guard, { ...patch, status: 'held', reason }))) return 'none';
  console.warn(`⚠️ [free-video] Lead ${lead.id} (${lead.website_domain}) is held: ${reason}`);
  return 'held';
}

/** A $99 unlock paid before the video ad was done: its clean render starts now (read after the 'done' write, so a payment landing at the same moment is seen by one side or the other). */
async function startWaitingUnlock(leadId: string): Promise<void> {
  try {
    const fresh = await getLead(leadId);
    if (fresh?.unlock_status === 'paid') startCleanRender(leadId);
  } catch (error) {
    console.warn(`⚠️ [free-video] Unlock check of lead ${leadId} failed (the sweep picks it up):`, String(error).slice(0, 160));
  }
}

/**
 * Marks a job that went silent as failed, with a guarded update of smart_video_jobs: only when it is
 * still not final AND its updated_at is still the one just read. Never writeJob: its final save is
 * unconditional and could undo a job that finished a moment ago. True only when a row changed.
 */
async function failDeadJob(jobId: string, row: JobRecord): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await jobsTable()
    .update({ status: 'failed', job: { ...row.job, status: 'failed', error: DEAD_JOB, updatedAt: now }, updated_at: now })
    .eq('id', jobId)
    .eq('updated_at', row.updated_at)
    .not('status', 'in', FINAL)
    .select('id');
  if (error) {
    console.error(`❌ [free-video] Could not mark job ${jobId} as dead:`, error.message);
    return false;
  }
  return Boolean(data?.length);
}

/**
 * One attempt failed. Its spend is added to the lead:
 * - a job that died without a usage record is charged the reserve (a conservative estimate);
 * - a job that failed after the director ran is charged at least half the reserve, because the steps still
 *   running in parallel at the throw (voice, music, animated photos) are billed but never recorded (review F7).
 * Then:
 * - an unreadable website → 'rejected' at $0: the partial unique indexes free the email and the domain,
 *   so the visitor can type another page (the sweep tells the owner, review F3);
 * - attempts below MAX_ATTEMPTS → 'queued' again after RETRY_DELAY_MS; the next claim gives it a NEW
 *   job id (createJob inserts on the uuid primary key, and writeJob never revives a final row);
 * - otherwise → 'failed'.
 */
async function attemptFailed(lead: FreeVideoLead, reason: string, usage: Usage, died: boolean): Promise<SettleOutcome> {
  let spent = sumUsd(usage);
  if (died && spent === 0) spent = lead.reserved_usd;
  else if (!died && !isUnreadable(reason) && !reason.startsWith(PLAN_TOO_LONG) && usage.some((entry) => entry.step === 'director')) {
    spent = Math.max(spent, lead.reserved_usd * 0.5);
  }
  const guard = { from: ['running'] as FreeVideoLeadStatus[], jobId: lead.job_id };
  const cost = { est_cost_usd: usd3(lead.est_cost_usd + spent), reserved_usd: 0, reason: reason.slice(0, 500) };

  if (isUnreadable(reason)) {
    if (!(await transitionLead(lead.id, guard, { ...cost, status: 'rejected', finished_at: new Date().toISOString() }))) return 'none';
    console.warn(`⚠️ [free-video] Lead ${lead.id}: ${lead.website_domain} is not readable, rejected at $${usd3(spent)}`);
    return 'rejected';
  }
  if (lead.attempts < MAX_ATTEMPTS) {
    const notBefore = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
    if (!(await transitionLead(lead.id, guard, { ...cost, status: 'queued', not_before: notBefore }))) return 'none';
    console.warn(`🔄 [free-video] Lead ${lead.id}: attempt ${lead.attempts} failed (${reason.slice(0, 120)}), retrying after ${notBefore}`);
    return 'queued';
  }
  if (!(await transitionLead(lead.id, guard, { ...cost, status: 'failed', finished_at: new Date().toISOString() }))) return 'none';
  console.error(`❌ [free-video] Lead ${lead.id} failed after ${lead.attempts} attempts: ${reason.slice(0, 160)}`);
  return 'failed';
}

// ---------------------------------------------------------------------------------------------
// Fake mode: the state machine for $0 (FREE_VIDEO_FAKE=1, never on the live server)
// ---------------------------------------------------------------------------------------------

const FAKE_STEP_MS = 3000;
/** What a fake video ad "costs": between half and all of the 1.30 reserve, so the daily_usd cap test (T8) behaves like real runs. */
const FAKE_USAGE: Usage = [{ step: 'fake', usd: 1, detail: 'fake run, no API call' }];

/** A saved plan that passes every plan check for this domain (or, with music null, fails on 'no music'). */
export function fakeSavedPlan(musicUrl: string | null, domain = 'example.com'): SavedPlan {
  const photo = 'https://example.com/fake.jpg';
  const scene = (narration: string, background: DirectorPlan['scenes'][number]['background'], blocks: DirectorPlan['scenes'][number]['blocks']) => ({
    narration,
    background,
    blocks,
  });
  const plan: DirectorPlan = {
    language: 'en',
    format: 'announcement',
    style: 'clean',
    captions: false,
    styleReason: 'fake run',
    theme: null,
    voice: { gender: 'female', direction: 'warm' },
    musicPrompt: 'fake',
    lifestyleShots: null,
    animate: [{ asset: 'a1', prompt: 'Leaves swaying. Camera: static.' }],
    drawings: null,
    signatureSound: null,
    assets: ['a1', 'a2', 'a3'].map((id) => ({ id, role: 'photo' as const, description: 'fake photo' })),
    warnings: [],
    scenes: [
      scene('A fake hook line for the test.', { type: 'mediaFull', asset: 'a1' }, [{ type: 'title', text: 'Fake hook' }]),
      scene('What a customer gets, in a few words.', { type: 'brand' }, [{ type: 'media', asset: 'a2' }, { type: 'title', text: 'Fake offer' }]),
      scene('Why people pick this business.', { type: 'brand' }, [{ type: 'media', asset: 'a3' }, { type: 'title', text: 'Fake reason' }]),
      scene('One more fact from the website.', { type: 'brand' }, [{ type: 'title', text: 'Fake fact' }, { type: 'pill', text: 'Fake pill' }]),
      scene('Visit the website on screen today.', { type: 'brand' }, [{ type: 'title', text: 'Visit us' }, { type: 'highlight', text: displayDomain(domain) }]),
    ],
  };
  const media: SmartVideoMedia = {
    format: 'vertical',
    sound: { voiceOver: true, music: true },
    voice: { url: 'https://example.com/fake-voice.wav', words: [], durationSeconds: 30 },
    clipWords: {},
    musicUrl,
    soundUrl: null,
    assets: {
      a1: { url: photo, kind: 'image' },
      a2: { url: photo, kind: 'image' },
      a3: { url: photo, kind: 'image' },
      'a1-motion': { url: 'https://example.com/fake-motion.mp4', kind: 'video', seconds: 6 },
    },
  };
  return { plan, props: { duration: 33, format: 'vertical', watermark: { ...WATERMARK } }, media, brief: 'fake' };
}

/**
 * Walks a job through reading, directing, producing, rendering 0/50/100 and finishing with 3 s steps
 * and no heartbeat, then marks it done with the vertical 'roofing' example video (34 s).
 * FREE_VIDEO_FAKE_FAIL: dead = stop after 'producing' like a deploy kill; error = fail with $0.10 of
 * usage; unreadable = fail as an unreadable website; gate = a saved plan without music.
 */
async function runFakeJob(start: SmartVideoJob, domain: string, live: (record: FreeVideoLive) => Promise<void>): Promise<void> {
  if (isLive()) throw new Error('Fake jobs never run on the live server');
  // The live page plays the record of a real run (live-demo.ts), step by step, so a $0 test shows the whole page.
  await live({});
  const mode = fakeFailMode();
  const pause = () => new Promise((resolve) => setTimeout(resolve, FAKE_STEP_MS));
  let job = start;
  console.log(`🎬 [free-video] Fake job ${job.id}${mode ? ` (fail: ${mode})` : ''}`);

  await pause();
  if (mode === 'unreadable') {
    await failAndRefund(job, `${UNREADABLE}fake`);
    return;
  }
  await live(LIVE_DEMO.photos);
  job = await writeJob(job, { status: 'directing' });
  await pause();
  await live(LIVE_DEMO.script);
  job = await writeJob(job, { status: 'producing' });
  await pause();
  await live(LIVE_DEMO.music);
  await pause();
  await live(LIVE_DEMO.clips);
  if (mode === 'dead') return;
  if (mode === 'error') {
    await failAndRefund({ ...job, usage: [{ step: 'director', usd: 0.1, detail: 'fake' }] }, 'Fake failure');
    return;
  }

  const saved = fakeSavedPlan(mode === 'gate' ? null : 'https://example.com/fake-music.mp3', domain);
  const { error } = await jobsTable().update({ plan: saved }).eq('id', job.id);
  if (error) throw new Error(`Could not save the fake plan: ${error.message}`);
  for (const renderProgress of [0, 50, 100]) {
    job = await writeJob(job, { status: 'rendering', renderProgress, durationSeconds: 34, usage: FAKE_USAGE, warnings: [], script: scriptOf(saved.plan) });
    await pause();
  }
  job = await writeJob(job, { status: 'finishing' });
  await pause();
  const example = PHANTOM_EXAMPLES.find((e) => e.id === 'roofing' && e.format === 'vertical') || PHANTOM_EXAMPLES.find((e) => e.format === 'vertical');
  await writeJob(job, { status: 'done', videoUrl: example?.videoUrl, renderProgress: 100 });
  console.log(`✅ [free-video] Fake job ${job.id} done`);
}
