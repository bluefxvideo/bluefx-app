'use server';

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { ZodError } from 'zod';
import { createAdminClient, createClient } from '@/app/supabase/server';
import { transcribeWords } from '@/lib/smart-video/audio';
import { refundFailedGeneration, refundSentence } from '@/lib/credits/refund';
import { createSmartVideo, reviseSmartVideo, type SmartVideoMedia, type SmartVideoResult } from '@/lib/smart-video/pipeline';
import { LISTING_CLIP_CREDITS, LISTING_CREDITS, PHANTOM_REVISION_CREDITS, phantomCredits } from '@/lib/smart-video/pricing';
import { LISTING_MIN_PHOTOS, listingLinkPhotos, listingPhotoCount, type ListingOptions } from '@/lib/smart-video/listing';
import type { DirectorPlan } from '@/lib/smart-video/types';
import { prepareAssets, type ClientFile } from '@/lib/smart-video/prepare-assets';
import { downloadLinkPhotos, fromLink } from '@/lib/smart-video/sources';
import { levelLoudness, renderSmartVideo } from '@/lib/smart-video/render';
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

type JobRow = { job: SmartVideoJob; updated_at: string };
// The column is the truth for "when did this job last show life": the heartbeat only touches the column.
const fromRow = (row: JobRow): SmartVideoJob => ({ ...row.job, updatedAt: row.updated_at });
const FINAL = '(done,failed)';

