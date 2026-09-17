'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { executeTalkingAvatar, pollAvatarTierGeneration, switchAvatarVoice, TalkingAvatarRequest, AvatarTemplate, VoiceOption } from '@/actions/tools/talking-avatar';
import { isScriptTier, readAvatarTier, waitLabelFor, type AvatarQualityTier } from '@/types/talking-avatar-tiers';
import { getAvatarTemplates, getTalkingAvatarVideos, deleteTalkingAvatarVideo } from '@/actions/database/talking-avatar-database';
import type { TalkingAvatarVideo } from '@/actions/database/talking-avatar-database';
import { getUserClonedVoices, saveClonedVoice } from '@/actions/database/cloned-voices-database';
import type { ClonedVoice } from '@/actions/database/cloned-voices-database';
import { getUserSavedAvatars, saveUserAvatar, deleteSavedAvatar as deleteSavedAvatarAction, updateSavedAvatarName } from '@/actions/database/saved-avatars-database';
import type { SavedAvatar } from '@/actions/database/saved-avatars-database';
import { prepareVoiceUpload, cloneVoiceFromStorage } from '@/actions/services/minimax-clone-service';
import { generateMinimaxVoice } from '@/actions/services/minimax-voice-service';
import { pollLTXVideoGeneration } from '@/actions/models/fal-ltx-polling';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { isStalePageError } from '@/lib/stale-page';

export interface TalkingAvatarState {
  // Current step in wizard (1: Avatar Selection, 2: Voice/Audio Input, 3: Video Generation)
  currentStep: number;
  totalSteps: number;

  // Avatar Selection (Step 1)
  avatarTemplates: AvatarTemplate[];
  selectedAvatarTemplate: AvatarTemplate | null;
  customAvatarImage: File | null;
  customAvatarUrl: string | null;

  // Audio Input (Step 2) - TTS or Upload mode
  audioInputMode: 'tts' | 'upload';
  scriptText: string;
  voiceOptions: VoiceOption[];
  selectedVoiceId: string | null;
  voiceAudioUrl: string | null; // TTS generated audio URL
  uploadedAudioUrl: string | null; // Directly uploaded audio URL
  uploadedAudioFile: File | null;
  audioDurationSeconds: number; // Duration of audio (TTS estimated or uploaded actual)
  actionPrompt: string; // Optional prompt for visual style/movements
  /** Standard = own voice on LTX-2 19B; Fast / Ultra = the engine speaks the script. */
  qualityTier: AvatarQualityTier;

  // Video Generation (Step 3)
  selectedResolution: 'landscape' | 'portrait';
  isGenerating: boolean;
  generatedVideo: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    script_text: string;
    avatar_image_url: string;
    created_at: string;
    /** The copy with the user's own voice ("Switch voice"), when one was made. */
    voice_video_url?: string | null;
  } | null;

  // General state
  isLoading: boolean;
  error: string | null;
  credits: number;
  estimatedCredits: number;

  // History state
  videos: TalkingAvatarVideo[];
  /** When the running render began (ms). Feeds the elapsed clock so it survives a remount or a reload. */
  generationStartedAt: number | null;
  isLoadingHistory: boolean;
  /** The last History load failed: an empty list then means "could not load", not "no videos". */
  historyLoadFailed: boolean;

  // Generation state
  currentGenerationId: string | null; // fal.ai request_id or hedra generation_id
  isStateRestored: boolean;

  // Cloned voices
  clonedVoices: ClonedVoice[];
  isCloning: boolean;

  // Saved avatars
  savedAvatars: SavedAvatar[];
}

export interface UseTalkingAvatarReturn {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  state: TalkingAvatarState;
  loadAvatarTemplates: () => Promise<void>;
  handleAvatarSelection: (template: AvatarTemplate | null, customFile?: File) => Promise<void>;
  /** Use a photo that already sits in our storage (saved or AI-made avatar): no upload. */
  selectAvatarImageUrl: (url: string) => void;
  handleVoiceGeneration: (voiceId: string, scriptText: string, voiceSettings?: { speed?: number; pitch?: number; volume?: number; emotion?: string }) => Promise<{ success: boolean; voiceAudioUrl?: string }>;
  handleVideoGeneration: () => Promise<void>;
  resetWizard: () => void;
  goToStep: (step: number) => void;
  clearVoice: () => void;
  clearResults: () => void;
  loadHistory: () => Promise<void>;
  deleteVideo: (videoId: string) => Promise<boolean>;
  checkHistoryItemStatus: (video: TalkingAvatarVideo) => Promise<void>;
  /** Optional manual status check — not currently implemented by the hook (always undefined). */
  checkStatusManually?: () => void;
  // New state setters for dual audio input mode
  setAudioInputMode: (mode: 'tts' | 'upload') => void;
  setUploadedAudio: (url: string | null, file: File | null, duration: number) => void;
  setActionPrompt: (prompt: string) => void;
  setSelectedResolution: (resolution: 'landscape' | 'portrait') => void;
  setScriptText: (text: string) => void;
  setQualityTier: (tier: AvatarQualityTier) => void;
  // Voice cloning
  loadClonedVoices: () => Promise<void>;
  /** Put the user's own voice on the finished video. `file` null = reuse the remembered sample. */
  switchVoice: (file: File | null) => Promise<void>;
  isSwitchingVoice: boolean;
  lastVoiceSample: { url: string; name: string } | null;
  /** Resolves with the saved voice so the page can select it. */
  cloneVoice: (file: File, name: string, options: { noiseReduction: boolean; volumeNormalization: boolean }) => Promise<ClonedVoice | undefined>;
  // Saved avatars
  loadSavedAvatars: () => Promise<void>;
  saveAvatar: (name: string, imageUrl: string) => Promise<boolean>;
  deleteSavedAvatar: (avatarId: string) => Promise<boolean>;
  renameSavedAvatar: (avatarId: string, newName: string) => Promise<boolean>;
}

/** Failure toast with the real reason under the title. */
function failureToast(title: string, reason: string | null | undefined) {
  if (isStalePageError(reason)) {
    // A tab left open across an update: nothing ran, only a reload helps
    toast.error('This page is out of date', { description: 'Reload the page and try again.', duration: 15000 });
    return;
  }
  toast.error(title, reason && reason !== title ? { description: reason, duration: 15000 } : undefined);
}

