/**
 * Video Swap pricing and limits (Kling 2.6 Pro motion control on fal).
 *
 * fal bills $0.14 per output second with the original sound kept and $0.07
 * without, the same cost as Kling O3 Pro animation, so the credit price is
 * the same 8 credits per second (3.5x monthly / 1.8x yearly margin, the
 * markup tier the owner set for Video Maker Ultra and Clone Studio).
 * Charged on the source clip's length, rounded up, refunded on failure.
 *
 * Length limits are fal's own: 30 s when the character follows the video's
 * orientation, 10 s when it follows the image's.
 */
export type VideoSwapOrientation = 'video' | 'image';

export const VIDEO_SWAP_CREDITS_PER_SECOND = 8;

export const VIDEO_SWAP_MAX_SECONDS: Record<VideoSwapOrientation, number> = {
  video: 30,
  image: 10,
};

/** Credits for a source clip of `durationSeconds`; partial seconds count as a whole one. */
export function videoSwapCredits(durationSeconds: number): number {
  return VIDEO_SWAP_CREDITS_PER_SECOND * Math.max(1, Math.ceil(durationSeconds));
}
