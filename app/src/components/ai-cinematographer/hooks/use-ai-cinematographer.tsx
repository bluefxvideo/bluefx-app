'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';
import { executeAICinematographer, generateVideo, CinematographerRequest, CinematographerResponse } from '@/actions/tools/ai-cinematographer';
import { getCinematographerVideos, deleteCinematographerVideo } from '@/actions/database/cinematographer-database';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';

export function useAICinematographer() {
  const { credits } = useCredits(); // Use real credits hook
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CinematographerResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [videos, setVideos] = useState<CinematographerVideo[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isStateRestored, setIsStateRestored] = useState(false);
  
  // Use ref to track current result without causing subscription re-creation
  const resultRef = useRef<CinematographerResponse | undefined>();
  const isGeneratingRef = useRef<boolean>(false);
  
  // Update refs when state changes
  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);
  
  const supabase = createClient();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, [supabase.auth]);
  
  // Load video history
  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingHistory(true);
    try {
      const { videos: historyVideos } = await getCinematographerVideos(user.id);
      setVideos(historyVideos);
    } catch (err) {
      console.error('Failed to load video history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id]);

  // Generate video
  const generateVideo = async (request: CinematographerRequest) => {
    // Authentication check
    if (!user?.id) {
      setError('User must be authenticated to generate videos');
      return;
    }

    setIsGenerating(true);
    setError(undefined);
    setResult(undefined);
    
    try {
      // Try primary export first, fallback to alternative export if server action fails
      let response: CinematographerResponse;
      try {
        response = await executeAICinematographer({
          ...request,
          user_id: user.id,
        });
      } catch (serverActionError) {
        console.warn('Primary server action failed, trying alternative:', serverActionError);
        response = await generateVideo({
          ...request,
          user_id: user.id,
        });
      }
      
      setResult(response);
      
      if (response.success) {
        // Refresh history to show new video
        await loadHistory();
      } else {
        setError(response.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Video generation failed';
      setError(errorMessage);
      setResult({
        success: false,
        error: errorMessage,
        batch_id: `error_${Date.now()}`,
        generation_time_ms: 0,
        credits_used: 0,
        remaining_credits: 0,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Clear results
  const clearResults = () => {
    setResult(undefined);
    setError(undefined);
    setIsStateRestored(false);
    setIsGenerating(false); // Also stop generating state
  };

  // Delete video
  const deleteVideo = useCallback(async (videoId: string) => {
    if (!user?.id) {
      setError('User must be authenticated to delete videos');
      return false;
    }

    try {
      // The existing function returns boolean and throws on error
      const success = await deleteCinematographerVideo(videoId, user.id);
      
      if (success) {
        // Remove from local state
        setVideos(prev => prev.filter(video => video.id !== videoId));
        
        // If this was the current result, clear it
        if (result?.batch_id === videoId) {
          clearResults();
        }
        
        console.log(`✅ Successfully deleted video: ${videoId}`);
        return true;
      } else {
        setError('Failed to delete video');
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete video';
      setError(errorMessage);
      return false;
    }
  }, [user?.id, result?.batch_id]);

  // Subscribe to real-time updates for video status
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔔 Setting up real-time subscription for user:', user.id);

    const subscription = supabase
      .channel(`cinematographer_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'cinematographer_videos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔔 Real-time update received:', {
            event: payload.eventType,
            old: payload.old,
            new: payload.new
          });

          const updatedVideo = payload.new as CinematographerVideo;
          
          // Update current result if it matches the current generation
          const currentResult = resultRef.current;
          if (currentResult && currentResult.batch_id && updatedVideo?.id === currentResult.batch_id) {
            console.log('📺 Updating current video result:', {
              batch_id: currentResult.batch_id,
              status: updatedVideo.status,
              video_url: updatedVideo.final_video_url
            });

            setResult(prev => prev ? {
              ...prev,
              video: prev.video ? {
                ...prev.video,
                video_url: updatedVideo.final_video_url || prev.video.video_url,
                thumbnail_url: updatedVideo.preview_urls?.[0] || prev.video.thumbnail_url || '',
              } : {
                id: updatedVideo.id,
                video_url: updatedVideo.final_video_url || '',
                thumbnail_url: updatedVideo.preview_urls?.[0] || '',
                duration: updatedVideo.total_duration_seconds || 5,
                aspect_ratio: updatedVideo.aspect_ratio || '16:9',
                prompt: updatedVideo.video_concept,
                created_at: updatedVideo.created_at
              }
            } : prev);
            
            // CRITICAL: Set isGenerating to false when video generation is complete
            if (updatedVideo.status === 'completed' || updatedVideo.status === 'failed') {
              console.log('✅ Video generation completed, stopping loading state');
              setIsGenerating(false);
              setIsStateRestored(false); // Clear restored state flag
              
              // Clear any existing error if the video succeeded
              if (updatedVideo.status === 'completed' && updatedVideo.final_video_url) {
                setError(undefined);
              }
            }
          }
          
          // Always update the videos list for history tab
          if (payload.eventType === 'UPDATE') {
            setVideos(prev => prev.map(video => 
              video.id === updatedVideo.id ? updatedVideo : video
            ));
          } else if (payload.eventType === 'INSERT') {
            setVideos(prev => [updatedVideo, ...prev]);
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
  }, [user?.id, supabase]); // Remove result dependency to avoid re-subscription

  // Load initial history and restore any ongoing generations
  useEffect(() => {
    if (user?.id) {
      loadHistory();
      
      // Check for ongoing video generations and restore state
      const checkOngoingGenerations = async () => {
        try {
          const { videos } = await getCinematographerVideos(user.id);
          
          // Debug: Log all video statuses
          console.log('🔍 All videos from database:', videos.map(v => ({ 
            id: v.id, 
            status: v.status, 
            created: v.created_at,
            final_video_url: !!v.final_video_url 
          })));
          
          // Only consider recent videos (within last 30 minutes) to avoid old stuck records
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          const processingVideo = videos.find(v => {
            const isProcessingStatus = v.status === 'shooting' || v.status === 'planning' || v.status === 'editing';
            const isRecent = new Date(v.created_at) > thirtyMinutesAgo;
            return isProcessingStatus && isRecent;
          });
          
          if (processingVideo) {
            console.log('🔄 Restoring processing state for video:', processingVideo.id, 'status:', processingVideo.status);
            
            // Restore processing state
            setIsGenerating(true);
            setError(undefined);
            
            // Restore result state to match the ongoing generation
            setResult({
              success: true,
              batch_id: processingVideo.id,
              generation_time_ms: 0, // Will be updated when completed
              credits_used: 0, // Will be updated when completed
              remaining_credits: 0, // Will be updated when completed
              video: {
                id: processingVideo.id,
                video_url: processingVideo.final_video_url || '', // Empty until completed
                thumbnail_url: processingVideo.preview_urls?.[0] || '',
                duration: processingVideo.total_duration_seconds || 5,
                aspect_ratio: processingVideo.aspect_ratio || '16:9',
                prompt: processingVideo.video_concept,
                created_at: processingVideo.created_at
              }
            });
            
            console.log('✅ Processing state restored - user will see "Video processing..." until completion');
            setIsStateRestored(true);
          } else {
            console.log('💡 No ongoing generations found - user is in normal state');
            
            // Ensure we're not in a stuck generating state
            if (isGenerating) {
              console.log('🛠️ Clearing stuck generating state');
              setIsGenerating(false);
              setResult(undefined);
              setIsStateRestored(false);
            }
          }
        } catch (error) {
          console.error('Error checking ongoing generations:', error);
        }
      };
      
      checkOngoingGenerations();
    }
  }, [user?.id, loadHistory]);

  // Fallback polling mechanism when generating
  useEffect(() => {
    if (!isGenerating || !result?.batch_id || !user?.id) return;

    console.log('🔄 Starting fallback polling for video completion');
    
    const pollInterval = setInterval(async () => {
      try {
        const { videos: updatedVideos } = await getCinematographerVideos(user.id);
        const currentVideo = updatedVideos.find(v => v.id === result.batch_id);
        
        if (currentVideo && (currentVideo.status === 'completed' || currentVideo.status === 'failed')) {
          console.log('🔄 Polling detected completion:', currentVideo.status);
          
          // Update result
          setResult(prev => prev ? {
            ...prev,
            video: prev.video ? {
              ...prev.video,
              video_url: currentVideo.final_video_url || prev.video.video_url,
              thumbnail_url: currentVideo.preview_urls?.[0] || prev.video.thumbnail_url || '',
            } : {
              id: currentVideo.id,
              video_url: currentVideo.final_video_url || '',
              thumbnail_url: currentVideo.preview_urls?.[0] || '',
              duration: currentVideo.total_duration_seconds || 5,
              aspect_ratio: currentVideo.aspect_ratio || '16:9',
              prompt: currentVideo.video_concept,
              created_at: currentVideo.created_at
            }
          } : prev);
          
          // Stop generating state
          setIsGenerating(false);
          setIsStateRestored(false); // Clear restored state flag
          
          // Clear error if successful
          if (currentVideo.status === 'completed' && currentVideo.final_video_url) {
            setError(undefined);
          }
          
          // Update videos list
          setVideos(prev => prev.map(video => 
            video.id === currentVideo.id ? currentVideo : video
          ));
          
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      console.log('🔄 Stopping fallback polling');
      clearInterval(pollInterval);
    };
  }, [isGenerating, result?.batch_id, user?.id]);

  return {
    // Generation state
    isGenerating,
    result,
    error,
    isStateRestored, // New: indicates if state was restored from ongoing generation
    
    // History state
    videos,
    isLoadingHistory,
    
    // User and credits
    user,
    credits: credits?.available_credits || 0,
    
    // Actions
    generateVideo,
    clearResults,
    loadHistory,
    deleteVideo,
  };
}