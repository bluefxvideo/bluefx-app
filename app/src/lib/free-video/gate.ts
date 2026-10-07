/**
 * Free video ad funnel: the quality gate every finished free video ad passes before anyone is emailed.
 *
 * Zero cost: it reads the saved plan and media (what was made, what failed) and probes the stored
 * file with ffprobe and ffmpeg volumedetect. A video ad that fails any check is never emailed: it is made
 * again once (runner settleLead), then held for the owner. A file check that could not run on our side (the download or ffprobe failed) is not a
 * verdict: the result is `inconclusive` and the sweep tries again (review F4). Server only; no API calls.
 */

import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { domainToUnicode } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { FREE_RENDER_SCALE, GATE } from '@/lib/free-video/config';
import type { SavedPlan } from '@/lib/smart-video/jobs';
import type { DirectorPlan } from '@/lib/smart-video/types';
import type { FreeVideoGateResult } from '@/types/free-video';
import type { SmartVideoJob } from '@/types/smart-video';

const run = promisify(execFile);

/** What the gate reads from the job: the stored video, its length (content plus the end card), warnings and spend. */
export type GateJob = Pick<SmartVideoJob, 'videoUrl' | 'durationSeconds'> & Partial<Pick<SmartVideoJob, 'warnings' | 'usage'>>;

export interface GateOptions {
  /** Skip the file checks (fake mode only: its video is an example without the end card). */
  skipProbe?: boolean;
  /** The lead's website (website_domain): the last screen must show it, or another way to reach the business (review F5). */
  domain?: string | null;
}

/** The old test, kept for a gate without a domain: an email, a phone number or a web address. */
const REACHABLE = /[@\d]|\.[a-z]{2,}/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
/** Seven digits or more, with the usual separators between them. */
const PHONE = /(?:\d[\s().+-]*){7,}/;
/** The client's own pictures (prepareAssets numbers them a1, a2, ...). */
const CLIENT_ASSET = /^a\d+$/;

/** Every asset id a scene shows: its background, its media, logo and gallery blocks, and a speaker's clip. */
export function sceneAssetIds(scene: DirectorPlan['scenes'][number]): string[] {
  const ids: (string | null | undefined)[] = [scene.background.asset, scene.speaker?.asset];
  for (const block of scene.blocks) {
    if ('assets' in block) ids.push(...block.assets);
    else if ('asset' in block) ids.push(block.asset);
  }
  return ids.filter((id): id is string => Boolean(id));
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 200);
/** Lowercase, no white space, no www.: how a domain is compared with a line on screen. */
const squash = (text: string) => text.toLowerCase().replace(/\s+/g, '').replace(/^www\./, '');

/**
 * Whether the last screen lets a viewer reach the business: the lead's own domain (in its ASCII or its
 * Unicode form, anywhere in a text of the last scene), else an email address or a phone number. "Open 7
 * days" or "5-star service" no longer pass (review F5).
 */
export function lastScreenReaches(plan: Pick<DirectorPlan, 'scenes'>, domain?: string | null): { ok: boolean; domainShown: boolean; texts: string[] } {
  const last = plan.scenes[plan.scenes.length - 1];
  const texts = (last?.blocks ?? []).flatMap((block) => ('text' in block && typeof block.text === 'string' && block.text.trim() ? [block.text] : []));
  if (!domain) {
    const ok = (last?.blocks ?? []).some((block) => block.type === 'highlight' && REACHABLE.test(block.text));
    return { ok, domainShown: false, texts };
  }
  const forms = [...new Set([domain, domainToUnicode(domain)].map((d) => squash(d || '')).filter(Boolean))];
  const domainShown = texts.some((text) => forms.some((form) => squash(text).includes(form)));
  return { ok: domainShown || texts.some((text) => EMAIL.test(text) || PHONE.test(text)), domainShown, texts };
}

/**
 * The plan checks: zero cost, from the saved plan and media alone. Each failed check adds one reason.
 */
