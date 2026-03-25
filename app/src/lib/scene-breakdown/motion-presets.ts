/**
 * Motion Presets for Scene Breakdown
 * Camera movement and action presets for video generation
 */

import type { MotionPreset } from './types';
import type { FastCameraMotion } from '@/types/cinematographer';

export const MOTION_PRESETS: MotionPreset[] = [
  { id: 1, name: 'Static', prompt: 'Camera remains completely static, no movement' },
  { id: 2, name: 'Dolly Left', prompt: 'Camera moves sideways to the left' },
  { id: 3, name: 'Dolly Right', prompt: 'Camera moves sideways to the right' },
  { id: 4, name: 'Jib Up', prompt: 'Camera tilts/cranes upward revealing more of the scene' },
  { id: 5, name: 'Jib Down', prompt: 'Camera tilts/cranes downward' },
  { id: 6, name: 'Dolly In', prompt: 'Camera moves forward toward the subject' },
  { id: 7, name: 'Dolly Out', prompt: 'Camera pulls back from the subject' },
  { id: 8, name: 'Focus Shift', prompt: 'Focus shifts between foreground and background' },
  { id: 9, name: 'None', prompt: 'No specific camera motion, determined by prompt' },
];

/**
 * Get a motion preset by ID
 */
export function getMotionPresetById(id: number): MotionPreset | undefined {
  return MOTION_PRESETS.find(preset => preset.id === id);
}

/**
 * Get the display label for a motion preset (used in dropdown)
 * Format: "#2 - Pan Left"
 */
export function getMotionPresetLabel(preset: MotionPreset): string {
  return `#${preset.id} - ${preset.name}`;
}

/**
 * Find the best matching preset for a given prompt text
 * Returns the preset ID or 9 (None) if no match found
 */
export function findMatchingPreset(promptText: string): number {
  const lowerPrompt = promptText.toLowerCase();

  for (const preset of MOTION_PRESETS) {
    if (preset.id === 9) continue; // Skip "None"

    const keywords = preset.name.toLowerCase().split(' ');
    if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
      return preset.id;
    }
  }

  return 9; // Default to None
}

/**
 * Map a motion preset ID to LTX 2.3's native camera_motion parameter.
 * Each preset maps 1:1 to a supported LTX camera_motion value.
 */
const PRESET_TO_NATIVE: Record<number, FastCameraMotion> = {
  1: 'static',
  2: 'dolly_left',
  3: 'dolly_right',
  4: 'jib_up',
  5: 'jib_down',
  6: 'dolly_in',
  7: 'dolly_out',
  8: 'focus_shift',
  9: 'none',
};

export function motionPresetToNativeCameraMotion(
  presetId: number | null | undefined
): FastCameraMotion {
  if (presetId == null) return 'none';
  return PRESET_TO_NATIVE[presetId] ?? 'none';
}
