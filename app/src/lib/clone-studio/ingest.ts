import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { detectPlatform } from '@/lib/social-video-utils';
import { downloadSocialVideo } from '@/actions/tools/social-video-downloader';
import { downloadToFile } from './segmentation';
import type { CloneScenePlatform } from '@/types/clone-studio';

const execFileAsync = promisify(execFile);

export interface IngestResult {
  /** Local path of the downloaded source video. */
  filePath: string;
  platform: CloneScenePlatform;
  title?: string;
}

/**
 * Resolve a source (social/YouTube URL or an already-uploaded video URL) to a
 * local file in workDir. Social platforms go through the existing Apify
 * downloader; YouTube uses the yt-dlp binary that ships in the app container
 * (installed for transcript fetching).
 */
export async function ingestSourceVideo(
  workDir: string,
  source: { source_url?: string; video_url?: string }
): Promise<IngestResult> {
  const filePath = path.join(workDir, 'source.mp4');

  if (source.video_url) {
    await downloadToFile(source.video_url, filePath);
    return { filePath, platform: 'upload' };
  }

  if (!source.source_url) {
    throw new Error('Provide a video URL or upload a video file');
  }

  const platform = detectPlatform(source.source_url);

  if (platform === 'youtube') {
    // -f: best mp4 video ≤1080p + audio; ffmpeg in the container handles the merge
    await execFileAsync('yt-dlp', [
      '-f', 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
      '--merge-output-format', 'mp4',
      '--no-warnings',
      '--no-playlist',
      '-o', filePath,
      source.source_url,
    ], { timeout: 180000, maxBuffer: 8 * 1024 * 1024 });

    await fs.access(filePath);
    return { filePath, platform: 'youtube' };
  }

  if (platform === 'tiktok' || platform === 'instagram' || platform === 'facebook') {
    const download = await downloadSocialVideo(source.source_url);
    if (!download.success || !download.videoUrl) {
      throw new Error(download.error || `Could not download the ${platform} video`);
    }
    await downloadToFile(download.videoUrl, filePath);
    return { filePath, platform, title: download.title };
  }

  throw new Error(
    'Unsupported URL. Use a TikTok, Instagram, Facebook, or YouTube link — or upload the video file directly.'
  );
}
