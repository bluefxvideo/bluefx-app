'use server';

/**
 * Rough-Cut Editor — server actions.
 *
 * Flow:
 *   1. The browser extracts a small MP3 from the video with ffmpeg.wasm. The video never leaves the user's computer.
 *   2. requestRoughcutUpload() creates the job row and returns a signed upload URL.
 *   3. The browser PUTs the MP3 straight to Supabase Storage (bypasses Next.js body limits).
 *   4. startRoughcutJob() validates the upload, charges credits and dispatches the worker.
 *   5. The worker (video-roughcut-worker) transcribes, asks Claude for the cuts, writes the XML,
 *      and reports back to /api/webhooks/video-roughcut. The page polls getRoughcutJobStatus().
 *   6. getRoughcutDownloadUrl() hands the user a short-lived signed link to the XML.
 */

import { createClient, createAdminClient } from '@/app/supabase/server';
import {
  createRoughcutJob,
  failStaleRoughcutJobs,
  getRoughcutJob,
  listRoughcutJobs,
  refundRoughcutCredits,
  updateRoughcutJob,
  type RoughcutJob,
} from '@/actions/database/video-roughcut-database';
import { refundSentence } from '@/lib/credits/refund';
import { roughcutCredits } from '@/lib/video-roughcut/pricing';

const BUCKET = 'video-roughcut';
const MIN_DURATION_SECONDS = 30;
const MAX_DURATION_SECONDS = 60 * 60;
/** The browser encodes 64 kbps MP3: 8,000 bytes per second of audio. */
const MP3_BYTES_PER_SECOND = 8000;

/** Why a video of this length can't be processed, or null when it can. */
function durationError(duration: number): string | null {
  if (duration < MIN_DURATION_SECONDS) {
    return `The video must be at least ${MIN_DURATION_SECONDS} seconds long. This one is ${Math.round(duration)} seconds.`;
  }
  if (duration > MAX_DURATION_SECONDS) {
    return `The video must be under ${MAX_DURATION_SECONDS / 60} minutes. This one is ${Math.round(duration / 60)} minutes.`;
  }
  return null;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

export interface RoughcutQuote {
  success: boolean;
  error?: string;
  credits?: number;
  /** The same audio was transcribed before, so the job is half price. */
  rerun?: boolean;
}

/**
 * Step 0: the price, shown before anything is uploaded or charged. Uses the same
 * pricing function and cache check as startRoughcutJob.
 */
export async function quoteRoughcutJob(input: { durationSeconds: number; audioHash: string }): Promise<RoughcutQuote> {
  try {
    const userId = await currentUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };
    const duration = Number(input.durationSeconds) || 0;
    const tooLongOrShort = durationError(duration);
    if (tooLongOrShort) return { success: false, error: tooLongOrShort };
    const rerun = /^[a-f0-9]{64}$/.test(input.audioHash) && (await isTranscriptionCached(input.audioHash));
    return { success: true, credits: roughcutCredits(duration, rerun), rerun };
  } catch (err: unknown) {
    console.error('❌ quoteRoughcutJob error:', err);
    return { success: false, error: 'Could not work out the price. Please try again.' };
  }
}

export interface RequestUploadInput {
  videoFilename: string;
  audioHash: string;
  videoMetadata: {
    width: number;
    height: number;
    duration: number;
    frameRate: number;
  };
}

export interface RequestUploadResult {
  success: boolean;
  jobId?: string;
  uploadUrl?: string;
  uploadPath?: string;
  error?: string;
}

/**
 * Step 1: reserve a job row and return a signed upload URL.
 * No credits are charged yet.
 */
