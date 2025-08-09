'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { executeVoiceOver, VoiceOverRequest, VoiceOption, GeneratedVoice } from '@/actions/tools/voice-over';
import { getVoiceOverHistory, deleteGeneratedVoice } from '@/actions/database/voice-over-database';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface VoiceOverState {
  // Script and voice settings
  scriptText: string;
  selectedVoice: string;
  voiceSettings: {
    speed: number;
    pitch: number;
    volume: number;
    emphasis: 'strong' | 'moderate' | 'none';
  };
  
  // Export options
  exportFormat: 'mp3' | 'wav' | 'ogg';
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
}

export function useVoiceOver() {
  const pathname = usePathname();
  
  const getActiveTabFromPath = useCallback(() => {
    if (pathname.includes('/history')) return 'history';
    if (pathname.includes('/settings')) return 'settings';
    return 'generate';
  }, [pathname]);

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const supabase = createClient();
  
  const [state, setState] = useState<VoiceOverState>({
    scriptText: '',
    selectedVoice: 'alloy',
    voiceSettings: {
      speed: 1.0,
      pitch: 0,
      volume: 1.0,
      emphasis: 'none',
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
            voice_settings: voice.voice_settings as { speed?: number; pitch?: number; volume?: number; emphasis?: "none" | "moderate" | "strong" } | undefined,
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
      
      // Format multiplier
      if (state.exportFormat === 'wav') baseCost *= 1.2;
      
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
  }, [state.scriptText, state.quality, state.exportFormat]);

  // Handle voice preview playback
  const handleVoicePlayback = useCallback((voiceId: string, sampleUrl: string) => {
    // If the same voice is playing, stop it
    if (state.playingVoiceId === voiceId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setState(prev => ({ ...prev, playingVoiceId: null }));
      return;
    }

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // Start new audio
    const audio = new Audio(sampleUrl);
    setCurrentAudio(audio);
    setState(prev => ({ ...prev, playingVoiceId: voiceId }));

    // Handle audio end
    audio.addEventListener('ended', () => {
      setCurrentAudio(null);
      setState(prev => ({ ...prev, playingVoiceId: null }));
    });

    // Handle audio error
    audio.addEventListener('error', () => {
      console.error('Audio playback failed for:', sampleUrl);
      setCurrentAudio(null);
      setState(prev => ({ ...prev, playingVoiceId: null }));
    });

    audio.play().catch((error) => {
      console.error('Audio playback failed:', error);
      setCurrentAudio(null);
      setState(prev => ({ ...prev, playingVoiceId: null }));
    });
  }, [state.playingVoiceId, currentAudio]);

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
  };
}