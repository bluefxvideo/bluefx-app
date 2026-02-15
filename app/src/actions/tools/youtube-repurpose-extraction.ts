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
 * Downloads a YouTube video using yt-dlp and uploads to Supabase Storage.
 * This is the slow operation — can take 1-5 minutes depending on video length.
 */
export async function downloadYouTubeVideo(url: string): Promise<DownloadYouTubeVideoResult> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    console.log('Downloading YouTube video:', videoId);

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { readFile, unlink, stat } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const { join } = await import('path');

    const execAsync = promisify(exec);
    const { readdir } = await import('fs/promises');

    // Use a base name WITHOUT extension — yt-dlp will add the correct extension
    const tempBase = join(tmpdir(), `yt_video_${videoId}_${Date.now()}`);
    const tempOutput = `${tempBase}.%(ext)s`;

    // Download video with yt-dlp — h264 video + aac audio, 1080p max, merged to mp4
    const command = `yt-dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]" --merge-output-format mp4 --no-warnings -o "${tempOutput}" "https://www.youtube.com/watch?v=${videoId}" 2>&1`;

    console.log('Running yt-dlp with output template:', tempOutput);
    const { stdout } = await execAsync(command, { timeout: 600000 }); // 10 min timeout
    console.log('yt-dlp output:', stdout.substring(0, 500));

    // Find the actual output file — yt-dlp may have created .mp4 or .mkv etc.
    const tempDir = tmpdir();
    const prefix = `yt_video_${videoId}_`;
    const files = await readdir(tempDir);
    const outputFile = files
      .filter(f => f.startsWith(prefix) && (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.webm')))
      .sort()
      .pop(); // most recent

    if (!outputFile) {
      console.error('No output file found. yt-dlp stdout:', stdout);
      return { success: false, error: 'Video download completed but output file not found. Check yt-dlp output.' };
    }

    const tempFile = join(tempDir, outputFile);
    console.log('Found output file:', tempFile);

    // Check file exists and get size
    const fileStats = await stat(tempFile);
    const fileSizeMB = Math.round(fileStats.size / 1024 / 1024);
    console.log(`Video downloaded: ${fileSizeMB}MB`);

    // Read file into buffer
    const videoBuffer = await readFile(tempFile);

    // Upload to Supabase Storage
    const fileName = `${user.id}/yt-${videoId}-${Date.now()}.mp4`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content-multiplier-videos')
      .upload(fileName, videoBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false,
      });

    // Clean up temp file
    await unlink(tempFile).catch(() => {});

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Get public URL
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to download video';

    // Provide helpful error messages
    if (errorMessage.includes('yt-dlp')) {
      return { success: false, error: 'yt-dlp is not installed. Install with: brew install yt-dlp' };
    }
    if (errorMessage.includes('timeout')) {
      return { success: false, error: 'Video download timed out. The video might be too long.' };
    }

    return { success: false, error: errorMessage };
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
