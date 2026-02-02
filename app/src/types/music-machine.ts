/**
 * Music Machine Types - MiniMax v2 via fal.ai
 * Simplified single-model music generation
 */

// Fixed credit cost per generation
export const MUSIC_CREDITS = 6;

// Music generation state
export interface MusicMachineState {
  prompt: string;
  lyrics: string;
  isGenerating: boolean;
  error: string | null;
  estimatedCredits: number;
}

// Initial state factory
export function createInitialMusicState(): MusicMachineState {
  return {
    prompt: '',
    lyrics: '',
    isGenerating: false,
    error: null,
    estimatedCredits: MUSIC_CREDITS,
  };
}
