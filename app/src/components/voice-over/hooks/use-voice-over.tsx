'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { executeVoiceOver, VoiceOverRequest, VoiceOption, GeneratedVoice } from '@/actions/tools/voice-over';
import { getVoiceOverHistory, deleteGeneratedVoice } from '@/actions/database/voice-over-database';
import { getUserClonedVoices, deleteClonedVoice, saveClonedVoice } from '@/actions/database/cloned-voices-database';
import { cloneVoiceFromFile } from '@/actions/services/minimax-clone-service';
import { generateMinimaxVoice } from '@/actions/services/minimax-voice-service';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import type { MinimaxEmotion } from '@/components/shared/voice-constants';

export interface ClonedVoice {
  id: string;
  name: string;
  minimax_voice_id: string;
  preview_url: string | null;
  created_at: string;
}

export interface VoiceOverState {
  // Script and voice settings
  scriptText: string;
  selectedVoice: string;
  voiceSettings: {
    speed: number;
    pitch: number;
    volume: number;
    emotion: MinimaxEmotion;
  };
  
  // Export options
  exportFormat: 'mp3' | 'wav' | 'flac';
  quality: 'standard' | 'hd';
  useSSML: boolean;
  
  
  // Generated results
  generatedAudios: GeneratedVoice[];
  currentBatchId: string | null;
  
  // History
  voiceHistory: GeneratedVoice[];
  
  // Voice options and previews
  voiceOptions: VoiceOption[];
  playingVoiceId: string | null;
  
  // UI state
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  credits: number;
  estimatedCredits: number;

  // Cloned voices
  clonedVoices: ClonedVoice[];
  isCloning: boolean;
}

