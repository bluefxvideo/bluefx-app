import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { uploadImageToStorage } from '@/actions/supabase-storage';
import {
  CLONE_MIN_SCENE_SECONDS,
  CLONE_MAX_SCENES,
} from '@/types/clone-studio';

const execFileAsync = promisify(execFile);

// showinfo output for a 60fps 3-min video stays well under this
const FFMPEG_MAX_BUFFER = 32 * 1024 * 1024;

export interface VideoProbe {
  duration: number;
  width: number;
  height: number;
}

export interface SegmentedScene {
  n: number;
  start: number;
  end: number;
  keyframe_url: string;
  /** Local path of the extracted frame (valid while the workDir lives). */
  framePath: string;
}

/**
 * Small labeled keyframes for the analysis request — ground truth of what is
 * actually in each scene. Sub-second insert shots are invisible to Gemini's
 * timestamp resolution; anchoring every scene to its own keyframe stops it
 * from smearing neighboring action into them.
 */
export async function buildAnalysisKeyframes(
  scenes: SegmentedScene[]
): Promise<Array<{ n: number; jpegBase64: string }>> {
  const sharp = (await import('sharp')).default;
  const result: Array<{ n: number; jpegBase64: string }> = [];
  for (const scene of scenes) {
    try {
      const buffer = await sharp(scene.framePath)
        .resize({ width: 360, withoutEnlargement: true })
        .jpeg({ quality: 60 })
        .toBuffer();
      result.push({ n: scene.n, jpegBase64: buffer.toString('base64') });
    } catch (error) {
      console.warn(`Clone Studio: could not thumbnail keyframe for scene ${scene.n}:`, error);
    }
  }
  return result;
}

