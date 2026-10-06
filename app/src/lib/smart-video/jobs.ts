import path from 'node:path';
import { createAdminClient } from '@/app/supabase/server';
import { refundFailedGeneration, refundSentence } from '@/lib/credits/refund';
import { createSmartVideo, type SmartVideoMedia, type SmartVideoOptions, type SmartVideoResult } from '@/lib/smart-video/pipeline';
import { LISTING_CLIP_CREDITS } from '@/lib/smart-video/pricing';
import { listingLinkPhotos } from '@/lib/smart-video/listing';
import type { DirectorPlan, SmartAsset } from '@/lib/smart-video/types';
import { prepareAssets, type ClientFile } from '@/lib/smart-video/prepare-assets';
import { downloadLinkPhotos, fromLink } from '@/lib/smart-video/sources';
import { levelLoudness, renderSmartVideo } from '@/lib/smart-video/render';
import { usageOf } from '@/lib/smart-video/usage';
import type { SmartVideoJob, SmartVideoScriptScene } from '@/types/smart-video';

/**
 * The Phantom's job runner: everything that happens to a job once it has been started
 * (reading, directing, producing, rendering, saving, refunding). It moved here unchanged
 * from actions/tools/smart-video.ts, so the free video funnel runs the same code as the
 * paying users.
 *
 * This is a plain server module on purpose, without the server-action directive. NEVER import
 * it from a client component, and NEVER re-export anything from it in a server-action file
 * (like actions/tools/smart-video.ts): every export of such a file becomes a public,
 * unauthenticated server action, and the functions here start paid jobs, write job rows and
 * give credits back without checking who asks. Their callers check the session (or the
 * funnel's own gate) first.
 */

export const BUCKET = 'script-videos';
export const STALE_AFTER_MS = 12 * 60 * 1000;

export const jobDir = (userId: string, jobId: string) => `smart-video/${userId}/${jobId}`;
export const safeName = (name: string) => name.replace(/[^\w.-]+/g, '_').slice(-80);

// smart_video_jobs is newer than the generated database types.
export const jobsTable = () => (createAdminClient() as any).from('smart_video_jobs');

