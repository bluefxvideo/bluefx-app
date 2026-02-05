/**
 * Motion Presets for Scene Breakdown
 * Camera movement and action presets for video generation
 */

import type { MotionPreset } from './types';

export const MOTION_PRESETS: MotionPreset[] = [
  { id: 1, name: 'Static', prompt: 'Camera remains completely static, no movement' },
  { id: 2, name: 'Pan Left', prompt: 'Camera pans slowly from right to left' },
  { id: 3, name: 'Pan Right', prompt: 'Camera pans slowly from left to right' },
  { id: 4, name: 'Tilt Up', prompt: 'Camera tilts upward revealing more of the scene' },
  { id: 5, name: 'Tilt Down', prompt: 'Camera tilts downward' },
  { id: 6, name: 'Zoom In', prompt: 'Slow zoom in on the subject' },
  { id: 7, name: 'Zoom Out', prompt: 'Slow zoom out revealing more context' },
  { id: 8, name: 'Dolly In', prompt: 'Camera moves forward toward the subject' },
  { id: 9, name: 'Dolly Out', prompt: 'Camera pulls back from the subject' },
  { id: 10, name: 'Track Left', prompt: 'Camera tracks sideways to the left' },
  { id: 11, name: 'Track Right', prompt: 'Camera tracks sideways to the right' },
  { id: 12, name: 'Push In', prompt: 'Dynamic push in toward subject' },
  { id: 13, name: 'Crane Up', prompt: 'Camera rises upward dramatically' },
  { id: 14, name: 'Arc Shot', prompt: 'Camera arcs around the subject' },
  { id: 15, name: 'Custom', prompt: '' },  // User enters custom motion
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
 * Returns the preset ID or 15 (Custom) if no match found
 */
export function findMatchingPreset(promptText: string): number {
  const lowerPrompt = promptText.toLowerCase();

  for (const preset of MOTION_PRESETS) {
    if (preset.id === 15) continue; // Skip custom

    const keywords = preset.name.toLowerCase().split(' ');
    if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
      return preset.id;
    }
  }

  return 15; // Default to Custom
}
