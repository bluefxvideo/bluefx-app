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