export function useVoiceOver() {
  const pathname = usePathname();
  
  const getActiveTabFromPath = useCallback(() => {
    if (pathname.includes('/history')) return 'history';
    if (pathname.includes('/settings')) return 'settings';
    if (pathname.includes('/clone')) return 'clone';
    return 'generate';
  }, [pathname]);

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const supabase = createClient();
  
  const [state, setState] = useState<VoiceOverState>({
    scriptText: '',
    selectedVoice: 'Friendly_Person',
    voiceSettings: {
      speed: 1.0,
      pitch: 0,
      volume: 1,
      emotion: 'auto',
    },
    exportFormat: 'mp3',
    quality: 'standard',
    useSSML: false,
    generatedAudios: [],
    currentBatchId: null,
    voiceHistory: [],
    voiceOptions: [],
    playingVoiceId: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    credits: 0,
    estimatedCredits: 2,
    clonedVoices: [],
    isCloning: false,
  });

  // Update active tab when pathname changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [pathname, getActiveTabFromPath]);

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

  // Load voice history
  const loadVoiceHistory = useCallback(async () => {
    if (!user) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await getVoiceOverHistory(user.id, 50);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          voiceHistory: (result.data || []).map(voice => ({
            ...voice,
            script_text: voice.script_text || '',
            user_id: voice.user_id || 'unknown',
            batch_id: voice.batch_id || 'unknown',
            credits_used: voice.credits_used || 0,
            audio_url: voice.audio_url || '',
            duration_seconds: voice.duration_seconds ?? 0,
            file_size_mb: voice.file_size_mb ?? 0,
            export_format: voice.export_format || 'mp3',
            created_at: voice.created_at || new Date().toISOString(),
            // Handle optional fields properly
            voice_settings: voice.voice_settings as { speed?: number; pitch?: number; volume?: number; emotion?: MinimaxEmotion } | undefined,
            quality_rating: voice.quality_rating ?? undefined
          })),
          isLoading: false,
        }));
      } else {
        throw new Error(result.error || 'Failed to load history');
      }
    } catch (error) {
      console.error('History load error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to load history',
        isLoading: false 
      }));
    }
  }, [user]);

  // Load voice history when tab changes
  useEffect(() => {
    if (activeTab === 'history' && user) {
      loadVoiceHistory();
    }
  }, [activeTab, user, loadVoiceHistory]);

  // Update estimated credits based on settings
  useEffect(() => {
    const calculateEstimatedCredits = () => {
      const wordCount = state.scriptText.trim().split(/\s+/).filter(Boolean).length;
      let baseCost = 2;
      
      // Quality multiplier
      if (state.quality === 'hd') baseCost *= 1.5;
      
      // Length multiplier
      if (wordCount > 500) {
        baseCost *= (1 + ((wordCount - 500) * 0.001));
      }
      
      return Math.ceil(baseCost);
    };

    setState(prev => ({
      ...prev,
      estimatedCredits: calculateEstimatedCredits(),
    }));
  }, [state.scriptText, state.quality]);

  // Handle voice preview playback
  const handleVoicePlayback = useCallback((voiceId: string, sampleUrl: string) => {
    // If the same voice is playing, stop it
    if (state.playingVoiceId === voiceId && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setState(prev => ({ ...prev, playingVoiceId: null }));
      return;
    }

    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }

    // Start new audio with preload
    const audio = new Audio();
    audio.preload = 'auto';

    // Set up event listeners before setting src
    audio.addEventListener('canplaythrough', () => {
      audio.play().catch((error) => {
        console.error('Audio play() failed:', error);
        currentAudioRef.current = null;
        setState(prev => ({ ...prev, playingVoiceId: null }));
      });
    }, { once: true });

    audio.addEventListener('ended', () => {
      currentAudioRef.current = null;
      setState(prev => ({ ...prev, playingVoiceId: null }));
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio error for:', voiceId, sampleUrl, e);
      currentAudioRef.current = null;
      setState(prev => ({ ...prev, playingVoiceId: null }));
    });

    // Set src and store reference
    audio.src = sampleUrl;
    currentAudioRef.current = audio;
    setState(prev => ({ ...prev, playingVoiceId: voiceId }));

    // Start loading
    audio.load();
  }, [state.playingVoiceId]);

  // Generate voice
  const generateVoice = useCallback(async () => {
    if (!user || !state.scriptText.trim()) return;
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    try {
      const request: VoiceOverRequest = {
        script_text: state.scriptText,
        voice_id: state.selectedVoice,
        voice_settings: state.voiceSettings,
        export_format: state.exportFormat,
        quality: state.quality,
        use_ssml: state.useSSML,
        user_id: user.id,
      };

      const response = await executeVoiceOver(request);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          generatedAudios: response.generated_audio ? [{
            ...response.generated_audio,
            user_id: 'current-user',
            batch_id: response.batch_id || 'unknown',
            credits_used: 2
          }] : [],
          currentBatchId: response.batch_id,
          credits: response.remaining_credits,
          isGenerating: false,
        }));
        
        toast.success('Voice generated successfully!');
      } else {
        throw new Error(response.error || 'Voice generation failed');
      }
    } catch (error) {
      console.error('Voice generation error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Voice generation failed',
        isGenerating: false 
      }));
      toast.error('Voice generation failed');
    }
  }, [user, state.scriptText, state.selectedVoice, state.voiceSettings, state.exportFormat, state.quality, state.useSSML]);


  // Delete voice
  const deleteVoice = useCallback(async (voiceId: string) => {
    if (!user) return;
    
    try {
      const result = await deleteGeneratedVoice(voiceId, user.id);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          voiceHistory: prev.voiceHistory.filter(voice => voice.id !== voiceId),
          generatedAudios: prev.generatedAudios.filter(voice => voice.id !== voiceId),
        }));
        
        toast.success('Voice deleted successfully');
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete voice');
    }
  }, [user]);

  // Update script text
  const updateScriptText = useCallback((text: string) => {
    setState(prev => ({ ...prev, scriptText: text }));
  }, []);

  // Update voice settings
  const updateVoiceSettings = useCallback((settings: Partial<VoiceOverState['voiceSettings']>) => {
    setState(prev => ({
      ...prev,
      voiceSettings: { ...prev.voiceSettings, ...settings },
    }));
  }, []);


  // Clear current generation
  const clearGeneration = useCallback(() => {
    setState(prev => ({
      ...prev,
      generatedAudios: [],
      currentBatchId: null,
      error: null,
    }));
  }, []);

  // Load cloned voices
  const loadClonedVoices = useCallback(async () => {
    if (!user) return;

    try {
      const result = await getUserClonedVoices(user.id);

      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          clonedVoices: result.data || [],
        }));
      }
    } catch (error) {
      console.error('Failed to load cloned voices:', error);
    }
  }, [user]);

  // Load cloned voices when on clone or generate tab
  useEffect(() => {
    if ((activeTab === 'clone' || activeTab === 'generate') && user) {
      loadClonedVoices();
    }
  }, [activeTab, user, loadClonedVoices]);

  // Clone a voice from uploaded file
  const cloneVoice = useCallback(async (
    file: File,
    name: string,
    options: { noiseReduction: boolean; volumeNormalization: boolean }
  ) => {
    if (!user) return;

    setState(prev => ({ ...prev, isCloning: true }));

    try {
      // Convert file to base64 string (serializes correctly through server actions)
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binary);

      // Clone the voice via Minimax (pass base64 instead of Buffer)
      const result = await cloneVoiceFromFile(
        base64Data,
        user.id,
        file.name,
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
            // Continue without preview - not critical
          }
        }

        // Save the cloned voice to database
        const saveResult = await saveClonedVoice(
          user.id,
          name,
          result.voice_id,
          undefined, // source_audio_url
          previewUrl
        );

        if (saveResult.success && saveResult.data) {
          setState(prev => ({
            ...prev,
            clonedVoices: [saveResult.data!, ...prev.clonedVoices],
            isCloning: false,
          }));
          toast.success('Voice cloned successfully!');
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
  }, [user]);

  // Delete a cloned voice
  const handleDeleteClonedVoice = useCallback(async (voiceId: string) => {
    if (!user) return;

    try {
      const result = await deleteClonedVoice(voiceId, user.id);

      if (result.success) {
        setState(prev => ({
          ...prev,
          clonedVoices: prev.clonedVoices.filter(v => v.id !== voiceId),
        }));
        toast.success('Cloned voice deleted');
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete cloned voice error:', error);
      toast.error('Failed to delete cloned voice');
    }
  }, [user]);

  // Select a cloned voice for use
  const selectClonedVoice = useCallback((minimaxVoiceId: string) => {
    setState(prev => ({ ...prev, selectedVoice: minimaxVoiceId }));
    toast.success('Cloned voice selected');
  }, []);

  return {
    activeTab,
    setActiveTab,
    state,
    handleVoicePlayback,
    generateVoice,
    loadVoiceHistory,
    deleteVoice,
    updateScriptText,
    updateVoiceSettings,
    clearGeneration,
    setState,
    // Clone voice functions
    cloneVoice,
    deleteClonedVoice: handleDeleteClonedVoice,
    selectClonedVoice,
    loadClonedVoices,
  };
}