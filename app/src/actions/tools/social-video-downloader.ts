'use server';

import { ApifyClient } from 'apify-client';
import { detectPlatform } from '@/lib/social-video-utils';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || '',
});

// Platform-specific Actor IDs (pay-per-use, NO monthly subscription)
const ACTOR_IDS: Record<string, string> = {
  instagram: 'EYxjTNaAMlqUePwza', // igview-owner/instagram-video-downloader - $0.005/video, NO subscription
  tiktok: 'Uyv5cLfgesW6cROPV',    // wilcode/fast-tiktok-downloader-without-watermark - $0.005/request
};

export interface SocialVideoDownloadResult {
  success: boolean;
  videoUrl?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  platform?: string;
  error?: string;
}

/**
 * Download a video from TikTok or Instagram using Apify
 * Returns the direct video URL that can be used for analysis
 */
export async function downloadSocialVideo(url: string): Promise<SocialVideoDownloadResult> {
  const platform = detectPlatform(url);

  if (platform === 'unknown') {
    return {
      success: false,
      error: 'Unsupported URL. Please use TikTok or Instagram video URLs.',
    };
  }

  if (platform === 'youtube') {
    return {
      success: false,
      error: 'YouTube videos are handled directly. Please use the YouTube URL option.',
    };
  }

  if (platform === 'facebook' || platform === 'twitter') {
    return {
      success: false,
      error: `${platform.charAt(0).toUpperCase() + platform.slice(1)} videos are not currently supported. Please use TikTok, Instagram, or YouTube URLs.`,
    };
  }

  if (!process.env.APIFY_API_TOKEN) {
    return {
      success: false,
      error: 'Apify API token not configured. Please add APIFY_API_TOKEN to environment variables.',
    };
  }

  const actorId = ACTOR_IDS[platform];
  if (!actorId) {
    return {
      success: false,
      error: `No downloader available for ${platform}.`,
    };
  }

  console.log(`📥 Downloading ${platform} video via Apify (Actor: ${actorId}): ${url}`);

  try {
    // Prepare Actor input based on platform
    let input: Record<string, unknown>;

    if (platform === 'instagram') {
      // Normalize Instagram URL: /reels/ -> /reel/ (actor expects singular form)
      let normalizedUrl = url.replace('/reels/', '/reel/');

      // igview-owner/instagram-video-downloader input format
      input = {
        instagram_urls: [normalizedUrl],
      };
      console.log(`📎 Normalized Instagram URL: ${normalizedUrl}`);
    } else if (platform === 'tiktok') {
      // TikTok video downloader input format: single url string
      input = {
        url,
        apiVersion: 'v1',
      };
    } else {
      input = { url };
    }

    // Run the Actor and wait for it to finish
    const run = await client.actor(actorId).call(input, {
      timeout: 120, // 2 minute timeout
    });

    // Fetch Actor results from the run's dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return {
        success: false,
        error: 'No video found at the provided URL.',
      };
    }

    const result = items[0] as Record<string, unknown>;

    // Extract the video URL from the result
    // The structure varies by platform, so we check multiple possible fields
    let videoUrl: string | undefined;
    let title: string | undefined;
    let thumbnail: string | undefined;
    let duration: number | undefined;

    // Extract video URL based on platform-specific response formats
    if (platform === 'instagram') {
      // Instagram downloader returns: videoUrl, displayUrl, etc.
      videoUrl = (result.videoUrl || result.video_url || result.displayUrl) as string | undefined;
      title = (result.caption || result.title) as string | undefined;
      thumbnail = (result.displayUrl || result.thumbnail) as string | undefined;
    } else if (platform === 'tiktok') {
      // TikTok downloader returns nested structure: result.video.playAddr[]
      const tiktokResult = result.result as Record<string, unknown> | undefined;
      if (tiktokResult) {
        const video = tiktokResult.video as Record<string, unknown> | undefined;
        if (video?.playAddr && Array.isArray(video.playAddr) && video.playAddr.length > 0) {
          videoUrl = video.playAddr[0] as string;
        }
        title = tiktokResult.desc as string | undefined;
        const author = tiktokResult.author as Record<string, unknown> | undefined;
        thumbnail = author?.avatar as string | undefined;
      }
      // Fallback to flat structure
      if (!videoUrl) {
        videoUrl = (result.downloadUrl || result.videoUrl || result.video_url || result.playAddr) as string | undefined;
        title = title || (result.text || result.desc || result.title) as string | undefined;
        thumbnail = thumbnail || (result.cover || result.thumbnail || result.originCover) as string | undefined;
      }
      if (result.duration) {
        duration = typeof result.duration === 'number' ? result.duration : parseFloat(result.duration as string);
      }
    }

    // Fallback: try common field names if platform-specific extraction failed
    if (!videoUrl) {
      if (result.videoUrl) {
        videoUrl = result.videoUrl as string;
      } else if (result.video_url) {
        videoUrl = result.video_url as string;
      } else if (result.downloadUrl) {
        videoUrl = result.downloadUrl as string;
      } else if (result.download_url) {
        videoUrl = result.download_url as string;
      } else if (result.url && typeof result.url === 'string' && result.url.includes('.mp4')) {
        videoUrl = result.url as string;
      } else if (result.formats && Array.isArray(result.formats)) {
        // Find the best quality video format
        const formats = result.formats as Array<{ url?: string; ext?: string; quality?: string; height?: number }>;
        const videoFormats = formats.filter(f => f.ext === 'mp4' || f.url?.includes('.mp4'));
        if (videoFormats.length > 0) {
          videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
          videoUrl = videoFormats[0].url;
        }
      }
    }

    // Fallback title extraction if not set by platform-specific code
    if (!title) {
      if (result.title) {
        title = result.title as string;
      } else if (result.description) {
        title = (result.description as string).slice(0, 100);
      }
    }

    // Fallback thumbnail extraction
    if (!thumbnail) {
      if (result.thumbnail) {
        thumbnail = result.thumbnail as string;
      } else if (result.thumbnail_url) {
        thumbnail = result.thumbnail_url as string;
      }
    }

    // Fallback duration extraction
    if (!duration && result.duration) {
      duration = typeof result.duration === 'number' ? result.duration : parseFloat(result.duration as string);
    }

    if (!videoUrl) {
      console.error('Apify result structure:', JSON.stringify(result, null, 2));
      return {
        success: false,
        error: 'Could not extract video URL from the response. The video might be private or unavailable.',
      };
    }

    console.log(`✅ ${platform} video downloaded successfully: ${videoUrl.slice(0, 100)}...`);

    return {
      success: true,
      videoUrl,
      title,
      thumbnail,
      duration,
      platform,
    };

  } catch (error) {
    console.error('Apify download error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Provide helpful error messages
    if (errorMessage.includes('timeout')) {
      return {
        success: false,
        error: 'Download timed out. The video might be too long or the server is busy. Please try again.',
      };
    }

    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return {
        success: false,
        error: 'Video not found. Please check if the URL is correct and the video is publicly available.',
      };
    }

    return {
      success: false,
      error: `Failed to download video: ${errorMessage}`,
    };
  }
}
