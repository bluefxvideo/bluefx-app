'use server';

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { ZodError } from 'zod';
import { createAdminClient, createClient } from '@/app/supabase/server';
import { transcribeWords } from '@/lib/smart-video/audio';
import { refundFailedGeneration, refundSentence } from '@/lib/credits/refund';
import { createSmartVideo, reviseSmartVideo, type SmartVideoMedia, type SmartVideoResult } from '@/lib/smart-video/pipeline';
import { PHANTOM_REVISION_CREDITS, phantomCredits } from '@/lib/smart-video/pricing';
import type { DirectorPlan } from '@/lib/smart-video/types';
import { prepareAssets, type ClientFile } from '@/lib/smart-video/prepare-assets';
import { downloadLinkPhotos, fromLink } from '@/lib/smart-video/sources';
import { checkRemotionProgress, startRemotionRender } from '@/actions/services/remotion-render-service';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';
import {
  SmartVideoReviseSchema,
  SmartVideoStartSchema,
  SmartVideoUploadRequestSchema,
  type SmartVideoJob,
  type SmartVideoReviseInput,
  type SmartVideoScriptScene,
  type SmartVideoStartInput,
  type SmartVideoUploadSlot,
} from '@/types/smart-video';

/**
 * The Phantom (Smart Video): text + files (or a link) in, finished ad out.
 * The job runs after the response is sent (the proxy cuts requests at ~55 s)
 * and the page polls its row in smart_video_jobs. Files live in the public
 * bucket under an unguessable job folder (the render server fetches them by
 * URL); everything written about the job (brief, script, plan, API usage)
 * lives in the table, which only the server can read.
 */

const run = promisify(execFile);
const BUCKET = 'script-videos';
const STALE_AFTER_MS = 12 * 60 * 1000;
// One video costs up to about $1 in API fees before it can fail; nobody needs more than two at once.
const MAX_RUNNING_JOBS = 2;

const jobDir = (userId: string, jobId: string) => `smart-video/${userId}/${jobId}`;
const safeName = (name: string) => name.replace(/[^\w.-]+/g, '_').slice(-80);

// People see the first problem in plain words, never a validation dump.
function readable(error: unknown, fallback: string): string {
  if (error instanceof ZodError) return error.issues[0]?.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// smart_video_jobs is newer than the generated database types.
const jobsTable = () => (createAdminClient() as any).from('smart_video_jobs');

function publicUrl(storagePath: string): string {
  return createAdminClient().storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Storage now and then answers with a gateway error page instead of JSON; the
 * client library then throws a bare SyntaxError. One hiccup must not kill a
 * job that saves thirty files, so every storage call gets three tries.
 */
async function withRetry<T>(what: string, call: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ ${what} failed (attempt ${attempt}/3):`, String(error).slice(0, 160));
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 800));
    }
  }
  throw new Error(`${what} failed after 3 tries: ${lastError instanceof Error ? lastError.message : String(lastError)}`.slice(0, 300));
}

function upload(storagePath: string, data: Buffer, contentType: string): Promise<string> {
  return withRetry(`Saving ${path.basename(storagePath)}`, async () => {
    const { error } = await createAdminClient().storage.from(BUCKET).upload(storagePath, data, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return publicUrl(storagePath);
  });
}

function download(storagePath: string): Promise<Buffer> {
  return withRetry(`Loading ${path.basename(storagePath)}`, async () => {
    const { data, error } = await createAdminClient().storage.from(BUCKET).download(storagePath);
    if (error || !data) throw new Error(error?.message || 'no data');
    return Buffer.from(await data.arrayBuffer());
  });
}

async function readJob(userId: string, jobId: string): Promise<SmartVideoJob | null> {
  const { data, error } = await jobsTable().select('job').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Could not read the job: ${error.message}`);
  return (data?.job as SmartVideoJob) ?? null;
}

function writeJob(job: SmartVideoJob, patch: Partial<SmartVideoJob> = {}): Promise<SmartVideoJob> {
  const next = { ...job, ...patch, updatedAt: new Date().toISOString() };
  return withRetry('Saving the job', async () => {
    const { error } = await jobsTable().upsert({
      id: next.id,
      user_id: next.userId,
      parent_id: next.parentId ?? null,
      status: next.status,
      job: next,
      created_at: next.createdAt,
      updated_at: next.updatedAt,
    });
    if (error) throw new Error(error.message);
    return next;
  });
}

interface SavedPlan {
  plan: DirectorPlan;
  props: Record<string, unknown>;
  media?: SmartVideoMedia;
  brief?: string;
}

async function readPlan(userId: string, jobId: string): Promise<SavedPlan> {
  const { data, error } = await jobsTable().select('plan').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error || !data?.plan) throw new Error(error?.message || 'This video has no saved plan');
  return data.plan as SavedPlan;
}

