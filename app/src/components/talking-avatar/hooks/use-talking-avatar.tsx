'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { executeTalkingAvatar, TalkingAvatarRequest, AvatarTemplate, VoiceOption } from '@/actions/tools/talking-avatar';
import { getAvatarTemplates, getTalkingAvatarVideos, deleteTalkingAvatarVideo } from '@/actions/database/talking-avatar-database';
import type { TalkingAvatarVideo } from '@/actions/database/talking-avatar-database';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface TalkingAvatarState {
  // Current step in wizard (1: Avatar Selection, 2: Voice Generation, 3: Video Generation)
  currentStep: number;
  totalSteps: number;
  
  // Avatar Selection (Step 1)
  avatarTemplates: AvatarTemplate[];
  selectedAvatarTemplate: AvatarTemplate | null;
  customAvatarImage: File | null;
  customAvatarUrl: string | null;
  
  // Voice Generation (Step 2)
  scriptText: string;
  voiceOptions: VoiceOption[];
  selectedVoiceId: string | null;
  voiceAudioUrl: string | null;
  estimatedDuration: number;
  
  // Video Generation (Step 3)
  isGenerating: boolean;
  generatedVideo: { id: string; video_url: string; thumbnail_url?: string; script_text: string; avatar_image_url: string; created_at: string; } | null;
  
  // General state
  isLoading: boolean;
  error: string | null;
  credits: number;
  estimatedCredits: number;

  // History state
  videos: TalkingAvatarVideo[];
  isLoadingHistory: boolean;
  
  // Polling state
  currentGenerationId: string | null;
  isPolling: boolean;
  isStateRestored: boolean; // New: indicates if state was restored from ongoing generation
  pollingStartTime: number | null; // Track when polling started
  showManualCheck: boolean; // Show manual check button after timeout
  isManuallyChecking: boolean; // Track manual check state
}

export interface UseTalkingAvatarReturn {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  state: TalkingAvatarState;
  loadAvatarTemplates: () => Promise<void>;
  handleAvatarSelection: (template: AvatarTemplate | null, customFile?: File) => Promise<void>;
  handleVoiceGeneration: (voiceId: string, scriptText: string) => Promise<{ success: boolean; voiceAudioUrl?: string }>;
  handleVideoGeneration: () => Promise<void>;
  resetWizard: () => void;
  goToStep: (step: number) => void;
  clearVoice: () => void;
  clearResults: () => void;
  loadHistory: () => Promise<void>;
  deleteVideo: (videoId: string) => Promise<boolean>;
  checkStatusManually: () => Promise<void>;
}

