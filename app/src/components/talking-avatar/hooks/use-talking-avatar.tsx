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
  
  // Generation state
  currentGenerationId: string | null;
  isStateRestored: boolean; // New: indicates if state was restored from ongoing generation
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
  const currentGenerationIdRef = useRef<string | null>(null);
  const generatedVideoRef = useRef<TalkingAvatarState['generatedVideo']>(null);
  const hasAttemptedRestorationRef = useRef<boolean>(false);
  
  // Frontend polling refs for Hedra completion detection
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    isStateRestored: false,
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

      // Create immediate placeholder result to show processing UI
      const placeholderVideo = {
        id: `talking_avatar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        video_url: '', // Empty until completed
        thumbnail_url: '',
        script_text: state.scriptText,
        avatar_image_url: state.selectedAvatarTemplate?.thumbnail_url || state.customAvatarUrl || '',
        created_at: new Date().toISOString()
      };

      setState(prev => ({
        ...prev,
        generatedVideo: placeholderVideo,
        isGenerating: true,
        error: null
      }));

      const response = await executeTalkingAvatar(request);
      
      if (response.success) {
        // Update the placeholder with real data
        setState(prev => ({
          ...prev,
          generatedVideo: {
            ...placeholderVideo,
            id: response.video?.id || placeholderVideo.id,
            video_url: response.video?.video_url || '', // Still empty until real-time update
            thumbnail_url: response.video?.thumbnail_url || placeholderVideo.thumbnail_url,
            script_text: response.video?.script_text || placeholderVideo.script_text,
            avatar_image_url: response.video?.avatar_image_url || placeholderVideo.avatar_image_url,
            created_at: response.video?.created_at || placeholderVideo.created_at
          },
          credits: response.remaining_credits,
          currentGenerationId: response.prediction_id || null,
        }));
        
        // Start frontend polling after 30 seconds for Hedra completion detection
        // Since Hedra doesn't have webhooks, we need to poll their API
        setTimeout(() => {
          startHedraPolling(response.prediction_id || placeholderVideo.id);
        }, 30000); // Wait 30 seconds before starting to poll
        
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


  // Pure real-time architecture - no polling needed

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
            
            // Resume processing videos with real-time updates
            
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
                isStateRestored: true, // Only set when truly restoring
                currentStep: 3,
              }));
              
              // Resume polling for the restored generation (without initial 30s delay since generation is already in progress)
              if (processingVideo.hedra_generation_id) {
                console.log('🔄 Resuming Hedra polling for restored generation:', processingVideo.hedra_generation_id);
                setTimeout(() => {
                  startHedraPolling(processingVideo.hedra_generation_id);
                }, 2000); // Short delay to let UI update first
              }
            } else {
              // Skipping restoration - already generating
            }
            
            // Pure real-time updates will handle completion automatically
            
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
          const currentGenerationId = currentGenerationIdRef.current;
          const currentVideo = generatedVideoRef.current;
          const isCurrentGeneration = currentGenerationId && updatedVideo?.hedra_generation_id === currentGenerationId;

          console.log('🔍 Talking Avatar real-time matching check:', {
            hasCurrentGenerationId: !!currentGenerationId,
            currentGenerationId,
            updatedVideoGenerationId: updatedVideo?.hedra_generation_id,
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
                avatar_image_url: updatedVideo.avatar_image_url || '',
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
    };
  }, [stopHedraPolling]);

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