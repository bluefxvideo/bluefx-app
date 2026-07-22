/**
 * Turn a raw FAL error response into a message safe to show users:
 * no third-party provider names, and content-policy rejections become an
 * actionable explanation instead of truncated JSON.
 */
export function friendlyFalImageError(status: number, errorText: string): string {
  if (
    errorText.includes('content_policy_violation') ||
    errorText.includes('content checker') ||
    errorText.includes('flagged by a content')
  ) {
    return 'Blocked by the image safety filter: the prompt (or a reference image) was flagged as inappropriate. Remove suggestive wording — e.g. "sexy", revealing-clothing or body-focused descriptions — and generate again. Credits for this attempt were not kept.';
  }
  return `Image engine error (${status}): ${errorText.substring(0, 100)}`;
}