export function useTalkingAvatar(): UseTalkingAvatarReturn {
  const pathname = usePathname();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentGenerationIdRef = useRef<string | null>(null);
  const generatedVideoRef = useRef<TalkingAvatarState['generatedVideo']>(null);
  const pollingStartTimeRef = useRef<number | null>(null);
  
  const getActiveTabFromPath = useCallback(() => {
    if (pathname.includes('/history')) return 'history';
    return 'generate';
  }, [pathname]);

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const supabase = createClient();
  
  const [state, setState] = useState<TalkingAvatarState>({
    currentStep: 1,
    totalSteps: 3,
    avatarTemplates: [],
    selectedAvatarTemplate: null,
    customAvatarImage: null,
    customAvatarUrl: null,
    scriptText: '',
    voiceOptions: [],
    selectedVoiceId: null,
    voiceAudioUrl: null,
    estimatedDuration: 0,
    isGenerating: false,
    generatedVideo: null,
    isLoading: false,
    error: null,
    credits: 0,
    estimatedCredits: 6, // Base cost for avatar video
    videos: [],
    isLoadingHistory: false,
    currentGenerationId: null,
    isPolling: false,
    isStateRestored: false,
    pollingStartTime: null,
    showManualCheck: false,
    isManuallyChecking: false,
  });

  // Update active tab when pathname changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [pathname, getActiveTabFromPath]);

  // Update refs when state changes (to avoid subscription re-creation)
  useEffect(() => {
    currentGenerationIdRef.current = state.currentGenerationId;
  }, [state.currentGenerationId]);

  useEffect(() => {
    generatedVideoRef.current = state.generatedVideo;
  }, [state.generatedVideo]);

  useEffect(() => {
    pollingStartTimeRef.current = state.pollingStartTime;
  }, [state.pollingStartTime]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

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
      console.error('Failed to load avatar templates:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load avatar templates',
        isLoading: false 
      }));
      toast.error('Failed to load avatar templates');
    }
  }, [state.avatarTemplates.length]);

  // Step 1: Handle avatar selection
  const handleAvatarSelection = useCallback(async (template: AvatarTemplate | null, customImage?: File) => {
    if (!user) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const request: TalkingAvatarRequest = {
        script_text: state.scriptText,
        avatar_template_id: template?.id,
        avatar_image_url: template?.thumbnail_url,
        custom_avatar_image: customImage || null,
        workflow_step: 'avatar_select',
        user_id: user.id,
      };

      const response = await executeTalkingAvatar(request);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          selectedAvatarTemplate: template || null,
          customAvatarImage: customImage || null,
          customAvatarUrl: response.step_data?.avatar_preview_url || null,
          credits: response.remaining_credits,
          isLoading: false,
        }));
        
        toast.success('Avatar selected successfully');
      } else {
        throw new Error(response.error || 'Avatar selection failed');
      }
    } catch (error) {
      console.error('Avatar selection error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Avatar selection failed',
        isLoading: false 
      }));
      toast.error('Avatar selection failed');
    }
  }, [user, state.scriptText]);

  // Step 2: Handle voice generation
  const handleVoiceGeneration = useCallback(async (voiceId: string, scriptText: string): Promise<{ success: boolean; voiceAudioUrl?: string }> => {
    if (!user) return { success: false };
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const request: TalkingAvatarRequest = {
        script_text: scriptText,
        voice_id: voiceId,
        avatar_image_url: state.customAvatarUrl || state.selectedAvatarTemplate?.thumbnail_url,
        workflow_step: 'voice_generate',
        user_id: user.id,
      };

      const response = await executeTalkingAvatar(request);
      
      if (response.success) {
        const voiceAudioUrl = response.step_data?.voice_audio_url || null;
        
        setState(prev => ({
          ...prev,
          scriptText,
          selectedVoiceId: voiceId,
          voiceOptions: response.voice_options || prev.voiceOptions,
          voiceAudioUrl,
          estimatedDuration: response.step_data?.estimated_duration || 0,
          currentStep: 2,
          credits: response.remaining_credits,
          isLoading: false,
        }));
        
        toast.success('Voice generated successfully');
        return { success: true, voiceAudioUrl: voiceAudioUrl || undefined };
      } else {
        throw new Error(response.error || 'Voice generation failed');
      }
    } catch (error) {
      console.error('Voice generation error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Voice generation failed',
        isLoading: false 
      }));
      toast.error('Voice generation failed');
      return { success: false };
    }
  }, [user, state.customAvatarUrl, state.selectedAvatarTemplate]);

  // Step 3: Handle video generation
  const handleVideoGeneration = useCallback(async () => {
    if (!user || !state.selectedVoiceId || !state.scriptText) return;
    
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    // Create immediate placeholder result to show video preview (matching AI cinematographer pattern)
    const batch_id = crypto.randomUUID();
    const placeholderVideo = {
      id: batch_id,
      video_url: '', // Empty until completed
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
        voice_id: state.selectedVoiceId,
        voice_audio_url: state.voiceAudioUrl,
        avatar_image_url: state.customAvatarUrl || state.selectedAvatarTemplate?.thumbnail_url,
        workflow_step: 'video_generate',
        user_id: user.id,
      };

      const response = await executeTalkingAvatar(request);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          generatedVideo: response.video || placeholderVideo,
          credits: response.remaining_credits,
          currentGenerationId: response.prediction_id || null,
          isPolling: true,
          pollingStartTime: Date.now(), // Track when polling started
          showManualCheck: false,
        }));
        
        // Start polling for video completion
        if (response.prediction_id) {
          startPolling(response.prediction_id);
        }
        
        toast.success('Video generation started! Check your history for updates.');
      } else {
        throw new Error(response.error || 'Video generation failed');
      }
    } catch (error) {
      console.error('Video generation error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Video generation failed',
        isGenerating: false 
      }));
      toast.error('Video generation failed');
    }
  }, [user, state.selectedVoiceId, state.scriptText, state.customAvatarUrl, state.selectedAvatarTemplate]);

  // Reset to step 1
  const resetWizard = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 1,
      selectedAvatarTemplate: null,
      customAvatarImage: null,
      customAvatarUrl: null,
      scriptText: '',
      selectedVoiceId: null,
      voiceAudioUrl: null,
      generatedVideo: null,
      error: null,
    }));
  }, []);

  // Navigate between steps
  const goToStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  // Clear voice to allow regeneration
  const clearVoice = useCallback(() => {
    setState(prev => ({
      ...prev,
      voiceAudioUrl: null,
      selectedVoiceId: null,
      estimatedDuration: 0,
    }));
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      generatedVideo: null,
      error: null,
      isStateRestored: false,
      isGenerating: false,
      currentGenerationId: null,
      isPolling: false,
      pollingStartTime: null,
      showManualCheck: false,
      isManuallyChecking: false,
    }));
    
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Load video history
  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    
    setState(prev => ({ ...prev, isLoadingHistory: true }));
    try {
      const { videos: historyVideos } = await getTalkingAvatarVideos(user.id);
      setState(prev => ({ ...prev, videos: historyVideos, isLoadingHistory: false }));
    } catch (err) {
      console.error('Failed to load video history:', err);
      setState(prev => ({ ...prev, isLoadingHistory: false }));
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
        
        console.log(`✅ Successfully deleted video: ${videoId}`);
        return true;
      } else {
        setState(prev => ({ ...prev, error: 'Failed to delete video' }));
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete video';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [user?.id]);

  // Manual status check function
  const checkStatusManually = useCallback(async () => {
    if (!state.currentGenerationId || !user?.id) return;
    
    setState(prev => ({ ...prev, isManuallyChecking: true }));
    
    try {
      console.log(`[TalkingAvatar] Manual status check for generation: ${state.currentGenerationId}`);
      
      // Call the webhook endpoint directly for status check
      const response = await fetch(`/api/webhooks/hedra-ai?generation_id=${state.currentGenerationId}&user_id=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[TalkingAvatar] Manual status check result:', result);
        
        if (result.status === 'complete' && result.video_url) {
          // Update state with completed video
          setState(prev => ({
            ...prev,
            generatedVideo: {
              id: prev.generatedVideo?.id || state.currentGenerationId!,
              video_url: result.video_url,
              thumbnail_url: '',
              script_text: prev.generatedVideo?.script_text || '',
              avatar_image_url: prev.generatedVideo?.avatar_image_url || '',
              created_at: prev.generatedVideo?.created_at || new Date().toISOString(),
            },
            isPolling: false,
            isGenerating: false,
            currentGenerationId: null,
            showManualCheck: false,
            isManuallyChecking: false,
            pollingStartTime: null,
            error: null,
          }));
          
          // Stop any existing polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          toast.success('Video generation completed!');
          await loadHistory();
          
        } else if (result.status === 'error') {
          setState(prev => ({
            ...prev,
            error: result.error || 'Video generation failed',
            isPolling: false,
            isGenerating: false,
            currentGenerationId: null,
            showManualCheck: false,
            isManuallyChecking: false,
            pollingStartTime: null,
          }));
          
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          toast.error('Video generation failed');
        } else {
          setState(prev => ({ ...prev, isManuallyChecking: false }));
          toast.info(`Video is still processing... Status: ${result.status}`);
        }
      } else {
        throw new Error(`Status check failed: ${response.status}`);
      }
    } catch (error) {
      console.error('[TalkingAvatar] Manual status check failed:', error);
      setState(prev => ({ 
        ...prev, 
        isManuallyChecking: false,
        error: 'Manual status check failed'
      }));
      toast.error('Manual status check failed');
    }
  }, [state.currentGenerationId, user?.id, loadHistory]);

  // Start polling for video generation status
  const startPolling = useCallback((generationId: string) => {
    console.log(`[TalkingAvatar] Starting polling for generation: ${generationId}`);
    
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Start polling every 5 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        if (!user?.id) {
          console.error('[TalkingAvatar] No user found during polling');
          return;
        }

        // Check if we should stop polling and show manual check (after 4 minutes)
        const pollingDuration = Date.now() - (pollingStartTimeRef.current || 0);
        const timeoutThreshold = 4 * 60 * 1000; // 4 minutes
        
        if (pollingDuration > timeoutThreshold) {
          console.log(`[TalkingAvatar] Polling timeout reached after ${Math.round(pollingDuration / 60000)} minutes`);
          
          // Stop polling and show manual check option
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          setState(prev => ({
            ...prev,
            isPolling: false,
            showManualCheck: true,
          }));
          
          toast.info('Video is taking longer than expected. You can manually check the status.');
          return;
        }

        console.log(`[TalkingAvatar] Polling for generation: ${generationId} (${Math.round(pollingDuration / 1000)}s elapsed)`);
        
        // Check avatar_videos table for completed video
        const { data: videos, error } = await supabase
          .from('avatar_videos')
          .select('*')
          .eq('hedra_generation_id', generationId)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('[TalkingAvatar] Error during polling:', error);
          return;
        }

        const video = videos?.[0];
        if (!video) {
          console.log('[TalkingAvatar] No video record found yet, continuing polling...');
          return;
        }

        console.log('[TalkingAvatar] Video status:', video.status);

        // Check if video is completed
        if (video.status === 'completed' && video.video_url) {
          console.log('[TalkingAvatar] Video completed!', video.video_url);
          
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Update state with completed video
          setState(prev => ({
            ...prev,
            generatedVideo: {
              id: video.id,
              video_url: video.video_url,
              thumbnail_url: video.thumbnail_url,
              script_text: video.script_text,
              avatar_image_url: video.avatar_image_url || '',
              created_at: video.created_at || new Date().toISOString(),
            },
            isPolling: false,
            currentGenerationId: null,
          }));

          // Refresh history to show the new video
          await loadHistory();
          
          toast.success('Video generation completed!');
          
        } else if (video.status === 'failed') {
          console.log('[TalkingAvatar] Video generation failed');
          
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setState(prev => ({
            ...prev,
            error: 'Video generation failed',
            isPolling: false,
            currentGenerationId: null,
          }));

          toast.error('Video generation failed');
        }
        // Otherwise continue polling
        
      } catch (pollingError) {
        console.error('[TalkingAvatar] Polling error:', pollingError);
      }
    }, 5000); // Poll every 5 seconds (matching AI cinematographer pattern)
  }, [user?.id, supabase, loadHistory]);

  // Load initial history and restore any ongoing generations
  useEffect(() => {
    if (user?.id) {
      loadHistory();
      
      // Check for ongoing video generations and restore state
      const checkOngoingGenerations = async () => {
        try {
          const { data: videos, error } = await supabase
            .from('avatar_videos')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Error checking ongoing generations:', error);
            return;
          }

          console.log('🔍 All videos from database:', videos?.map(v => ({ 
            id: v.id, 
            status: v.status, 
            created: v.created_at,
            video_url: !!v.video_url 
          })));
          
          // Only consider recent videos (within last 30 minutes) to avoid old stuck records
          // Also require hedra_generation_id to be present for valid resumption
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          const processingVideo = videos?.find(v => {
            const isProcessingStatus = v.status === 'processing' || v.status === 'pending';
            const isRecent = new Date(v.created_at || '') > thirtyMinutesAgo;
            const hasValidGenerationId = v.hedra_generation_id && v.hedra_generation_id.trim();
            
            // On localhost, don't resume processing videos since webhooks won't work
            const isLocalhost = typeof window !== 'undefined' && (
              window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1' ||
              window.location.hostname.includes('gitpod') ||
              window.location.hostname.includes('codespaces')
            );
            
            if (isLocalhost && isProcessingStatus) {
              console.log('🚫 Skipping state restoration on localhost environment');
              return false;
            }
            
            return isProcessingStatus && isRecent && hasValidGenerationId;
          });
          
          if (processingVideo) {
            console.log('🔄 Restoring processing state for video:', processingVideo.id, 'status:', processingVideo.status);
            
            // Restore processing state - estimate how long it's been processing
            const videoCreatedAt = new Date(processingVideo.created_at || '').getTime();
            const estimatedPollingStartTime = videoCreatedAt || Date.now();
            
            setState(prev => ({
              ...prev,
              isGenerating: true,
              error: null,
              generatedVideo: {
                id: processingVideo.id,
                video_url: processingVideo.video_url || '', // Empty until completed
                thumbnail_url: processingVideo.thumbnail_url || '',
                script_text: processingVideo.script_text || '',
                avatar_image_url: processingVideo.avatar_image_url || '',
                created_at: processingVideo.created_at || new Date().toISOString()
              },
              currentGenerationId: processingVideo.hedra_generation_id || null,
              isPolling: true,
              isStateRestored: true,
              currentStep: 3,
              pollingStartTime: estimatedPollingStartTime,
              showManualCheck: false,
            }));
            
            // Start polling if we have a generation ID
            if (processingVideo.hedra_generation_id) {
              startPolling(processingVideo.hedra_generation_id);
            }
            
            console.log('✅ Processing state restored - user will see "Video processing..." until completion');
          } else {
            console.log('💡 No ongoing generations found - user is in normal state');
            
            // Clean up any stuck processing records without hedra_generation_id
            const stuckRecords = videos?.filter(v => {
              const isProcessingStatus = v.status === 'processing' || v.status === 'pending';
              const hasNoGenerationId = !v.hedra_generation_id || !v.hedra_generation_id.trim();
              return isProcessingStatus && hasNoGenerationId;
            });
            
            if (stuckRecords && stuckRecords.length > 0) {
              console.log('🧹 Found stuck processing records without generation ID, marking as failed:', 
                stuckRecords.map(r => r.id));
              
              // Mark stuck records as failed in the background
              stuckRecords.forEach(async (record) => {
                try {
                  await supabase
                    .from('avatar_videos')
                    .update({ status: 'failed' })
                    .eq('id', record.id);
                  console.log('✅ Marked stuck record as failed:', record.id);
                } catch (error) {
                  console.error('❌ Failed to update stuck record:', error);
                }
              });
            }
            
            // Ensure we're not in a stuck generating state
            setState(prev => {
              if (prev.isGenerating && !prev.currentGenerationId) {
                console.log('🛠️ Clearing stuck generating state');
                return {
                  ...prev,
                  isGenerating: false,
                  generatedVideo: null,
                  isStateRestored: false,
                  isPolling: false,
                };
              }
              return prev;
            });
          }
        } catch (error) {
          console.error('Error checking ongoing generations:', error);
        }
      };
      
      checkOngoingGenerations();
    }
  }, [user?.id, loadHistory, supabase, startPolling]);

  // Subscribe to real-time updates for video status (matching AI cinematographer pattern)
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔔 Setting up real-time subscription for user:', user.id);

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
          console.log('🔔 Real-time update received:', {
            event: payload.eventType,
            old: payload.old,
            new: payload.new
          });

          const updatedVideo = payload.new as TalkingAvatarVideo;
          
          // Update current result if it matches the current generation
          const currentGenerationId = currentGenerationIdRef.current;
          const currentVideo = generatedVideoRef.current;
          
          if (currentGenerationId && updatedVideo?.hedra_generation_id === currentGenerationId) {
            console.log('📺 Updating current video result:', {
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
                avatar_image_url: updatedVideo.avatar_image_url || '',
                created_at: updatedVideo.created_at || new Date().toISOString()
              }
            }));
            
            // CRITICAL: Set isGenerating to false when video generation is complete
            if (updatedVideo.status === 'completed' || updatedVideo.status === 'failed') {
              console.log('✅ Video generation completed, stopping loading state');
              
              // Stop polling
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              
              setState(prev => ({
                ...prev,
                isGenerating: false,
                isPolling: false,
                isStateRestored: false, // Clear restored state flag
                currentGenerationId: null,
                pollingStartTime: null,
                showManualCheck: false,
                isManuallyChecking: false,
              }));
              
              // Clear any existing error if the video succeeded
              if (updatedVideo.status === 'completed' && updatedVideo.video_url) {
                setState(prev => ({ ...prev, error: null }));
                toast.success('Video generation completed!');
              } else if (updatedVideo.status === 'failed') {
                setState(prev => ({ ...prev, error: 'Video generation failed' }));
                toast.error('Video generation failed');
              }
            }
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
        console.log('🔔 Subscription status:', status);
      });

    return () => {
      console.log('🔔 Unsubscribing from real-time updates');
      subscription.unsubscribe();
    };
  }, [user?.id, supabase]); // Use refs to avoid re-subscription

  return {
    activeTab,
    setActiveTab,
    state,
    loadAvatarTemplates,
    handleAvatarSelection,
    handleVoiceGeneration,
    handleVideoGeneration,
    resetWizard,
    goToStep,
    clearVoice,
    clearResults,
    loadHistory,
    deleteVideo,
    checkStatusManually,
  };
}