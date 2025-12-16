/**
 * Shared types for AI Cinematographer
 * Can be imported by both client and server components
 */

// Valid aspect ratios for Starting Shot (nano-banana)
export const NANO_BANANA_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
export type NanoBananaAspectRatio = typeof NANO_BANANA_ASPECT_RATIOS[number];

// Alias for Starting Shot
export type StartingShotAspectRatio = NanoBananaAspectRatio;
