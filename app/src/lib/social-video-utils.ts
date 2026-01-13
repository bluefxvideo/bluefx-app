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
 * Currently supports TikTok and Instagram (pay-per-use via Apify)
 * YouTube is handled natively by Gemini
 */
export function isSupportedSocialUrl(url: string): boolean {
  const platform = detectPlatform(url);
  // Only TikTok and Instagram are supported via Apify
  // YouTube is handled natively by Gemini
  // Facebook and Twitter are not currently supported
  return platform === 'tiktok' || platform === 'instagram';
}
