'use server';

import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || '',
});

// Actor ID for the All Social Media Video Downloader
const ACTOR_ID = 'hVlkT1FrZB15YsUDo';

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
 * Detect the platform from a URL
 */
export function detectPlatform(url: string): 'tiktok' | 'instagram' | 'facebook' | 'twitter' | 'youtube' | 'unknown' {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) {
    return 'tiktok';
  }
  if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) {
    return 'instagram';
  }
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerUrl.includes('fb.com')) {
    return 'facebook';
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'twitter';
  }
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }

  return 'unknown';
}

/**
 * Check if a URL is a supported social media video URL
 */
export function isSupportedSocialUrl(url: string): boolean {
  const platform = detectPlatform(url);
  // YouTube is handled natively by Gemini, so we don't need Apify for it
  return platform !== 'unknown' && platform !== 'youtube';
}

/**
 * Download a video from TikTok, Instagram, Facebook, or Twitter using Apify
 * Returns the direct video URL that can be used for analysis
 */
export async function downloadSocialVideo(url: string): Promise<SocialVideoDownloadResult> {
  const platform = detectPlatform(url);

  if (platform === 'unknown') {
    return {
      success: false,
      error: 'Unsupported URL. Please use TikTok, Instagram, Facebook, or Twitter video URLs.',
    };
  }

  if (platform === 'youtube') {
    return {
      success: false,
      error: 'YouTube videos are handled directly. Please use the YouTube URL option.',
    };
  }

  if (!process.env.APIFY_API_TOKEN) {
    return {
      success: false,
      error: 'Apify API token not configured. Please add APIFY_API_TOKEN to environment variables.',
    };
  }

  console.log(`📥 Downloading ${platform} video via Apify: ${url}`);

  try {
    // Prepare Actor input
    const input = {
      url,
      proxySettings: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
        apifyProxyCountry: 'US',
      },
      mergeAV: true, // Merge audio and video for Instagram/Facebook
    };

    // Run the Actor and wait for it to finish
    const run = await client.actor(ACTOR_ID).call(input, {
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

    // Try different field names that Apify might return
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
        // Sort by quality/height if available
        videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
        videoUrl = videoFormats[0].url;
      }
    }

    // Get title
    if (result.title) {
      title = result.title as string;
    } else if (result.description) {
      title = (result.description as string).slice(0, 100);
    }

    // Get thumbnail
    if (result.thumbnail) {
      thumbnail = result.thumbnail as string;
    } else if (result.thumbnail_url) {
      thumbnail = result.thumbnail_url as string;
    }

    // Get duration
    if (result.duration) {
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
