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
  facebook: 'PBJEdJdctLHQaqdfe',  // igview-owner/facebook-media-downloader - $0.005/video, NO subscription
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
 * Extract video from a Facebook Ads Library URL.
 * 1. Tries scraping the page HTML (fast, free).
 * 2. Falls back to apify/facebook-ads-scraper which accepts Ads Library URLs
 *    and returns video_hd_url / video_sd_url inside a snapshot object.
 */
async function extractFacebookAdsLibraryVideo(url: string): Promise<SocialVideoDownloadResult> {
  const adId = url.match(/[?&]id=(\d+)/)?.[1];
  console.log(`🎯 Detected Facebook Ads Library URL, ad ID: ${adId}`);

  // Step 1: try HTML extraction (fast, no cost — usually blocked by bot challenge)
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await response.text();

    const hdMatch = html.match(/"video_hd_url":"([^"]+)"/);
    const sdMatch = html.match(/"video_sd_url":"([^"]+)"/);
    const ogVideoMatch = html.match(/<meta[^>]+property="og:video(?::url)?"[^>]+content="([^"]+)"/);
    const playableMatch = html.match(/"playable_url":"([^"]+)"/);
    const playableHdMatch = html.match(/"playable_url_quality_hd":"([^"]+)"/);

    const rawUrl =
      playableHdMatch?.[1] ||
      hdMatch?.[1] ||
      playableMatch?.[1] ||
      sdMatch?.[1] ||
      ogVideoMatch?.[1];

    if (rawUrl) {
      const cleanUrl = rawUrl.replace(/\\u002F/g, '/').replace(/\\u0026/g, '&').replace(/\\/g, '');
      console.log(`✅ Extracted Ads Library video URL via HTML: ${cleanUrl.slice(0, 100)}...`);
      return { success: true, videoUrl: cleanUrl, title: `Facebook Ad ${adId || ''}`.trim(), platform: 'facebook' };
    }
  } catch (err) {
    console.error('Ads Library HTML fetch error:', err);
  }

  // Step 2: use apify/facebook-ads-scraper — accepts Ads Library URLs and
  // returns video_hd_url / video_sd_url inside snapshot.videos[]
  console.log('⚠️ HTML extraction failed, trying apify/facebook-ads-scraper...');
  try {
    const run = await client.actor('apify/facebook-ads-scraper').call(
      { startUrls: [{ url }], maxItems: 1 },
      { timeout: 120 },
    );
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (items && items.length > 0) {
      const ad = items[0] as Record<string, unknown>;
      const snapshot = ad.snapshot as Record<string, unknown> | undefined;
      const videos = snapshot?.videos as Array<Record<string, unknown>> | undefined;

      // Videos are inside snapshot.cards[].videoHdUrl (camelCase), not snapshot.videos
      const cards = snapshot?.cards as Array<Record<string, unknown>> | undefined;
      const videoUrl =
        (cards?.[0]?.videoHdUrl as string | undefined) ||
        (cards?.[0]?.videoSdUrl as string | undefined) ||
        (videos?.[0]?.video_hd_url as string | undefined) ||
        (videos?.[0]?.video_sd_url as string | undefined) ||
        (snapshot?.video_hd_url as string | undefined) ||
        (snapshot?.video_sd_url as string | undefined);

      if (videoUrl) {
        console.log(`✅ Extracted Ads Library video URL via apify/facebook-ads-scraper: ${videoUrl.slice(0, 100)}...`);
        return {
          success: true,
          videoUrl,
          title: (snapshot?.pageName as string | undefined) ? `Facebook Ad – ${snapshot?.pageName}` : `Facebook Ad ${adId || ''}`.trim(),
          thumbnail: (cards?.[0]?.videoPreviewImageUrl as string | undefined) || undefined,
          platform: 'facebook',
        };
      }

      console.error('apify/facebook-ads-scraper returned item but no video URL:', JSON.stringify(ad, null, 2));
    }
  } catch (err) {
    console.error('apify/facebook-ads-scraper error:', err);
  }

  return {
    success: false,
    error:
      'Could not extract the video from this Facebook Ads Library link. ' +
      'Please download the video file and upload it directly.',
  };
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

  if (platform === 'twitter') {
    return {
      success: false,
      error: 'Twitter/X videos are not currently supported. Please use TikTok, Instagram, Facebook, or YouTube URLs.',
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
    } else if (platform === 'facebook') {
      // Handle Facebook Ads Library URLs — use dedicated extractor.
      if (url.includes('/ads/library/')) {
        return await extractFacebookAdsLibraryVideo(url);
      }

      // Normalize Facebook URL for the Apify actor
      // Actor requires: www.facebook.com with /watch?v=, /reel/, or /photo paths
      let normalizedUrl = url;

      // Convert web.facebook.com to www.facebook.com
      normalizedUrl = normalizedUrl.replace('web.facebook.com', 'www.facebook.com');
      normalizedUrl = normalizedUrl.replace('m.facebook.com', 'www.facebook.com');

      // Handle fb.watch short URLs - these need to be resolved
      if (url.includes('fb.watch')) {
        console.log(`🔗 Resolving fb.watch short URL: ${url}`);
        try {
          const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
          normalizedUrl = response.url;
          normalizedUrl = normalizedUrl.replace('web.facebook.com', 'www.facebook.com');
          normalizedUrl = normalizedUrl.replace('m.facebook.com', 'www.facebook.com');
          console.log(`✅ Resolved to: ${normalizedUrl}`);
        } catch (e) {
          console.log(`⚠️ Could not resolve fb.watch URL, using original`);
        }
      }

      // Convert /videos/ format to /watch?v= format
      // e.g., /61577097980033/videos/1157004793172520/ -> /watch?v=1157004793172520
      const videosMatch = normalizedUrl.match(/\/videos\/(\d+)/);
      if (videosMatch) {
        const videoId = videosMatch[1];
        normalizedUrl = `https://www.facebook.com/watch?v=${videoId}`;
        console.log(`🔄 Converted /videos/ URL to /watch?v= format: ${normalizedUrl}`);
      }

      // Handle /share/v/ URLs - these need to be resolved to canonical format
      if (normalizedUrl.includes('/share/v/') || normalizedUrl.includes('/share/r/')) {
        console.log(`🔗 Resolving Facebook share URL: ${normalizedUrl}`);
        try {
          const response = await fetch(normalizedUrl, { method: 'HEAD', redirect: 'follow' });
          normalizedUrl = response.url;
          normalizedUrl = normalizedUrl.replace('web.facebook.com', 'www.facebook.com');
          normalizedUrl = normalizedUrl.replace('m.facebook.com', 'www.facebook.com');
          console.log(`✅ Resolved to: ${normalizedUrl}`);
        } catch (e) {
          console.log(`⚠️ Could not resolve share URL, trying to extract video directly`);
          // Try fetching the page and extracting the canonical URL or video
          try {
            const pageResponse = await fetch(url);
            const html = await pageResponse.text();

            // Look for canonical URL in the page
            const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
            if (canonicalMatch) {
              normalizedUrl = canonicalMatch[1].replace('web.facebook.com', 'www.facebook.com');
              console.log(`✅ Found canonical URL: ${normalizedUrl}`);
            }

            // Also look for og:url meta tag
            if (!canonicalMatch) {
              const ogUrlMatch = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/);
              if (ogUrlMatch) {
                normalizedUrl = ogUrlMatch[1].replace('web.facebook.com', 'www.facebook.com');
                console.log(`✅ Found og:url: ${normalizedUrl}`);
              }
            }
          } catch (fetchError) {
            console.error('Failed to fetch share page:', fetchError);
          }
        }
      }

      // igview-owner/facebook-media-downloader input format
      input = {
        urls: [normalizedUrl],
      };
      console.log(`📘 Facebook URL (normalized): ${normalizedUrl}`);
    } else if (platform === 'tiktok') {
      // Check if it's a Creative Center URL - extract video URL directly from page
      if (url.includes('ads.tiktok.com') || url.includes('creativecenter')) {
        console.log(`🎯 Detected TikTok Creative Center URL, extracting video directly...`);
        try {
          const response = await fetch(url);
          const html = await response.text();

          // Look for video URLs in the page (720p preferred, then 540p, then 480p)
          const videoUrlMatch = html.match(/https:\/\/v16m[^"'\s]+tiktokcdn\.com[^"'\s]+/g);

          if (videoUrlMatch && videoUrlMatch.length > 0) {
            // Get the longest URL (usually highest quality)
            const bestUrl = videoUrlMatch.sort((a, b) => b.length - a.length)[0];
            // Clean up any HTML entities
            const cleanUrl = bestUrl.replace(/\\u002F/g, '/').replace(/&amp;/g, '&');
            console.log(`✅ Extracted Creative Center video URL: ${cleanUrl.slice(0, 80)}...`);
            return {
              success: true,
              videoUrl: cleanUrl,
              title: 'TikTok Ad',
              platform: 'tiktok',
            };
          }

          return {
            success: false,
            error: 'Could not extract video URL from Creative Center page. Try downloading the video manually.',
          };
        } catch (fetchError) {
          console.error('Creative Center fetch error:', fetchError);
          return {
            success: false,
            error: 'Failed to fetch Creative Center page. Please download the video manually.',
          };
        }
      }

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
    } else if (platform === 'facebook') {
      // Facebook downloader returns: videoUrl, hdVideoUrl, etc.
      videoUrl = (result.hdVideoUrl || result.videoUrl || result.video_url || result.sdVideoUrl) as string | undefined;
      title = (result.title || result.description) as string | undefined;
      thumbnail = (result.thumbnail || result.thumbnailUrl) as string | undefined;
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
