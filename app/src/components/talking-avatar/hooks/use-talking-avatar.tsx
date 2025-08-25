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
}

export interface UseTalkingAvatarReturn {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  state: TalkingAvatarState;
  loadAvatarTemplates: () => Promise<void>;
  handleAvatarSelection: (template: AvatarTemplate | null, customFile?: File) => Promise<void>;
  handleVoiceGeneration: (voiceId: string, scriptText: string) => Promise<{ success: boolean; voiceAudioUrl?: string }>;
  handleVideoGeneration: (aspectRatio?: '16:9' | '9:16') => Promise<void>;
  resetWizard: () => void;
  goToStep: (step: number) => void;
  clearVoice: () => void;
  clearResults: () => void;
  loadHistory: () => Promise<void>;
  deleteVideo: (videoId: string) => Promise<boolean>;
  checkHistoryItemStatus: (generationId: string) => Promise<void>;
}

export function useTalkingAvatar(): UseTalkingAvatarReturn {
  const pathname = usePathname();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentGenerationIdRef = useRef<string | null>(null);
  const generatedVideoRef = useRef<TalkingAvatarState['generatedVideo']>(null);
  const pollingStartTimeRef = useRef<number | null>(null);
  const hasAttemptedRestorationRef = useRef<boolean>(false);
  
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
      // Avatar selection failed silently
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
        avatar_template_id: state.selectedAvatarTemplate?.id,
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
      // Voice generation failed silently
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
  const handleVideoGeneration = useCallback(async (aspectRatio: '16:9' | '9:16' = '16:9') => {
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
        avatar_template_id: state.selectedAvatarTemplate?.id,
        workflow_step: 'video_generate',
        user_id: user.id,
        aspect_ratio: aspectRatio,
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
        }));
        
        // Start polling for video completion
        if (response.prediction_id) {
          // Starting polling for prediction
          startPolling(response.prediction_id);
        } else {
          // No prediction_id returned from API
        }
        
        toast.success('Video generation started! Check your history for updates.');
      } else {
        throw new Error(response.error || 'Video generation failed');
      }
    } catch (error) {
      // Video generation failed silently
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
      // Video history loading failed silently
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
        
        // Video deleted successfully
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


  // Start polling for video generation status
  const startPolling = useCallback((generationId: string) => {
    // Starting polling for generation
    // Polling start time set
    
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      // Cleared existing polling interval
    }

    // Start polling every 5 seconds
    pollingIntervalRef.current = setInterval(async () => {
      // Polling tick - checking generation status
      
      try {
        if (!user?.id) {
          // No user found during polling
          return;
        }

        // Check if we should stop polling after timeout (5 minutes)
        const pollingDuration = Date.now() - (pollingStartTimeRef.current || 0);
        const timeoutThreshold = 5 * 60 * 1000; // 5 minutes
        
        if (pollingDuration > timeoutThreshold) {
          // Polling timeout reached
          
          // Stop polling after timeout
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          setState(prev => ({
            ...prev,
            isPolling: false,
            error: 'Video generation timed out. Please try again.',
          }));
          
          toast.error('Video generation timed out. Please try again.');
          return;
        }

        // Polling in progress
        
        // Check avatar_videos table for completed video
        const { data: videos, error } = await supabase
          .from('avatar_videos')
          .select('*')
          .eq('hedra_generation_id', generationId)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) {
          // Polling error occurred
          return;
        }

        let video = videos?.[0];
        if (!video) {
          // No video record found yet, continuing polling
          return;
        }

        // Video status checked

        // If still processing, check Hedra API directly
        if (video.status === 'processing') {
          // Still processing, checking Hedra API
          
          // Call the webhook endpoint to check Hedra status
          try {
            const response = await fetch(`/api/webhooks/hedra-ai`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                generation_id: generationId,
                user_id: user.id,
                avatar_video_id: video.id,
                action: 'check_status'
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              // Hedra API check completed
              
              // Re-fetch from database after webhook update
              const { data: updatedVideo } = await supabase
                .from('avatar_videos')
                .select('*')
                .eq('hedra_generation_id', generationId)
                .eq('user_id', user.id)
                .single();
                
              if (updatedVideo) {
                video = updatedVideo;
                // Updated video status after Hedra check
              }
            }
          } catch (error) {
            // Failed to check Hedra API
          }
        }

        // Check if video is completed
        if (video.status === 'completed' && video.video_url) {
          // Video completed successfully
          
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
            isGenerating: false, // Important: stop the loading state
            currentGenerationId: null,
            currentStep: 3, // Keep UI on step 3 to show the completed video
            error: null, // Clear any errors
          }));

          // Refresh history to show the new video
          await loadHistory();
          
          toast.success('Video generation completed!');
          
        } else if (video.status === 'failed') {
          // Video generation failed
          
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
        // Polling error occurred
      }
    }, 5000); // Poll every 5 seconds (matching AI cinematographer pattern)
  }, [user?.id, supabase, loadHistory, state.currentGenerationId, state.isPolling]);

  // Removed duplicate effect-based polling - all polling handled by startPolling function
  // This was causing conflicts and could stop polling prematurely

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
          
          // Only consider very recent videos (within last 2 minutes) since Hedra videos expire quickly
          // Also require hedra_generation_id to be present for valid resumption
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
          const processingVideo = videos?.find(v => {
            const isProcessingStatus = v.status === 'processing' || v.status === 'pending';
            const isRecent = new Date(v.created_at || '') > twoMinutesAgo;
            const hasValidGenerationId = v.hedra_generation_id && v.hedra_generation_id.trim();
            
            // Resume processing videos with frontend polling (works in all environments)
            
            return isProcessingStatus && isRecent && hasValidGenerationId;
          });
          
          if (processingVideo) {
            // Found processing video
            
            // Only restore if we're not already in a generating state (true restoration)
            if (!state.isGenerating && !state.currentGenerationId) {
              // Restoring processing state for video
              
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
                isStateRestored: true, // Only set when truly restoring
                currentStep: 3,
                pollingStartTime: estimatedPollingStartTime,
              }));
            } else {
              // Skipping restoration - already generating
            }
            
            // Start polling if we have a generation ID
            if (processingVideo.hedra_generation_id) {
              startPolling(processingVideo.hedra_generation_id);
            }
            
            // Processing state restored
          } else {
            // No ongoing generations found
            
            // Clean up any stuck processing records without hedra_generation_id
            const stuckRecords = videos?.filter(v => {
              const isProcessingStatus = v.status === 'processing' || v.status === 'pending';
              const hasNoGenerationId = !v.hedra_generation_id || !v.hedra_generation_id.trim();
              return isProcessingStatus && hasNoGenerationId;
            });
            
            if (stuckRecords && stuckRecords.length > 0) {
              // Found stuck processing records
              
              // Mark stuck records as failed in the background
              stuckRecords.forEach(async (record) => {
                try {
                  await supabase
                    .from('avatar_videos')
                    .update({ status: 'failed' })
                    .eq('id', record.id);
                  // Marked stuck record as failed
                } catch (error) {
                  // Failed to update stuck record
                }
              });
            }
            
            // Ensure we're not in a stuck generating state
            setState(prev => {
              if (prev.isGenerating && !prev.currentGenerationId) {
                // Clearing stuck generating state
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
          // Error checking ongoing generations
        }
      };
      
      checkOngoingGenerations();
    }
  }, [user?.id, loadHistory, supabase]);

  // Subscribe to real-time updates for video status (matching AI cinematographer pattern)
  useEffect(() => {
    if (!user?.id) return;

    // Setting up real-time subscription

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
          // Real-time update received

          const updatedVideo = payload.new as TalkingAvatarVideo;
          
          // Update current result if it matches the current generation
          const currentGenerationId = currentGenerationIdRef.current;
          const currentVideo = generatedVideoRef.current;
          
          if (currentGenerationId && updatedVideo?.hedra_generation_id === currentGenerationId) {
            // Updating current video result

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
              // Video generation completed
              
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
        // Subscription status changed
      });

    return () => {
      // Unsubscribing from real-time updates
      subscription.unsubscribe();
    };
  }, [user?.id, supabase]); // Use refs to avoid re-subscription

  // Check status for a specific history item
  const checkHistoryItemStatus = useCallback(async (generationId: string) => {
    if (!generationId) return;

    // Checking status for history item
    
    try {
      const response = await fetch(`/api/webhooks/hedra-ai?generation_id=${generationId}&user_id=${user?.id}`);
      const result = await response.json();
      
      if (result.success) {
        toast.success('Status checked successfully');
        // Refresh history to show updated status
        await loadHistory();
      } else {
        toast.error(result.error || 'Failed to check status');
      }
    } catch (error) {
      // Error checking history item status
      toast.error('Failed to check status');
    }
  }, [user?.id, loadHistory]);

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
    checkHistoryItemStatus,
  };
}