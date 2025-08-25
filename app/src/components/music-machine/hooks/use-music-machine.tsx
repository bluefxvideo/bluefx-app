'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { executeMusicMachine, MusicMachineRequest } from '@/actions/tools/music-machine';
import { getMusicHistory, deleteGeneratedMusic, GeneratedMusic } from '@/actions/database/music-database';
import { getMusicGenModelInfo } from '@/actions/models/meta-musicgen';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface MusicMachineState {
  // Generation settings
  prompt: string;
  genre: string;
  mood: string;
  duration: number;
  model_provider: 'musicgen' | 'lyria-2';
  model_version: 'stereo-large' | 'stereo-melody-large' | 'large'; // For MusicGen
  negative_prompt: string; // For Lyria-2
  seed: number | null; // For Lyria-2
  
  // Generated results
  generatedMusic: GeneratedMusic[];
  currentGeneration: {
    id: string;
    prediction_id: string;
    prompt: string;
    genre?: string;
    mood?: string;
    duration: number;
    status: string;
    created_at: string;
  } | null;
  
  // History
  musicHistory: GeneratedMusic[];
  
  // UI state
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  credits: number;
  estimatedCredits: number;
  
  // Model info
  modelInfo: Awaited<ReturnType<typeof getMusicGenModelInfo>> | null;
}

export interface UseMusicMachineReturn {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  state: MusicMachineState;
  playingMusicId: string | null;
  generateMusic: () => Promise<void>;
  loadMusicHistory: () => Promise<void>;
  deleteMusic: (musicId: string) => Promise<void>;
  handleMusicPlayback: (musicId: string, audioUrl: string) => void;
  updatePrompt: (prompt: string) => void;
  updateSettings: (updates: Partial<MusicMachineState>) => void;
  clearGeneration: () => void;
  setState: React.Dispatch<React.SetStateAction<MusicMachineState>>;
}