export function publicUrl(storagePath: string): string {
  return createAdminClient().storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Storage now and then answers with a gateway error page instead of JSON; the
 * client library then throws a bare SyntaxError. One hiccup must not kill a
 * job that saves thirty files, so every storage call gets three tries.
 */
export async function withRetry<T>(what: string, call: () => Promise<T>): Promise<T> {
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

export function upload(storagePath: string, data: Buffer, contentType: string): Promise<string> {
  return withRetry(`Saving ${path.basename(storagePath)}`, async () => {
    const { error } = await createAdminClient().storage.from(BUCKET).upload(storagePath, data, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return publicUrl(storagePath);
  });
}

export function download(storagePath: string): Promise<Buffer> {
  return withRetry(`Loading ${path.basename(storagePath)}`, async () => {
    const { data, error } = await createAdminClient().storage.from(BUCKET).download(storagePath);
    if (error || !data) throw new Error(error?.message || 'no data');
    return Buffer.from(await data.arrayBuffer());
  });
}

export type JobRow = { job: SmartVideoJob; updated_at: string };
// The column is the truth for "when did this job last show life": the heartbeat only touches the column.
export const fromRow = (row: JobRow): SmartVideoJob => ({ ...row.job, updatedAt: row.updated_at });
export const FINAL = '(done,failed)';

export async function readJob(userId: string, jobId: string): Promise<SmartVideoJob | null> {
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
export function inOrder<T>(jobId: string, save: () => Promise<T>): Promise<T> {
  const next = (saveQueue.get(jobId) || Promise.resolve()).catch(() => undefined).then(save);
  saveQueue.set(jobId, next);
  next.finally(() => saveQueue.get(jobId) === next && saveQueue.delete(jobId)).catch(() => undefined);
  return next;
}

/** The first save of a job. */
export function createJob(job: SmartVideoJob): Promise<SmartVideoJob> {
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
export function writeJob(job: SmartVideoJob, patch: Partial<SmartVideoJob> = {}): Promise<SmartVideoJob> {
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
export function touchJob(jobId: string): Promise<void> {
  return inOrder(jobId, async () => {
    await jobsTable().update({ updated_at: new Date().toISOString() }).eq('id', jobId).not('status', 'in', FINAL);
  });
}

export interface SavedPlan {
  plan: DirectorPlan;
  props: Record<string, unknown>;
  media?: SmartVideoMedia;
  brief?: string;
}

export async function readPlan(userId: string, jobId: string): Promise<SavedPlan> {
  const { data, error } = await jobsTable().select('plan').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error || !data?.plan) throw new Error(error?.message || 'This video has no saved plan');
  return data.plan as SavedPlan;
}

/** Jobs of this user that are still working (a job with a stale heartbeat is dead, not running). */
export async function runningJobs(userId: string): Promise<number> {
  const alive = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { count } = await jobsTable()
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('status', 'in', '(done,failed)')
    .gt('updated_at', alive);
  return count ?? 0;
}

/**
 * A listing video's animated photos are charged one by one, when each clip is ordered. Each charge
 * has its own reference, so the clip that fails (or the whole video) gets exactly its credits back.
 * The key is "batch_id", never "job_id": the video's own charge must stay the only debit under the job id.
 */
export const clipReference = (jobId: string, assetId: string) => `${jobId}-clip-${assetId}`;

export async function chargeClip(job: SmartVideoJob, assetId: string): Promise<boolean> {
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

export async function refundClip(job: SmartVideoJob, assetId: string): Promise<number> {
  const refund = await refundFailedGeneration({ userId: job.userId, referenceIds: [clipReference(job.id, assetId)], operation: 'listing photo animation' });
  return refund.refunded ? (refund.amount ?? 0) : 0;
}

/**
 * The animated photos a listing video was charged for, read from the ledger: a job that died
 * between a charge and its next save still gets every credit back.
 */
export async function chargedClips(job: SmartVideoJob): Promise<string[]> {
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

export async function failAndRefund(job: SmartVideoJob, reason: string): Promise<SmartVideoJob> {
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

/**
 * What another caller (the free video funnel) changes about a job. A paying user's job passes
 * none of them and runs exactly as before.
 */
export interface SmartVideoRunHooks {
  /** Reads the job's link instead of fromLink + downloadLinkPhotos. */
  readLink?: (link: string) => Promise<{ brief: string; files: ClientFile[] }>;
  /** Changes the options the video is made with; runs after prepareAssets, so it sees the real photos. */
  options?: (base: SmartVideoOptions, assets: SmartAsset[]) => SmartVideoOptions;
  /** Changes the finished result just before finish() renders it. */
  beforeRender?: (result: SmartVideoResult) => SmartVideoResult;
  /** Hears about every file the job saves, the moment it is saved (the free video ad's live status page). */
  onStored?: (name: string, url: string) => void;
}

export async function runSmartVideoJob(initial: SmartVideoJob, uploads: { name: string; path: string }[], hooks: SmartVideoRunHooks = {}): Promise<void> {
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
    if (job.link && hooks.readLink) {
      const read = await hooks.readLink(job.link);
      files.push(...read.files);
      brief = job.brief.trim() ? `${read.brief}\n\nNOTE FROM THE CLIENT:\n${job.brief}` : read.brief;
    } else if (job.link) {
      // A listing video takes its photos from the whole listing, more of them than a general video uses
      const linkPhotos = job.listing ? listingLinkPhotos(uploads.length) : undefined;
      const link = await fromLink(job.link, linkPhotos);
      files.push(...(await downloadLinkPhotos(link.imageUrls, linkPhotos)));
      brief = job.brief.trim() ? `${link.brief}\n\nNOTE FROM THE CLIENT:\n${job.brief}` : link.brief;
    }

    const store = hooks.onStored
      ? async (data: Buffer, name: string, contentType: string) => {
          const url = await upload(`${dir}/${name}`, data, contentType);
          hooks.onStored?.(name, url);
          return url;
        }
      : (data: Buffer, name: string, contentType: string) => upload(`${dir}/${name}`, data, contentType);
    const assets = await prepareAssets(files, store);
    const base: SmartVideoOptions = {
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
    };
    const result = await createSmartVideo(
      brief,
      assets,
      store,
      (url) => download(`${dir}/${path.basename(new URL(url).pathname)}`),
      hooks.options ? hooks.options(base, assets) : base
    );
    // What a listing video cost in the end: its own price plus the photos that were animated
    if (job.listing) job = { ...job, clipCharges: [...clipCharges], creditsUsed: (initial.creditsUsed ?? 0) + clipCharges.length * LISTING_CLIP_CREDITS };
    await finish(job, hooks.beforeRender ? hooks.beforeRender(result) : result, brief, (next) => {
      job = next;
    });
  } catch (error) {
    console.error(`❌ Smart Video job ${job.id} failed:`, error);
    // What the job had already spent at the APIs is kept with it (forViewer keeps it off the page).
    const spent = usageOf(error);
    await failAndRefund({ ...job, clipCharges: [...clipCharges], ...(spent.length ? { usage: spent } : {}) }, error instanceof Error ? error.message : 'Unknown error').catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
}

/** Voice-over and music of a job; a job made before the switches existed has both. */
export const soundOf = (job: SmartVideoJob) => ({ voiceOver: job.voiceOver !== false, music: job.music !== false });

// The words a block puts on screen, for the script shown under the video.
export function scriptOf(plan: DirectorPlan): SmartVideoScriptScene[] {
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
export async function finish(start: SmartVideoJob, result: SmartVideoResult, brief: string, track: (job: SmartVideoJob) => void): Promise<void> {
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

export const DEAD_JOB = 'The job stopped unexpectedly (the server restarted during an update). Please run it again.';

/** A running job keeps its updatedAt fresh with a heartbeat; one that has gone quiet died with its process (deploy, crash). */
export const isDead = (job: SmartVideoJob) =>
  job.status !== 'done' && job.status !== 'failed' && Date.now() - Date.parse(job.updatedAt) > STALE_AFTER_MS;
