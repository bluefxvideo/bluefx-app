/**
 * A free video ad moves into its buyer's AI Media Machine (owner 2026-10-07: "the client makes the video, but how will
 * he access it in the AI MM?"). The free job stays where it is, owned by the system user, so the $99 clean render and
 * the 30-day cleanup of its files work as before. The buyer gets a copy of it in their own Phantom videos:
 *
 * 1. Every file of the free job is copied (storage copy, nothing downloaded) from smart-video/<system user>/<job>/ to
 *    smart-video/<buyer>/<copy>/, except the finished video files.
 * 2. A job row for the buyer, status 'rendering', with every URL pointing at the copied files and the plan without the
 *    watermark, so "Edit this video" works on it like on any Phantom video. The copy id comes from the lead and the
 *    account, so a second claim (the sweep and a click at the same moment) finds the same row and copies nothing twice.
 * 3. In the background: the saved plan is rendered again without the watermark (as the $99 clean version is), levelled,
 *    checked and stored as video.mp4, and the row is done. A lead that has its $99 clean version gets that file instead;
 *    a lead whose working files are already gone (cleanup.ts, after 30 days) gets the free file, which is all there is.
 *
 * Callers: the sweep, for a lead whose email bought the AI Media Machine (claimBoughtLeads), and /go/claim?t=<token>
 * for a signed-in customer (the button on the video ad page).
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createAdminClient } from '@/app/supabase/server';
import { fakeMode, renderTargetAllowed } from '@/lib/free-video/config';
import { asLead, customerIdByEmail, leadsTable, readSettings } from '@/lib/free-video/leads';
import { checkCleanFile, cleanProps, inBackground } from '@/lib/free-video/unlock';
import { BUCKET, jobDir, jobsTable, publicUrl, readJob, STALE_AFTER_MS, touchJob, upload, withRetry, writeJob } from '@/lib/smart-video/jobs';
import { levelLoudness, renderSmartVideo } from '@/lib/smart-video/render';
import type { FreeVideoLead } from '@/types/free-video';
import type { SmartVideoJob } from '@/types/smart-video';

/** The finished video files of a job folder: never copied, the copy gets its own video.mp4. */
const FINISHED_FILE = /^(video\.mp4|clean-.+\.mp4)$/;

/** The line a copy carries when the free (marked) file stood in for its clean render. */
const MARKED_COPY = 'This copy still shows the BlueFX mark. Edit it once to make a version without the mark.';