export function useMusicMachine() {
  const pathname = usePathname();
  
  const getActiveTabFromPath = useCallback(() => {
    if (pathname.includes('/history')) return 'history';
    return 'generate';
  }, [pathname]);

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const supabase = createClient();
  
  const [state, setState] = useState<MusicMachineState>({
    prompt: '',
    genre: 'pop',
    mood: 'energetic',
    duration: 30,
    model_provider: 'lyria-2', // Default to newer Lyria-2 model
    model_version: 'stereo-melody-large',
    negative_prompt: '',
    seed: null,
    generatedMusic: [],
    currentGeneration: null,
    musicHistory: [],
    isGenerating: false,
    isLoading: false,
    error: null,
    credits: 0,
    estimatedCredits: 5,
    modelInfo: null,
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

  // Load model info
  useEffect(() => {
    const loadModelInfo = async () => {
      const modelInfo = await getMusicGenModelInfo();
      setState(prev => ({ ...prev, modelInfo }));
    };
    loadModelInfo();
  }, []);

  // Load music history function (defined early to avoid hoisting issues)
  const loadMusicHistory = useCallback(async () => {
    if (!user) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await getMusicHistory(user.id, 50);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          musicHistory: result.data || [],
          isLoading: false,
        }));
      } else {
        throw new Error(result.error || 'Failed to load music history');
      }
    } catch (error) {
      console.error('Music history load error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to load music history',
        isLoading: false 
      }));
    }
  }, [user]);

  // Load music history when tab changes
  useEffect(() => {
    if (activeTab === 'history' && user) {
      loadMusicHistory();
    }
  }, [activeTab, user, loadMusicHistory]);

  // Update estimated credits based on settings
  useEffect(() => {
    const calculateEstimatedCredits = () => {
      if (state.model_provider === 'lyria-2') {
        // Lyria-2 has fixed cost per generation
        const baseCost = 3;
        const promptComplexity = state.prompt.split(' ').length > 20 ? 1 : 0;
        return baseCost + promptComplexity;
      } else {
        // MusicGen cost calculation
        let baseCost = 5;
        
        // Duration multiplier
        if (state.duration > 60) baseCost *= 1.5;
        if (state.duration > 120) baseCost *= 2.0;
        
        // Model multiplier
        if (state.model_version === 'stereo-melody-large') {
          baseCost *= 1.5;
        } else if (state.model_version === 'stereo-large') {
          baseCost *= 1.2;
        }
        
        return Math.ceil(baseCost);
      }
    };

    setState(prev => ({
      ...prev,
      estimatedCredits: calculateEstimatedCredits(),
    }));
  }, [state.duration, state.model_provider, state.model_version, state.prompt]);

  // Generate music
  const generateMusic = useCallback(async () => {
    if (!user || !state.prompt.trim()) return;
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    try {
      const request: MusicMachineRequest = {
        prompt: state.prompt,
        genre: state.genre,
        mood: state.mood,
        model_provider: state.model_provider,
        duration: state.model_provider === 'musicgen' ? state.duration : undefined,
        model_version: state.model_provider === 'musicgen' ? state.model_version : undefined,
        negative_prompt: state.model_provider === 'lyria-2' ? state.negative_prompt : undefined,
        seed: state.model_provider === 'lyria-2' ? state.seed : undefined,
        user_id: user.id,
      };

      const response = await executeMusicMachine(request);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          currentGeneration: response.generated_music ? {
            id: response.generated_music.id,
            prediction_id: response.generated_music.prediction_id,
            prompt: response.generated_music.prompt,
            genre: prev.genre,
            mood: prev.mood,
            duration: response.generated_music.duration,
            status: response.generated_music.status,
            created_at: response.generated_music.created_at
          } : null,
          credits: response.remaining_credits,
          isGenerating: false,
        }));
        
        toast.success('Music generation started! Processing may take 1-2 minutes.');
        
        // Start polling for completion using the prediction_id
        if (response.prediction_id) {
          startPolling(response.prediction_id);
        }
      } else {
        throw new Error(response.error || 'Music generation failed');
      }
    } catch (error) {
      console.error('Music generation error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Music generation failed',
        isGenerating: false 
      }));
      toast.error('Music generation failed');
    }
  }, [user, state.prompt, state.genre, state.mood, state.duration, state.model_provider, state.model_version, state.negative_prompt, state.seed]); // startPolling removed to avoid circular dep

  // Start polling for music completion
  const startPolling = useCallback((predictionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        // Check if music is completed by refreshing history
        await loadMusicHistory();
        
        // Check if current generation is completed
        // Look for the music record with matching prediction_id in generation_settings
        const history = await getMusicHistory(user?.id || '', 10);
        if (history.success && history.data && history.data.length > 0) {
          const matchingMusic = history.data.find((music: any) => 
            music.generation_settings?.prediction_id === predictionId
          );
          
          if (matchingMusic) {
            if (matchingMusic.status === 'completed') {
              clearInterval(pollInterval);
              setState(prev => ({ ...prev, isGenerating: false }));
              toast.success('Music generated successfully!');
              
              // Auto-switch to history tab
              setActiveTab('history');
            } else if (matchingMusic.status === 'failed') {
              clearInterval(pollInterval);
              setState(prev => ({ 
                ...prev, 
                isGenerating: false,
                error: 'Music generation failed'
              }));
              toast.error('Music generation failed');
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Clear polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setState(prev => ({ ...prev, isGenerating: false }));
    }, 300000);
  }, [user, loadMusicHistory]);


  // Delete music
  const deleteMusic = useCallback(async (musicId: string) => {
    if (!user) return;
    
    try {
      const result = await deleteGeneratedMusic(musicId, user.id);
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          musicHistory: prev.musicHistory.filter(music => music.id !== musicId),
          generatedMusic: prev.generatedMusic.filter(music => music.id !== musicId),
        }));
        
        toast.success('Music deleted successfully');
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete music');
    }
  }, [user]);

  // Handle music playback
  const handleMusicPlayback = useCallback((musicId: string, audioUrl: string) => {
    // If the same music is playing, stop it
    if (playingMusicId === musicId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setPlayingMusicId(null);
      return;
    }

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // Start new audio
    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);
    setPlayingMusicId(musicId);

    // Handle audio end
    audio.addEventListener('ended', () => {
      setCurrentAudio(null);
      setPlayingMusicId(null);
    });

    // Handle audio error
    audio.addEventListener('error', () => {
      console.error('Audio playback failed for:', audioUrl);
      setCurrentAudio(null);
      setPlayingMusicId(null);
      toast.error('Audio playback failed');
    });

    audio.play().catch((error) => {
      console.error('Audio playback failed:', error);
      setCurrentAudio(null);
      setPlayingMusicId(null);
      toast.error('Audio playback failed');
    });
  }, [playingMusicId, currentAudio]);

  // Update prompt
  const updatePrompt = useCallback((prompt: string) => {
    setState(prev => ({ ...prev, prompt }));
  }, []);

  // Update settings
  const updateSettings = useCallback((settings: Partial<Pick<MusicMachineState, 'genre' | 'mood' | 'duration' | 'model_provider' | 'model_version' | 'negative_prompt' | 'seed'>>) => {
    setState(prev => ({ ...prev, ...settings }));
  }, []);

  // Clear current generation
  const clearGeneration = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentGeneration: null,
      error: null,
    }));
  }, []);

  return {
    activeTab,
    setActiveTab,
    state,
    playingMusicId,
    generateMusic,
    loadMusicHistory,
    deleteMusic,
    handleMusicPlayback,
    updatePrompt,
    updateSettings,
    clearGeneration,
    setState,
  };
}