/** Jobs of this user that are still working (a job with a stale heartbeat is dead, not running). */
async function runningJobs(userId: string): Promise<number> {
  const alive = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { count } = await jobsTable()
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'in', '(done,failed)')
    .gt('updated_at', alive);
  return count ?? 0;
}

const TOO_MANY = `Two of your videos are still being made. Start the next one when one of them is finished.`;

/**
 * What the page may see. API costs stay on the server for everyone, admins included
 * (the owner records his screen): they are kept with the job for analysis only.
 */
function forViewer(job: SmartVideoJob): SmartVideoJob {
  const { usage: _usage, ...visible } = job;
  return visible;
}

/** Step 1: a job id and one signed upload URL per file (files never travel through a server action). */
export async function requestSmartVideoUploads(input: {
  files: { name: string; size: number }[];
}): Promise<ApiResponse<{ jobId: string; slots: SmartVideoUploadSlot[] }>> {
  try {
    const userId = await currentUserId();
    if (!userId) return createApiError('Please sign in again');
    const { files } = SmartVideoUploadRequestSchema.parse(input);

    const jobId = randomUUID();
    const storage = createAdminClient().storage.from(BUCKET);
    const slots: SmartVideoUploadSlot[] = [];
    for (const [i, file] of files.entries()) {
      const storagePath = `${jobDir(userId, jobId)}/src/${String(i + 1).padStart(2, '0')}-${safeName(file.name)}`;
      const { data, error } = await storage.createSignedUploadUrl(storagePath);
      if (error || !data?.signedUrl) return createApiError(`Could not create an upload URL for ${file.name}`);
      slots.push({ name: file.name, path: storagePath, uploadUrl: data.signedUrl });
    }
    return createApiSuccess({ jobId, slots });
  } catch (error) {
    console.error('❌ requestSmartVideoUploads error:', error);
    return createApiError(readable(error, 'Could not prepare the uploads'));
  }
}

/** Charges before the work starts; job_id is how a failed job's refund finds this debit. */
async function charge(userId: string, jobId: string, credits: number): Promise<string | null> {
  const { deductCredits } = await import('@/actions/database/cinematographer-database');
  const result = await deductCredits(userId, credits, 'smart-video', { job_id: jobId });
  return result.success ? null : result.error || 'Credit deduction failed';
}

async function failAndRefund(job: SmartVideoJob, reason: string): Promise<SmartVideoJob> {
  const refund = job.creditsUsed
    ? await refundFailedGeneration({ userId: job.userId, referenceIds: [job.id], operation: 'Phantom video' })
    : { refunded: false as const };
  const error = refund.refunded && refund.amount ? `${reason} ${refundSentence(refund.amount)}` : reason;
  return writeJob(job, { status: 'failed', error });
}