export async function requestRoughcutUpload(input: RequestUploadInput): Promise<RequestUploadResult> {
  try {
    const userId = await currentUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };

    const duration = input.videoMetadata?.duration || 0;
    const tooLongOrShort = durationError(duration);
    if (tooLongOrShort) return { success: false, error: tooLongOrShort };

    const job = await createRoughcutJob({
      userId,
      videoFilename: input.videoFilename,
      audioHash: input.audioHash,
      videoWidth: input.videoMetadata.width,
      videoHeight: input.videoMetadata.height,
      videoDurationSeconds: duration,
      videoFrameRate: input.videoMetadata.frameRate,
    });

    const storagePath = `audio/${userId}/${job.id}.mp3`;
    const admin = createAdminClient();
    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (signedError || !signed?.signedUrl) {
      await updateRoughcutJob(job.id, {
        status: 'failed',
        status_reason: `Could not create upload URL: ${signedError?.message || 'unknown'}`,
      });
      return { success: false, error: 'Could not create upload URL' };
    }

    return { success: true, jobId: job.id, uploadUrl: signed.signedUrl, uploadPath: storagePath };
  } catch (err: unknown) {
    console.error('❌ requestRoughcutUpload error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export interface StartJobInput {
  jobId: string;
  uploadPath: string;
  /** The source's media layout as ffmpeg read it in the browser. Goes into the XML only. */
  media?: {
    hasVideo?: boolean;
    audioStreams?: number[];
    audioSampleRate?: number;
    nominalFrameRate?: number;
  };
}

/** Client-supplied values: keep only what is plausible, so the XML stays valid. */
function sanitizeMedia(media: StartJobInput['media']) {
  const audioStreams = (Array.isArray(media?.audioStreams) ? media.audioStreams : [])
    .map((c) => Math.round(Number(c)))
    .filter((c) => c >= 1 && c <= 64)
    .slice(0, 16);
  const rate = Math.round(Number(media?.audioSampleRate));
  const nominal = Number(media?.nominalFrameRate);
  return {
    nominalFrameRate: nominal >= 1 && nominal <= 240 ? nominal : undefined,
    hasVideo: media?.hasVideo !== false,
    audioStreams: audioStreams.length > 0 ? audioStreams : undefined,
    audioSampleRate: rate >= 8000 && rate <= 384000 ? rate : undefined,
  };
}

export interface StartJobResult {
  success: boolean;
  error?: string;
  creditsUsed?: number;
}

/**
 * Step 2: after the MP3 upload, validate it, charge credits and dispatch the worker.
 * Credits are only kept if the worker accepts the job; failures are refunded.
 */
export async function startRoughcutJob(input: StartJobInput): Promise<StartJobResult> {
  let creditsCharged = 0;
  let userId: string | null = null;
  try {
    userId = await currentUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };

    const job = await getRoughcutJob(input.jobId, userId);
    if (!job) return { success: false, error: 'Job not found' };
    if (job.status !== 'uploading') {
      return { success: false, error: `Job is ${job.status}, cannot start` };
    }
    if (input.uploadPath !== `audio/${userId}/${job.id}.mp3`) {
      return { success: false, error: 'Upload path does not match this job' };
    }

    await updateRoughcutJob(input.jobId, { status: 'validating' });
    const admin = createAdminClient();

    // Check the upload exists and read its size without downloading it.
    const { data: listing, error: listError } = await admin.storage
      .from(BUCKET)
      .list(`audio/${userId}`, { search: `${job.id}.mp3`, limit: 1 });
    const file = listing?.find((f) => f.name === `${job.id}.mp3`);
    const size = Number(file?.metadata?.size ?? 0);

    if (listError || !file) {
      await updateRoughcutJob(input.jobId, { status: 'failed', status_reason: 'The audio upload was not found' });
      return { success: false, error: 'Audio upload not found' };
    }
    if (size < 50_000) {
      await updateRoughcutJob(input.jobId, { status: 'failed', status_reason: 'The audio is too short or silent' });
      return { success: false, error: 'The audio is too short or silent' };
    }

    // Bill on the longer of the reported duration and what the MP3 size implies,
    // so a wrong duration from the browser can't undercharge.
    const reported = job.video_duration_seconds ?? 0;
    const billableSeconds = Math.max(reported, (size / MP3_BYTES_PER_SECOND) * 0.95);
    if (billableSeconds > MAX_DURATION_SECONDS * 1.05) {
      await updateRoughcutJob(input.jobId, {
        status: 'failed',
        status_reason: `The audio is longer than ${MAX_DURATION_SECONDS / 60} minutes`,
      });
      return { success: false, error: `The video must be under ${MAX_DURATION_SECONDS / 60} minutes.` };
    }

    const cacheHit = job.audio_hash ? await isTranscriptionCached(job.audio_hash) : false;
    const creditsToCharge = roughcutCredits(billableSeconds, cacheHit);

    const { deductCredits } = await import('@/actions/database/cinematographer-database');
    // job_id is how refundFailedGeneration finds this debit if the job fails.
    const creditResult = await deductCredits(userId, creditsToCharge, 'video-roughcut', {
      job_id: job.id,
      videoFilename: job.video_filename,
      cacheHit,
      billableSeconds: Math.round(billableSeconds),
    });
    if (!creditResult.success) {
      await updateRoughcutJob(input.jobId, {
        status: 'failed',
        status_reason: `Credit deduction failed: ${creditResult.error}`,
      });
      return { success: false, error: creditResult.error || 'Credit deduction failed' };
    }
    creditsCharged = creditsToCharge;
    await updateRoughcutJob(input.jobId, { credits_used: creditsToCharge });

    // The worker gets a short-lived signed URL; the bucket is private.
    const { data: audioLink, error: audioLinkError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(input.uploadPath, 60 * 60);
    if (audioLinkError || !audioLink?.signedUrl) {
      throw new Error(`Could not sign the audio URL: ${audioLinkError?.message || 'unknown'}`);
    }

    const workerUrl = process.env.VIDEO_ROUGHCUT_WORKER_URL || 'http://video-roughcut-worker:3003';
    const callbackBase = process.env.VIDEO_ROUGHCUT_CALLBACK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
    const workerRes = await fetch(`${workerUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Api-Key': process.env.INTERNAL_API_KEY || '',
      },
      body: JSON.stringify({
        jobId: job.id,
        userId,
        audioUrl: audioLink.signedUrl,
        audioHash: job.audio_hash,
        videoFilename: job.video_filename,
        videoMetadata: {
          fileName: job.video_filename,
          width: job.video_width,
          height: job.video_height,
          duration: job.video_duration_seconds,
          frameRate: job.video_frame_rate,
          ...sanitizeMedia(input.media),
        },
        callbackUrl: `${callbackBase}/api/webhooks/video-roughcut`,
      }),
    });

    if (!workerRes.ok) {
      throw new Error(`Worker unavailable: HTTP ${workerRes.status} ${await workerRes.text().catch(() => '')}`);
    }

    await updateRoughcutJob(input.jobId, { status: 'queued', progress: 5 });
    return { success: true, creditsUsed: creditsToCharge };
  } catch (err: unknown) {
    console.error('❌ startRoughcutJob error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    let userMessage = message.startsWith('Worker unavailable')
      ? 'The rough-cut service is unavailable. Please try again.'
      : message;
    try {
      await updateRoughcutJob(input.jobId, { status: 'failed', status_reason: message });
      const refunded = creditsCharged > 0 && userId ? await refundRoughcutCredits(input.jobId, userId) : 0;
      if (refunded > 0) userMessage = `${userMessage} ${refundSentence(refunded)}`;
    } catch (cleanupErr) {
      console.error('❌ startRoughcutJob cleanup failed:', cleanupErr);
    }
    return { success: false, error: userMessage };
  }
}

/**
 * One job, scoped to the current user. The page polls this while a job runs, so a job
 * whose worker died is failed and refunded here too, and the page stops waiting.
 */
export async function getRoughcutJobStatus(jobId: string): Promise<RoughcutJob | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  await failStaleRoughcutJobs(userId).catch((err) => console.warn('⚠️ stale job sweep failed:', err));
  return getRoughcutJob(jobId, userId);
}

/** The current user's job history. Jobs stuck for too long are failed and refunded first. */
export async function listMyRoughcutJobs(): Promise<RoughcutJob[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  await failStaleRoughcutJobs(userId).catch((err) => console.warn('⚠️ stale job sweep failed:', err));
  return listRoughcutJobs(userId);
}

export type RoughcutEditor = 'premiere' | 'resolve';

export interface DownloadUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * A 5-minute signed link that downloads the XML with a readable filename,
 * e.g. "My Video - Roughcut.xml".
 */
export async function getRoughcutDownloadUrl(
  jobId: string,
  editor: RoughcutEditor = 'premiere',
): Promise<DownloadUrlResult> {
  try {
    const userId = await currentUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };
    const job = await getRoughcutJob(jobId, userId);
    if (!job || job.status !== 'done' || !job.xml_url) {
      return { success: false, error: 'This rough cut is not ready yet' };
    }

    // xml_url holds the storage path of the Premiere XML in the private bucket.
    // The worker writes the DaVinci Resolve variant next to it.
    const baseName = job.video_filename.replace(/\.[^.]+$/, '') || 'video';
    const resolve = editor === 'resolve';
    const path = resolve ? job.xml_url.replace(/roughcut\.xml$/, 'roughcut-resolve.xml') : job.xml_url;
    const { data, error } = await createAdminClient()
      .storage.from(BUCKET)
      .createSignedUrl(path, 300, { download: `${baseName} - Roughcut${resolve ? ' (Resolve)' : ''}.xml` });
    if (error || !data?.signedUrl) {
      return {
        success: false,
        error: resolve
          ? 'This rough cut was made before DaVinci Resolve was supported. Run the video again to get a Resolve XML (it costs half, because it is already transcribed).'
          : 'Could not create the download link',
      };
    }
    return { success: true, url: data.signedUrl };
  } catch (err: unknown) {
    console.error('❌ getRoughcutDownloadUrl error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function isTranscriptionCached(audioHash: string): Promise<boolean> {
  try {
    const { data } = await createAdminClient()
      .from('transcription_cache')
      .select('audio_hash')
      .eq('audio_hash', audioHash)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
