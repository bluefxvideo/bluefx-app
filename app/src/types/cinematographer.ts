/**
 * Shared types for AI Cinematographer
 * Can be imported by both client and server components
 */

// Valid aspect ratios for Starting Shot (nano-banana)
export const NANO_BANANA_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
export type NanoBananaAspectRatio = typeof NANO_BANANA_ASPECT_RATIOS[number];

// Alias for Starting Shot
export type StartingShotAspectRatio = NanoBananaAspectRatio;

// ============================================
// Video Generation Model Types
// ============================================

// Available video generation models
export type VideoModel = 'fast' | 'pro';

// Model configurations
export const VIDEO_MODEL_CONFIG = {
  fast: {
    id: 'fast',
    name: 'Fast',
    description: 'Quick generation, longer videos, higher resolutions',
    model: 'lightricks/ltx-2-fast',
    maxDuration: 20,
    minDuration: 6,
    durations: [6, 8, 10, 12, 14, 16, 18, 20] as const,
    resolutions: ['1080p', '2k', '4k'] as const,
    aspectRatios: null, // Fixed by resolution
    creditsPerSecond: {
      '1080p': 1,
      '2k': 2,
      '4k': 4,
    },
    features: {
      firstFrame: true,
      lastFrame: false,
      seed: false,
      lipSync: true, // Basic lip sync support
      singing: false,
      upscale: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Higher quality, better lip sync, singing, frame control',
    model: 'bytedance/seedance-1.5-pro',
    maxDuration: 10,
    minDuration: 5,
    durations: [5, 6, 7, 8, 9, 10] as const, // Valid range: 5-10 seconds
    resolutions: ['720p'] as const, // Base resolution, can be upscaled
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', '9:21'] as const,
    creditsPerSecond: {
      '720p': 2, // 2x Fast mode
      '1080p': 3, // 720p + upscale
    },
    features: {
      firstFrame: true,
      lastFrame: true,
      seed: true,
      lipSync: true, // Enhanced lip sync with audio generation
      singing: true, // Singing mode support
      upscale: true,
    },
  },
} as const;

// Type helpers
export type FastDuration = typeof VIDEO_MODEL_CONFIG.fast.durations[number];
export type ProDuration = typeof VIDEO_MODEL_CONFIG.pro.durations[number];
export type FastResolution = typeof VIDEO_MODEL_CONFIG.fast.resolutions[number];
export type ProResolution = '720p' | '1080p'; // 720p native, 1080p with upscale
export type ProAspectRatio = typeof VIDEO_MODEL_CONFIG.pro.aspectRatios[number];
