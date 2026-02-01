/**
 * Shared types for Music Machine
 * Configuration-driven multi-model music generation
 */

// Available music generation models
export type MusicModel = 'unlimited' | 'hd' | 'vocals' | 'pro';

// Model feature flags
export interface MusicModelFeatures {
  lyrics: boolean;           // Supports lyrics input
  vocals: boolean;           // Generates singing/vocals
  negativePrompt: boolean;   // Supports negative prompt
  seed: boolean;             // Supports seed for reproducibility
  referenceAudio: boolean;   // Supports style reference audio
  durationControl: boolean;  // User can control output duration
}

// Model configuration
export interface MusicModelConfig {
  id: MusicModel;
  name: string;
  description: string;
  model: string;           // Replicate model identifier
  provider: string;        // Provider name for database
  credits: number;         // Credit cost per generation
  maxDuration: number;     // Max output duration in seconds
  durations: readonly number[];  // Available duration options
  features: MusicModelFeatures;
}

// Order: Unlimited → HD → Vocals → Pro
export const MUSIC_MODEL_CONFIG: Record<MusicModel, MusicModelConfig> = {
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'Free tier, basic instrumental generation',
    model: 'google/lyria-2',
    provider: 'lyria-2',
    credits: 0,
    maxDuration: 30,
    durations: [30] as const, // Lyria-2 outputs ~30s fixed
    features: {
      lyrics: false,
      vocals: false,
      negativePrompt: true,
      seed: true,
      referenceAudio: false,
      durationControl: false,
    },
  },
  hd: {
    id: 'hd',
    name: 'HD',
    description: 'High-quality instrumentals, precise duration',
    model: 'stability-ai/stable-audio-2.5',
    provider: 'stable-audio',
    credits: 8,
    maxDuration: 47,
    durations: [15, 30, 47] as const,
    features: {
      lyrics: false,
      vocals: false,
      negativePrompt: true,
      seed: false,
      referenceAudio: false,
      durationControl: true,
    },
  },
  vocals: {
    id: 'vocals',
    name: 'Vocals',
    description: 'Full songs with singing and lyrics',
    model: 'minimax/music-1.5',
    provider: 'minimax',
    credits: 10,
    maxDuration: 240,
    durations: [60, 120, 180, 240] as const,
    features: {
      lyrics: true,
      vocals: true,
      negativePrompt: false,
      seed: false,
      referenceAudio: true,
      durationControl: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Premium quality, long-form instrumentals',
    model: 'elevenlabs/music',
    provider: 'elevenlabs',
    credits: 15,
    maxDuration: 300,
    durations: [30, 60, 120, 180, 300] as const,
    features: {
      lyrics: false,
      vocals: false,
      negativePrompt: false,
      seed: false,
      referenceAudio: false,
      durationControl: true,
    },
  },
} as const;

// Helper to get ordered models for UI
export const MUSIC_MODELS_ORDERED: MusicModel[] = ['unlimited', 'hd', 'vocals', 'pro'];

// Type helpers
export type UnlimitedDuration = typeof MUSIC_MODEL_CONFIG.unlimited.durations[number];
export type HdDuration = typeof MUSIC_MODEL_CONFIG.hd.durations[number];
export type VocalsDuration = typeof MUSIC_MODEL_CONFIG.vocals.durations[number];
export type ProDuration = typeof MUSIC_MODEL_CONFIG.pro.durations[number];
