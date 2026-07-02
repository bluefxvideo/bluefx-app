/**
 * Shared types for AI Cinematographer
 * Can be imported by both client and server components
 */

// Valid aspect ratios for Starting Shot (nano-banana)
export type NanoBananaAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9';
// All aspect ratios (nano-banana-pro)
export const NANO_BANANA_PRO_ASPECT_RATIOS: readonly NanoBananaAspectRatio[] = [
  '16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2', '21:9'
];

// Starting Shot resolution
export type StartingShotResolution = '1K' | '2K' | '4K';

// Alias for Starting Shot
export type StartingShotAspectRatio = NanoBananaAspectRatio;

// ============================================
// Video Generation Model Types
// ============================================

// Available video generation models
export type VideoModel = 'fast' | 'pro' | 'ultra';

// Audio mode: 'voice' = AI audio with a server-side "no background music"
// directive (Seedance loves adding a soundtrack); 'silent' = no audio track
// (half provider cost on Seedance — pairs with the Music tool).
export type VideoAudioMode = 'voice' | 'silent';

// Model configurations (all hosted on fal.ai)
export const VIDEO_MODEL_CONFIG = {
  fast: {
    id: 'fast',
    name: 'Fast',
    description: 'Ready in seconds — 1080p, longer videos, camera movements',
    model: 'fal-ai/ltx-2.3 fast',
    maxDuration: 20,
    minDuration: 6,
    durations: [6, 8, 10, 12, 14, 16, 18, 20] as const,
    resolutions: ['1080p', '2k', '4k'] as const,
    aspectRatios: ['16:9', '9:16'] as const,
    creditsPerSecond: {
      '1080p': 2,
      '2k': 4,
      '4k': 8,
    },
    cameraMotions: ['none', 'dolly_in', 'dolly_out', 'dolly_left', 'dolly_right', 'jib_up', 'jib_down', 'static', 'focus_shift'] as const,
    features: {
      firstFrame: true,
      lastFrame: true,
      seed: false,
      lipSync: true,
      singing: false,
      cameraMotion: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Best value — crisp product shots, natural voice, great identity hold',
    model: 'fal-ai/bytedance/seedance/v1.5/pro',
    maxDuration: 12,
    minDuration: 4,
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12] as const,
    resolutions: ['720p'] as const, // Native 720p resolution
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'] as const,
    creditsPerSecond: {
      '720p': 4,
    },
    features: {
      firstFrame: true,
      lastFrame: true,
      seed: true,
      lipSync: true, // Enhanced lip sync with audio generation
      singing: true, // Singing mode support
    },
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    description: 'Cinematic multi-shot scenes, complex direction — our most advanced model',
    model: 'bytedance/seedance-2.0',
    maxDuration: 15,
    minDuration: 4,
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const,
    resolutions: ['720p'] as const,
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'] as const,
    creditsPerSecond: {
      '720p': 10,
    },
    features: {
      firstFrame: true,
      lastFrame: true,
      seed: false,
      lipSync: true,
      singing: true,
      multiShot: true, // Multiple shots/scenes in a single generation
    },
  },
} as const;

// Type helpers
export type FastDuration = typeof VIDEO_MODEL_CONFIG.fast.durations[number];
export type ProDuration = typeof VIDEO_MODEL_CONFIG.pro.durations[number];
export type UltraDuration = typeof VIDEO_MODEL_CONFIG.ultra.durations[number];
export type FastResolution = typeof VIDEO_MODEL_CONFIG.fast.resolutions[number];
export type ProResolution = '720p'; // 720p native resolution
export type FastAspectRatio = typeof VIDEO_MODEL_CONFIG.fast.aspectRatios[number];
export type FastCameraMotion = typeof VIDEO_MODEL_CONFIG.fast.cameraMotions[number];
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
  model?: VideoModel; // 'fast' = LTX-2.3-Fast, 'pro' = Seedance 1.5 Pro, 'ultra' = Seedance 2.0
  // Audio handling for models with generated audio (pro/ultra)
  audio_mode?: VideoAudioMode; // 'voice' (default) = AI audio without music; 'silent' = no audio track
  // Shared options (both models)
  aspect_ratio?: ProAspectRatio | FastAspectRatio;
  last_frame_image?: File | null; // Ending frame (both models)
  last_frame_image_url?: string; // URL of ending frame
  // Fast model specific options
  camera_motion?: FastCameraMotion; // Native camera movement (Fast only)
  // Pro model specific options
  seed?: number; // Seed for reproducibility (Pro only)
  camera_fixed?: boolean; // Lock camera movement (Pro only)
  // Ultra (Seedance 2.0) reference-to-video: up to 9 images for character/
  // product/scene consistency. Reference them in the prompt as [Image1], … .
  // When present, they replace first/last-frame control.
  ultra_reference_images?: File[];
  ultra_reference_image_urls?: string[];
  // Ultra reference audio (up to 3 clips, combined ≤15s) — e.g. a recorded
  // voice line the scene should speak, or a music snippet to score it.
  // Free (fal bills only video durations); requires at least one ref image.
  ultra_reference_audios?: File[];
  ultra_reference_audio_urls?: string[];
}

// Generation settings stored with the response for regenerate/tweak
export interface GenerationSettings {
  model: VideoModel;
  duration: number;
  resolution: string;
  aspect_ratio: string;
  generate_audio: boolean;
  audio_mode?: VideoAudioMode;
  camera_motion?: FastCameraMotion;
  camera_fixed?: boolean;
  seed?: number;
  reference_image_url?: string;
  last_frame_image_url?: string;
  ultra_reference_image_urls?: string[];
  ultra_reference_audio_urls?: string[];
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
  generation_settings?: GenerationSettings;
}
