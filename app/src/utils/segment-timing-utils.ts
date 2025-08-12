/**
 * Client-side utilities for segment timing calculations
 */

/**
 * Estimate time impact of segment changes
 * Helps UI show preview of timing changes
 */
export function estimateTimingImpact(
  segments: any[],
  changedSegmentId: string,
  newText: string
): { estimatedDuration: number; totalDuration: number } {
  // Rough estimate: 150 words per minute
  const wordsPerSecond = 150 / 60;
  const wordCount = newText.trim().split(/\s+/).length;
  const estimatedDuration = wordCount / wordsPerSecond;
  
  // Calculate total with the change
  const totalDuration = segments.reduce((total, seg) => {
    if (seg.id === changedSegmentId) {
      return total + estimatedDuration;
    }
    return total + seg.duration;
  }, 0);
  
  return {
    estimatedDuration,
    totalDuration
  };
}

/**
 * Calculate speech duration for text
 * @param text The text to estimate duration for
 * @param wordsPerMinute Speech rate (default 150)
 * @returns Estimated duration in seconds
 */
export function calculateSpeechDuration(text: string, wordsPerMinute = 150): number {
  const wordCount = text.trim().split(/\s+/).length;
  const baseDuration = (wordCount / wordsPerMinute) * 60;
  
  // Add a small buffer for pauses
  return Math.max(3, baseDuration + 0.5);
}

/**
 * Format duration for display
 * @param seconds Duration in seconds
 * @returns Formatted string like "1:23"
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if segments need resync based on timing differences
 * @param segments Current segments
 * @param threshold Timing difference threshold in seconds
 * @returns True if resync is needed
 */
export function needsResync(segments: any[], threshold = 0.5): boolean {
  let expectedTime = 0;
  
  for (const segment of segments) {
    // Check if segment timing matches expected position
    if (Math.abs(segment.start_time - expectedTime) > threshold) {
      return true;
    }
    expectedTime = segment.end_time;
  }
  
  return false;
}