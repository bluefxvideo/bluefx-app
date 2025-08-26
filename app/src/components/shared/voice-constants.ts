/**
 * Shared Voice Constants - OpenAI TTS Voice Options
 * 
 * Complete set of OpenAI Text-to-Speech voices for consistent use across all tools:
 * - Script-to-Video Generator
 * - Talking Avatar Generator  
 * - Voice-Over Generator
 * 
 * Updated December 2024 with all 11 available OpenAI TTS voices
 */

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  description: string;
  preview_url: string;
  category?: 'natural' | 'professional' | 'expressive' | 'character';
  isNew?: boolean; // Mark newer 2024 voices
  isLegacy?: boolean; // Mark legacy voices still supported
}

// Complete OpenAI TTS voice options - Updated November 2024
// All 11 voices including new and legacy voices with GPT-4o-mini-TTS model
export const OPENAI_VOICE_OPTIONS: VoiceOption[] = [
  // PRIMARY NEW VOICES (2024 Release)
  {
    id: 'alloy',
    name: 'Alloy',
    gender: 'neutral',
    description: 'Natural and versatile voice, great for narration',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/alloy.mp3',
    category: 'natural'
  },
  {
    id: 'echo',
    name: 'Echo',
    gender: 'male',
    description: 'Deep and resonant voice, excellent for documentaries',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/echo.mp3',
    category: 'professional'
  },
  {
    id: 'ash',
    name: 'Ash',
    gender: 'female',
    description: 'Expressive and dynamic with enhanced emotional range',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/ash.mp3',
    category: 'expressive',
    isNew: true
  },
  {
    id: 'ballad',
    name: 'Ballad',
    gender: 'female',
    description: 'Warm and melodious, perfect for storytelling',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/ballad.mp3',
    category: 'natural',
    isNew: true
  },
  {
    id: 'coral',
    name: 'Coral',
    gender: 'female',
    description: 'Friendly and approachable with excellent emotional control',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/coral.mp3',
    category: 'natural',
    isNew: true
  },
  {
    id: 'sage',
    name: 'Sage',
    gender: 'male',
    description: 'Professional and authoritative, ideal for business content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/sage.mp3',
    category: 'professional',
    isNew: true
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    gender: 'female',
    description: 'Bright and expressive, ideal for engaging presentations',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/shimmer.mp3',
    category: 'expressive',
    isNew: true
  },
  {
    id: 'verse',
    name: 'Verse',
    gender: 'female',
    description: 'Creative and artistic voice, perfect for poetry',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/verse.mp3',
    category: 'expressive',
    isNew: true
  },
  
  // LEGACY VOICES (still supported)
  {
    id: 'nova',
    name: 'Nova',
    gender: 'female',
    description: 'Warm and engaging voice (legacy)',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/nova.mp3',
    category: 'natural',
    isLegacy: true
  },
  {
    id: 'onyx',
    name: 'Onyx',
    gender: 'male',
    description: 'Professional and clear voice (legacy)',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/onyx.mp3',
    category: 'professional',
    isLegacy: true
  },
  {
    id: 'fable',
    name: 'Fable',
    gender: 'neutral',
    description: 'Versatile storytelling voice with character (legacy)',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/fable.mp3',
    category: 'character',
    isLegacy: true
  }
];

// Voice settings interface for advanced controls
export interface VoiceSettings {
  voice_id: string;
  speed: number; // 0.25 - 4.0
  pitch?: number; // -20 to 20 semitones (optional advanced feature)
  volume?: number; // 0.0 to 1.0 (optional)
  emphasis?: 'strong' | 'moderate' | 'none'; // SSML emphasis
}

// Export format options
export type VoiceExportFormat = 'mp3' | 'wav' | 'ogg';
export type VoiceQuality = 'standard' | 'hd';

// Helper functions
export const getVoicesByGender = (gender: 'male' | 'female' | 'neutral') => 
  OPENAI_VOICE_OPTIONS.filter(voice => voice.gender === gender);

export const getVoicesByCategory = (category: VoiceOption['category']) => 
  OPENAI_VOICE_OPTIONS.filter(voice => voice.category === category);

export const getNewVoices = () => 
  OPENAI_VOICE_OPTIONS.filter(voice => voice.isNew);

export const getLegacyVoices = () => 
  OPENAI_VOICE_OPTIONS.filter(voice => voice.isLegacy);

export const getVoiceById = (id: string) => 
  OPENAI_VOICE_OPTIONS.find(voice => voice.id === id);

// Default voice settings
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voice_id: 'alloy',
  speed: 1.0,
  pitch: 0,
  volume: 1.0,
  emphasis: 'none'
};

// Speed preset mappings for backward compatibility
export const SPEED_PRESETS = {
  slower: 0.75,
  normal: 1.0,
  faster: 1.25
} as const;