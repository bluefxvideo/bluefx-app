'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';
import {
  executeAICinematographer,
  CinematographerRequest,
  CinematographerResponse,
  executeStartingShot,
  StartingShotRequest,
  StartingShotResponse,
  executeStoryboardGeneration,
  executeFrameExtraction,
  StoryboardRequest,
  StoryboardResponse,
  FrameExtractionRequest,
  ExtractedFrame,
} from '@/actions/tools/ai-cinematographer';
import { getCinematographerVideos, deleteCinematographerVideo } from '@/actions/database/cinematographer-database';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';

export function useAICinematographer() {
  const { credits, isLoading: isLoadingCredits } = useCredits(); // Use real credits hook

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CinematographerResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [videos, setVideos] = useState<CinematographerVideo[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isStateRestored, setIsStateRestored] = useState(false);

  // Starting Shot state
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [startingShotResult, setStartingShotResult] = useState<StartingShotResponse | undefined>();
  const [pendingImageForVideo, setPendingImageForVideo] = useState<string | undefined>();

  // Storyboard state
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [storyboardResult, setStoryboardResult] = useState<StoryboardResponse | undefined>();
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [extractingProgress, setExtractingProgress] = useState({ current: 0, total: 0 });

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription?.unsubscribe();
  }, [supabase.auth]);

  // Load video history
  const loadHistory = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingHistory(true);
    try {
      const { videos: historyVideos } = await getCinematographerVideos(user.id, 500);
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

    // Create immediate placeholder result to show video preview
    const batch_id = `cinematographer_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const placeholderResult: CinematographerResponse = {
      success: true,
      batch_id,
      generation_time_ms: 0,
      credits_used: 0,
      remaining_credits: 0,
      video: {
        id: batch_id,
        video_url: '', // Empty until completed
        thumbnail_url: '',
        duration: request.duration || 6,
        resolution: request.resolution || '1080p',
        prompt: request.prompt,
        created_at: new Date().toISOString()
      }
    };
    setResult(placeholderResult);

    try {
      const response = await executeAICinematographer({
        ...request,
        user_id: user.id,
      });

      setResult(response);

      if (response.success) {
        // Clear pending image after successful video generation
        setPendingImageForVideo(undefined);
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

  // Generate Starting Shot (first frame image)
  const generateStartingShot = async (request: StartingShotRequest) => {
    if (!user?.id) {
      setError('User must be authenticated to generate images');
      return;
    }

    setIsGeneratingImage(true);
    setError(undefined);
    setStartingShotResult(undefined);

    try {
      const response = await executeStartingShot({
        ...request,
        user_id: user.id,
      });

      setStartingShotResult(response);

      if (response.success) {
        // Refresh history to show new image
        await loadHistory();
      } else {
        setError(response.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Image generation failed';
      setError(errorMessage);
      setStartingShotResult({
        success: false,
        error: errorMessage,
        batch_id: `error_${Date.now()}`,
        generation_time_ms: 0,
        credits_used: 0,
        remaining_credits: 0,
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Set image URL to be used for video generation (pass undefined or empty to clear)
  const setImageForVideo = (imageUrl: string | undefined) => {
    setPendingImageForVideo(imageUrl || undefined);
  };

  // Clear results
  const clearResults = () => {
    setResult(undefined);
    setError(undefined);
    setIsStateRestored(false);
    setIsGenerating(false);
  };

  // Clear Starting Shot results
  const clearStartingShotResults = () => {
    setStartingShotResult(undefined);
    setError(undefined);
    setIsGeneratingImage(false);
  };

  // Generate Storyboard (3x3 grid)
  const generateStoryboard = async (request: StoryboardRequest) => {
    if (!user?.id) {
      setError('User must be authenticated to generate storyboards');
      return;
    }

    setIsGeneratingStoryboard(true);
    setError(undefined);
    setStoryboardResult(undefined);
    setExtractedFrames([]); // Clear any previous extracted frames

    try {
      const response = await executeStoryboardGeneration({
        ...request,
        user_id: user.id,
      });

      setStoryboardResult(response);

      if (response.success) {
        // Refresh history to show new storyboard
        await loadHistory();
      } else {
        setError(response.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Storyboard generation failed';
      setError(errorMessage);
      setStoryboardResult({
        success: false,
        error: errorMessage,
        batch_id: `error_${Date.now()}`,
        generation_time_ms: 0,
        credits_used: 0,
        remaining_credits: 0,
      });
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  // Extract frames from storyboard grid
  const extractFrames = async (frameNumbers: number[]) => {
    if (!user?.id) {
      setError('User must be authenticated to extract frames');
      return;
    }

    if (!storyboardResult?.storyboard) {
      setError('No storyboard available for frame extraction');
      return;
    }

    setIsExtractingFrames(true);
    setError(undefined);
    setExtractingProgress({ current: 0, total: frameNumbers.length });

    // Add pending frames to the list
    const pendingFrames: ExtractedFrame[] = frameNumbers.map(num => ({
      id: `pending_${num}`,
      frame_number: num,
      image_url: '',
      status: 'pending' as const,
    }));
    setExtractedFrames(prev => [...prev, ...pendingFrames]);

    try {
      const response = await executeFrameExtraction({
        storyboard_id: storyboardResult.storyboard.id,
        grid_image_url: storyboardResult.storyboard.grid_image_url,
        frame_numbers: frameNumbers,
        user_id: user.id,
      });

      if (response.success) {
        // Replace pending frames with actual results
        setExtractedFrames(prev => {
          const existingCompleted = prev.filter(f =>
            f.status === 'completed' && !frameNumbers.includes(f.frame_number)
          );
          return [...existingCompleted, ...response.frames];
        });
        // Refresh history
        await loadHistory();
      } else {
        setError(response.error);
        // Mark pending frames as failed
        setExtractedFrames(prev =>
          prev.map(f =>
            frameNumbers.includes(f.frame_number) && f.status === 'pending'
              ? { ...f, status: 'failed' as const, error: response.error }
              : f
          )
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Frame extraction failed';
      setError(errorMessage);
      // Mark pending frames as failed
      setExtractedFrames(prev =>
        prev.map(f =>
          frameNumbers.includes(f.frame_number) && f.status === 'pending'
            ? { ...f, status: 'failed' as const, error: errorMessage }
            : f
        )
      );
    } finally {
      setIsExtractingFrames(false);
      setExtractingProgress({ current: 0, total: 0 });
    }
  };

  // Clear Storyboard results
  const clearStoryboardResults = () => {
    setStoryboardResult(undefined);
    setExtractedFrames([]);
    setError(undefined);
    setIsGeneratingStoryboard(false);
    setIsExtractingFrames(false);
  };

  // Delete video
  const deleteVideo = useCallback(async (videoId: string) => {
    if (!user?.id) {
      setError('User must be authenticated to delete videos');
      return false;
    }

    try {
      const success = await deleteCinematographerVideo(videoId, user.id);

      if (success) {
        // Remove from local state
        setVideos(prev => prev.filter(video => video.id !== videoId));

        // If this was the current result, clear it
        if (result?.batch_id === videoId) {
          clearResults();
        }

        console.log(`Successfully deleted video: ${videoId}`);
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

    console.log('Setting up real-time subscription for user:', user.id);

    const subscription = supabase
      .channel(`cinematographer_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cinematographer_videos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time update received:', {
            event: payload.eventType,
            old: payload.old,
            new: payload.new
          });

          const updatedVideo = payload.new as CinematographerVideo;

          // Update current result if it matches the current generation
          const currentResult = resultRef.current;
          const isCurrentGeneration = currentResult && currentResult.batch_id &&
            (updatedVideo?.id === currentResult.batch_id ||
             currentResult.video?.id === updatedVideo?.id);

          if (isCurrentGeneration) {
            console.log('Updating current video result:', {
              batch_id: currentResult.batch_id,
              status: updatedVideo.status,
              video_url: updatedVideo.final_video_url
            });

            // Extract resolution from metadata if available
            const metadata = updatedVideo.metadata as { resolution?: string } | null;
            const resolution = metadata?.resolution || '1080p';

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
                duration: updatedVideo.total_duration_seconds || 6,
                resolution: resolution,
                prompt: updatedVideo.video_concept,
                created_at: updatedVideo.created_at || new Date().toISOString()
              }
            } : prev);

            // Set isGenerating to false when video generation is complete
            if (updatedVideo.status === 'completed' || updatedVideo.status === 'failed') {
              console.log('Video generation completed, stopping loading state');
              setIsGenerating(false);
              setIsStateRestored(false);

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
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from real-time updates');
      subscription.unsubscribe();
    };
  }, [user?.id, supabase]);

  // Load initial history and restore any ongoing generations
  useEffect(() => {
    if (user?.id) {
      loadHistory();

      // Check for ongoing video generations and restore state
      const checkOngoingGenerations = async () => {
        try {
          const { videos } = await getCinematographerVideos(user.id, 500);

          // Only consider recent videos (within last 30 minutes)
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          const processingVideo = videos.find(v => {
            const isProcessingStatus = v.status === 'shooting' || v.status === 'planning' || v.status === 'editing';
            const createdAt = v.created_at ? new Date(v.created_at) : new Date(0);
            const isRecent = createdAt > thirtyMinutesAgo;
            return isProcessingStatus && isRecent;
          });

          if (processingVideo) {
            console.log('Restoring processing state for video:', processingVideo.id);

            setIsGenerating(true);
            setError(undefined);

            // Extract resolution from metadata
            const metadata = processingVideo.metadata as { resolution?: string } | null;
            const resolution = metadata?.resolution || '1080p';

            setResult({
              success: true,
              batch_id: processingVideo.id,
              generation_time_ms: 0,
              credits_used: 0,
              remaining_credits: 0,
              video: {
                id: processingVideo.id,
                video_url: processingVideo.final_video_url || '',
                thumbnail_url: processingVideo.preview_urls?.[0] || '',
                duration: processingVideo.total_duration_seconds || 6,
                resolution: resolution,
                prompt: processingVideo.video_concept,
                created_at: processingVideo.created_at || new Date().toISOString()
              }
            });

            setIsStateRestored(true);
          } else if (isGenerating) {
            // Clear stuck generating state
            setIsGenerating(false);
            setResult(undefined);
            setIsStateRestored(false);
          }
        } catch (error) {
          console.error('Error checking ongoing generations:', error);
        }
      };

      checkOngoingGenerations();
    }
  }, [user?.id, loadHistory, isGenerating]);

  return {
    // Video generation state
    isGenerating,
    result,
    error,
    isStateRestored,

    // Starting Shot state
    isGeneratingImage,
    startingShotResult,
    pendingImageForVideo,

    // Storyboard state
    isGeneratingStoryboard,
    storyboardResult,
    extractedFrames,
    isExtractingFrames,
    extractingProgress,

    // History state
    videos,
    isLoadingHistory,

    // User and credits
    user,
    credits: credits?.available_credits ?? 0,
    isLoadingCredits,

    // Actions
    generateVideo,
    generateStartingShot,
    generateStoryboard,
    extractFrames,
    setImageForVideo,
    clearResults,
    clearStartingShotResults,
    clearStoryboardResults,
    loadHistory,
    deleteVideo,
  };
}
