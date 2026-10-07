'use server';

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { ZodError } from 'zod';
import { createAdminClient, createClient } from '@/app/supabase/server';
import { transcribeWords } from '@/lib/smart-video/audio';
import { reviseSmartVideo, type SmartVideoMedia } from '@/lib/smart-video/pipeline';
import { LISTING_CLIP_CREDITS, LISTING_CREDITS, PHANTOM_PRESENTER_CREDITS, PHANTOM_REVISION_CREDITS, phantomCredits } from '@/lib/smart-video/pricing';
import { LISTING_MIN_PHOTOS, listingLinkPhotos, listingPhotoCount, type ListingOptions } from '@/lib/smart-video/listing';
import { prepareAssets, type ClientFile } from '@/lib/smart-video/prepare-assets';
import {
  BUCKET,
  DEAD_JOB,
  chargePresenter,
  createJob,
  download,
  failAndRefund,
  finish,
  fromRow,
  isDead,
  jobDir,
  jobsTable,
  readJob,
  readPlan,
  runSmartVideoJob,
  runningJobs,
  safeName,
  scriptOf,
  soundOf,
  touchJob,
  upload,
  writeJob,
  type JobRow,
} from '@/lib/smart-video/jobs';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';
import {
  SmartVideoReviseSchema,
  SmartVideoStartSchema,
  SmartVideoUploadRequestSchema,
  type SmartVideoJob,
  type SmartVideoReviseInput,
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

/**
 * SECURITY: every export of this 'use server' file is a public server action that anyone can call.
 * Nothing that starts, settles or charges a job without a session may ever be exported from here.
 * The runner and its helpers live in lib/smart-video/jobs.ts and are only imported.
 */

// One video costs up to about $1 in API fees before it can fail; nobody needs more than two at once.
const MAX_RUNNING_JOBS = 2;

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
async function charge(userId: string, jobId: string, credits: number, operation = 'smart-video'): Promise<string | null> {
  const { deductCredits } = await import('@/actions/database/cinematographer-database');
  const result = await deductCredits(userId, credits, operation, { job_id: jobId });
  return result.success ? null : result.error || 'Credit deduction failed';
}

/** Credits a user can spend right now. */
async function availableCredits(userId: string): Promise<number> {
  const { data } = await createAdminClient().from('user_credits').select('available_credits').eq('user_id', userId).single();
  return data?.available_credits ?? 0;
}

/** Step 2: start the job. Returns at once; the work happens in after(). */
export async function startSmartVideo(input: SmartVideoStartInput): Promise<ApiResponse<{ jobId: string }>> {
  try {
    const userId = await currentUserId();
    if (!userId) return createApiError('Please sign in again');
    const parsed = SmartVideoStartSchema.parse(input);
    if (!parsed.brief.trim() && !parsed.link) {
      return createApiError(parsed.listing ? 'Paste the listing link, or write the address and the facts of the home' : 'Write what the video is about, or paste a link');
    }
    if (parsed.uploads.some((u) => !u.path.startsWith(`${jobDir(userId, parsed.jobId)}/src/`))) return createApiError('Invalid upload path');
    if (await readJob(userId, parsed.jobId)) return createApiError('This video was already started');
    if ((await runningJobs(userId)) >= MAX_RUNNING_JOBS) return createApiError(TOO_MANY);

    // The product has no still-photo listing video (the owner's call, 2026-10-02): every photo is animated.
    const instructions = parsed.listing?.instructions?.trim();
    const listing: ListingOptions | undefined = parsed.listing
      ? { seconds: parsed.listing.seconds, animate: true, ...(instructions ? { instructions } : {}) }
      : undefined;
    if (listing && !parsed.link && parsed.uploads.length < LISTING_MIN_PHOTOS) {
      return createApiError(`Add at least ${LISTING_MIN_PHOTOS} photos of the home, or paste the listing link`);
    }
    const credits = listing ? LISTING_CREDITS : phantomCredits(parsed.brief, parsed.length === 'script');
    // The AI presenter opens vertical Phantom videos only (presenter.ts films 9:16); it is charged on its own.
    const presenter = parsed.presenter && !listing && parsed.format !== 'horizontal';
    if (presenter) {
      const needed = credits + PHANTOM_PRESENTER_CREDITS;
      const balance = await availableCredits(userId);
      if (balance < needed) {
        return createApiError(`This video needs ${needed} credits: ${credits} for the video and ${PHANTOM_PRESENTER_CREDITS} for the AI presenter. You have ${balance}.`);
      }
    }
    if (listing) {
      // The clips are charged photo by photo while the video is made: the balance has to cover all of them now.
      const photos = listingPhotoCount(listing.seconds, (parsed.link ? listingLinkPhotos(parsed.uploads.length) : 0) + parsed.uploads.length);
      const needed = credits + photos * LISTING_CLIP_CREDITS;
      const balance = await availableCredits(userId);
      if (balance < needed) {
        return createApiError(`This video needs ${needed} credits: ${credits} for the video and ${LISTING_CLIP_CREDITS} for each of ${photos} animated photos. You have ${balance}.`);
      }
    }
    const chargeError = await charge(userId, parsed.jobId, credits, listing ? 'listing-video' : 'smart-video');
    if (chargeError) return createApiError(chargeError);
    const presenterPaid = presenter ? await chargePresenter(userId, parsed.jobId) : false;

    const now = new Date().toISOString();
    const job = await createJob({
      id: parsed.jobId,
      userId,
      status: 'reading',
      brief: parsed.brief,
      link: parsed.link || undefined,
      length: parsed.length,
      format: parsed.format,
      look: parsed.look,
      voiceOver: parsed.voiceOver,
      music: parsed.music,
      ...(presenterPaid ? { presenter: true } : {}),
      ...(listing ? { listing } : {}),
      creditsUsed: credits + (presenterPaid ? PHANTOM_PRESENTER_CREDITS : 0),
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
    const sound = { voiceOver: parsed.voiceOver ?? soundOf(parent).voiceOver, music: parsed.music ?? soundOf(parent).music };
    const sameSound = sound.voiceOver === soundOf(parent).voiceOver && sound.music === soundOf(parent).music;
    if (!parsed.note && sameSound && !parsed.uploads.length) return createApiError('Write what to change, or switch the voice-over or the music');
    if ((await runningJobs(userId)) >= MAX_RUNNING_JOBS) return createApiError(TOO_MANY);

    // With new files the edit takes the id its files were uploaded under.
    const jobId = parsed.uploads.length && parsed.uploadJobId ? parsed.uploadJobId : randomUUID();
    if (parsed.uploads.some((u) => !u.path.startsWith(`${jobDir(userId, jobId)}/src/`))) return createApiError('Invalid upload path');
    if (parsed.uploads.length && (await readJob(userId, jobId))) return createApiError('This edit was already started');
    const chargeError = await charge(userId, jobId, PHANTOM_REVISION_CREDITS);
    if (chargeError) return createApiError(chargeError);

    const now = new Date().toISOString();
    const job = await createJob({
      id: jobId,
      userId,
      status: 'directing',
      brief: parent.brief,
      link: parent.link,
      length: parent.length,
      format: parent.format,
      look: parent.look,
      // The new version keeps the sound of the video it changes, unless the edit switches it.
      voiceOver: sound.voiceOver,
      music: sound.music,
      ...(parent.listing ? { listing: parent.listing } : {}),
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
  const heartbeat = setInterval(() => touchJob(job.id).catch(() => undefined), 45_000);
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
      added,
      soundOf(job)
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
  const { data } = await jobsTable().select('job, updated_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
  // The library settles dead jobs too: a job that died while nobody watched it would otherwise
  // stay "Working" forever, keep its credits, and count against the two-at-once limit.
  const jobs = await Promise.all(
    ((data || []) as JobRow[]).map(fromRow).map((job) => (isDead(job) ? failAndRefund(job, DEAD_JOB).catch(() => job) : job))
  );
  return jobs.map(forViewer);
}
