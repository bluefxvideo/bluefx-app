/**
 * Music Machine Types - MiniMax v2 via fal.ai
 * Simplified single-model music generation with smart prompt helpers
 */

// Fixed credit cost per generation
export const MUSIC_CREDITS = 6;

// Music mode type
export type MusicMode = 'instrumental' | 'vocals';

// Instrumental formula for lyrics field - creates pure instrumental music
export const INSTRUMENTAL_LYRICS = `[Instrumental Intro]
[Inst]
[Inst]
[Instrumental Verse]
[Inst]
[Inst]
[Instrumental Chorus]
[Inst]
[Inst]
[Instrumental Outro]
[End]`;

// Suffix appended to prompt for instrumental mode
export const INSTRUMENTAL_SUFFIX = 'Instrumental only, no vocals, no voice, no singing, no humming, no words.';

// Template buttons for vocals mode
export const LYRICS_TEMPLATES = {
  verse: '[Verse]\n',
  chorus: '[Chorus]\n',
  bridge: '[Bridge]\n',
  intro: '[Intro]\n',
  outro: '[Outro]\n',
} as const;

// Music generation state
export interface MusicMachineState {
  prompt: string;
  lyrics: string;
  mode: MusicMode;
  isGenerating: boolean;
  error: string | null;
  estimatedCredits: number;
}

// Initial state factory
export function createInitialMusicState(): MusicMachineState {
  return {
    prompt: '',
    lyrics: INSTRUMENTAL_LYRICS, // Default to instrumental
    mode: 'instrumental',
    isGenerating: false,
    error: null,
    estimatedCredits: MUSIC_CREDITS,
  };
}
