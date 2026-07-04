import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);
const FFMPEG_MAX_BUFFER = 32 * 1024 * 1024;

/**
 * Assembly: joins the animated scene clips in order. By default the FULL
 * generated clips are used — the engine's 3s minimum means a sub-second
 * scene gets a 3s performance, and trimming that back to 0.9s cuts the
 * action off before it lands (owner feedback). `trimToOriginal` restores
 * the source ad's exact cut rhythm for tightly-paced clones.
 *
 * Strategy: normalize each clip (optional trim, scale/pad, 25fps, aac 48k
 * stereo, silence track if the clip has no audio), then concat-demux with
 * stream copy. Per-clip normalization keeps one bad clip from failing a
 * giant filter graph and makes the concat itself trivial.
 */

async function hasAudioStream(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      filePath,
    ], { maxBuffer: FFMPEG_MAX_BUFFER });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function normalizeClip(
  inPath: string,
  outPath: string,
  /** Trim target in seconds, or null to keep the clip's full length. */
  durationSeconds: number | null,
  width: number,
  height: number
): Promise<void> {
  const withAudio = await hasAudioStream(inPath);
  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25`;
  const trimArgs = durationSeconds != null ? ['-t', durationSeconds.toFixed(3)] : [];

  const args = withAudio
    ? [
        '-i', inPath,
        ...trimArgs,
        '-vf', vf,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
        '-c:a', 'aac', '-ar', '48000', '-ac', '2',
        '-y', outPath,
      ]
    : [
        '-i', inPath,
        '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
        ...trimArgs,
        '-vf', vf,
        '-map', '0:v', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
        '-c:a', 'aac', '-ar', '48000', '-ac', '2',
        '-shortest',
        '-y', outPath,
      ];

  await execFileAsync('ffmpeg', args, { maxBuffer: FFMPEG_MAX_BUFFER });
}

async function probeDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ], { maxBuffer: FFMPEG_MAX_BUFFER });
  return parseFloat(stdout.trim()) || 0;
}

export interface AssemblyClip {
  filePath: string;
  /** Original scene duration in the source ad — the clip is trimmed to this. */
  durationSeconds: number;
}

export async function assembleClips(opts: {
  workDir: string;
  clips: AssemblyClip[];
  width: number;
  height: number;
  /** Optional music bed (mp3/m4a path) mixed under the scene audio. */
  musicFilePath?: string;
  /** Trim each clip to its original scene duration (source cut rhythm). Default: full clips. */
  trimToOriginal?: boolean;
  outPath: string;
}): Promise<void> {
  const { workDir, clips, width, height, musicFilePath, trimToOriginal, outPath } = opts;
  // Kling outputs are ~even-dimension already, but pad targets must be even for yuv420p
  const evenWidth = Math.round(width / 2) * 2;
  const evenHeight = Math.round(height / 2) * 2;

  const normalizedPaths: string[] = [];
  for (const [i, clip] of clips.entries()) {
    const normPath = path.join(workDir, `norm-${String(i + 1).padStart(2, '0')}.mp4`);
    await normalizeClip(clip.filePath, normPath, trimToOriginal ? clip.durationSeconds : null, evenWidth, evenHeight);
    normalizedPaths.push(normPath);
  }

  const listPath = path.join(workDir, 'concat.txt');
  await fs.writeFile(
    listPath,
    normalizedPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  );

  const concatPath = musicFilePath ? path.join(workDir, 'concat.mp4') : outPath;
  await execFileAsync('ffmpeg', [
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    '-y', concatPath,
  ], { maxBuffer: FFMPEG_MAX_BUFFER });

  if (musicFilePath) {
    // Measure the real concat length — with full clips it exceeds the sum of
    // the original scene durations
    const totalSeconds = (await probeDurationSeconds(concatPath)) ||
      clips.reduce((sum, c) => sum + c.durationSeconds, 0);
    const fadeStart = Math.max(0, totalSeconds - 2).toFixed(2);
    // Scene audio at full level, music bed at 0.85, 2s fade-out (verified mix
    // from the hand-run remake). normalize=0 keeps amix from halving levels.
    await execFileAsync('ffmpeg', [
      '-i', concatPath,
      '-stream_loop', '-1', '-i', musicFilePath,
      '-filter_complex',
      `[1:a]volume=0.85,atrim=duration=${totalSeconds.toFixed(2)}[bed];` +
        `[0:a][bed]amix=inputs=2:duration=first:normalize=0,afade=t=out:st=${fadeStart}:d=2[a]`,
      '-map', '0:v', '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac', '-ar', '48000',
      '-y', outPath,
    ], { maxBuffer: FFMPEG_MAX_BUFFER });
  }
}