/** True when the picture is taller than wide; null when it cannot be read. Reads the size only, no full decode. */
function imageIsTall(src: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalHeight > img.naturalWidth);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function useTalkingAvatar(): UseTalkingAvatarReturn {
  const pathname = usePathname();
  const currentGenerationIdRef = useRef<string | null>(null);
  const generatedVideoRef = useRef<TalkingAvatarState['generatedVideo']>(null);
  const hasAttemptedRestorationRef = useRef<boolean>(false);
  
  // Frontend polling refs for Hedra completion detection
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Poll interval ref (the poll is the safety net on every tier)
  const falPollingRef = useRef<NodeJS.Timeout | null>(null);
  const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  const getActiveTabFromPath = useCallback(() => {
    if (pathname.includes('/history')) return 'history';
    return 'generate';
  }, [pathname]);

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const supabase = createClient();
  // Hosted copy of the picked audio file. The page keeps a blob: link for its own
  // players; the video engine needs a link it can open from the internet.
  const hostedAudioRef = useRef<{ file: File; url: string } | null>(null);
  
  const [state, setState] = useState<TalkingAvatarState>({
    currentStep: 1,
    totalSteps: 3,
    avatarTemplates: [],
    selectedAvatarTemplate: null,
    customAvatarImage: null,
    customAvatarUrl: null,
    // Audio input (Step 2)
    audioInputMode: 'tts',
    qualityTier: 'standard',
    scriptText: '',
    voiceOptions: [],
    selectedVoiceId: null,
    voiceAudioUrl: null,
    uploadedAudioUrl: null,
    uploadedAudioFile: null,
    audioDurationSeconds: 0,
    actionPrompt: '',
    // Video generation (Step 3)
    selectedResolution: 'landscape',
    isGenerating: false,
    generatedVideo: null,
    isLoading: false,
    error: null,
    credits: 0,
    estimatedCredits: 10, // Minimum 10 credits for avatar video
    videos: [],
    historyLoadFailed: false,
    generationStartedAt: null,
    // True from the start: a deep link to History must not flash "No videos yet" before the first load
    isLoadingHistory: true,
    currentGenerationId: null,
    isStateRestored: false,
    // Cloned voices
    clonedVoices: [],
    isCloning: false,
    // Saved avatars
    savedAvatars: [],
  });

  // Update active tab when pathname changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [pathname, getActiveTabFromPath]);

  // The page stays mounted across Generate and History (talking-avatar/layout.tsx),
  // so History is read again each time the user opens it: a video the poller
  // finished never reached the list through Realtime.
  const loadHistoryRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (activeTab === 'history') loadHistoryRef.current();
  }, [activeTab]);

  // Update refs when state changes (to avoid subscription re-creation)
  useEffect(() => {
    currentGenerationIdRef.current = state.currentGenerationId;
  }, [state.currentGenerationId]);

  useEffect(() => {
    generatedVideoRef.current = state.generatedVideo;
  }, [state.generatedVideo]);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Load avatar templates on mount
  const loadAvatarTemplates = useCallback(async () => {
    if (state.avatarTemplates.length > 0) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const templates = await getAvatarTemplates();
      setState(prev => ({ 
        ...prev, 
        avatarTemplates: templates.map(template => ({
          id: template.id,
          name: template.name,
          category: template.category,
          description: template.description || undefined,
          thumbnail_url: template.thumbnail_url || undefined,
          gender: template.gender || undefined,
          age_range: template.age_range || undefined,
          ethnicity: template.ethnicity || undefined,
          voice_provider: template.voice_provider || undefined,
          voice_id: template.voice_id || undefined,
          preview_video_url: template.preview_video_url || undefined,
          is_active: template.is_active ?? true,
          usage_count: template.usage_count || undefined,
          created_by: template.created_by || undefined,
          created_at: template.created_at || new Date().toISOString(),
          updated_at: template.updated_at || undefined
        })),
        isLoading: false 
      }));
    } catch (error) {
      // Avatar template loading failed silently
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load avatar templates',
        isLoading: false 
      }));
      toast.error('Failed to load avatar templates');
    }
  }, [state.avatarTemplates.length]);

  // Step 1: Handle avatar selection
  // A library avatar is a pure pick: no server call and no toast (the card shows
  // the check mark). Only the client's own photo goes to the server, once, to be
  // stored; "Continue" waits for that upload.
  const handleAvatarSelection = useCallback(async (template: AvatarTemplate | null, customImage?: File) => {
    if (!user) return;

    if (template || !customImage) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
        selectedAvatarTemplate: template || null,
        customAvatarImage: null,
        customAvatarUrl: null,
        // Library avatars are wide: undo a Portrait that a tall own photo preselected
        selectedResolution: template ? 'landscape' : prev.selectedResolution,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      selectedAvatarTemplate: null,
      customAvatarImage: customImage,
      customAvatarUrl: null,
    }));

    // Match the video shape to the photo: a tall photo left on Landscape gets re-framed
    // by the engine. The cards in step 3 show the result and can still be changed.
    const objectUrl = URL.createObjectURL(customImage);
    imageIsTall(objectUrl).then((tall) => {
      URL.revokeObjectURL(objectUrl);
      // Unreadable here (HEIC, broken file): the upload below reports it
      if (tall === null) return;
      setState(prev => prev.customAvatarImage !== customImage ? prev : {
        ...prev,
        selectedResolution: tall ? 'portrait' : 'landscape',
      });
    });

    try {
      const request: TalkingAvatarRequest = {
        script_text: state.scriptText,
        custom_avatar_image: customImage,
        workflow_step: 'avatar_select',
        user_id: user.id,
      };

      const response = await executeTalkingAvatar(request);
      const url = response.success ? response.step_data?.avatar_preview_url : undefined;
      if (!url) {
        throw new Error(response.error || 'The photo could not be uploaded');
      }

      // A slower upload must not replace a pick the user made after it
      setState(prev => prev.customAvatarImage !== customImage ? prev : {
        ...prev,
        customAvatarUrl: url,
        credits: response.remaining_credits,
        isLoading: false,
      });
    } catch (error) {
      console.error('Avatar photo upload failed:', error);
      // A page left open across a deploy keeps its own wording: the output panel
      // turns it into "This page is out of date" with a Reload button
      const raw = error instanceof Error ? error.message : '';
      const stalePage = isStalePageError(raw);
      setState(prev => prev.customAvatarImage !== customImage ? prev : {
        ...prev,
        customAvatarImage: null,
        error: stalePage ? raw : 'The photo could not be uploaded',
        isLoading: false,
      });
      if (!stalePage) toast.error('The photo could not be uploaded. Try a JPG or PNG under 10 MB.');
    }
  }, [user, state.scriptText]);

  const selectAvatarImageUrl = useCallback((url: string) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      error: null,
      selectedAvatarTemplate: null,
      customAvatarImage: null,
      customAvatarUrl: url,
      // Saved and AI-made avatar photos are wide (the AI photo maker only makes 16:9)
      selectedResolution: 'landscape',
    }));
  }, []);

  // Step 2: Handle voice generation
  const handleVoiceGeneration = useCallback(async (voiceId: string, scriptText: string, voiceSettings?: { speed?: number; pitch?: number; volume?: number; emotion?: string }): Promise<{ success: boolean; voiceAudioUrl?: string }> => {
    if (!user) return { success: false };

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const request: TalkingAvatarRequest = {
        script_text: scriptText,
        voice_id: voiceId,
        voice_speed: voiceSettings?.speed || 1.0,
        voice_pitch: voiceSettings?.pitch,
        voice_volume: voiceSettings?.volume,
        voice_emotion: voiceSettings?.emotion,
        avatar_image_url: state.customAvatarUrl || state.selectedAvatarTemplate?.thumbnail_url,
        avatar_template_id: state.selectedAvatarTemplate?.id,
        workflow_step: 'voice_generate',
        user_id: user.id,
      };

      const response = await executeTalkingAvatar(request);
      
      if (response.success) {
        const voiceAudioUrl = response.step_data?.voice_audio_url || null;
        const estimatedDuration = response.step_data?.estimated_duration || 0;

        setState(prev => {
          // The user switched to "Upload Audio" while the voice was being made:
          // drop the late voice, or step 3 would play it while the video uses
          // (and charges for) the uploaded recording.
          if (prev.audioInputMode !== 'tts') {
            return { ...prev, credits: response.remaining_credits, isLoading: false };
          }
          return {
            ...prev,
            scriptText,
            selectedVoiceId: voiceId,
            voiceOptions: response.voice_options || prev.voiceOptions,
            voiceAudioUrl,
            audioDurationSeconds: estimatedDuration,
            currentStep: 3,
            credits: response.remaining_credits,
            isLoading: false,
          };
        });

        // The server already measured the file; this browser reading only corrects
        // the figure if the two disagree, and only for the voice it belongs to.
        if (voiceAudioUrl) {
          const audio = new Audio();
          audio.preload = 'metadata';
          audio.addEventListener('loadedmetadata', () => {
            if (audio.duration && isFinite(audio.duration)) {
              setState(prev => prev.voiceAudioUrl === voiceAudioUrl
                ? { ...prev, audioDurationSeconds: Math.ceil(audio.duration) }
                : prev);
            }
          });
          audio.src = voiceAudioUrl;
          audio.load();
        }

        toast.success('Voice ready. Listen to it below.');
        return { success: true, voiceAudioUrl: voiceAudioUrl || undefined };
      } else {
        throw new Error(response.error || 'Voice generation failed');
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Voice generation failed';
      console.error('Avatar voice generation failed:', raw);
      const reason = isStalePageError(raw) ? raw : 'The voice could not be made. Try again in a minute, or pick another voice.';
      setState(prev => ({ ...prev, error: reason, isLoading: false }));
      failureToast('The voice could not be made', isStalePageError(raw) ? raw : 'Try again in a minute, or pick another voice.');
      return { success: false };
    }
  }, [user, state.customAvatarUrl, state.selectedAvatarTemplate]);

  // Step 3: Handle video generation (supports both TTS and upload audio modes)
  const handleVideoGeneration = useCallback(async () => {
    if (!user) return;

    // Fast / Ultra speak the typed script themselves; only Standard needs audio
    const scriptTier = isScriptTier(state.qualityTier);
    const audioUrl = state.audioInputMode === 'upload'
      ? state.uploadedAudioUrl
      : state.voiceAudioUrl;

    if (!scriptTier && !audioUrl) {
      toast.error('Please generate voice or upload audio first');
      return;
    }
    if (scriptTier && !state.scriptText.trim()) {
      toast.error('Type the script the avatar should speak');
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, error: null, generationStartedAt: Date.now() }));

    // Uploaded recording: put the file in storage first. The blob: link made when
    // the file was picked only exists inside this browser tab, so the video engine
    // could never open it and every uploaded recording ended in a failed video.
    let hostedAudioUrl: string | undefined;
    if (!scriptTier && state.audioInputMode === 'upload') {
      try {
        const file = state.uploadedAudioFile;
        if (!file) throw new Error('Pick the audio file again.');
        if (hostedAudioRef.current?.file === file) {
          hostedAudioUrl = hostedAudioRef.current.url;
        } else {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('kind', 'target');
          const res = await fetch('/api/upload/voice-changer', { method: 'POST', body: formData });
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) throw new Error(`Upload failed (${res.status})`);
          const data = await res.json();
          if (!data.success || !data.url) throw new Error(data.error || 'The audio file could not be uploaded');
          hostedAudioUrl = data.url as string;
          hostedAudioRef.current = { file, url: hostedAudioUrl };
        }
      } catch (error) {
        const raw = error instanceof Error ? error.message : 'The audio file could not be uploaded';
        const message = /[.!?]$/.test(raw.trim()) ? raw.trim() : `${raw.trim()}.`;
        setState(prev => ({ ...prev, isGenerating: false, error: message }));
        toast.error(`${message} Nothing was charged.`);
        return;
      }
    }

    // Create immediate placeholder result to show video preview
    const batch_id = crypto.randomUUID();
    const placeholderVideo = {
      id: batch_id,
      video_url: '',
      thumbnail_url: '',
      script_text: state.scriptText,
      avatar_image_url: state.customAvatarUrl || state.selectedAvatarTemplate?.thumbnail_url || '',
      created_at: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      generatedVideo: placeholderVideo,
      currentStep: 3,
    }));

    try {
      const request: TalkingAvatarRequest = {
        script_text: state.scriptText,
        avatar_image_url: state.customAvatarUrl || state.selectedAvatarTemplate?.thumbnail_url,
        avatar_template_id: state.selectedAvatarTemplate?.id,
        workflow_step: 'video_generate',
        user_id: user.id,
        quality_tier: state.qualityTier,
        // Audio input mode specific fields (Standard only)
        audio_input_mode: state.audioInputMode,
        voice_audio_url: !scriptTier && state.audioInputMode === 'tts' ? state.voiceAudioUrl ?? undefined : undefined,
        uploaded_audio_url: hostedAudioUrl,
        audio_duration_seconds: scriptTier ? undefined : state.audioDurationSeconds,
        voice_id: scriptTier ? undefined : state.selectedVoiceId ?? undefined,
        // Video settings
        resolution: state.selectedResolution,
        aspect_ratio: state.selectedResolution === 'portrait' ? '9:16' : '16:9',
        action_prompt: state.actionPrompt || undefined,
      };

      const response = await executeTalkingAvatar(request);

      if (response.success) {
        setState(prev => ({
          ...prev,
          generatedVideo: {
            ...placeholderVideo,
            id: response.video?.id || placeholderVideo.id,
            video_url: response.video?.video_url || '',
            thumbnail_url: response.video?.thumbnail_url || placeholderVideo.thumbnail_url,
            script_text: response.video?.script_text || placeholderVideo.script_text,
            avatar_image_url: response.video?.avatar_image_url || placeholderVideo.avatar_image_url,
            created_at: response.video?.created_at || placeholderVideo.created_at
          },
          credits: response.remaining_credits,
          currentGenerationId: response.prediction_id || null,
        }));

        // The poll effect below plus the Realtime subscription pick up completion
        toast.success(`Video started. Usually ready in ${waitLabelFor(state.qualityTier)}.`);
      } else {
        throw new Error(response.error || 'Video generation failed');
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Video generation failed';
      setState(prev => ({ ...prev, error: reason, isGenerating: false }));
      failureToast('The video could not be started', reason);
    }
  }, [user, state.audioInputMode, state.voiceAudioUrl, state.uploadedAudioUrl, state.uploadedAudioFile, state.audioDurationSeconds,
      state.scriptText, state.customAvatarUrl, state.selectedAvatarTemplate, state.selectedVoiceId,
      state.selectedResolution, state.actionPrompt, state.qualityTier]);

  // Reset to step 1
  const resetWizard = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 1,
      selectedAvatarTemplate: null,
      customAvatarImage: null,
      customAvatarUrl: null,
      // Audio input reset
      audioInputMode: 'tts',
      scriptText: '',
      selectedVoiceId: null,
      voiceAudioUrl: null,
      uploadedAudioUrl: null,
      uploadedAudioFile: null,
      audioDurationSeconds: 0,
      actionPrompt: '',
      // The tier stays: someone making several Fast videos should not land on Basic each time
      // Video settings reset
      selectedResolution: 'landscape',
      generatedVideo: null,
      error: null,
      currentGenerationId: null,
      // Safety net: a reset must never leave a grey "working" button behind
      isGenerating: false,
      isStateRestored: false,
    }));
  }, []);

  // Navigate between steps
  const goToStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  // Clear voice/audio and go back to step 2 for regeneration
  const clearVoice = useCallback(() => {
    setState(prev => ({
      ...prev,
      voiceAudioUrl: null,
      uploadedAudioUrl: null,
      uploadedAudioFile: null,
      audioDurationSeconds: 0,
      currentStep: 2,
    }));
  }, []);

  // Set audio input mode
  // One audio source at a time: switching between "generate a voice" and "upload a
  // recording" drops the other one, so the step 3 player, the length on screen, the
  // price on the button and the file sent to the server always agree.
  const setAudioInputMode = useCallback((mode: 'tts' | 'upload') => {
    setState(prev => {
      if (prev.audioInputMode === mode) return prev;
      if (prev.uploadedAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(prev.uploadedAudioUrl);
      return {
        ...prev,
        audioInputMode: mode,
        voiceAudioUrl: null,
        uploadedAudioUrl: null,
        uploadedAudioFile: null,
        audioDurationSeconds: 0,
      };
    });
  }, []);

  // Quality tier. Leaving Standard drops any generated or uploaded audio so a
  // leftover voice file never rides along with a Fast / Ultra job.
  const setQualityTier = useCallback((tier: AvatarQualityTier) => {
    if (tier !== 'standard' && (state.voiceAudioUrl || state.uploadedAudioUrl)) {
      toast('Your voice file was cleared: Fast and Ultra speak the script themselves.');
    }
    setState(prev => ({
      ...prev,
      qualityTier: tier,
      ...(tier !== 'standard'
        ? { voiceAudioUrl: null, uploadedAudioUrl: null, uploadedAudioFile: null, audioDurationSeconds: 0, audioInputMode: 'tts' as const }
        : {}),
    }));
  }, [state.voiceAudioUrl, state.uploadedAudioUrl]);

  // Set uploaded audio
  const setUploadedAudio = useCallback((url: string | null, file: File | null, duration: number) => {
    setState(prev => {
      // Release the previous recording's browser link
      if (prev.uploadedAudioUrl && prev.uploadedAudioUrl !== url && prev.uploadedAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(prev.uploadedAudioUrl);
      }
      return {
        ...prev,
        uploadedAudioUrl: url,
        uploadedAudioFile: file,
        audioDurationSeconds: duration,
      };
    });
  }, []);

  // Set action prompt
  const setActionPrompt = useCallback((prompt: string) => {
    setState(prev => ({ ...prev, actionPrompt: prompt }));
  }, []);

  // Set resolution
  const setSelectedResolution = useCallback((resolution: 'landscape' | 'portrait') => {
    setState(prev => ({ ...prev, selectedResolution: resolution }));
  }, []);

  // Set script text
  const setScriptText = useCallback((text: string) => {
    setState(prev => ({ ...prev, scriptText: text }));
  }, []);

  // Frontend polling functions for Hedra completion detection
  const stopHedraPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    // Stop any ongoing polling
    stopHedraPolling();
    
    setState(prev => ({
      ...prev,
      generatedVideo: null,
      error: null,
      isStateRestored: false,
      isGenerating: false,
      currentGenerationId: null,
    }));
  }, [stopHedraPolling]);

  const startHedraPolling = useCallback((generationId: string) => {
    if (!user?.id) return;
    
    console.log(`🔄 Starting Hedra polling for generation: ${generationId}`);
    
    // Stop any existing polling
    stopHedraPolling();
    
    const pollHedraStatus = async () => {
      try {
        console.log(`🔍 Polling Hedra status for: ${generationId}`);
        
        const response = await fetch(`/api/webhooks/hedra-ai?generation_id=${generationId}&user_id=${user.id}`);
        const result = await response.json();
        
        console.log(`📊 Hedra polling result:`, result);
        
        if (result.success && result.status === 'complete' && result.video_url) {
          console.log(`✅ Hedra generation completed: ${generationId}`);
          
          // Update the current video with the completed video URL
          setState(prev => {
            if (prev.generatedVideo && prev.generatedVideo.id === generationId) {
              return {
                ...prev,
                generatedVideo: {
                  ...prev.generatedVideo,
                  video_url: result.video_url,
                },
                isGenerating: false,
              };
            }
            return prev;
          });
          
          // Stop polling when complete
          stopHedraPolling();
          toast.success('Avatar video completed!');
          
        } else if (result.success && result.status === 'error') {
          console.error(`❌ Hedra generation failed: ${generationId} - ${result.error}`);
          
          setState(prev => ({
            ...prev,
            error: result.error || 'Video generation failed',
            isGenerating: false,
          }));
          
          stopHedraPolling();
          toast.error('Avatar video generation failed');
          
        } else {
          console.log(`⏳ Hedra still processing: ${generationId} - ${result.status || 'processing'}`);
        }
        
      } catch (error) {
        console.error('Hedra polling error:', error);
        // Don't stop polling on network errors - keep trying
      }
    };
    
    // Start polling every 5 seconds
    pollingIntervalRef.current = setInterval(pollHedraStatus, 5000);
    
    // Run first poll immediately
    pollHedraStatus();
    
    // Set a timeout to stop polling after 10 minutes (Hedra usually completes in 2-5 minutes)
    pollingTimeoutRef.current = setTimeout(() => {
      console.log(`⏰ Hedra polling timeout for: ${generationId}`);
      stopHedraPolling();
      
      setState(prev => ({
        ...prev,
        error: 'Video generation timed out. Please check your history later.',
        isGenerating: false,
      }));
      
      toast.error('Video generation is taking longer than expected. Check your history later.');
    }, 10 * 60 * 1000); // 10 minutes timeout
    
  }, [user?.id, stopHedraPolling]);

  // Load video history
  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    
    setState(prev => ({ ...prev, isLoadingHistory: true }));
    try {
      // The busiest account has 81 avatar videos; the default page of 50 hid the oldest
      const { videos: historyVideos } = await getTalkingAvatarVideos(user.id, 200);
      setState(prev => ({ ...prev, videos: historyVideos, isLoadingHistory: false, historyLoadFailed: false }));
    } catch (err) {
      console.error('Avatar history could not be loaded:', err);
      setState(prev => ({ ...prev, isLoadingHistory: false, historyLoadFailed: true }));
      if (isStalePageError(err instanceof Error ? err.message : null)) failureToast('', err instanceof Error ? err.message : null);
    }
  }, [user?.id]);

  // Delete video
  const deleteVideo = useCallback(async (videoId: string): Promise<boolean> => {
    if (!user?.id) {
      setState(prev => ({ ...prev, error: 'User must be authenticated to delete videos' }));
      return false;
    }

    try {
      const success = await deleteTalkingAvatarVideo(videoId, user.id);
      
      if (success) {
        // Remove from local state
        setState(prev => ({
          ...prev,
          videos: prev.videos.filter(video => video.id !== videoId)
        }));
        
        // Video deleted successfully
        return true;
      } else {
        // The History tab never shows state.error, so the failure is said here
        toast.error('This video could not be deleted. Try again.');
        return false;
      }
    } catch (error) {
      console.error('Avatar video delete failed:', error);
      const raw = error instanceof Error ? error.message : null;
      if (isStalePageError(raw)) failureToast('', raw);
      else toast.error('This video could not be deleted. Try again.');
      return false;
    }
  }, [user?.id]);

  useEffect(() => {
    loadHistoryRef.current = loadHistory;
  }, [loadHistory]);

  // Load initial history and restore any ongoing generations
  useEffect(() => {
    if (user?.id) {
      loadHistory();
      
      // Only attempt restoration once per session
      if (hasAttemptedRestorationRef.current) {
        // Skipping restoration - already attempted
        return;
      }
      
      hasAttemptedRestorationRef.current = true;
      // Checking for ongoing generations
      
      // Check for ongoing video generations and restore state
      const checkOngoingGenerations = async () => {
        try {
          const { data: videos, error } = await supabase
            .from('avatar_videos')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) {
            // Error checking ongoing generations
            return;
          }

          // Retrieved videos from database

          // Only consider recent videos: 20 minutes on every tier. Basic takes 2 to 5
          // minutes and Ultra 3 to 6; a 2 minute window made a reload at minute 3 hide
          // the paid job and invite a second paid run. The poller settles restored jobs.
          // Check for both fal_request_id (new) and hedra_generation_id (legacy)
          const now = Date.now();
          const processingVideo = videos?.find((v: any) => {
            const isProcessingStatus = v.status === 'processing' || v.status === 'pending';
            const isRecent = new Date(v.created_at || '').getTime() > now - 20 * 60 * 1000;
            const hasValidGenerationId = (v.fal_request_id && v.fal_request_id.trim()) ||
                                         (v.hedra_generation_id && v.hedra_generation_id.trim());

            return isProcessingStatus && isRecent && hasValidGenerationId;
          });

          if (processingVideo) {
            // Found processing video - determine generation ID (fal.ai or Hedra)
            const generationId = (processingVideo as any).fal_request_id || (processingVideo as any).hedra_generation_id;
            const videoSource = (processingVideo as any).video_source || 'hedra';

            // Only restore if we're not already in a generating state (true restoration)
            if (!state.isGenerating && !state.currentGenerationId) {
              setState(prev => ({
                ...prev,
                isGenerating: true,
                error: null,
                generatedVideo: {
                  id: processingVideo.id,
                  video_url: processingVideo.video_url || '',
                  thumbnail_url: processingVideo.thumbnail_url || '',
                  script_text: processingVideo.script_text || '',
                  avatar_image_url: (processingVideo as any).avatar_image_url || '',
                  created_at: processingVideo.created_at || new Date().toISOString()
                },
                currentGenerationId: generationId || null,
                generationStartedAt: new Date(processingVideo.created_at || Date.now()).getTime() || Date.now(),
                isStateRestored: true,
                currentStep: 3,
                qualityTier: readAvatarTier(processingVideo as any),
                scriptText: processingVideo.script_text || prev.scriptText,
                actionPrompt: (processingVideo as any).action_prompt || prev.actionPrompt,
                // Bring the photo back too, so "generate again" after the restored job works
                customAvatarUrl: (prev.customAvatarUrl || prev.selectedAvatarTemplate)
                  ? prev.customAvatarUrl
                  : ((processingVideo as any).avatar_image_url || null),
              }));

              // Resume polling for legacy Hedra generations
              if (videoSource === 'hedra' && generationId) {
                console.log('🔄 Resuming Hedra polling for restored generation:', generationId);
                setTimeout(() => {
                  startHedraPolling(generationId);
                }, 2000);
              } else {
                console.log('🔄 Restored fal.ai generation - the poll effect picks it up:', generationId);
              }
            }
          } else {
            // No ongoing generations found. Rows that never got an engine id are left
            // alone here: the browser used to mark them failed with no refund and no
            // reason. "Check this video" in History closes them on the server, with the refund.

            // Ensure we're not in a stuck generating state
            setState(prev => {
              if (prev.isGenerating && !prev.currentGenerationId) {
                // Clearing stuck generating state
                return {
                  ...prev,
                  isGenerating: false,
                  generatedVideo: null,
                  isStateRestored: false,
                };
              }
              return prev;
            });
          }
        } catch (error) {
          // Error checking ongoing generations
        }
      };
      
      checkOngoingGenerations();
    }
  }, [user?.id, loadHistory, supabase]);

  // Subscribe to real-time updates for video status (matching AI cinematographer pattern)
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔔 Setting up Talking Avatar real-time subscription for user:', user.id);

    const subscription = supabase
      .channel(`avatar_videos_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'avatar_videos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🎬 Talking Avatar real-time update received:', {
            event: payload.eventType,
            old: payload.old,
            new: payload.new
          });

          const updatedVideo = payload.new as TalkingAvatarVideo;

          // Update current result if it matches the current generation
          // Check both fal_request_id (new) and hedra_generation_id (legacy)
          const currentGenerationId = currentGenerationIdRef.current;
          const currentVideo = generatedVideoRef.current;
          const updatedVideoGenerationId = updatedVideo?.fal_request_id || (updatedVideo as any)?.hedra_generation_id;
          const isCurrentGeneration = currentGenerationId && updatedVideoGenerationId === currentGenerationId;

          console.log('🔍 Talking Avatar real-time matching check:', {
            hasCurrentGenerationId: !!currentGenerationId,
            currentGenerationId,
            updatedVideoGenerationId,
            updatedVideoStatus: updatedVideo?.status,
            isMatch: isCurrentGeneration
          });
          
          if (isCurrentGeneration) {
            console.log('📺 Updating current talking avatar result:', {
              generation_id: currentGenerationId,
              status: updatedVideo.status,
              video_url: updatedVideo.video_url
            });

            setState(prev => ({
              ...prev,
              generatedVideo: currentVideo ? {
                ...currentVideo,
                video_url: updatedVideo.video_url || currentVideo.video_url,
                thumbnail_url: updatedVideo.thumbnail_url || currentVideo.thumbnail_url,
              } : {
                id: updatedVideo.id,
                video_url: updatedVideo.video_url || '',
                thumbnail_url: updatedVideo.thumbnail_url || '',
                script_text: updatedVideo.script_text || '',
                avatar_image_url: (updatedVideo as any).avatar_image_url || '',
                created_at: updatedVideo.created_at || new Date().toISOString()
              }
            }));
            
            // CRITICAL: Set isGenerating to false when video generation is complete
            if (updatedVideo.status === 'completed' || updatedVideo.status === 'failed') {
              console.log('✅ Talking Avatar generation completed, stopping loading state and polling');
              
              // Stop frontend polling since real-time completed successfully
              stopHedraPolling();
              
              setState(prev => ({
                ...prev,
                isGenerating: false,
                isStateRestored: false, // Clear restored state flag
                currentGenerationId: null,
              }));
              
              // Clear any existing error if the video succeeded
              if (updatedVideo.status === 'completed' && updatedVideo.video_url) {
                setState(prev => ({ ...prev, error: null }));
                toast.success('Your avatar video is ready');
              } else if (updatedVideo.status === 'failed') {
                const reason = updatedVideo.error_message || 'The video could not be made';
                setState(prev => ({ ...prev, error: reason }));
                failureToast('The video could not be made', reason);
              }
            }
          }
          
          if (
            !isCurrentGeneration
            && updatedVideo?.status === 'failed'
            && updatedVideo.error_message
            && generatedVideoRef.current?.id === updatedVideo.id
          ) {
            const fullReason = updatedVideo.error_message;
            setState(prev => (prev.error && prev.error !== fullReason ? { ...prev, error: fullReason } : prev));
          }

          // Always update the videos list for history tab
          if (payload.eventType === 'UPDATE') {
            setState(prev => ({
              ...prev,
              videos: prev.videos.map(video => 
                video.id === updatedVideo.id ? updatedVideo : video
              )
            }));
          } else if (payload.eventType === 'INSERT') {
            setState(prev => ({
              ...prev,
              videos: [updatedVideo, ...prev.videos]
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Talking Avatar subscription status:', status);
      });

    return () => {
      console.log('🔔 Unsubscribing from Talking Avatar real-time updates');
      subscription.unsubscribe();
    };
  }, [user?.id, supabase]); // Use refs to avoid re-subscription

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up Hedra polling timers');
      stopHedraPolling();
      // Also cleanup fal.ai polling
      if (falPollingRef.current) {
        clearInterval(falPollingRef.current);
        falPollingRef.current = null;
      }
    };
  }, [stopHedraPolling]);

  // Every tier polls while a video renders: never let the spinner wait on Realtime
  // alone. A sleeping laptop or a dropped wifi misses the one Realtime event and
  // the finished video never showed. In production the poll asks our own server
  // (pollAvatarTierGeneration). On localhost the webhook cannot reach us, so the
  // Basic tier asks fal directly there.
  useEffect(() => {
    const scriptTier = isScriptTier(state.qualityTier);

    // Only poll if we're generating and have a request ID
    // New generations use fal.ai, legacy ones use Hedra (which has its own polling)
    const requestId = state.currentGenerationId;
    const videoId = state.generatedVideo?.id;

    if (!state.isGenerating || !requestId) {
      if (falPollingRef.current) {
        clearInterval(falPollingRef.current);
        falPollingRef.current = null;
      }
      return;
    }

    // Poll every 5 s on localhost, 10 s in production. In production the webhook
    // normally finishes the job; the poll only takes over once the engine has been
    // done for three ticks (about 30 s) and the row is still open.
    let engineDoneTicks = 0;
    const pollInterval = setInterval(async () => {
      try {
        // The fal-direct poller below is for localhost only
        if (!videoId && !isLocalDev) return;
        const result = (scriptTier || !isLocalDev) && videoId
          ? await pollAvatarTierGeneration(videoId, isLocalDev || engineDoneTicks >= 3)
          : await pollLTXVideoGeneration(requestId);
        if ('engineDone' in result && result.engineDone) engineDoneTicks += 1;

        // A Realtime update may have finished this job while the request was in
        // flight; then the id ref is already cleared and this tick must stay quiet.
        if (currentGenerationIdRef.current !== requestId) {
          clearInterval(pollInterval);
          falPollingRef.current = null;
          return;
        }

        if (result.status === 'completed' && result.video_url) {
          // Update state with completed video
          setState(prev => ({
            ...prev,
            isGenerating: false,
            isStateRestored: false,
            currentGenerationId: null,
            generatedVideo: prev.generatedVideo ? {
              ...prev.generatedVideo,
              video_url: result.video_url!,
            } : null,
            error: null,
          }));

          toast.success('Your avatar video is ready');
          loadHistoryRef.current();

          // Stop polling
          clearInterval(pollInterval);
          falPollingRef.current = null;

        } else if (result.status === 'failed') {
          setState(prev => ({
            ...prev,
            isGenerating: false,
            isStateRestored: false,
            error: result.error || 'The video could not be made',
            currentGenerationId: null,
          }));

          failureToast('The video could not be made', result.error);
          loadHistoryRef.current();

          // Stop polling
          clearInterval(pollInterval);
          falPollingRef.current = null;
        }
        // For 'pending' or 'processing', continue polling
      } catch (error) {
        console.error('Avatar poll error:', error);
        // Don't stop polling on network errors - they might be temporary
      }
    }, isLocalDev ? 5000 : 10000);

    falPollingRef.current = pollInterval;

    // Cleanup on unmount or when dependencies change
    return () => {
      clearInterval(pollInterval);
      falPollingRef.current = null;
    };
  }, [state.isGenerating, state.currentGenerationId, state.qualityTier, state.generatedVideo?.id, isLocalDev]);

  // Load user's cloned voices
  const loadClonedVoices = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await getUserClonedVoices(user.id);
      if (result.success && result.data) {
        setState(prev => ({ ...prev, clonedVoices: result.data || [] }));
      }
    } catch (error) {
      console.error('Failed to load cloned voices:', error);
    }
  }, [user?.id]);

  // Clone a voice from uploaded file
  const cloneVoiceAction = useCallback(async (
    file: File,
    name: string,
    options: { noiseReduction: boolean; volumeNormalization: boolean }
  ) => {
    if (!user) return;

    setState(prev => ({ ...prev, isCloning: true }));

    try {
      // The browser uploads straight to storage, the same path Voice Over uses.
      // File bytes sent through a server action die above about 750 KB.
      const prep = await prepareVoiceUpload(user.id, file.name);
      if (!prep.success || !prep.path || !prep.token) {
        throw new Error(prep.error || 'Could not prepare the upload');
      }

      const { error: uploadError } = await supabase.storage
        .from('script-videos')
        .uploadToSignedUrl(prep.path, prep.token, file, {
          contentType: file.type || 'audio/mpeg',
        });
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const result = await cloneVoiceFromStorage(
        user.id,
        prep.path,
        {
          noise_reduction: options.noiseReduction,
          volume_normalization: options.volumeNormalization,
        }
      );

      if (result.success && result.voice_id) {
        // Generate a preview sample with the cloned voice
        let previewUrl: string | undefined = result.preview_url;

        if (!previewUrl) {
          try {
            const previewResult = await generateMinimaxVoice({
              text: `Hello, this is ${name}. This is a preview of your cloned voice.`,
              voice_settings: {
                voice_id: result.voice_id,
                speed: 1.0,
                pitch: 0,
                volume: 1,
                emotion: 'auto'
              },
              user_id: user.id,
              batch_id: `clone_preview_${Date.now()}`
            });

            if (previewResult.success && previewResult.audio_url) {
              previewUrl = previewResult.audio_url;
            }
          } catch (previewError) {
            console.warn('Failed to generate preview for cloned voice:', previewError);
          }
        }

        // Save the cloned voice to database
        const saveResult = await saveClonedVoice(
          user.id,
          name,
          result.voice_id,
          undefined,
          previewUrl
        );

        if (saveResult.success && saveResult.data) {
          setState(prev => ({
            ...prev,
            clonedVoices: [saveResult.data!, ...prev.clonedVoices],
            isCloning: false,
          }));
          toast.success('Voice cloned successfully!');
          return saveResult.data;
        } else {
          throw new Error(saveResult.error || 'Failed to save cloned voice');
        }
      } else {
        throw new Error(result.error || 'Voice cloning failed');
      }
    } catch (error) {
      console.error('Clone error:', error);
      setState(prev => ({ ...prev, isCloning: false }));
      toast.error(error instanceof Error ? error.message : 'Voice cloning failed');
      throw error;
    }
  }, [user, supabase]);

  // Load cloned voices on mount when user is available
  useEffect(() => {
    if (user?.id) {
      loadClonedVoices();
    }
  }, [user?.id, loadClonedVoices]);

  // ─── Switch voice: the user's own voice on the finished video ───
  const [isSwitchingVoice, setIsSwitchingVoice] = useState(false);
  const [lastVoiceSample, setLastVoiceSample] = useState<{ url: string; name: string } | null>(null);

  // Remembered voice sample, shared with Video Maker and Agent Clone: one upload serves all three
  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = localStorage.getItem(`bluefx.voiceSample.${user.id}`) || localStorage.getItem(`agentclone.voiceSample.${user.id}`);
      if (saved) setLastVoiceSample(JSON.parse(saved));
    } catch {
      // no remembered sample
    }
  }, [user?.id]);

  const switchVoice = useCallback(async (file: File | null) => {
    const current = generatedVideoRef.current;
    if (!current?.id || !current.video_url || !user?.id) return;
    const videoId = current.id;

    setIsSwitchingVoice(true);
    try {
      let sample = lastVoiceSample;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('kind', 'target');
        const res = await fetch('/api/upload/voice-changer', { method: 'POST', body: formData });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) throw new Error(`The voice sample could not be uploaded (${res.status}).`);
        const data = await res.json();
        if (!data.success || !data.url) throw new Error(data.error || 'The voice sample could not be uploaded.');
        sample = { url: data.url as string, name: file.name };
        setLastVoiceSample(sample);
        try { localStorage.setItem(`bluefx.voiceSample.${user.id}`, JSON.stringify(sample)); } catch { /* ignore */ }
      }
      if (!sample) throw new Error('Choose a voice sample first.');

      const response = await switchAvatarVoice(videoId, sample.url);
      if (!response.success || !response.videoUrl) throw new Error(response.error || 'The voice could not be switched.');

      const voiceUrl = response.videoUrl;
      setState(prev => ({
        ...prev,
        generatedVideo: prev.generatedVideo && prev.generatedVideo.id === videoId
          ? { ...prev.generatedVideo, voice_video_url: voiceUrl }
          : prev.generatedVideo,
        videos: prev.videos.map(v => v.id === videoId
          ? {
              ...v,
              video_settings: {
                ...((v.video_settings && typeof v.video_settings === 'object' && !Array.isArray(v.video_settings)) ? v.video_settings as Record<string, unknown> : {}),
                voice_video_url: voiceUrl,
              } as TalkingAvatarVideo['video_settings'],
            }
          : v),
      }));
      toast.success('Voice switched. Your voice is on the video.');
    } catch (err) {
      failureToast('The voice could not be switched', err instanceof Error ? err.message : null);
    } finally {
      setIsSwitchingVoice(false);
    }
  }, [lastVoiceSample, user?.id]);

  // Load user's saved avatars
  const loadSavedAvatars = useCallback(async () => {
    if (!user?.id) return;
    try {
      const result = await getUserSavedAvatars(user.id);
      if (result.success && result.data) {
        setState(prev => ({ ...prev, savedAvatars: result.data || [] }));
      }
    } catch (error) {
      console.error('Failed to load saved avatars:', error);
    }
  }, [user?.id]);

  // Save a generated avatar
  const saveAvatar = useCallback(async (name: string, imageUrl: string): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const result = await saveUserAvatar(user.id, name, imageUrl);
      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          savedAvatars: [result.data!, ...prev.savedAvatars],
        }));
        toast.success('Avatar saved to My Avatars');
        return true;
      } else {
        toast.error(result.error || 'Failed to save avatar');
        return false;
      }
    } catch (error) {
      console.error('Save avatar error:', error);
      toast.error('Failed to save avatar');
      return false;
    }
  }, [user?.id]);

  // Delete a saved avatar
  const deleteSavedAvatarFn = useCallback(async (avatarId: string): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const result = await deleteSavedAvatarAction(user.id, avatarId);
      if (result.success) {
        setState(prev => ({
          ...prev,
          savedAvatars: prev.savedAvatars.filter(a => a.id !== avatarId),
        }));
        toast.success('Avatar deleted');
        return true;
      } else {
        toast.error(result.error || 'Failed to delete avatar');
        return false;
      }
    } catch (error) {
      console.error('Delete avatar error:', error);
      toast.error('Failed to delete avatar');
      return false;
    }
  }, [user?.id]);

  // Rename a saved avatar
  const renameSavedAvatar = useCallback(async (avatarId: string, newName: string): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const result = await updateSavedAvatarName(user.id, avatarId, newName);
      if (result.success) {
        setState(prev => ({
          ...prev,
          savedAvatars: prev.savedAvatars.map(a =>
            a.id === avatarId ? { ...a, name: newName } : a
          ),
        }));
        return true;
      } else {
        toast.error(result.error || 'Failed to rename avatar');
        return false;
      }
    } catch (error) {
      console.error('Rename avatar error:', error);
      toast.error('Failed to rename avatar');
      return false;
    }
  }, [user?.id]);

  // Load saved avatars on mount when user is available
  useEffect(() => {
    if (user?.id) {
      loadSavedAvatars();
    }
  }, [user?.id, loadSavedAvatars]);

  // Check status for a specific history item
  // "Check this video" on a History card that has been "being made" for too long.
  // Every row goes through the same guarded poller the page uses: it finishes the
  // job, or closes it with a refund once it is over 45 minutes old (that includes
  // the few legacy Hedra rows, whose engine is retired).
  const checkHistoryItemStatus = useCallback(async (video: TalkingAvatarVideo) => {
    try {
      const result = await pollAvatarTierGeneration(video.id);
      // The page's own poller and Realtime already announce the job it is watching
      const watchedByPage = !!currentGenerationIdRef.current && generatedVideoRef.current?.id === video.id;
      if (!watchedByPage) {
        if (result.status === 'completed') toast.success('Your video is ready');
        else if (result.status === 'failed') failureToast('The video could not be made', result.error);
        else toast.info('Still being made. Check again in a few minutes.');
      }
      await loadHistory();
    } catch (error) {
      console.error('Avatar status check failed:', error);
      const raw = error instanceof Error ? error.message : null;
      failureToast('This video could not be checked', isStalePageError(raw) ? raw : 'Try again in a minute.');
    }
  }, [loadHistory]);

  return {
    activeTab,
    setActiveTab,
    state,
    loadAvatarTemplates,
    handleAvatarSelection,
    selectAvatarImageUrl,
    handleVoiceGeneration,
    handleVideoGeneration,
    resetWizard,
    goToStep,
    clearVoice,
    clearResults,
    loadHistory,
    deleteVideo,
    checkHistoryItemStatus,
    // New state setters for dual audio input mode
    setAudioInputMode,
    setUploadedAudio,
    setActionPrompt,
    setSelectedResolution,
    setScriptText,
    setQualityTier,
    // Switch voice on the finished video
    switchVoice,
    isSwitchingVoice,
    lastVoiceSample,
    // Voice cloning
    loadClonedVoices,
    cloneVoice: cloneVoiceAction,
    // Saved avatars
    loadSavedAvatars,
    saveAvatar,
    deleteSavedAvatar: deleteSavedAvatarFn,
    renameSavedAvatar,
  };
}