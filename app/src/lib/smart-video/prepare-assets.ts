import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { analyzeColors } from './brand';
import type { SmartAsset, StoreFile } from './types';

const run = promisify(execFile);

export const IMAGE_FILE = /\.(jpe?g|png|webp|tiff?|gif|bmp|heic|heif|avif)$/i;
export const VIDEO_FILE = /\.(mp4|mov|webm|m4v)$/i;

export interface ClientFile {
  filename: string;
  data: Buffer;
}

/**
 * Client uploads → assets the director can look at and the renderer can load.
 * Images become JPEG/PNG of at most 1920 px; videos are stored as they are.
 */
export async function prepareAssets(files: ClientFile[], store: StoreFile, firstNumber = 1): Promise<SmartAsset[]> {
  const usable = files.filter((f) => IMAGE_FILE.test(f.filename) || VIDEO_FILE.test(f.filename));
  const assets: SmartAsset[] = [];
  for (const [i, file] of usable.entries()) {
    // Files added in an edit continue the numbering of the video's own files.
    const id = `a${firstNumber + i}`;
    assets.push(VIDEO_FILE.test(file.filename) ? await prepareVideo(id, file, store) : await prepareImage(id, file, store));
  }
  return assets;
}

/**
 * The client's own photo of the person who should present the video (the edit form's "Change the presenter"): turned
 * upright, as a JPEG of at most 1920 px, still whole. It is cut to the presenter's vertical frame around the face only
 * once the director has said where the face is (2026-10-13: a crop around what draws the eye chose a bright lamp and
 * cut the face in half, and the clip invented another person).
 */
export async function presenterPhotoFromUpload(file: ClientFile): Promise<Buffer> {
  let input = file.data;
  try {
    await sharp(input).stats();
  } catch {
    input = await viaFfmpeg(file);
  }
  return sharp(input).rotate().resize(1920, 1920, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
}

/**
 * The presenter's vertical frame (1088x1920) cut from the client's photo with the face in the middle, a little above
 * the centre line. `face` is where the face is, as fractions of the photo's width and height.
 */
export async function framePresenterPhoto(photo: Buffer, face: { x: number; y: number }, horizontal = false): Promise<Buffer> {
  const W = horizontal ? 1920 : 1088;
  const H = horizontal ? 1088 : 1920;
  const meta = await sharp(photo).metadata();
  const scale = Math.max(W / (meta.width || W), H / (meta.height || H));
  const width = Math.max(W, Math.ceil((meta.width || W) * scale));
  const height = Math.max(H, Math.ceil((meta.height || H) * scale));
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value)));
  return sharp(photo)
    .resize(width, height)
    .extract({ left: clamp(face.x * width - W / 2, width - W), top: clamp(face.y * height - H * 0.4, height - H), width: W, height: H })
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function prepareImage(id: string, file: ClientFile, store: StoreFile): Promise<SmartAsset> {
  // Photoshop TIFFs can carry metadata blobs sharp refuses; ffmpeg reads them fine.
  let input = file.data;
  try {
    await sharp(input).stats();
  } catch {
    input = await viaFfmpeg(file);
  }
  const meta = await sharp(input).metadata();
  const png = Boolean(meta.hasAlpha);
  const image = sharp(input).rotate().resize(1920, 1920, { fit: 'inside', withoutEnlargement: true });
  const data = png ? await image.png().toBuffer() : await image.jpeg({ quality: 88 }).toBuffer();
  const size = await sharp(data).metadata();
  const colours = await analyzeColors(data);
  return {
    id,
    filename: file.filename,
    kind: 'image',
    data,
    mimeType: png ? 'image/png' : 'image/jpeg',
    width: size.width,
    height: size.height,
    url: await store(data, `${id}.${png ? 'png' : 'jpg'}`, png ? 'image/png' : 'image/jpeg'),
    // Photos have no flat background; their colours say nothing about the brand.
    ...(colours.flatBackground ? colours : {}),
  };
}

async function prepareVideo(id: string, file: ClientFile, store: StoreFile): Promise<SmartAsset> {
  const probe = await withTempFile(file, async (source) => {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'csv=p=0', source]);
    return stdout.trim().split(/[\n,]/).map(Number);
  });
  return {
    id,
    filename: file.filename,
    kind: 'video',
    data: file.data,
    mimeType: 'video/mp4',
    width: probe[0],
    height: probe[1],
    durationSeconds: probe[2],
    url: await store(file.data, `${id}.mp4`, 'video/mp4'),
  };
}

/** The sound of a clip as 24 kHz mono WAV, for transcription. */
export const extractAudio = (video: Buffer) =>
  withTempFile({ filename: 'clip.mp4', data: video }, async (source) => {
    const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', source, '-vn', '-ac', '1', '-ar', '24000', '-f', 'wav', '-'], {
      encoding: 'buffer',
      maxBuffer: 1 << 30,
    });
    return stdout;
  });

/**
 * The integrated loudness (LUFS) of a sound or a clip, from a file's bytes or its URL; null when it cannot be measured
 * or is silence. The mix uses it so the music sits under the voice whatever the song's mastering (owner 2026-10-07:
 * "the music is way too loud, louder than the voice-over").
 */
export async function measureLufs(input: Buffer | string): Promise<number | null> {
  const measure = async (source: string) => {
    const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', source, '-vn', '-af', 'ebur128', '-f', 'null', '-'], {
      maxBuffer: 64 << 20,
      timeout: 60_000,
    });
    // The summary comes last: "Integrated loudness: I: -22.2 LUFS".
    const values = [...String(stderr).matchAll(/I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g)].map((match) => Number(match[1]));
    const lufs = values[values.length - 1];
    return Number.isFinite(lufs) && lufs > -60 ? lufs : null;
  };
  try {
    return typeof input === 'string' ? await measure(input) : await withTempFile({ filename: 'sound.mp4', data: input }, measure);
  } catch (error) {
    console.warn('⚠️ Loudness not measured:', String(error).slice(0, 160));
    return null;
  }
}

const viaFfmpeg = (file: ClientFile) =>
  withTempFile(file, async (source) => {
    const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', source, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], {
      encoding: 'buffer',
      maxBuffer: 1 << 30,
    });
    return stdout;
  });

async function withTempFile<T>(file: ClientFile, job: (source: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-video-'));
  const source = path.join(dir, `source${path.extname(file.filename) || '.bin'}`);
  try {
    await fs.writeFile(source, file.data);
    return await job(source);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