/** Step 2: start the job. Returns at once; the work happens in after(). */
export async function startSmartVideo(input: SmartVideoStartInput): Promise<ApiResponse<{ jobId: string }>> {
  try {
    const userId = await currentUserId();
    if (!userId) return createApiError('Please sign in again');
    const parsed = SmartVideoStartSchema.parse(input);
    if (!parsed.brief.trim() && !parsed.link) return createApiError('Write what the video is about, or paste a link');
    if (parsed.uploads.some((u) => !u.path.startsWith(`${jobDir(userId, parsed.jobId)}/src/`))) return createApiError('Invalid upload path');
    if (await readJob(userId, parsed.jobId)) return createApiError('This video was already started');
    if ((await runningJobs(userId)) >= MAX_RUNNING_JOBS) return createApiError(TOO_MANY);

    const credits = phantomCredits(parsed.brief, parsed.length === 'script');
    const chargeError = await charge(userId, parsed.jobId, credits);
    if (chargeError) return createApiError(chargeError);

    const now = new Date().toISOString();
    const job = await writeJob({
      id: parsed.jobId,
      userId,
      status: 'reading',
      brief: parsed.brief,
      link: parsed.link || undefined,
      length: parsed.length,
      format: parsed.format,
      creditsUsed: credits,
      createdAt: now,
      updatedAt: now,
    });
    after(() => runSmartVideoJob(job, parsed.uploads));
    return createApiSuccess({ jobId: job.id });
  } catch (error) {
    console.error('❌ startSmartVideo error:', error);
    return createApiError(readable(error, 'Could not start the video'));
  }
}

