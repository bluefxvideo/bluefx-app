'use server';

import { createClient } from '@/app/supabase/server';
import { fetchYouTubeTranscript } from './youtube-transcript';

// ============================================================================
// TYPES
// ============================================================================

export interface YouTubeMetadata {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl: string;
  channelName: string;
  productUrl: string | null;
}

export interface ExtractYouTubeDataResult {
  success: boolean;
  metadata?: YouTubeMetadata;
  transcript?: string;
  error?: string;
}

export interface DownloadYouTubeVideoResult {
  success: boolean;
  videoStorageUrl?: string;
  fileSizeMB?: number;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract the first non-social-media URL from a YouTube description.
 * This is typically the creator's product/website link.
 */
function extractProductUrl(description: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const urls = description.match(urlRegex) || [];

  const productUrls = urls.filter(url => {
    const lower = url.toLowerCase();
    return (
      !lower.includes('youtube.com') &&
      !lower.includes('youtu.be') &&
      !lower.includes('instagram.com') &&
      !lower.includes('twitter.com') &&
      !lower.includes('x.com') &&
      !lower.includes('facebook.com') &&
      !lower.includes('tiktok.com') &&
      !lower.includes('discord.gg')
    );
  });

  return productUrls[0] || null;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Extract metadata from YouTube page HTML
 */
async function extractMetadataFromPage(videoId: string): Promise<{
  title: string;
  description: string;
  tags: string[];
  channelName: string;
} | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Extract title
    let title = '';
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      title = titleMatch[1].replace(' - YouTube', '').trim();
    }

    // Extract description from meta tag
    let description = '';
    const descMatch = html.match(/<meta name="description" content="([^"]*)">/);
    if (descMatch) {
      description = descMatch[1];
    }

    // Try to get full description from ytInitialPlayerResponse
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
    if (playerResponseMatch) {
      try {
        const playerData = JSON.parse(playerResponseMatch[1]);
        const videoDetails = playerData?.videoDetails;
        if (videoDetails) {
          if (videoDetails.title) title = videoDetails.title;
          if (videoDetails.shortDescription) description = videoDetails.shortDescription;
        }
      } catch {
        // JSON parse failed, use meta tag values
      }
    }

    // Extract tags from meta keywords
    let tags: string[] = [];
    const keywordsMatch = html.match(/<meta name="keywords" content="([^"]*)">/);
    if (keywordsMatch) {
      tags = keywordsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
    }

    // Extract channel name
    let channelName = '';
    const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
    if (channelMatch) {
      channelName = channelMatch[1];
    } else {
      const linkMatch = html.match(/<link itemprop="name" content="([^"]+)">/);
      if (linkMatch) {
        channelName = linkMatch[1];
      }
    }

    return { title, description, tags, channelName };
  } catch (error) {
    console.error('Failed to extract metadata from page:', error);
    return null;
  }
}

// ============================================================================
// ACTION 1: EXTRACT METADATA + TRANSCRIPT (FAST)
// ============================================================================

/**
 * Extracts YouTube video metadata and transcript.
 * This is the fast operation — returns in ~5-15 seconds.
 */
export async function extractYouTubeData(url: string): Promise<ExtractYouTubeDataResult> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    console.log('Extracting YouTube data for video:', videoId);

    // Run metadata + transcript extraction in parallel
    const [metadataResult, transcriptResult, oembedResult] = await Promise.all([
      extractMetadataFromPage(videoId),
      fetchYouTubeTranscript(url),
      // oEmbed for reliable title + thumbnail
      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]);

    // Combine metadata sources — page scraping is primary, oEmbed as fallback
    const title = metadataResult?.title || oembedResult?.title || '';
    const description = metadataResult?.description || '';
    const tags = metadataResult?.tags || [];
    const channelName = metadataResult?.channelName || oembedResult?.author_name || '';
    const thumbnailUrl = oembedResult?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    if (!title) {
      return { success: false, error: 'Could not extract video metadata. Is this a valid public YouTube video?' };
    }

    const metadata: YouTubeMetadata = {
      videoId,
      title,
      description,
      tags,
      thumbnailUrl,
      channelName,
      productUrl: extractProductUrl(description),
    };

    return {
      success: true,
      metadata,
      transcript: transcriptResult.success ? transcriptResult.transcript : undefined,
    };
  } catch (error) {
    console.error('YouTube data extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract YouTube data',
    };
  }
}

// ============================================================================
// ACTION 2: DOWNLOAD VIDEO + UPLOAD TO STORAGE (SLOW)
// ============================================================================