async function readJob(userId: string, jobId: string): Promise<SmartVideoJob | null> {
  const { data, error } = await jobsTable().select('job, updated_at').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Could not read the job: ${error.message}`);
  return data ? fromRow(data as JobRow) : null;
}

/**
 * Saves of one job land in the order they were made. Without this, a background save that stalled on
 * the network arrived after the final "done" save and put the job back to "rendering 94%" for good
 * (2026-09-21: the video was finished and stored, the page never learned).
 */
const saveQueue = new Map<string, Promise<unknown>>();
function inOrder<T>(jobId: string, save: () => Promise<T>): Promise<T> {
  const next = (saveQueue.get(jobId) || Promise.resolve()).catch(() => undefined).then(save);
  saveQueue.set(jobId, next);
  next.finally(() => saveQueue.get(jobId) === next && saveQueue.delete(jobId)).catch(() => undefined);
  return next;
}

/** The first save of a job. */
function createJob(job: SmartVideoJob): Promise<SmartVideoJob> {
  return inOrder(job.id, () =>
    withRetry('Saving the job', async () => {
      const { error } = await jobsTable().insert({
        id: job.id,
        user_id: job.userId,
        parent_id: job.parentId ?? null,
        status: job.status,
        job,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      });
      if (error) throw new Error(error.message);
      return job;
    })
  );
}

/** Every later save. A progress save can never undo a finished or failed job, whenever it arrives. */
function writeJob(job: SmartVideoJob, patch: Partial<SmartVideoJob> = {}): Promise<SmartVideoJob> {
  const next = { ...job, ...patch, updatedAt: new Date().toISOString() };
  const final = next.status === 'done' || next.status === 'failed';
  return inOrder(next.id, () =>
    withRetry('Saving the job', async () => {
      const update = jobsTable().update({ status: next.status, job: next, updated_at: next.updatedAt }).eq('id', next.id);
      const { error } = await (final ? update : update.not('status', 'in', FINAL));
      if (error) throw new Error(error.message);
      return next;
    })
  );
}

/** The heartbeat: "still alive", nothing else. It carries no job data, so it has nothing stale to write. */
function touchJob(jobId: string): Promise<void> {
  return inOrder(jobId, async () => {
    await jobsTable().update({ updated_at: new Date().toISOString() }).eq('id', jobId).not('status', 'in', FINAL);
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
async function charge(userId: string, jobId: string, credits: number, operation = 'smart-video'): Promise<string | null> {
  const { deductCredits } = await import('@/actions/database/cinematographer-database');
  const result = await deductCredits(userId, credits, operation, { job_id: jobId });
  return result.success ? null : result.error || 'Credit deduction failed';
}

/**
 * A listing video's animated photos are charged one by one, when each clip is ordered. Each charge
 * has its own reference, so the clip that fails (or the whole video) gets exactly its credits back.
 * The key is "batch_id", never "job_id": the video's own charge must stay the only debit under the job id.
 */
const clipReference = (jobId: string, assetId: string) => `${jobId}-clip-${assetId}`;

async function chargeClip(job: SmartVideoJob, assetId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc('deduct_user_credits', {
    p_user_id: job.userId,
    p_amount: LISTING_CLIP_CREDITS,
    p_operation: 'listing-video-clip',
    p_metadata: { batch_id: clipReference(job.id, assetId), video: job.id },
  });
  const charged = !error && Boolean((data as { success?: boolean } | null)?.success);
  if (!charged) console.warn(`⚠️ Listing clip ${assetId} of job ${job.id} was not charged, the photo stays still:`, error?.message || data);
  return charged;
}

async function refundClip(job: SmartVideoJob, assetId: string): Promise<number> {
  const refund = await refundFailedGeneration({ userId: job.userId, referenceIds: [clipReference(job.id, assetId)], operation: 'listing photo animation' });
  return refund.refunded ? (refund.amount ?? 0) : 0;
}

/**
 * The animated photos a listing video was charged for, read from the ledger: a job that died
 * between a charge and its next save still gets every credit back.
 */
async function chargedClips(job: SmartVideoJob): Promise<string[]> {
  if (!job.listing?.animate) return [];
  const saved = (job.clipCharges ?? []).map((assetId) => clipReference(job.id, assetId));
  const { data, error } = await createAdminClient()
    .from('credit_transactions')
    .select('metadata')
    .eq('user_id', job.userId)
    .eq('transaction_type', 'debit')
    .filter('metadata->>video', 'eq', job.id);
  if (error) {
    console.warn(`⚠️ Could not read the clip charges of job ${job.id}, using the ones saved with the job:`, error.message);
    return saved;
  }
  const ledger = (data || []).map((row) => (row.metadata as { batch_id?: string } | null)?.batch_id).filter((r): r is string => Boolean(r));
  return [...new Set([...ledger, ...saved])];
}

/** Credits a user can spend right now. */
async function availableCredits(userId: string): Promise<number> {
  const { data } = await createAdminClient().from('user_credits').select('available_credits').eq('user_id', userId).single();
  return data?.available_credits ?? 0;
}

async function failAndRefund(job: SmartVideoJob, reason: string): Promise<SmartVideoJob> {
  const refund = job.creditsUsed
    ? await refundFailedGeneration({ userId: job.userId, referenceIds: [job.id], operation: job.listing ? 'listing video' : 'Phantom video' })
    : { refunded: false as const };
  // A listing video that fails also gives back the photos it had already animated
  // (one after the other: a refund reads the balance and writes it back)
  let returned = refund.refunded ? (refund.amount ?? 0) : 0;
  for (const reference of await chargedClips(job).catch(() => [] as string[])) {
    const clip = await refundFailedGeneration({ userId: job.userId, referenceIds: [reference], operation: 'listing photo animation' }).catch(() => null);
    if (clip?.refunded) returned += clip.amount ?? 0;
  }
  const error = returned > 0 ? `${reason} ${refundSentence(returned)}` : reason;
  return writeJob(job, { status: 'failed', error });
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
      ...(listing ? { listing } : {}),
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
  // Listing video: the photos whose animation is paid for so far
  const clipCharges: string[] = [];
  // Refunds run one at a time: each reads the balance and writes it back, so two at once would lose one.
  let refunds: Promise<void> = Promise.resolve();
  const dir = jobDir(job.userId, job.id);
  // A heartbeat keeps updatedAt fresh, so the page can tell a slow job from a dead one.
  const heartbeat = setInterval(() => touchJob(job.id).catch(() => undefined), 45_000);
  try {
    console.log(`🎬 Smart Video job ${job.id}: ${uploads.length} files${job.link ? ' + link' : ''}`);
    const files: ClientFile[] = await Promise.all(uploads.map(async (u) => ({ filename: u.name, data: await download(u.path) })));

    let brief = job.brief;
    if (job.link) {
      // A listing video takes its photos from the whole listing, more of them than a general video uses
      const linkPhotos = job.listing ? listingLinkPhotos(uploads.length) : undefined;
      const link = await fromLink(job.link, linkPhotos);
      files.push(...(await downloadLinkPhotos(link.imageUrls, linkPhotos)));
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
        look: job.look && job.look !== 'auto' ? job.look : null,
        sound: soundOf(job),
        listing: job.listing ?? null,
        clips: job.listing?.animate
          ? {
              // Every charge is saved with the job at once: a job that dies half-way still knows what to give back.
              charge: async (assetId) => {
                const charged = await chargeClip(job, assetId);
                if (charged) {
                  clipCharges.push(assetId);
                  job = { ...job, clipCharges: [...clipCharges] };
                  writeJob(job).catch(() => undefined);
                }
                return charged;
              },
              refund: (assetId) =>
                (refunds = refunds
                  .then(async () => {
                    if ((await refundClip(job, assetId)) === 0) return;
                    clipCharges.splice(clipCharges.indexOf(assetId), 1);
                    job = { ...job, clipCharges: [...clipCharges] };
                    writeJob(job).catch(() => undefined);
                  })
                  .catch((error) => console.warn(`⚠️ Refund of listing clip ${assetId} failed:`, String(error).slice(0, 160)))),
            }
          : undefined,
        onStage: (stage) => {
          job = { ...job, status: stage };
          writeJob(job).catch(() => undefined);
        },
      }
    );
    // What a listing video cost in the end: its own price plus the photos that were animated
    if (job.listing) job = { ...job, clipCharges: [...clipCharges], creditsUsed: (initial.creditsUsed ?? 0) + clipCharges.length * LISTING_CLIP_CREDITS };
    await finish(job, result, brief, (next) => {
      job = next;
    });
  } catch (error) {
    console.error(`❌ Smart Video job ${job.id} failed:`, error);
    await failAndRefund({ ...job, clipCharges: [...clipCharges] }, error instanceof Error ? error.message : 'Unknown error').catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
}

/** Voice-over and music of a job; a job made before the switches existed has both. */
const soundOf = (job: SmartVideoJob) => ({ voiceOver: job.voiceOver !== false, music: job.music !== false });

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
  const renderedUrl = await renderSmartVideo(props, (progress) => {
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
  const { data } = await jobsTable().select('job, updated_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
  // The library settles dead jobs too: a job that died while nobody watched it would otherwise
  // stay "Working" forever, keep its credits, and count against the two-at-once limit.
  const jobs = await Promise.all(
    ((data || []) as JobRow[]).map(fromRow).map((job) => (isDead(job) ? failAndRefund(job, DEAD_JOB).catch(() => job) : job))
  );
  return jobs.map(forViewer);
}