/** The copy's job id: a UUID made from the lead and the account, the same every time. */
export function copyIdOf(leadId: string, userId: string): string {
  const h = createHash('sha256').update(`free-video-copy:${leadId}:${userId}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Copies one file inside the bucket. A file that is already there (a claim run again) counts as copied. */
async function copyFile(from: string, to: string): Promise<void> {
  await withRetry(`Copying ${path.basename(from)}`, async () => {
    const { error } = await createAdminClient().storage.from(BUCKET).copy(from, to);
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  });
}

/** The files of a job folder (the folder has no subfolders: storage lists those with a null id). */
async function filesIn(dir: string): Promise<string[]> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).list(dir, { limit: 1000 });
  if (error) throw new Error(`Could not list ${dir}: ${error.message}`);
  return (data ?? []).filter((entry) => entry.id !== null).map((entry) => entry.name);
}

/** Copies running in this process: the sweep must not start a second render of a copy that is still rendering. */
const finishing = new Set<string>();

/**
 * Puts a copy of this finished free video ad in the account's Phantom videos and returns the copy's job id. The row
 * shows at once; the clean render finishes it in the background. Safe to call again: the existing copy is returned,
 * and a copy whose render died (a deploy) is rendered again.
 */
export async function claimFreeVideo(lead: FreeVideoLead, userId: string, viaAfter = false): Promise<string> {
  if (lead.status !== 'done' || !lead.job_id || !lead.video_url) throw new Error('The free video ad is not finished');
  const copyId = copyIdOf(lead.id, userId);
  const existing = await readJob(userId, copyId);
  if (existing) {
    const dead = existing.status === 'failed' || (existing.status !== 'done' && Date.parse(existing.updatedAt) < Date.now() - STALE_AFTER_MS);
    // A copy that got the marked free file is rendered clean again on the next click, while the working files exist
    // (2026-10-07: every clean render failed its frame check for a day, so the owner's copy kept the mark).
    const marked = existing.status === 'done' && Boolean(existing.warnings?.includes(MARKED_COPY)) && !lead.files_cleaned_at;
    if ((dead || marked) && !finishing.has(copyId)) startFinish(lead, existing, viaAfter);
    return copyId;
  }

  const settings = await readSettings(true);
  const systemUserId = settings?.system_user_id;
  if (!systemUserId) throw new Error('No system user for free video ads');
  const { data: source, error } = await jobsTable().select('job, plan').eq('id', lead.job_id).eq('user_id', systemUserId).maybeSingle();
  if (error || !source?.job || !source?.plan) throw new Error(`The free job ${lead.job_id} could not be read: ${error?.message || 'no row'}`);

  // 1. The files.
  const fromDir = jobDir(systemUserId, lead.job_id);
  const toDir = jobDir(userId, copyId);
  for (const name of await filesIn(fromDir)) {
    if (!FINISHED_FILE.test(name)) await copyFile(`${fromDir}/${name}`, `${toDir}/${name}`);
  }

  // 2. The row. Every saved URL of the free job sits in its own folder, so the folder swap moves them all.
  const swap = <T,>(value: T): T => JSON.parse(JSON.stringify(value).split(`${fromDir}/`).join(`${toDir}/`)) as T;
  const freeJob = source.job as SmartVideoJob;
  const plan = swap(source.plan as { props: Record<string, unknown>; brief?: string });
  plan.props = cleanProps(plan.props);
  // The free job's brief is the funnel's instruction to the director: edits keep reading it from the plan.
  plan.brief = plan.brief ?? freeJob.brief;
  const now = new Date().toISOString();
  const job: SmartVideoJob = {
    ...swap(freeJob),
    id: copyId,
    userId,
    status: 'rendering',
    renderProgress: 0,
    // The first line is the card's title in the Phantom's video list.
    brief: `Your free video ad for ${lead.website_domain}`,
    parentId: undefined,
    note: undefined,
    creditsUsed: 0,
    usage: undefined,
    videoUrl: undefined,
    error: undefined,
    freeLeadId: lead.id,
    createdAt: now,
    updatedAt: now,
  };
  const { error: insertError } = await jobsTable().insert({
    id: copyId,
    user_id: userId,
    parent_id: null,
    status: job.status,
    job,
    plan,
    created_at: now,
    updated_at: now,
  });
  // A claim at the same moment wrote the same row first: that one renders.
  if (insertError) {
    if (/duplicate|unique/i.test(insertError.message)) return copyId;
    throw new Error(`The copy could not be saved: ${insertError.message}`);
  }
  console.log(`✅ [free-video] Lead ${lead.id} (${lead.website_domain}) copied to account ${userId} as job ${copyId}`);

  // 3.
  startFinish(lead, job, viaAfter);
  return copyId;
}

function startFinish(lead: FreeVideoLead, job: SmartVideoJob, viaAfter: boolean): void {
  finishing.add(job.id);
  inBackground(`Finishing the free video ad copy ${job.id}`, () => finishCopy(lead, job).finally(() => finishing.delete(job.id)), viaAfter);
}

/** Step 3: the copy's own video.mp4, without the watermark when the files allow it, then the row is done. */
async function finishCopy(lead: FreeVideoLead, initial: SmartVideoJob): Promise<void> {
  let job = initial;
  const heartbeat = setInterval(() => touchJob(job.id).catch(() => undefined), 45_000);
  const settings = await readSettings(true);
  const freeDir = jobDir(settings?.system_user_id ?? '', lead.job_id ?? '');
  const toDir = jobDir(job.userId, job.id);
  // A finished copy rendered again (it had the marked file) saves under a new name: the CDN may still hold video.mp4.
  const target = initial.status === 'done' ? `clean-${Date.now().toString(36)}.mp4` : 'video.mp4';
  const copyFree = async () => {
    await copyFile(`${freeDir}/video.mp4`, `${toDir}/video.mp4`);
    return publicUrl(`${toDir}/video.mp4`);
  };
  try {
    let videoUrl: string;
    // The free file's length includes the 2 s end card; a clean version is the plan's own length.
    let durationSeconds = lead.duration_seconds ?? job.durationSeconds;
    const warnings: string[] = [];
    if (lead.clean_video_url) {
      // The $99 clean version exists.
      await copyFile(`${freeDir}/${path.basename(new URL(lead.clean_video_url).pathname)}`, `${toDir}/${target}`);
      videoUrl = publicUrl(`${toDir}/${target}`);
    } else if (lead.files_cleaned_at || fakeMode() || !renderTargetAllowed()) {
      // The working files are gone (or this server may not render): the free file is all there is.
      videoUrl = await copyFree();
      warnings.push(MARKED_COPY);
    } else {
      const { data: row } = await jobsTable().select('plan').eq('id', job.id).eq('user_id', job.userId).maybeSingle();
      const props = (row?.plan as { props?: Record<string, unknown> } | undefined)?.props;
      try {
        if (!props) throw new Error('no saved plan');
        let lastSave = 0;
        const rendered = await renderSmartVideo(props, (percent) => {
          if (Date.now() - lastSave < 10_000) return;
          lastSave = Date.now();
          writeJob(job, { renderProgress: Math.round(percent) }).then((saved) => (job = saved), () => undefined);
        });
        const data = await levelLoudness(rendered);
        await checkCleanFile(data, props);
        videoUrl = await upload(`${toDir}/${target}`, data, 'video/mp4');
        durationSeconds = Number(props.duration) || durationSeconds;
      } catch (error) {
        console.error(`❌ [free-video] Clean render of copy ${job.id} failed, the free file stands in:`, error);
        videoUrl = await copyFree();
        warnings.push(MARKED_COPY);
      }
    }
    // warnings is always written, so a clean render again clears the "still shows the BlueFX mark" line.
    job = await writeJob(job, { status: 'done', videoUrl, renderProgress: 100, durationSeconds, warnings: warnings.length ? warnings : undefined });
    console.log(`✅ [free-video] Copy ${job.id} of lead ${lead.id} is ready in account ${job.userId}`);
  } catch (error) {
    console.error(`❌ [free-video] Copy ${job.id} of lead ${lead.id} failed:`, error);
    await writeJob(job, { status: 'failed', error: 'The free video ad could not be copied. Open the link in our email to try again.' }).catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * The sweep's share: every finished lead whose email bought the AI Media Machine in the last 3 days (attributeSales set
 * bought_at) gets its copy in that account, once the account exists. Returns how many copies were started.
 */
export async function claimBoughtLeads(own: (query: any) => any): Promise<number> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
  const { data, error } = await own(leadsTable().select('*').eq('status', 'done').not('bought_at', 'is', null).gt('bought_at', since)).limit(50);
  if (error) {
    console.error('❌ [free-video] Sweep: bought leads not read:', error.message);
    return 0;
  }
  let started = 0;
  for (const lead of ((data ?? []) as Record<string, unknown>[]).map(asLead)) {
    try {
      const userId = await customerIdByEmail(lead.email);
      if (!userId) continue;
      const copy = await readJob(userId, copyIdOf(lead.id, userId));
      if (copy?.status === 'done') continue;
      if (copy && finishing.has(copy.id)) continue;
      await claimFreeVideo(lead, userId);
      started++;
    } catch (failure) {
      console.error(`❌ [free-video] Sweep: copying lead ${lead.id} to its buyer failed:`, failure);
    }
  }
  return started;
}
