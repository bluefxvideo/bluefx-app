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
