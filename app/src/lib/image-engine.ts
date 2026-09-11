/**
 * Which model makes the app's still images (Image Maker, Thumbnail Machine,
 * Avatar generator, Clone Studio keyframe edits).
 *
 * Default is GPT Image 2.5 Flare on fal (Arena #2 on text-to-image and
 * image-edit as of 2026-09, about half the per-image price of Nano Banana 2
 * and a third of Nano Banana Pro). Set IMAGE_ENGINE=nb2 in the environment
 * to roll every call site back to Nano Banana 2 without a code change.
 */
export type ImageEngine = 'gpt25' | 'nb2';

export function imageEngine(): ImageEngine {
  return process.env.IMAGE_ENGINE === 'nb2' ? 'nb2' : 'gpt25';
}

/** Label written to prediction / history rows so analytics can tell the engines apart. */
export function imageEngineLabel(tier: 'std' | 'pro' = 'std'): string {
  if (imageEngine() === 'gpt25') return 'gpt-image-2.5-flare';
  return tier === 'pro' ? 'nano-banana-pro-fal' : 'nano-banana-2-fal';
}
