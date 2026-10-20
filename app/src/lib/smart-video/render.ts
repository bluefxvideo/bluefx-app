import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { checkRemotionProgress, startRemotionRender } from '@/actions/services/remotion-render-service';

/**
 * The last two steps of every video made with the SmartVideo composition (the Phantom,
 * and Clone Studio's finished ads): the render on the render server, then the loudness.
 */

const run = promisify(execFile);

/** Renders the props and returns where the render server keeps the result. */
export async function renderSmartVideo(props: Record<string, unknown>, onProgress: (percent: number) => void, scale = 1): Promise<string> {
  const started = await startRemotionRender({ compositionId: 'SmartVideo', inputProps: props, scale });
  if (!started.success || !started.renderId) {
    // The cause ("fetch failed", a status code) means nothing to the person waiting for a video.
    console.error('❌ The render did not start:', started.error);
    throw new Error('The render server did not answer. Please try again in a few minutes.');
  }
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

/** The frame size of a video's first picture stream. */
async function frameOf(videoUrl: string): Promise<{ width: number; height: number }> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', videoUrl], { timeout: 60_000 });
  const [width, height] = stdout.trim().split('x').map(Number);
  if (!(width > 0 && height > 0)) throw new Error(`No frame size in ${stdout.trim().slice(0, 40)}`);
  return { width, height };
}

/**
 * levelLoudness, with another finished video played after this one in the same file (a free video ad, then the founder
 * message). The picture is encoded again so both parts share one stream (720p: about 10 to 30 s); the second video takes
 * the first one's frame size and keeps its own sound level.
 */
export async function levelAndAppend(videoUrl: string, thenUrl: string): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-video-'));
  const output = path.join(dir, 'video.mp4');
  try {
    const { width, height } = await frameOf(videoUrl);
    const graph = [
      '[0:v]scale=out_range=tv,setsar=1,fps=30,format=yuv420p[v0]',
      `[1:v]scale=${width}:${height}:flags=lanczos:out_range=tv,setsar=1,fps=30,format=yuv420p[v1]`,
      // Only the first video is levelled, as levelLoudness levels it; the second keeps its own level (the founder
      // message is mixed at -14 LUFS). Levelled together, a quiet render pushed the message to -12.
      '[0:a]loudnorm=I=-14:TP=-1.5:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo[a0]',
      '[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a1]',
      '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
    ].join(';');
    await run(
      'ffmpeg',
      ['-v', 'error', '-y', '-i', videoUrl, '-i', thenUrl, '-filter_complex', graph, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', output],
      { timeout: 5 * 60 * 1000 }
    );
    return await fs.readFile(output);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * The first `seconds` of a finished video (a free video ad without the founder message after its end card). Encoded
 * again: a plain copy keeps a few frames past the cut.
 */
export async function cutVideo(videoUrl: string, seconds: number): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-video-'));
  const output = path.join(dir, 'video.mp4');
  try {
    await run(
      'ffmpeg',
      ['-v', 'error', '-y', '-i', videoUrl, '-t', seconds.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', output],
      { timeout: 5 * 60 * 1000 }
    );
    return await fs.readFile(output);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** Levels the mix to -14 LUFS (social-media standard); a calm voice otherwise comes out quiet. */
export async function levelLoudness(videoUrl: string): Promise<Buffer> {
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
