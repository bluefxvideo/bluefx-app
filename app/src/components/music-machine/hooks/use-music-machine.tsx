'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { executeMusicMachine, MusicMachineRequest } from '@/actions/tools/music-machine';
import { getMusicHistory, deleteGeneratedMusic, GeneratedMusic } from '@/actions/database/music-database';
import { pollMusicGeneration } from '@/actions/models/fal-minimax-music';
import { MUSIC_CREDITS, MusicMode, INSTRUMENTAL_LYRICS } from '@/types/music-machine';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface MusicMachineState {
  // Generation settings
  prompt: string;
  lyrics: string;
  mode: MusicMode;

  // Generated results
  generatedMusic: GeneratedMusic[];
  currentGeneration: {
    id: string;
    request_id: string;
    prompt: string;
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
  updateLyrics: (lyrics: string) => void;
  setMode: (mode: MusicMode) => void;
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
    lyrics: '',
    mode: 'vocals',
    generatedMusic: [],
    currentGeneration: null,
    musicHistory: [],
    isGenerating: false,
    isLoading: false,
    error: null,
    credits: 0,
    estimatedCredits: MUSIC_CREDITS,
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

  // State restoration for seamless navigation
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
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentPredictions && recentPredictions.length > 0) {
          const music = recentPredictions[0];
          const generationSettings = music.generation_settings as any;

          console.log('🔄 Restoring music generation state:', music.track_title);

          setState(prev => ({
            ...prev,
            isGenerating: true,
            currentGeneration: {
              id: music.id,
              request_id: generationSettings?.prediction_id || '',
              prompt: music.track_title,
              status: music.status,
              created_at: music.created_at
            },
            prompt: music.track_title
          }));
        }
      } catch (error) {
        console.error('State restoration error:', error);
      }
    };

    const timeoutId = setTimeout(checkOngoingGenerations, 1000);
    return () => clearTimeout(timeoutId);
  }, [user?.id, supabase]);

  // Load music history
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

  // Real-time subscription for webhook updates
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

  // Handle webhook updates
  const handleWebhookUpdate = useCallback(async (message: any) => {
    console.log('🎵 Processing webhook update:', message);

    if (message.tool_type !== 'music-machine') {
      return;
    }

    if (state.currentGeneration?.request_id && message.prediction_id !== state.currentGeneration.request_id) {
      return;
    }

    if (message.status === 'succeeded' && message.results?.success) {
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

          setState(prev => ({
            ...prev,
            isGenerating: false,
            generatedMusic: [musicRecord] as GeneratedMusic[],
            musicHistory: [musicRecord, ...prev.musicHistory.filter(m => m.id !== musicRecord.id)],
            currentGeneration: null,
            error: null,
          }));

          // Preload audio to get real duration
          const audio = new Audio(musicRecord.audio_url);
          audio.addEventListener('loadedmetadata', () => {
            if (audio.duration && isFinite(audio.duration)) {
              const actualDuration = Math.round(audio.duration);
              console.log(`🎵 Preloaded duration detected: ${actualDuration}s`);

              setState(prev => ({
                ...prev,
                generatedMusic: prev.generatedMusic.map(music =>
                  music.id === musicRecord.id
                    ? { ...music, duration: actualDuration }
                    : music
                ),
              }));

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
        generatedMusic: [],
        currentGeneration: null,
      }));

      toast.error(message.results?.error || 'Music generation failed');
    }
  }, [supabase, state.currentGeneration?.request_id]);

  // Backup postgres subscription for database changes
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
          if (!state.currentGeneration ||
              newMusic.generation_settings?.prediction_id !== state.currentGeneration.request_id) {
            setState(prev => ({
              ...prev,
              musicHistory: [newMusic, ...prev.musicHistory.filter(m => m.id !== newMusic.id)],
            }));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [user?.id, supabase, state.currentGeneration?.request_id]);

  // Polling fallback for local development (webhooks can't reach localhost)
  // In production, webhooks handle completion - no polling needed
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  useEffect(() => {
    // Only poll in local development - production uses webhooks
    if (!isLocalDev) {
      return;
    }

    // Only poll if we're generating and have a request_id
    if (!state.isGenerating || !state.currentGeneration?.request_id) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const requestId = state.currentGeneration.request_id;
    console.log(`🔄 [DEV] Starting polling for music generation: ${requestId}`);

    // Poll every 5 seconds
    const pollInterval = setInterval(async () => {
      try {
        const result = await pollMusicGeneration(requestId);
        console.log(`🔄 Poll result for ${requestId}:`, result.status);

        if (result.status === 'completed' && result.audio_url) {
          console.log(`✅ [DEV] Polling: Music completed! ${result.audio_url}`);

          // Fetch updated music record from database
          const { data: musicRecord } = await supabase
            .from('music_history')
            .select('*')
            .contains('generation_settings', { prediction_id: requestId })
            .single();

          if (musicRecord) {
            setState(prev => ({
              ...prev,
              isGenerating: false,
              generatedMusic: [musicRecord] as GeneratedMusic[],
              musicHistory: [musicRecord, ...prev.musicHistory.filter(m => m.id !== musicRecord.id)],
              currentGeneration: null,
              error: null,
            }));

            toast.success('Music generated successfully!');
          }

          // Stop polling
          clearInterval(pollInterval);
          pollingRef.current = null;
        } else if (result.status === 'failed') {
          console.error(`❌ Polling: Music generation failed:`, result.error);

          setState(prev => ({
            ...prev,
            isGenerating: false,
            error: result.error || 'Music generation failed',
            currentGeneration: null,
          }));

          toast.error(result.error || 'Music generation failed');

          // Stop polling
          clearInterval(pollInterval);
          pollingRef.current = null;
        }
        // For 'pending' or 'processing', continue polling
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    pollingRef.current = pollInterval;

    // Cleanup on unmount or when dependencies change
    return () => {
      clearInterval(pollInterval);
      pollingRef.current = null;
    };
  }, [state.isGenerating, state.currentGeneration?.request_id, supabase]);

  // Generate music
  const generateMusic = useCallback(async () => {
    if (!user || !state.prompt.trim()) return;

    // Validate prompt length
    if (state.prompt.trim().length < 10) {
      toast.error('Prompt must be at least 10 characters');
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const request: MusicMachineRequest = {
        prompt: state.prompt.trim(),
        lyrics: state.lyrics.trim() || undefined,
        mode: state.mode,
        user_id: user.id,
      };

      const response = await executeMusicMachine(request);

      if (response.success) {
        setState(prev => ({
          ...prev,
          currentGeneration: response.generated_music ? {
            id: response.generated_music.id,
            request_id: response.generated_music.request_id,
            prompt: response.generated_music.prompt,
            status: response.generated_music.status,
            created_at: response.generated_music.created_at
          } : null,
          generatedMusic: [], // Will be populated by webhook
          credits: response.remaining_credits,
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
  }, [user, state.prompt, state.lyrics, state.mode]);

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
    if (playingMusicId === musicId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setPlayingMusicId(null);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);
    setPlayingMusicId(musicId);

    audio.addEventListener('ended', () => {
      setCurrentAudio(null);
      setPlayingMusicId(null);
    });

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

  // Update lyrics
  const updateLyrics = useCallback((lyrics: string) => {
    setState(prev => ({ ...prev, lyrics }));
  }, []);

  // Set music mode (instrumental or vocals)
  const setMode = useCallback((mode: MusicMode) => {
    setState(prev => ({
      ...prev,
      mode,
      // Auto-fill lyrics with instrumental formula when switching to instrumental
      // Clear lyrics when switching to vocals mode
      lyrics: mode === 'instrumental' ? INSTRUMENTAL_LYRICS : '',
    }));
  }, []);

  // Clear current generation
  const clearGeneration = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentGeneration: null,
      error: null,
    }));
  }, []);

  // Update music duration with actual audio duration
  const updateMusicDuration = useCallback(async (musicId: string, actualDurationSeconds: number) => {
    try {
      console.log(`🎵 Updating duration for ${musicId} to ${actualDurationSeconds}s`);

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
    updateLyrics,
    setMode,
    clearGeneration,
    updateMusicDuration,
    setState,
  };
}
