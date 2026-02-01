'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { executeMusicMachine, MusicMachineRequest } from '@/actions/tools/music-machine';
import { getMusicHistory, deleteGeneratedMusic, GeneratedMusic } from '@/actions/database/music-database';
import { MUSIC_MODEL_CONFIG, type MusicModel } from '@/types/music-machine';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface MusicMachineState {
  // Generation settings
  prompt: string;
  genre: string;
  mood: string;
  duration: number;
  model: MusicModel; // 'unlimited' | 'hd' | 'vocals' | 'pro'
  negative_prompt: string; // For Unlimited, HD
  seed: number | null; // For Unlimited only

  // Vocals model specific (MiniMax)
  lyrics: string;
  reference_audio: string | null;
  style_strength: number;

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
  modelInfo: typeof MUSIC_MODEL_CONFIG[MusicModel] | null;
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
  updateMusicDuration: (musicId: string, actualDurationSeconds: number) => Promise<void>;
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
    genre: '',
    mood: '',
    duration: 30,
    model: 'unlimited', // Default to free model
    negative_prompt: '',
    seed: null,
    lyrics: '',
    reference_audio: null,
    style_strength: 0.5,
    generatedMusic: [],
    currentGeneration: null,
    musicHistory: [],
    isGenerating: false,
    isLoading: false,
    error: null,
    credits: 0,
    estimatedCredits: 0, // Free model = 0 credits
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

  // Load model info based on selected model
  useEffect(() => {
    const config = MUSIC_MODEL_CONFIG[state.model];
    setState(prev => ({ ...prev, modelInfo: config }));
  }, [state.model]);

  // ✅ State restoration for seamless navigation (following perfect pattern)
  useEffect(() => {
    if (!user?.id) return;
    
    const checkOngoingGenerations = async () => {
      try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        const { data: recentPredictions } = await supabase
          .from('music_history')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', tenMinutesAgo)
          .in('status', ['pending', 'processing']) // Only restore incomplete generations
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentPredictions && recentPredictions.length > 0) {
          const music = recentPredictions[0];
          const generationSettings = music.generation_settings as any;
          
          console.log('🔄 Restoring music generation state:', music.track_title);
          
          // ✅ Restore processing state
          setState(prev => ({
            ...prev,
            isGenerating: true,
            currentGeneration: {
              id: music.id,
              prediction_id: generationSettings?.prediction_id || '',
              prompt: music.track_title,
              genre: generationSettings?.genre,
              mood: generationSettings?.mood,
              duration: music.duration_seconds || 30,
              status: music.status,
              created_at: music.created_at
            },
            prompt: music.track_title // Restore the prompt too
          }));
        }
      } catch (error) {
        console.error('State restoration error:', error);
      }
    };

    const timeoutId = setTimeout(checkOngoingGenerations, 1000);
    return () => clearTimeout(timeoutId);
  }, [user?.id, supabase]);

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

  // ✅ Real-time subscription for webhook updates (exact thumbnail machine pattern)
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel(`user_${user.id}_updates`)
      .on('broadcast', { event: 'webhook_update' }, (payload) => {
        console.log('🎵 Real-time webhook update:', payload);
        handleWebhookUpdate(payload.payload);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, supabase]);

  // Handle webhook updates (matching thumbnail machine pattern exactly)
  const handleWebhookUpdate = useCallback(async (message: any) => {
    console.log('🎵 Processing webhook update:', message);
    
    // Check if this webhook is for music generation
    if (message.tool_type !== 'music-machine') {
      return;
    }
    
    // Check if this is for our current generation
    if (state.currentGeneration?.prediction_id && message.prediction_id !== state.currentGeneration.prediction_id) {
      return;
    }
    
    if (message.status === 'succeeded' && message.results?.success) {
      // Fetch the updated music record from database
      try {
        console.log('🎵 Looking for music record with prediction_id:', message.prediction_id);
        
        const { data: musicRecord, error } = await supabase
          .from('music_history')
          .select('*')
          .contains('generation_settings', { prediction_id: message.prediction_id })
          .single();
        
        console.log('🎵 Database query result:', { musicRecord, error });
        
        if (musicRecord && musicRecord.status === 'completed' && musicRecord.audio_url) {
          console.log('🎵 Music record found and completed! Updating state...');
          
          const musicData = {
            id: musicRecord.id,
            track_title: musicRecord.prompt,
            prompt: musicRecord.prompt,
            status: 'completed',
            audio_url: musicRecord.audio_url,
            duration: musicRecord.duration_seconds,
            credits_used: musicRecord.credits_used,
            model_version: musicRecord.generation_settings?.model_version,
            output_format: musicRecord.generation_settings?.output_format,
            created_at: musicRecord.created_at,
          };
          
          setState(prev => ({
            ...prev,
            isGenerating: false,
            generatedMusic: [musicData],
            musicHistory: [musicRecord, ...prev.musicHistory.filter(m => m.id !== musicRecord.id)],
            currentGeneration: null,
            error: null,
          }));
          
          // Preload audio to get real duration
          console.log('🎵 Preloading audio to get real duration...');
          const audio = new Audio(musicRecord.audio_url);
          audio.addEventListener('loadedmetadata', () => {
            if (audio.duration && isFinite(audio.duration)) {
              const actualDuration = Math.round(audio.duration);
              console.log(`🎵 Preloaded duration detected: ${actualDuration}s, updating immediately...`);
              
              // Update with real duration
              setState(prev => ({
                ...prev,
                generatedMusic: prev.generatedMusic.map(music => 
                  music.id === musicRecord.id 
                    ? { ...music, duration: actualDuration }
                    : music
                ),
              }));
              
              // Update database in background
              import('@/actions/database/music-database')
                .then(({ updateMusicRecord }) => updateMusicRecord(musicRecord.id, {
                  duration_seconds: actualDuration
                }))
                .catch(err => console.error('Failed to update duration in DB:', err));
            }
          });
          
          toast.success('Music generated successfully!');
        }
      } catch (error) {
        console.error('❌ Error processing successful webhook:', error);
      }
    } else if (message.status === 'failed') {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: message.results?.error || 'Music generation failed',
        generatedMusic: [], // Clear any placeholder results
        currentGeneration: null,
      }));
      
      toast.error(message.results?.error || 'Music generation failed');
    }
  }, [supabase, state.currentGeneration?.prediction_id]);

  // Backup postgres subscription for database changes (music history updates)
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel(`music_history_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'music_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newMusic = payload.new as any;
          // Only add to history if it's not part of current generation
          if (!state.currentGeneration || 
              newMusic.generation_settings?.prediction_id !== state.currentGeneration.prediction_id) {
            setState(prev => ({
              ...prev,
              musicHistory: [newMusic, ...prev.musicHistory.filter(m => m.id !== newMusic.id)],
            }));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [user?.id, supabase, state.currentGeneration?.prediction_id]);

  // Update estimated credits based on model AND duration (for dynamic pricing)
  useEffect(() => {
    const config = MUSIC_MODEL_CONFIG[state.model];
    let credits = config.credits;

    // Pro model uses dynamic pricing based on duration
    if (config.dynamicPricing) {
      // ~2.7 credits per 10 seconds (2x Replicate cost at $0.06/credit)
      credits = Math.ceil(state.duration / 10 * 2.7);
    }

    setState(prev => ({
      ...prev,
      estimatedCredits: credits,
    }));
  }, [state.model, state.duration]);

  // Generate music
  const generateMusic = useCallback(async () => {
    if (!user || !state.prompt.trim()) return;

    // For vocals model, check if lyrics are provided
    const config = MUSIC_MODEL_CONFIG[state.model];
    if (config.features.lyrics && !state.lyrics.trim()) {
      toast.error('Please provide lyrics for the Vocals model');
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const request: MusicMachineRequest = {
        prompt: state.prompt,
        genre: state.genre || undefined,
        mood: state.mood || undefined,
        model: state.model,
        duration: Math.min(state.duration, config.maxDuration),
        negative_prompt: config.features.negativePrompt ? state.negative_prompt || undefined : undefined,
        seed: config.features.seed ? state.seed ?? undefined : undefined,
        // Vocals model specific fields
        lyrics: config.features.lyrics ? state.lyrics || undefined : undefined,
        reference_audio: config.features.referenceAudio ? state.reference_audio || undefined : undefined,
        style_strength: config.features.referenceAudio ? state.style_strength : undefined,
        user_id: user.id,
      };

      const response = await executeMusicMachine(request);

      if (response.success) {
        // Set immediate result for optimistic UI (like thumbnail machine)
        const initialMusic = response.generated_music ? {
          id: response.generated_music.id,
          track_title: response.generated_music.prompt,
          status: 'processing',
          audio_url: null,
          created_at: response.generated_music.created_at,
          generation_settings: {
            prediction_id: response.generated_music.prediction_id,
            batch_id: response.batch_id,
            model: state.model,
            credits_used: response.credits_used
          }
        } : null;

        setState(prev => ({
          ...prev,
          currentGeneration: response.generated_music ? {
            id: response.generated_music.id,
            prediction_id: response.generated_music.prediction_id,
            prompt: response.generated_music.prompt,
            genre: prev.genre || undefined,
            mood: prev.mood || undefined,
            duration: response.generated_music.duration,
            status: response.generated_music.status,
            created_at: response.generated_music.created_at
          } : null,
          generatedMusic: initialMusic ? [initialMusic] : [], // Set initial result immediately
          credits: response.remaining_credits,
          // Keep isGenerating: true until real-time event confirms completion
        }));

        toast.success('Music generation started! Processing may take 1-2 minutes.');
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
  }, [user, state.prompt, state.genre, state.mood, state.duration, state.model_provider, state.model_version, state.negative_prompt, state.seed]);


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
  const updateSettings = useCallback((settings: Partial<Pick<MusicMachineState, 'genre' | 'mood' | 'duration' | 'model' | 'negative_prompt' | 'seed' | 'lyrics' | 'reference_audio' | 'style_strength'>>) => {
    setState(prev => {
      // If model is changing, reset model-specific settings
      if (settings.model && settings.model !== prev.model) {
        const newConfig = MUSIC_MODEL_CONFIG[settings.model];
        return {
          ...prev,
          ...settings,
          duration: newConfig.durations[0],
          // Clear lyrics if new model doesn't support it
          lyrics: newConfig.features.lyrics ? prev.lyrics : '',
          // Clear reference audio if not supported
          reference_audio: newConfig.features.referenceAudio ? prev.reference_audio : null,
          // Clear seed if not supported
          seed: newConfig.features.seed ? prev.seed : null,
          // Clear negative prompt if not supported
          negative_prompt: newConfig.features.negativePrompt ? prev.negative_prompt : '',
        };
      }
      return { ...prev, ...settings };
    });
  }, []);

  // Clear current generation
  const clearGeneration = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentGeneration: null,
      error: null,
    }));
  }, []);

  // Cancel current generation
  const cancelGeneration = useCallback(async () => {
    if (!user?.id || !state.currentGeneration) return;
    
    try {
      // Update current generation to cancelled in database
      const { updateMusicRecord } = await import('@/actions/database/music-database');
      
      // Find the music record and mark as cancelled
      const musicHistory = await import('@/actions/database/music-database').then(m => m.getMusicHistory);
      const history = await musicHistory(user.id, 10);
      
      if (history.success && history.data) {
        const currentMusic = history.data.find((music: any) => 
          music.generation_settings?.prediction_id === state.currentGeneration?.prediction_id
        );
        
        if (currentMusic) {
          await updateMusicRecord(currentMusic.id, {
            status: 'cancelled'
          });
        }
      }
      
      // Reset state
      setState(prev => ({
        ...prev,
        currentGeneration: null,
        isGenerating: false,
        error: null,
      }));
      
      toast.info('Music generation cancelled');
      
    } catch (error) {
      console.error('Failed to cancel generation:', error);
      toast.error('Failed to cancel generation');
    }
  }, [user?.id, state.currentGeneration]);

  // Update music duration with actual audio duration
  const updateMusicDuration = useCallback(async (musicId: string, actualDurationSeconds: number) => {
    try {
      console.log(`🎵 Updating duration for ${musicId} to ${actualDurationSeconds}s`);
      
      // Update local state immediately
      setState(prev => ({
        ...prev,
        generatedMusic: prev.generatedMusic.map(music => 
          music.id === musicId 
            ? { ...music, duration: actualDurationSeconds }
            : music
        ),
        musicHistory: prev.musicHistory.map(music => 
          music.id === musicId 
            ? { ...music, duration_seconds: actualDurationSeconds }
            : music
        ),
      }));
      
      // Update database in background
      const { updateMusicRecord } = await import('@/actions/database/music-database');
      await updateMusicRecord(musicId, {
        duration_seconds: actualDurationSeconds
      });
      
      console.log(`✅ Duration updated for ${musicId}`);
    } catch (error) {
      console.error('❌ Failed to update music duration:', error);
    }
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
    cancelGeneration,
    updateMusicDuration,
    setState,
  };
}