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
    description: 'Quick generation with aspect ratio support',
    model: 'lightricks/ltx-2-distilled',
    maxDuration: 10,
    minDuration: 6,
    durations: [6, 8, 10] as const, // LTX-2 Distilled supports up to ~10s (241 frames at 24fps)
    resolutions: ['1080p'] as const, // LTX-2 Distilled outputs 1080p by default
    aspectRatios: ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'] as const,
    creditsPerSecond: {
      '1080p': 1,
    },
    features: {
      firstFrame: true,
      lastFrame: false,
      seed: true, // LTX-2 Distilled supports seed
      lipSync: true, // Built-in synchronized audio
      singing: false,
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
    resolutions: ['720p'] as const, // Native 720p resolution
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', '9:21'] as const,
    creditsPerSecond: {
      '720p': 2, // 2x Fast mode
    },
    features: {
      firstFrame: true,
      lastFrame: true,
      seed: true,
      lipSync: true, // Enhanced lip sync with audio generation
      singing: true, // Singing mode support
    },
  },
} as const;

// Type helpers
export type FastDuration = typeof VIDEO_MODEL_CONFIG.fast.durations[number];
export type ProDuration = typeof VIDEO_MODEL_CONFIG.pro.durations[number];
export type FastResolution = typeof VIDEO_MODEL_CONFIG.fast.resolutions[number];
export type ProResolution = '720p'; // 720p native resolution
export type FastAspectRatio = typeof VIDEO_MODEL_CONFIG.fast.aspectRatios[number];
export type ProAspectRatio = typeof VIDEO_MODEL_CONFIG.pro.aspectRatios[number];

// ============================================
// Request/Response Types (shared between client and server)
// ============================================

// Request type for AI Cinematographer video generation
export interface CinematographerRequest {
  prompt: string;
  reference_image?: File | null; // Optional for LTX-2-Fast (text-to-video supported)
  reference_image_url?: string; // URL of a reference image (e.g., from Starting Shot)
  duration?: number; // Duration in seconds (model-specific ranges)
  resolution?: '720p' | '1080p' | '2k' | '4k'; // Video resolution
  generate_audio?: boolean; // Enable AI audio generation (default: true)
  workflow_intent: 'generate' | 'audio_add';
  audio_file?: File | null;
  user_id: string;
  // Model selection
  model?: VideoModel; // 'fast' = LTX-2-Fast, 'pro' = Seedance 1.5 Pro
  // Pro model specific options
  aspect_ratio?: ProAspectRatio;
  last_frame_image?: File | null; // Ending frame for Pro model
  last_frame_image_url?: string; // URL of ending frame
  seed?: number; // Seed for reproducibility (Pro only)
  camera_fixed?: boolean; // Lock camera movement (Pro only)
}

// Response type for AI Cinematographer
export interface CinematographerResponse {
  success: boolean;
  video?: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    duration: number;
    resolution: string;
    prompt: string;
    created_at: string;
  };
  batch_id: string;
  generation_time_ms: number;
  credits_used: number;
  remaining_credits: number;
  warnings?: string[];
  error?: string;
}
