import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import type { CloneProject } from '@/types/clone-studio';
import { ownFile } from './files';
import { cleanupWorkDir, downloadToFile, makeWorkDir } from './segmentation';

/**
 * The source ad as the director watches it: one small video with its sound, and above the
 * picture a black bar that shows the number of the scene that is playing.
 *
 * The breakdown describes a scene in a line or two ("the man speaks while looking at the
 * camera"). A director who writes the shot for the remake has to see the acting itself: the
 * gesture, the timing of the joke, how the line is said. The number is burned into the
 * picture because a model that is only told "scene 7 runs from 15.7 to 16.7 s" places what
 * it saw a second or two off, which in a fast-cut ad is the neighbouring scene.
 */

const run = promisify(execFile);
/** Everything a request carries inline has to stay under the model's limit; the video gets this share of it. */
const MAX_BYTES = 11 * 1024 * 1024;
const BAR = 72; // height of the bar above the picture, pixels
const DOT = 8; // one dot of a digit, pixels
const FPS = 12;

/** Digits as 5 x 7 dots: the image carries its own type, so no font has to be installed where this runs. */
const DIGITS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

/** The bar's label for one scene: white digits on black. An empty text gives a plain black label. */
async function label(text: string, file: string): Promise<void> {
  const width = 16 + 3 * 6 * DOT;
  const pixels = Buffer.alloc(width * BAR * 3, 0);
  const top = Math.floor((BAR - 7 * DOT) / 2);
  const dot = (left: number, upper: number) => {
    for (let y = upper; y < upper + DOT; y++) pixels.fill(255, (y * width + left) * 3, (y * width + left + DOT) * 3);
  };
  [...text].forEach((digit, i) => (DIGITS[digit] || []).forEach((row, r) => [...row].forEach((on, c) => on === '1' && dot(8 + (i * 6 + c) * DOT, top + r * DOT))));
  await sharp(pixels, { raw: { width, height: BAR, channels: 3 } }).png().toFile(file);
}

export interface WatchedAd {
  /** MP4, base64. */
  data: string;
  seconds: number;
}

/**
 * The source ad with the scene numbers above the picture, small enough to send inline.
 * Never throws: without the video the director works from the frames and the breakdown.
 */
export async function sourceForDirector(project: CloneProject): Promise<WatchedAd | null> {
  const scenes = project.scenes.filter((scene) => !scene.is_custom).sort((a, b) => a.start - b.start);
  if (!project.source_video_url || !scenes.length) return null;
  const dir = await makeWorkDir('clone-director-');
  try {
    const source = path.join(dir, 'source.mp4');
    await downloadToFile(ownFile(project.source_video_url), source);
    const seconds = Math.max(scenes[scenes.length - 1].end, project.video_duration_seconds || 0);

    // One label per scene, each shown from the scene's first frame to the next scene's first frame.
    const list = ['ffconcat version 1.0'];
    const show = async (text: string, name: string, from: number, to: number) => {
      await label(text, path.join(dir, name));
      list.push(`file '${name}'`, `duration ${Math.max(0.04, to - from).toFixed(3)}`);
    };
    if (scenes[0].start > 0.05) await show('', 'label-lead.png', 0, scenes[0].start);
    for (const [i, scene] of scenes.entries()) await show(String(scene.n), `label-${scene.n}.png`, scene.start, i + 1 < scenes.length ? scenes[i + 1].start : Math.max(scene.end, seconds));
    // The list's last picture is named twice: only then does its duration count.
    list.push(`file 'label-${scenes[scenes.length - 1].n}.png'`);
    await fs.writeFile(path.join(dir, 'labels.txt'), list.join('\n'));

    // A long ad is sent smaller: the video has to fit into one request next to the frames and the photos.
    const side = seconds > 90 ? 360 : 480;
    const rate = seconds > 90 ? '260k' : '450k';
    const out = path.join(dir, 'watch.mp4');
    await run(
      'ffmpeg',
      [
        '-v', 'error', '-y',
        '-i', source,
        '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'labels.txt'),
        '-filter_complex',
        `[0:v]scale='if(gt(iw,ih),-2,${side})':'if(gt(iw,ih),${side},-2)',fps=${FPS},pad=iw:ih+${BAR}:0:${BAR}:black[picture];[1:v]fps=${FPS},format=rgb24[number];[picture][number]overlay=0:0:eof_action=pass[out]`,
        '-map', '[out]', '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-maxrate', rate, '-bufsize', rate, '-pix_fmt', 'yuv420p',
        '-ac', '1', '-c:a', 'aac', '-b:a', '48k',
        '-movflags', '+faststart', out,
      ],
      { cwd: dir, maxBuffer: 32 * 1024 * 1024, timeout: 4 * 60 * 1000 }
    );
    const buffer = await fs.readFile(out);
    if (buffer.length < 1000 || buffer.length > MAX_BYTES) throw new Error(`the video came out at ${buffer.length} bytes`);
    return { data: buffer.toString('base64'), seconds };
  } catch (error) {
    console.warn('Clone Studio: the source ad could not be prepared for the director (frames only):', String(error).slice(0, 300));
    return null;
  } finally {
    await cleanupWorkDir(dir);
  }
}