function planChecks(job: GateJob, saved: SavedPlan | null, opts: GateOptions, reasons: string[], facts: Record<string, unknown>): void {
  if (!job.videoUrl) reasons.push('no video file');
  const seconds = job.durationSeconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) reasons.push('length unknown');
  else if (seconds < GATE.minSeconds || seconds > GATE.maxSeconds) reasons.push(`length ${round(seconds, 1)} s`);
  facts.durationSeconds = typeof seconds === 'number' ? round(seconds, 2) : null;
  facts.warnings = job.warnings ?? [];
  facts.costUsd = round((job.usage ?? []).reduce((sum, entry) => sum + (Number(entry.usd) || 0), 0), 3);

  if (!saved?.plan) {
    reasons.push('no saved plan');
    return;
  }
  const { plan } = saved;
  const media = saved.media;
  const assets = media?.assets ?? {};
  const scenes = plan.scenes ?? [];
  const shown = new Set(scenes.flatMap(sceneAssetIds));
  const photosShown = [...shown].filter((id) => CLIENT_ASSET.test(id) && assets[id]?.kind === 'image').length;
  const drawings = scenes.filter((scene) => scene.background.type === 'drawing' && scene.background.asset && assets[scene.background.asset]).length;
  // Scenes that show a picture: a drawing, a taped photo, a gallery, the logo or the presenter.
  const pictured = scenes.filter((scene) => sceneAssetIds(scene).some((id) => assets[id])).length;
  const animatedPlanned = plan.animate?.length ?? 0;
  const animatedOk = Object.keys(assets).filter((id) => id.endsWith('-motion')).length;
  const reach = lastScreenReaches(plan, opts.domain);

  Object.assign(facts, {
    style: plan.style,
    format: media?.format ?? (saved.props as { format?: string } | undefined)?.format ?? 'vertical',
    adFormat: plan.format,
    language: plan.language,
    scenes: scenes.length,
    words: scenes.reduce((sum, scene) => sum + scene.narration.split(/\s+/).filter(Boolean).length, 0),
    photosShown,
    animatedPlanned,
    animatedOk,
    drawings,
    pictured,
    lastScreen: reach.texts.join(' | ').slice(0, 200),
    domainShown: reach.domainShown,
  });

  if (!media) {
    reasons.push('no saved media');
    return;
  }
  if (!media.voice) reasons.push('no voice');
  if (!media.musicUrl) reasons.push('no music');

  if (!reach.ok) reasons.push(opts.domain ? 'no website on the last screen' : 'no contact on the last screen');

  // A failed drawing or a missing lifestyle photo leaves a hole in a scene.
  const missing = [...shown].filter((id) => !assets[id]).sort();
  if (missing.length) reasons.push(`missing pictures: ${missing.join(', ')}`);

  if (plan.style === 'whiteboard') {
    // The board is not mostly empty. Drawings alone held good ads (owner 2026-10-06): a site with real
    // photos gets them taped to the board, and the presenter takes the scene of the first drawing.
    if (pictured < Math.ceil(scenes.length / 2)) reasons.push('too few pictures');
  } else if (photosShown === 0) {
    reasons.push('no website photo shown');
  }
  // Owner rule: the samples show the best output, animated photos included.
  if (animatedPlanned > 0 && animatedOk === 0) reasons.push('animated photos failed');
}

/** A failure on our side (download, tools): no verdict about the video ad. */
class InconclusiveError extends Error {}

/** Downloads the stored video to `file`, refusing anything over GATE.maxDownloadBytes. Proves the public URL serves it. */
async function download(url: string, file: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(GATE.downloadTimeoutMs) });
  } catch (error) {
    throw new InconclusiveError(`the video file did not load (${message(error)})`);
  }
  // A storage hiccup (5xx) or a file that is not visible yet (4xx right after the upload) says nothing about the video ad.
  if (!res.ok || !res.body) throw new InconclusiveError(`the video file did not load (HTTP ${res.status})`);
  const declared = Number(res.headers.get('content-length'));
  if (declared > GATE.maxDownloadBytes) throw new Error('the video file is too large');
  let bytes = 0;
  const cap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > GATE.maxDownloadBytes ? new Error('the video file is too large') : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), cap, createWriteStream(file));
  } catch (error) {
    if (bytes > GATE.maxDownloadBytes) throw error;
    throw new InconclusiveError(`the video file download broke off (${message(error)})`);
  }
}

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
}

export interface FileProbe {
  /** The video stream's length (exact); the container adds about 0.05 s of AAC padding. */
  seconds: number;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  bytes: number;
}

/** A tool that could not run (missing, killed by its timeout) is our failure; a non-zero exit on the file is the file's. */
const toolFailed = (error: unknown) => {
  const e = error as { code?: unknown; killed?: boolean; signal?: unknown };
  return typeof e?.code === 'string' || Boolean(e?.killed) || Boolean(e?.signal);
};