export async function makeWorkDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function downloadToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download source video: ${response.status} ${response.statusText}`);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 500 * 1024 * 1024) {
    throw new Error('Source video is too large (over 500MB)');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);
}

export async function probeVideo(filePath: string): Promise<VideoProbe> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,duration',
    '-show_entries', 'format=duration',
    '-of', 'json',
    filePath,
  ], { maxBuffer: FFMPEG_MAX_BUFFER });

  const parsed = JSON.parse(stdout);
  const stream = parsed.streams?.[0] || {};
  const duration = parseFloat(stream.duration || parsed.format?.duration || '0');
  const width = Number(stream.width || 0);
  const height = Number(stream.height || 0);
  if (!duration || !width || !height) {
    throw new Error('Could not read video dimensions/duration (is this a valid video file?)');
  }
  return { duration, width, height };
}

/**
 * Detect hard cuts with ffmpeg's scene filter and return scene ranges.
 * Threshold 0.12: measured on a real fast-cut ad, true cuts score 0.15-0.67
 * (dark-scene cuts — bowling alley montage — sat at 0.15-0.19 and were LOST
 * at the old 0.2 threshold) while within-shot noise stays ≤0.08, so 0.12
 * splits the bimodal distribution with margin on both sides. Scenes shorter
 * than CLONE_MIN_SCENE_SECONDS merge into their predecessor; if the count
 * still exceeds CLONE_MAX_SCENES, the shortest scenes keep merging.
 */
export async function detectSceneRanges(
  filePath: string,
  duration: number
): Promise<Array<{ start: number; end: number }>> {
  // Cut frames land on stderr via showinfo; the command "fails" with a 0-frame
  // output on some containers, so tolerate non-zero exit and parse what we got.
  let stderr = '';
  try {
    const result = await execFileAsync('ffmpeg', [
      '-i', filePath,
      '-vf', "select='gt(scene,0.12)',showinfo",
      '-an',
      '-f', 'null', '-',
    ], { maxBuffer: FFMPEG_MAX_BUFFER });
    stderr = result.stderr || '';
  } catch (err) {
    const e = err as { stderr?: string };
    if (!e.stderr) throw err;
    stderr = e.stderr;
  }

  const cutTimes: number[] = [];
  const regex = /pts_time:([0-9]+(?:\.[0-9]+)?)/g;
  let match;
  while ((match = regex.exec(stderr)) !== null) {
    const t = parseFloat(match[1]);
    if (t > 0.05 && t < duration - 0.05) cutTimes.push(t);
  }
  cutTimes.sort((a, b) => a - b);

  const boundaries = [0, ...cutTimes, duration];
  let ranges: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    ranges.push({ start: boundaries[i], end: boundaries[i + 1] });
  }

  // Merge micro-scenes (flash frames, dissolve artifacts) into the previous scene
  ranges = ranges.reduce<Array<{ start: number; end: number }>>((acc, r) => {
    if (r.end - r.start < CLONE_MIN_SCENE_SECONDS && acc.length > 0) {
      acc[acc.length - 1].end = r.end;
    } else {
      acc.push({ ...r });
    }
    return acc;
  }, []);
  // If the very first scene is still a micro-scene, fold it into the next one
  if (ranges.length > 1 && ranges[0].end - ranges[0].start < CLONE_MIN_SCENE_SECONDS) {
    ranges[1].start = ranges[0].start;
    ranges.splice(0, 1);
  }

  // Cost guard: keep merging the shortest scene into its shorter neighbor
  while (ranges.length > CLONE_MAX_SCENES) {
    let idx = 0;
    let min = Infinity;
    for (let i = 0; i < ranges.length; i++) {
      const d = ranges[i].end - ranges[i].start;
      if (d < min) { min = d; idx = i; }
    }
    if (idx === 0) {
      ranges[1].start = ranges[0].start;
      ranges.splice(0, 1);
    } else {
      ranges[idx - 1].end = ranges[idx].end;
      ranges.splice(idx, 1);
    }
  }

  return ranges;
}

export async function extractKeyframe(
  filePath: string,
  atSeconds: number,
  outPath: string
): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-ss', atSeconds.toFixed(3),
    '-i', filePath,
    '-frames:v', '1',
    '-q:v', '2',
    '-y',
    outPath,
  ], { maxBuffer: FFMPEG_MAX_BUFFER });
}

/**
 * Full segmentation pass: detect scenes, extract a keyframe at each scene's
 * midpoint, upload keyframes to storage under clone-studio/{projectId}.
 */
export async function segmentVideo(
  filePath: string,
  projectId: string,
  probe: VideoProbe
): Promise<SegmentedScene[]> {
  const ranges = await detectSceneRanges(filePath, probe.duration);
  const workDir = path.dirname(filePath);

  const scenes: SegmentedScene[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    const mid = start + (end - start) / 2;
    const framePath = path.join(workDir, `scene-${String(i + 1).padStart(2, '0')}.jpg`);
    await extractKeyframe(filePath, mid, framePath);

    const frameBuffer = await fs.readFile(framePath);
    const upload = await uploadImageToStorage(
      new Blob([new Uint8Array(frameBuffer)], { type: 'image/jpeg' }),
      {
        bucket: 'images',
        folder: `clone-studio/${projectId}`,
        filename: `scene-${String(i + 1).padStart(2, '0')}-key.jpg`,
        contentType: 'image/jpeg',
      }
    );
    if (!upload.success || !upload.url) {
      throw new Error(`Failed to upload keyframe for scene ${i + 1}: ${upload.error}`);
    }

    scenes.push({
      n: i + 1,
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      keyframe_url: upload.url,
      framePath,
    });
  }

  return scenes;
}

/**
 * Cut every scene into its own small clip for analysis. Gemini's timestamp
 * attribution drifts ±1-2s — bigger than a fast-cut ad's shots — so per-scene
 * analysis runs on physically-cut clips: the model can't describe the next
 * shot when it never sees it. -ss before -i with re-encode is frame-accurate.
 */
export async function extractSceneClips(
  filePath: string,
  ranges: Array<{ n: number; start: number; end: number }>
): Promise<Array<{ n: number; clipBase64: string }>> {
  const workDir = path.dirname(filePath);
  const clips: Array<{ n: number; clipBase64: string }> = [];
  for (const range of ranges) {
    const clipPath = path.join(workDir, `clip-${String(range.n).padStart(2, '0')}.mp4`);
    try {
      await execFileAsync('ffmpeg', [
        '-ss', range.start.toFixed(3),
        '-i', filePath,
        '-t', Math.max(0.2, range.end - range.start).toFixed(3),
        '-vf', 'scale=-2:480',
        '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast',
        '-c:a', 'aac', '-b:a', '64k',
        '-y', clipPath,
      ], { maxBuffer: FFMPEG_MAX_BUFFER });
      const buffer = await fs.readFile(clipPath);
      clips.push({ n: range.n, clipBase64: buffer.toString('base64') });
    } catch (error) {
      console.warn(`Clone Studio: could not cut clip for scene ${range.n}:`, error);
    }
  }
  return clips;
}

/**
 * Produce a small copy of the video that fits Gemini's inline-data budget
 * (~20MB request). Returns the original path if it is already small enough.
 */
export async function fitForInlineAnalysis(filePath: string): Promise<string> {
  const MAX_INLINE_BYTES = 18 * 1024 * 1024;
  const stat = await fs.stat(filePath);
  if (stat.size <= MAX_INLINE_BYTES) return filePath;

  const outPath = filePath.replace(/(\.[a-z0-9]+)?$/i, '-analysis.mp4');
  await execFileAsync('ffmpeg', [
    '-i', filePath,
    '-vf', 'scale=-2:480',
    '-c:v', 'libx264',
    '-crf', '28',
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-b:a', '64k',
    '-y',
    outPath,
  ], { maxBuffer: FFMPEG_MAX_BUFFER });

  const outStat = await fs.stat(outPath);
  if (outStat.size > MAX_INLINE_BYTES) {
    throw new Error('Video is too long to analyze even after compression');
  }
  return outPath;
}

export async function cleanupWorkDir(workDir: string): Promise<void> {
  try {
    await fs.rm(workDir, { recursive: true, force: true });
  } catch {
    // best effort — tmpdir is wiped by the OS anyway
  }
}
