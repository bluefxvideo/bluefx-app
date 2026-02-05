/**
 * Scene Breakdown Types
 * TypeScript interfaces for the Script Breakdown tool in AI Cinematographer
 */

export interface MotionPreset {
  id: number;
  name: string;
  prompt: string;
}

export interface BreakdownScene {
  sceneNumber: number;
  duration: string;           // e.g., "5s", "6s"
  narration: string;          // Original dialogue/voiceover from script
  visualPrompt: string;       // For image generation (storyboard)
  motionPrompt: string;       // For video generation (camera/action)
  motionPresetId: number | null; // Reference to preset, null if custom
}

export interface SceneBreakdownResult {
  globalAestheticPrompt: string;  // Applied to all scenes in the video
  scenes: BreakdownScene[];
}

export interface SceneBreakdownRequest {
  scriptText: string;
  visualStyle?: string;  // Optional visual style preset
}

export interface SceneBreakdownResponse {
  success: boolean;
  result?: SceneBreakdownResult;
  error?: string;
}

/**
 * Converts BreakdownScene to analyzerShots format for Storyboard integration
 * This matches the format expected by the existing AI Cinematographer system
 */
export interface AnalyzerShot {
  shotNumber: number;        // ← sceneNumber
  description: string;       // ← visualPrompt
  duration: string;
  shotType?: string;
  action?: string;           // ← motionPrompt (pre-fills in Batch Animation Queue)
  dialogue?: string;         // ← narration
}

/**
 * Convert a batch of BreakdownScenes to AnalyzerShots format
 */
export function scenesToAnalyzerShots(scenes: BreakdownScene[]): AnalyzerShot[] {
  return scenes.map(scene => ({
    shotNumber: scene.sceneNumber,
    description: scene.visualPrompt,
    duration: scene.duration,
    action: scene.motionPrompt,
    dialogue: scene.narration,
  }));
}

/**
 * Group scenes into batches of 9 for storyboard generation
 */
export function groupScenesIntoBatches(scenes: BreakdownScene[]): BreakdownScene[][] {
  const batches: BreakdownScene[][] = [];
  for (let i = 0; i < scenes.length; i += 9) {
    batches.push(scenes.slice(i, i + 9));
  }
  return batches;
}