/** ffprobe on a local file. Throws InconclusiveError when ffprobe itself could not run. */
export async function probeFile(file: string): Promise<FileProbe> {
  const { size } = await fs.stat(file);
  let stdout: string;
  try {
    ({ stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    }));
  } catch (error) {
    if (toolFailed(error)) throw new InconclusiveError(`ffprobe did not run (${message(error)})`);
    throw new Error('the file is not a readable video');
  }
  const probe = JSON.parse(stdout) as { streams?: ProbeStream[]; format?: { duration?: string } };
  const video = probe.streams?.find((s) => s.codec_type === 'video');
  const audio = probe.streams?.find((s) => s.codec_type === 'audio');
  return {
    seconds: Number(video?.duration) || Number(probe.format?.duration) || 0,
    width: video?.width ?? null,
    height: video?.height ?? null,
    hasAudio: Boolean(audio),
    bytes: size,
  };
}

/**
 * The frame size of a video in this format: 1080p scaled by `scale`. A free video ad renders at FREE_RENDER_SCALE
 * (720p since 2026-10-07); its clean versions (the $99 one and the copy in a buyer's account) render at full HD, scale 1.
 */
export const frameOf = (format: string | undefined, scale = FREE_RENDER_SCALE) => {
  const [width, height] = format === 'horizontal' ? [1920, 1080] : [1080, 1920];
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/** The file checks: length against the job (catches a stale Remotion bundle), audio, frame size, file size, loudness. */
async function fileChecks(job: GateJob, saved: SavedPlan | null, reasons: string[], facts: Record<string, unknown>): Promise<boolean> {
  if (!job.videoUrl) return false;
  let dir: string | null = null;
  try {
    let file: string;
    if (/^https?:\/\//i.test(job.videoUrl)) {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'free-video-gate-'));
      file = path.join(dir, 'video.mp4');
      await download(job.videoUrl, file);
    } else {
      file = job.videoUrl.replace(/^file:\/\//i, '');
    }
    const probe = await probeFile(file);
    facts.fileBytes = probe.bytes;
    if (probe.bytes < GATE.minBytes) reasons.push('file too small');
    facts.probeSeconds = round(probe.seconds, 3);
    if (typeof job.durationSeconds === 'number' && Math.abs(probe.seconds - job.durationSeconds) > GATE.probeTolerance) {
      reasons.push('render length mismatch');
    }
    if (!probe.hasAudio) reasons.push('no audio stream');
    const { width, height } = frameOf(saved?.media?.format ?? (saved?.props as { format?: string } | undefined)?.format);
    facts.frame = probe.width ? `${probe.width}x${probe.height}` : null;
    if (probe.width !== width || probe.height !== height) reasons.push(`not ${width}x${height}`);

    if (probe.hasAudio) {
      // volumedetect writes to stderr.
      let stderr: string;
      try {
        ({ stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], {
          timeout: 90_000,
          maxBuffer: 8 * 1024 * 1024,
        }));
      } catch (error) {
        if (toolFailed(error)) throw new InconclusiveError(`ffmpeg did not run (${message(error)})`);
        throw new Error('the sound could not be measured');
      }
      const found = /mean_volume:\s*(-?(?:inf|\d+(?:\.\d+)?))\s*dB/i.exec(stderr);
      const mean = found ? (/inf/i.test(found[1]) ? -Infinity : Number(found[1])) : NaN;
      facts.meanVolumeDb = Number.isFinite(mean) ? mean : null;
      if (Number.isNaN(mean)) reasons.push('loudness unreadable');
      else if (mean <= GATE.minMeanVolumeDb) reasons.push('too quiet');
    }
    return false;
  } catch (error) {
    reasons.push(`file check failed: ${message(error)}`);
    if (error instanceof InconclusiveError) {
      facts.fileCheckError = message(error);
      return true;
    }
    return false;
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Plan checks plus file checks. pass = no reason. It never throws: any error becomes a reason.
 * inconclusive = a file check could not run on our side; settleLead then leaves the lead running and the
 * next sweep gates it again, for GATE.inconclusiveMinutes, before holding it (review F4).
 * facts (stored with the lead) = style, format, language, words, photosShown, animatedPlanned,
 * animatedOk, drawings, pictured, lastScreen, domainShown, warnings, costUsd, probeSeconds, meanVolumeDb, and a few more.
 */
export async function qualityGate(job: GateJob, saved: SavedPlan | null, opts: GateOptions = {}): Promise<FreeVideoGateResult> {
  const reasons: string[] = [];
  const facts: Record<string, unknown> = {};
  let inconclusive = false;
  try {
    planChecks(job, saved, opts, reasons, facts);
    if (!opts.skipProbe) inconclusive = await fileChecks(job, saved, reasons, facts);
  } catch (error) {
    reasons.push(`gate error: ${message(error)}`);
  }
  return { pass: reasons.length === 0, reasons, facts, ...(inconclusive ? { inconclusive: true } : {}) };
}
