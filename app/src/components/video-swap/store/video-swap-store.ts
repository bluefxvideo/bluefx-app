'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Video Swap Zustand Store
 * Manages state for the Video Swap wizard workflow
 */

// Wizard step type
export type WizardStep = 'upload' | 'character' | 'settings' | 'processing' | 'result';

// Job status type
export type JobStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

// Video swap job interface
export interface VideoSwapJob {
  id: string;
  status: JobStatus;
  source_video_url: string;
  character_image_url: string;
  result_video_url?: string | null;
  thumbnail_url?: string | null;
  progress_percentage: number;
  error_message?: string | null;
  created_at: string;
}

// Settings interface
export interface VideoSwapSettings {
  resolution: '480' | '720';
  frames_per_second: number;
  merge_audio: boolean;
  go_fast: boolean;
  refert_num: 1 | 5;
  seed?: number;
}

// Store state interface
export interface VideoSwapState {
  // Wizard state
  currentStep: WizardStep;

  // File state
  sourceVideo: File | null;
  sourceVideoPreview: string | null;
  characterImage: File | null;
  characterImagePreview: string | null;

  // Settings
  settings: VideoSwapSettings;

  // Job state
  currentJob: VideoSwapJob | null;
  jobHistory: VideoSwapJob[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Credits
  availableCredits: number;
  creditsRequired: number;
}

// Store actions interface
export interface VideoSwapActions {
  // Navigation
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetWizard: () => void;

  // File management
  setSourceVideo: (file: File | null) => void;
  setCharacterImage: (file: File | null) => void;
  clearFiles: () => void;

  // Settings
  updateSettings: (settings: Partial<VideoSwapSettings>) => void;
  resetSettings: () => void;

  // Job management
  setCurrentJob: (job: VideoSwapJob | null) => void;
  updateJobProgress: (progress: number) => void;
  updateJobStatus: (status: JobStatus, error?: string) => void;
  setJobResult: (resultUrl: string, thumbnailUrl?: string) => void;
  addToHistory: (job: VideoSwapJob) => void;
  setJobHistory: (jobs: VideoSwapJob[]) => void;

  // UI state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Credits
  setCredits: (credits: number) => void;
}

// Default settings
const defaultSettings: VideoSwapSettings = {
  resolution: '720',
  frames_per_second: 24,
  merge_audio: true,
  go_fast: true,
  refert_num: 1,
};

// Initial state
const initialState: VideoSwapState = {
  currentStep: 'upload',
  sourceVideo: null,
  sourceVideoPreview: null,
  characterImage: null,
  characterImagePreview: null,
  settings: defaultSettings,
  currentJob: null,
  jobHistory: [],
  isLoading: false,
  error: null,
  availableCredits: 0,
  creditsRequired: 50, // VIDEO_SWAP_CREDITS
};

// Step order for navigation
const stepOrder: WizardStep[] = ['upload', 'character', 'settings', 'processing', 'result'];

// Create the store
export const useVideoSwapStore = create<VideoSwapState & VideoSwapActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Navigation actions
      setStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep } = get();
        const currentIndex = stepOrder.indexOf(currentStep);
        if (currentIndex < stepOrder.length - 1) {
          set({ currentStep: stepOrder[currentIndex + 1] });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        const currentIndex = stepOrder.indexOf(currentStep);
        if (currentIndex > 0) {
          set({ currentStep: stepOrder[currentIndex - 1] });
        }
      },

      resetWizard: () => {
        const { sourceVideoPreview, characterImagePreview } = get();

        // Revoke object URLs to prevent memory leaks
        if (sourceVideoPreview) URL.revokeObjectURL(sourceVideoPreview);
        if (characterImagePreview) URL.revokeObjectURL(characterImagePreview);

        set({
          ...initialState,
          jobHistory: get().jobHistory, // Preserve history
          availableCredits: get().availableCredits, // Preserve credits
        });
      },

      // File management actions
      setSourceVideo: (file) => {
        const { sourceVideoPreview } = get();

        // Revoke previous preview URL
        if (sourceVideoPreview) URL.revokeObjectURL(sourceVideoPreview);

        const preview = file ? URL.createObjectURL(file) : null;
        set({ sourceVideo: file, sourceVideoPreview: preview });
      },

      setCharacterImage: (file) => {
        const { characterImagePreview } = get();

        // Revoke previous preview URL
        if (characterImagePreview) URL.revokeObjectURL(characterImagePreview);

        const preview = file ? URL.createObjectURL(file) : null;
        set({ characterImage: file, characterImagePreview: preview });
      },

      clearFiles: () => {
        const { sourceVideoPreview, characterImagePreview } = get();

        if (sourceVideoPreview) URL.revokeObjectURL(sourceVideoPreview);
        if (characterImagePreview) URL.revokeObjectURL(characterImagePreview);

        set({
          sourceVideo: null,
          sourceVideoPreview: null,
          characterImage: null,
          characterImagePreview: null,
        });
      },

      // Settings actions
      updateSettings: (newSettings) => {
        set({ settings: { ...get().settings, ...newSettings } });
      },

      resetSettings: () => {
        set({ settings: defaultSettings });
      },

      // Job management actions
      setCurrentJob: (job) => set({ currentJob: job }),

      updateJobProgress: (progress) => {
        const { currentJob } = get();
        if (currentJob) {
          set({
            currentJob: { ...currentJob, progress_percentage: progress },
          });
        }
      },

      updateJobStatus: (status, error) => {
        const { currentJob } = get();
        if (currentJob) {
          set({
            currentJob: {
              ...currentJob,
              status,
              error_message: error || null,
            },
          });
        }
      },

      setJobResult: (resultUrl, thumbnailUrl) => {
        const { currentJob } = get();
        if (currentJob) {
          const completedJob: VideoSwapJob = {
            ...currentJob,
            status: 'completed',
            result_video_url: resultUrl,
            thumbnail_url: thumbnailUrl || null,
            progress_percentage: 100,
          };
          set({ currentJob: completedJob });

          // Also add to history
          get().addToHistory(completedJob);
        }
      },

      addToHistory: (job) => {
        const { jobHistory } = get();
        // Add to beginning, keep max 50 items
        const newHistory = [job, ...jobHistory.filter(j => j.id !== job.id)].slice(0, 50);
        set({ jobHistory: newHistory });
      },

      setJobHistory: (jobs) => set({ jobHistory: jobs }),

      // UI state actions
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Credits actions
      setCredits: (credits) => set({ availableCredits: credits }),
    }),
    { name: 'video-swap-store' }
  )
);

// Selector hooks for common patterns
export const useCurrentStep = () => useVideoSwapStore((state) => state.currentStep);
export const useSourceVideo = () => useVideoSwapStore((state) => state.sourceVideo);
export const useCharacterImage = () => useVideoSwapStore((state) => state.characterImage);
export const useSettings = () => useVideoSwapStore((state) => state.settings);
export const useCurrentJob = () => useVideoSwapStore((state) => state.currentJob);
export const useIsLoading = () => useVideoSwapStore((state) => state.isLoading);
export const useError = () => useVideoSwapStore((state) => state.error);
export const useCredits = () => useVideoSwapStore((state) => ({
  available: state.availableCredits,
  required: state.creditsRequired,
  hasEnough: state.availableCredits >= state.creditsRequired,
}));
