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
export async function prepareAssets(files: ClientFile[], store: StoreFile): Promise<SmartAsset[]> {
  const usable = files.filter((f) => IMAGE_FILE.test(f.filename) || VIDEO_FILE.test(f.filename));
  const assets: SmartAsset[] = [];
  for (const [i, file] of usable.entries()) {
    const id = `a${i + 1}`;
    assets.push(VIDEO_FILE.test(file.filename) ? await prepareVideo(id, file, store) : await prepareImage(id, file, store));
  }
  return assets;
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
