import type { BreakdownScene, SceneBreakdownResult } from '@/lib/scene-breakdown/types';
import type { AnimationQueueItem } from '@/components/ai-cinematographer/batch-animation-queue';

export interface WizardData {
  // From Video Analyzer (Step 1)
  analysisText: string;
  sourceVideoUrl?: string;

  // Step 2: Customize & Plan
  narrationScript: string;
  scenes: BreakdownScene[];
  enabledScenes: Set<number>; // scene numbers that are checked for generation
  globalAestheticPrompt: string;
  referenceImages: { file: File; preview: string; label?: string }[];
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
  motionPresetId?: number;
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
