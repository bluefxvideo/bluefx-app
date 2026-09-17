import type { BreakdownScene, SceneBreakdownResult } from '@/lib/scene-breakdown/types';

export interface WizardData {
  // From Video Analyzer (Step 1)
  analysisText: string;
  sourceVideoUrl?: string;

  // Step 2: Customize & Plan
  narrationScript: string;
  scenes: BreakdownScene[];
  enabledScenes: Set<number>; // scene numbers that are checked for generation
  globalAestheticPrompt: string;
  /**
   * `url`: the uploaded copy, kept so a page reload does not lose the product photo.
   * `lost`: restored without file or copy, and its preview no longer loads.
   */
  referenceImages: { file: File; preview: string; label?: string; url?: string; lost?: boolean }[];
  aspectRatio: '16:9' | '9:16';
  breakdownResult: SceneBreakdownResult | null;
  // Step 3: Image Generation
  extractedFrames: ExtractedFrame[];

  // Step 5: Voice Over
  voiceAudioUrl?: string;
  voiceDuration?: number;
  selectedVoice?: string;
  voiceSpeed?: number;
}

export interface ExtractedFrame {
  id: string;
  imageUrl: string;
  prompt: string;
  sceneNumber: number;
  batchNumber: number;
  narration?: string;
  duration: number;
  motionPresetId?: number | null; // null when the scene uses a custom motion prompt (see BreakdownScene)
  // Version history — all generated versions of this frame
  imageVersions?: string[]; // array of image URLs, newest last
  currentVersionIndex?: number; // which version is currently displayed
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const WIZARD_STEPS = [
  { number: 2, label: 'Customize', description: 'Plan your shots' },
  { number: 3, label: 'Images', description: 'Generate frames' },
  { number: 4, label: 'Videos', description: 'Animate clips' },
  { number: 5, label: 'Voice Over', description: 'Add narration' },
] as const;

export type WizardStep = 1 | 2 | 3 | 4 | 5;

/** A product photo whose file and preview died with the last page: it was never uploaded. */
export function isLostReferencePhoto(img: { file?: File | null; url?: string; lost?: boolean }): boolean {
  return img.lost === true && !img.file && !img.url;
}

/** A photo restored from storage with only a blob: preview. It still loads after moving
 * around inside the app (same page), not after a reload. */
export function needsPreviewCheck(img: { file?: File | null; preview?: string; url?: string; lost?: boolean }): boolean {
  return !img.file && !img.url && img.lost === undefined && !!img.preview?.startsWith('blob:');
}

export function getDefaultWizardData(): WizardData {
  return {
    analysisText: '',
    sourceVideoUrl: undefined,
    narrationScript: '',
    scenes: [],
    enabledScenes: new Set<number>(),
    globalAestheticPrompt: '',
    referenceImages: [],
    aspectRatio: '9:16',
    breakdownResult: null,
    extractedFrames: [],
  };
}
