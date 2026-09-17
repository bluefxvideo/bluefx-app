import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Length of a hosted audio or video file in seconds, read by ffprobe straight
 * from its http(s) link. Returns null when the file cannot be measured, so the
 * caller decides what an unknown length means.
 */
export async function probeMediaSeconds(url: string): Promise<number | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      url,
    ], { timeout: 30_000 });
    const seconds = parseFloat(stdout.trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch (error) {
    console.warn('probeMediaSeconds: could not measure the file:', error);
    return null;
  }
}
