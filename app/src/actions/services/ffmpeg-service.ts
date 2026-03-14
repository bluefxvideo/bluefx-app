'use server';

/**
 * Server-side FFmpeg utilities for audio/video processing.
 * Uses system ffmpeg (installed in Docker image via `apk add ffmpeg`).
 * For local dev: `brew install ffmpeg`
 */

/**
 * Extract audio track from a video file as WAV.
 */
export async function extractAudioFromVideo(
  videoPath: string,
  outputPath: string,
): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const command = `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 44100 -ac 1 -y "${outputPath}"`;
  await execAsync(command, { timeout: 120_000 });
}

/**
 * Replace audio track in a video file with new audio.
 * Video stream is copied (no re-encoding), audio is encoded as AAC.
 */
export async function replaceAudioInVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest -y "${outputPath}"`;
  await execAsync(command, { timeout: 300_000 });
}

/**
 * Create a temporary file path with a unique name.
 */
export async function createTempPath(prefix: string, extension: string): Promise<string> {
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  return join(tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`);
}

/**
 * Clean up temporary files. Silently ignores missing files.
 */
export async function cleanupTempFiles(...paths: string[]): Promise<void> {
  const { unlink } = await import('fs/promises');
  for (const p of paths) {
    try { await unlink(p); } catch { /* ignore */ }
  }
}