/**
 * Download video via RapidAPI YouTube Media Downloader.
 * Returns a direct download URL for the video.
 */
async function downloadViaRapidAPI(videoId: string): Promise<{ downloadUrl?: string; error: string }> {
  const apiKey = process.env.RAPIDAPI_KEY || process.env.APP_RAPIDAPI_KEY;
  if (!apiKey) {
    return { error: 'No RAPIDAPI_KEY env var set' };
  }

  try {
    const response = await fetch(
      `https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=${videoId}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { error: `API ${response.status}: ${body.substring(0, 200)}` };
    }

    const data = await response.json();

    // Find best mp4 video with audio (progressive streams)
    const videos = data?.videos?.items || [];

    if (videos.length === 0) {
      return { error: `API returned no video items. Keys: ${Object.keys(data || {}).join(',')}` };
    }

    // First try: progressive mp4 with audio (single file, no merging needed)
    const progressive = videos
      .filter((v: { url?: string; extension?: string; hasAudio?: boolean }) =>
        v.url && v.extension === 'mp4' && v.hasAudio
      )
      .sort((a: { height?: number }, b: { height?: number }) =>
        (b.height || 0) - (a.height || 0)
      );

    if (progressive.length > 0) {
      const best = progressive.find((v: { height?: number }) => (v.height || 0) <= 1080) || progressive[0];
      console.log('Found progressive mp4:', best.quality, best.height + 'p', best.sizeText);
      return { downloadUrl: best.url, error: '' };
    }

    // Second try: any mp4 video stream (may not have audio)
    const anyMp4 = videos
      .filter((v: { url?: string; extension?: string }) => v.url && v.extension === 'mp4')
      .sort((a: { height?: number }, b: { height?: number }) =>
        (b.height || 0) - (a.height || 0)
      );

    if (anyMp4.length > 0) {
      const best = anyMp4.find((v: { height?: number }) => (v.height || 0) <= 1080) || anyMp4[0];
      console.log('Found mp4 (may lack audio):', best.quality, best.height + 'p', best.sizeText);
      return { downloadUrl: best.url, error: '' };
    }

    // Log what we got for debugging
    const formats = videos.map((v: { extension?: string; hasAudio?: boolean; quality?: string }) =>
      `${v.extension}/${v.quality}/${v.hasAudio ? 'audio' : 'no-audio'}`
    ).join(', ');
    return { error: `No mp4 found. Formats: ${formats}` };
  } catch (error) {
    return { error: `Exception: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Download video via yt-dlp CLI (works locally, may fail on servers due to bot detection).
 * Returns a path to the downloaded temp file.
 */
async function downloadViaYtDlp(videoId: string): Promise<{ tempFile: string; error?: string } | null> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const { readdir } = await import('fs/promises');

    const execAsync = promisify(exec);

    const tempBase = join(tmpdir(), `yt_video_${videoId}_${Date.now()}`);
    const tempOutput = `${tempBase}.%(ext)s`;

    const command = `yt-dlp -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]" --merge-output-format mp4 --no-warnings -o "${tempOutput}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;

    console.log('Running yt-dlp...');
    let stdout: string;
    try {
      const result = await execAsync(command, { timeout: 600000 });
      stdout = result.stdout;
    } catch (execError: unknown) {
      const e = execError as { stdout?: string; stderr?: string; message?: string };
      const output = e.stdout || e.stderr || e.message || 'Unknown error';
      console.error('yt-dlp failed:', output.substring(0, 500));
      return { tempFile: '', error: output.substring(0, 300) };
    }
    console.log('yt-dlp output:', stdout.substring(0, 500));

    // Find the output file
    const tempDir = tmpdir();
    const prefix = `yt_video_${videoId}_`;
    const files = await readdir(tempDir);
    const outputFile = files
      .filter(f => f.startsWith(prefix) && (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm')))
      .sort()
      .pop();

    if (!outputFile) {
      return { tempFile: '', error: 'Output file not found after download' };
    }

    return { tempFile: join(tempDir, outputFile) };
  } catch (error) {
    console.error('yt-dlp error:', error);
    return null;
  }
}

/**
 * Downloads a YouTube video and uploads to Supabase Storage.
 * Tries RapidAPI first (works on servers), falls back to yt-dlp (works locally).
 */
export async function downloadYouTubeVideo(url: string): Promise<DownloadYouTubeVideoResult> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    console.log('Downloading YouTube video:', videoId);

    let videoBuffer: Buffer | null = null;

    // Method 1: Try RapidAPI (works on servers, no bot detection issues)
    let apiError = '';
    const apiResult = await downloadViaRapidAPI(videoId);
    if (apiResult.downloadUrl) {
      console.log('Downloading video from API URL...');
      try {
        const response = await fetch(apiResult.downloadUrl, {
          headers: {
            'Referer': 'https://www.youtube.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(300000), // 5 min timeout
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          videoBuffer = Buffer.from(arrayBuffer);
          const sizeMB = Math.round(videoBuffer.length / 1024 / 1024);
          console.log(`Video fetched via API: ${sizeMB}MB`);
        } else {
          apiError = `Download URL returned ${response.status}`;
        }
      } catch (fetchErr) {
        apiError = `Fetch failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`;
      }
    } else {
      apiError = apiResult.error;
    }

    // Method 2: Fall back to yt-dlp (works locally)
    if (!videoBuffer) {
      console.log('API failed:', apiError, '— falling back to yt-dlp...');
      const ytResult = await downloadViaYtDlp(videoId);

      if (ytResult?.tempFile && !ytResult.error) {
        const { readFile, unlink, stat } = await import('fs/promises');
        const fileStats = await stat(ytResult.tempFile);
        console.log(`Video downloaded via yt-dlp: ${Math.round(fileStats.size / 1024 / 1024)}MB`);
        videoBuffer = await readFile(ytResult.tempFile);
        await unlink(ytResult.tempFile).catch(() => {});
      } else {
        const ytError = ytResult?.error || 'yt-dlp not available';
        return { success: false, error: `Video download failed. API: ${apiError}. yt-dlp: ${ytError}` };
      }
    }

    if (!videoBuffer || videoBuffer.length === 0) {
      return { success: false, error: 'Downloaded video is empty' };
    }

    const fileSizeMB = Math.round(videoBuffer.length / 1024 / 1024);

    // Upload to Supabase Storage
    const fileName = `${user.id}/yt-${videoId}-${Date.now()}.mp4`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content-multiplier-videos')
      .upload(fileName, videoBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage
      .from('content-multiplier-videos')
      .getPublicUrl(uploadData.path);

    console.log('Video uploaded to storage:', urlData.publicUrl);

    return {
      success: true,
      videoStorageUrl: urlData.publicUrl,
      fileSizeMB,
    };
  } catch (error) {
    console.error('YouTube video download error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download video',
    };
  }
}

// ============================================================================
// ACTION 3: DELETE VIDEO FROM STORAGE (CLEANUP)
// ============================================================================

/**
 * Deletes a video from Supabase Storage after publishing is complete.
 * Videos are temporary — only needed long enough to post to social platforms.
 */
export async function deleteVideoFromStorage(videoStorageUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Extract the file path from the public URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/content-multiplier-videos/userId/filename.mp4
    const bucketName = 'content-multiplier-videos';
    const urlParts = videoStorageUrl.split(`/storage/v1/object/public/${bucketName}/`);
    if (urlParts.length < 2) {
      return { success: false, error: 'Could not parse storage URL' };
    }

    const filePath = urlParts[1];
    console.log('Deleting video from storage:', filePath);

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('Storage delete error:', error);
      return { success: false, error: error.message };
    }

    console.log('Video deleted from storage successfully');
    return { success: true };
  } catch (error) {
    console.error('Video cleanup error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Cleanup failed' };
  }
}

/**
 * Cleans up videos older than 24 hours from storage.
 * Safety net in case publishing fails and auto-delete doesn't run.
 */
export async function cleanupOldVideos(): Promise<{ deleted: number; errors: number }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { deleted: 0, errors: 0 };

    const bucketName = 'content-multiplier-videos';
    const userPrefix = `${user.id}/`;

    // List files in user's directory that start with "yt-" (repurpose videos)
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(userPrefix, { search: 'yt-' });

    if (error || !files) return { deleted: 0, errors: 0 };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let deleted = 0;
    let errors = 0;

    for (const file of files) {
      if (!file.name.startsWith('yt-')) continue;

      const createdAt = new Date(file.created_at);
      if (createdAt < oneDayAgo) {
        const { error: delError } = await supabase.storage
          .from(bucketName)
          .remove([`${userPrefix}${file.name}`]);

        if (delError) {
          errors++;
        } else {
          deleted++;
        }
      }
    }

    console.log(`Cleaned up ${deleted} old videos (${errors} errors)`);
    return { deleted, errors };
  } catch {
    return { deleted: 0, errors: 0 };
  }
}