async function runSmartVideoJob(initial: SmartVideoJob, uploads: { name: string; path: string }[]): Promise<void> {
  let job = initial;
  const dir = jobDir(job.userId, job.id);
  // A heartbeat keeps updatedAt fresh, so the page can tell a slow job from a dead one.
  const heartbeat = setInterval(() => writeJob(job).catch(() => undefined), 45_000);
  try {
    console.log(`🎬 Smart Video job ${job.id}: ${uploads.length} files${job.link ? ' + link' : ''}`);
    const files: ClientFile[] = await Promise.all(uploads.map(async (u) => ({ filename: u.name, data: await download(u.path) })));

    let brief = job.brief;
    if (job.link) {
      const link = await fromLink(job.link);
      files.push(...(await downloadLinkPhotos(link.imageUrls)));
      brief = job.brief.trim() ? `${link.brief}\n\nNOTE FROM THE CLIENT:\n${job.brief}` : link.brief;
    }

    const store = (data: Buffer, name: string, contentType: string) => upload(`${dir}/${name}`, data, contentType);
    const assets = await prepareAssets(files, store);
    const result = await createSmartVideo(
      brief,
      assets,
      store,
      (url) => download(`${dir}/${path.basename(new URL(url).pathname)}`),
      {
        length: job.length === 'script' ? 'script' : 'auto',
        format: job.format,
        onStage: (stage) => {
          job = { ...job, status: stage };
          writeJob(job).catch(() => undefined);
        },
      }
    );
    await finish(job, result, brief, (next) => {
      job = next;
    });
  } catch (error) {
    console.error(`❌ Smart Video job ${job.id} failed:`, error);
    await failAndRefund(job, error instanceof Error ? error.message : 'Unknown error').catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
}

// The words a block puts on screen, for the script shown under the video.
function scriptOf(plan: DirectorPlan): SmartVideoScriptScene[] {
  return plan.scenes.map((scene) => ({
    say: scene.narration,
    speaker: Boolean(scene.speaker),
    show: scene.blocks.flatMap((block) => {
      if ('items' in block) return block.items.map((item) => ('text' in item ? item.text : `${item.top} ${item.big}`));
      if (block.type === 'number') return [`${block.prefix || ''}${block.value}${block.suffix || ''}`];
      return 'text' in block && block.text ? [block.text.replace(/\s*\n\s*/g, ' ')] : [];
    }),
  }));
}

/** Shared ending of a new video and a revision: save the plan, render, level the sound. */
async function finish(start: SmartVideoJob, result: SmartVideoResult, brief: string, track: (job: SmartVideoJob) => void): Promise<void> {
  let job = start;
  const dir = jobDir(job.userId, job.id);
  const { props, plan, media, durationSeconds, usage, warnings } = result;
  // plan + media are what a later revision starts from
  const saved: SavedPlan = { plan, props, media, brief };
  const { error: planError } = await jobsTable().update({ plan: saved }).eq('id', job.id);
  if (planError) throw new Error(`Could not save the plan: ${planError.message}`);

  job = await writeJob(job, {
    status: 'rendering',
    renderProgress: 0,
    durationSeconds,
    usage,
    warnings,
    script: scriptOf(plan),
    summary: {
      format: plan.format,
      style: plan.style,
      styleReason: plan.styleReason,
      language: plan.language,
      scenes: plan.scenes.length,
      captions: plan.captions,
    },
  });
  let reported = 0;
  track(job);
  const renderedUrl = await render(props, (progress) => {
    job = { ...job, renderProgress: progress };
    track(job);
    if (progress - reported >= 10) {
      reported = progress;
      writeJob(job).catch(() => undefined);
    }
  });

  job = await writeJob(job, { status: 'finishing' });
  const videoUrl = await upload(`${dir}/video.mp4`, await levelLoudness(renderedUrl), 'video/mp4');
  job = await writeJob(job, { status: 'done', videoUrl, renderProgress: 100 });
  track(job);
  console.log(`✅ Smart Video job ${job.id} done: ${videoUrl}`);
}

/**
 * "Leave a note": changes a finished video. The revision is a new job that
 * reuses the original's files, voice and music; the original stays untouched.
 */
export async function reviseSmartVideoJob(input: SmartVideoReviseInput): Promise<ApiResponse<{ jobId: string }>> {
  try {
    const userId = await currentUserId();
    if (!userId) return createApiError('Please sign in again');
    const parsed = SmartVideoReviseSchema.parse(input);
    const parent = await readJob(userId, parsed.jobId);
    if (!parent || parent.status !== 'done') return createApiError('Only a finished video can be changed');
    if ((await runningJobs(userId)) >= MAX_RUNNING_JOBS) return createApiError(TOO_MANY);

    // With new files the edit takes the id its files were uploaded under.
    const jobId = parsed.uploads.length && parsed.uploadJobId ? parsed.uploadJobId : randomUUID();
    if (parsed.uploads.some((u) => !u.path.startsWith(`${jobDir(userId, jobId)}/src/`))) return createApiError('Invalid upload path');
    if (parsed.uploads.length && (await readJob(userId, jobId))) return createApiError('This edit was already started');
    const chargeError = await charge(userId, jobId, PHANTOM_REVISION_CREDITS);
    if (chargeError) return createApiError(chargeError);

    const now = new Date().toISOString();
    const job = await writeJob({
      id: jobId,
      userId,
      status: 'directing',
      brief: parent.brief,
      link: parent.link,
      length: parent.length,
      format: parent.format,
      parentId: parent.id,
      note: parsed.note,
      creditsUsed: PHANTOM_REVISION_CREDITS,
      createdAt: now,
      updatedAt: now,
    });
    after(() => runRevision(job, parent, parsed.uploads));
    return createApiSuccess({ jobId });
  } catch (error) {
    console.error('❌ reviseSmartVideoJob error:', error);
    return createApiError(readable(error, 'Could not start the change'));
  }
}

async function runRevision(initial: SmartVideoJob, parent: SmartVideoJob, uploads: { name: string; path: string }[]): Promise<void> {
  let job = initial;
  const heartbeat = setInterval(() => writeJob(job).catch(() => undefined), 45_000);
  try {
    const parentDir = jobDir(parent.userId, parent.id);
    const saved = await readPlan(parent.userId, parent.id);
    const media = saved.media ?? (await mediaFromProps(saved.props, parentDir, saved.plan.language));
    const dir = jobDir(job.userId, job.id);
    const store = (data: Buffer, name: string, contentType: string) => upload(`${dir}/${name}`, data, contentType);
    // New files continue the numbering of the video's own files (a1, a2, ... then a7, a8).
    const taken = Object.keys(media.assets).map((id) => Number(/^a(\d+)/.exec(id)?.[1] || 0));
    const files: ClientFile[] = await Promise.all(uploads.map(async (u) => ({ filename: u.name, data: await download(u.path) })));
    const added = files.length ? await prepareAssets(files, store, Math.max(0, ...taken) + 1) : [];
    const result = await reviseSmartVideo(
      { plan: saved.plan, media },
      job.note || '',
      saved.brief || parent.brief,
      store,
      (stage) => {
        job = { ...job, status: stage };
        writeJob(job).catch(() => undefined);
      },
      added
    );
    await finish(job, result, saved.brief || parent.brief, (next) => {
      job = next;
    });
  } catch (error) {
    console.error(`❌ Smart Video revision ${job.id} failed:`, error);
    await failAndRefund(job, error instanceof Error ? error.message : 'Unknown error').catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
}

// Videos made before media was saved with the plan: rebuild it from the render props.
async function mediaFromProps(props: Record<string, unknown>, dir: string, language: string): Promise<SmartVideoMedia> {
  const audio = props.audio as { voice: { url: string; cuts: { srcEnd: number }[] }; music?: { url: string }; sfx?: { url?: string }[] };
  const voiceFile = await download(`${dir}/${path.basename(new URL(audio.voice.url).pathname)}`);
  return {
    voice: { url: audio.voice.url, words: await transcribeWords(voiceFile, language), durationSeconds: Math.max(...audio.voice.cuts.map((c) => c.srcEnd)) },
    clipWords: {},
    musicUrl: audio.music?.url ?? null,
    soundUrl: audio.sfx?.find((s) => s.url)?.url ?? null,
    assets: props.assets as SmartVideoMedia['assets'],
  };
}

async function render(props: Record<string, unknown>, onProgress: (percent: number) => void): Promise<string> {
  const started = await startRemotionRender({ compositionId: 'SmartVideo', inputProps: props });
  if (!started.success || !started.renderId) throw new Error(started.error || 'The render did not start');
  // A 3-minute script is ~5,000 frames; the production server renders two at a time.
  for (let waited = 0; waited < 60 * 60; waited += 3) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const progress = await checkRemotionProgress(started.renderId);
    if (progress.status === 'completed' && progress.videoUrl) return progress.videoUrl;
    if (progress.status === 'failed') throw new Error(progress.error || 'The render failed');
    onProgress(Math.round((progress.progress || 0) * 100));
  }
  throw new Error('The render timed out');
}

/** Levels the mix to -14 LUFS (social-media standard); a calm voice otherwise comes out quiet. */
async function levelLoudness(videoUrl: string): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-video-'));
  const output = path.join(dir, 'video.mp4');
  try {
    await run(
      'ffmpeg',
      ['-v', 'error', '-y', '-i', videoUrl, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output],
      { timeout: 5 * 60 * 1000 }
    );
    return await fs.readFile(output);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const DEAD_JOB = 'The job stopped unexpectedly (the server restarted during an update). Please run it again.';

/** A running job keeps its updatedAt fresh with a heartbeat; one that has gone quiet died with its process (deploy, crash). */
const isDead = (job: SmartVideoJob) =>
  job.status !== 'done' && job.status !== 'failed' && Date.now() - Date.parse(job.updatedAt) > STALE_AFTER_MS;

/** The page polls this. A job whose process died (deploy, crash) is reported as failed. */
export async function getSmartVideoJob(jobId: string): Promise<SmartVideoJob | null> {
  const userId = await currentUserId();
  if (!userId || !/^[0-9a-f-]{36}$/.test(jobId)) return null;
  const job = await readJob(userId, jobId);
  if (!job) return null;
  if (isDead(job)) return forViewer(await failAndRefund(job, DEAD_JOB));
  // Videos finished before the script was saved with the job: read it from their plan once.
  if (job.status === 'done' && !job.script) {
    try {
      const saved = await readPlan(userId, jobId);
      return forViewer(await writeJob(job, { script: scriptOf(saved.plan) }));
    } catch {
      return forViewer(job);
    }
  }
  return forViewer(job);
}

export async function listSmartVideoJobs(): Promise<SmartVideoJob[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data } = await jobsTable().select('job').eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
  // The library settles dead jobs too: a job that died while nobody watched it would otherwise
  // stay "Working" forever, keep its credits, and count against the two-at-once limit.
  const jobs = await Promise.all(
    ((data || []) as { job: SmartVideoJob }[]).map((row) => (isDead(row.job) ? failAndRefund(row.job, DEAD_JOB).catch(() => row.job) : row.job))
  );
  return jobs.map(forViewer);
}
