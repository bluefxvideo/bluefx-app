import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { ApifyClient } from 'apify-client';
import { detectPlatform } from '@/lib/social-video-utils';
import { downloadSocialVideo } from '@/actions/tools/social-video-downloader';
import { downloadToFile } from './segmentation';
import type { CloneScenePlatform } from '@/types/clone-studio';

const execFileAsync = promisify(execFile);

// streamers/youtube-video-downloader — pay-per-use (~$0.005/MB), 12k+ users.
// Fallback for when YouTube's bot wall blocks yt-dlp from the server's
// datacenter IP ("Sign in to confirm you're not a bot").
const YOUTUBE_APIFY_ACTOR_ID = 'UUhJDfKJT2SsXdclR';

async function downloadYouTubeViaApify(url: string, filePath: string): Promise<void> {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error('YouTube download blocked by bot check and APIFY_API_TOKEN is not configured');
  }
  const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

  console.log(`📥 Clone Studio: downloading YouTube video via Apify: ${url}`);
  const run = await client.actor(YOUTUBE_APIFY_ACTOR_ID).call(
    {
      videos: [{ url }],
      storeInKVStore: true,
      preferredQuality: '1080p',
      preferredFormat: 'mp4',
    },
    { timeout: 300 }
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const fileUrl = (items?.[0] as Record<string, unknown> | undefined)?.downloadedFileUrl as
    | string
    | undefined;
  if (!fileUrl) {
    throw new Error('Could not download this YouTube video (it may be private, age-gated, or region-locked)');
  }

  const separator = fileUrl.includes('?') ? '&' : '?';
  await downloadToFile(`${fileUrl}${separator}token=${process.env.APIFY_API_TOKEN}`, filePath);
}

async function downloadYouTubeViaYtDlp(url: string, filePath: string): Promise<void> {
  // -f: best mp4 video ≤1080p + audio; ffmpeg in the container handles the merge
  await execFileAsync('yt-dlp', [
    '-f', 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
    '--merge-output-format', 'mp4',
    '--no-warnings',
    '--no-playlist',
    '-o', filePath,
    url,
  ], { timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  await fs.access(filePath);
}

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
    // yt-dlp is free and fast but YouTube's bot wall blocks it from
    // datacenter IPs (production). Try it first, fall back to the paid actor.
    try {
      await downloadYouTubeViaYtDlp(source.source_url, filePath);
    } catch (ytdlpError) {
      const message = ytdlpError instanceof Error ? ytdlpError.message : String(ytdlpError);
      console.warn(`Clone Studio: yt-dlp failed (${message.slice(0, 200)}), falling back to Apify`);
      await downloadYouTubeViaApify(source.source_url, filePath);
    }
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
