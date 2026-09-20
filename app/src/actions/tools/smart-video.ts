'use server';

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';
import { checkAdminAuth } from '@/lib/admin-auth';
import { createSmartVideo } from '@/lib/smart-video/pipeline';
import { prepareAssets, type ClientFile } from '@/lib/smart-video/prepare-assets';
import { fromLink } from '@/lib/smart-video/sources';
import { checkRemotionProgress, startRemotionRender } from '@/actions/services/remotion-render-service';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';
import {
  SmartVideoStartSchema,
  SmartVideoUploadRequestSchema,
  type SmartVideoJob,
  type SmartVideoStartInput,
  type SmartVideoUploadSlot,
} from '@/types/smart-video';

/**
 * Smart Video (admin-only trial): text + files (or a Zillow/Amazon link) in,
 * finished vertical ad out. The job runs after the response is sent (the proxy
 * cuts requests at ~55 s) and the page polls job.json for its state.
 */

const run = promisify(execFile);
const BUCKET = 'script-videos';
const STALE_AFTER_MS = 12 * 60 * 1000;

const jobDir = (userId: string, jobId: string) => `smart-video/${userId}/${jobId}`;
const safeName = (name: string) => name.replace(/[^\w.-]+/g, '_').slice(-80);

async function adminUserId(): Promise<string | null> {
  const admin = await checkAdminAuth();
  return admin?.user.id ?? null;
}

function publicUrl(storagePath: string): string {
  return createAdminClient().storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function upload(storagePath: string, data: Buffer, contentType: string): Promise<string> {
  const { error } = await createAdminClient().storage.from(BUCKET).upload(storagePath, data, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed (${storagePath}): ${error.message}`);
  return publicUrl(storagePath);
}

async function download(storagePath: string): Promise<Buffer> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error(`Download failed (${storagePath}): ${error?.message || 'no data'}`);
  return Buffer.from(await data.arrayBuffer());
}

async function readJob(userId: string, jobId: string): Promise<SmartVideoJob | null> {
  try {
    return JSON.parse((await download(`${jobDir(userId, jobId)}/job.json`)).toString('utf-8'));
  } catch {
    return null;
  }
}

async function writeJob(job: SmartVideoJob, patch: Partial<SmartVideoJob> = {}): Promise<SmartVideoJob> {
  const next = { ...job, ...patch, updatedAt: new Date().toISOString() };
  await upload(`${jobDir(job.userId, job.id)}/job.json`, Buffer.from(JSON.stringify(next)), 'application/json');
  return next;
}

/** Step 1: a job id and one signed upload URL per file (files never travel through a server action). */
export async function requestSmartVideoUploads(input: {
  files: { name: string; size: number }[];
}): Promise<ApiResponse<{ jobId: string; slots: SmartVideoUploadSlot[] }>> {
  try {
    const userId = await adminUserId();
    if (!userId) return createApiError('Smart Video is in admin-only testing');
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
    return createApiError(error instanceof Error ? error.message : 'Could not prepare the uploads');
  }
}

/** Step 2: start the job. Returns at once; the work happens in after(). */
export async function startSmartVideo(input: SmartVideoStartInput): Promise<ApiResponse<{ jobId: string }>> {
  try {
    const userId = await adminUserId();
    if (!userId) return createApiError('Smart Video is in admin-only testing');
    const parsed = SmartVideoStartSchema.parse(input);
    if (!parsed.brief.trim() && !parsed.link) return createApiError('Write what the video is about, or paste a Zillow or Amazon link');
    if (parsed.uploads.some((u) => !u.path.startsWith(`${jobDir(userId, parsed.jobId)}/src/`))) return createApiError('Invalid upload path');

    const now = new Date().toISOString();
    const job = await writeJob({
      id: parsed.jobId,
      userId,
      status: 'reading',
      brief: parsed.brief,
      link: parsed.link || undefined,
      length: parsed.length,
      createdAt: now,
      updatedAt: now,
    });
    after(() => runSmartVideoJob(job, parsed.uploads));
    return createApiSuccess({ jobId: job.id });
  } catch (error) {
    console.error('❌ startSmartVideo error:', error);
    return createApiError(error instanceof Error ? error.message : 'Could not start the video');
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
      const photos = await Promise.all(
        link.imageUrls.map(async (url, i) => ({
          filename: `link-${String(i + 1).padStart(2, '0')}.jpg`,
          data: Buffer.from(await (await fetch(url)).arrayBuffer()),
        }))
      );
      files.push(...photos);
      brief = job.brief.trim() ? `${link.brief}\n\nNOTE FROM THE CLIENT:\n${job.brief}` : link.brief;
    }

    const store = (data: Buffer, name: string, contentType: string) => upload(`${dir}/${name}`, data, contentType);
    const assets = await prepareAssets(files, store);
    const { props, plan, durationSeconds, usage, warnings } = await createSmartVideo(
      brief,
      assets,
      store,
      (url) => download(`${dir}/${path.basename(new URL(url).pathname)}`),
      {
        length: job.length === 'script' ? 'script' : 'auto',
        onStage: (stage) => {
          job = { ...job, status: stage };
          writeJob(job).catch(() => undefined);
        },
      }
    );
    await upload(`${dir}/plan.json`, Buffer.from(JSON.stringify({ plan, props }, null, 2)), 'application/json');

    job = await writeJob(job, {
      status: 'rendering',
      renderProgress: 0,
      durationSeconds,
      usage,
      warnings,
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
    const renderedUrl = await render(props, (progress) => {
      job = { ...job, renderProgress: progress };
      if (progress - reported >= 10) {
        reported = progress;
        writeJob(job).catch(() => undefined);
      }
    });

    job = await writeJob(job, { status: 'finishing' });
    const videoUrl = await upload(`${dir}/video.mp4`, await levelLoudness(renderedUrl), 'video/mp4');
    job = await writeJob(job, { status: 'done', videoUrl, renderProgress: 100 });
    console.log(`✅ Smart Video job ${job.id} done: ${videoUrl}`);
  } catch (error) {
    console.error(`❌ Smart Video job ${job.id} failed:`, error);
    await writeJob(job, { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }).catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
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

/** The page polls this. A job whose process died (deploy, crash) is reported as failed. */
export async function getSmartVideoJob(jobId: string): Promise<SmartVideoJob | null> {
  const userId = await adminUserId();
  if (!userId || !/^[0-9a-f-]{36}$/.test(jobId)) return null;
  const job = await readJob(userId, jobId);
  if (!job) return null;
  const running = job.status !== 'done' && job.status !== 'failed';
  if (running && Date.now() - Date.parse(job.updatedAt) > STALE_AFTER_MS) {
    return writeJob(job, { status: 'failed', error: 'The job stopped unexpectedly (the server may have restarted). Please run it again.' });
  }
  return job;
}

export async function listSmartVideoJobs(): Promise<SmartVideoJob[]> {
  const userId = await adminUserId();
  if (!userId) return [];
  const { data } = await createAdminClient()
    .storage.from(BUCKET)
    .list(`smart-video/${userId}`, { limit: 30, sortBy: { column: 'created_at', order: 'desc' } });
  const jobs = await Promise.all((data || []).map((entry) => readJob(userId, entry.name)));
  return jobs.filter((job): job is SmartVideoJob => job !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
