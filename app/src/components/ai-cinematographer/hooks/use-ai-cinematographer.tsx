'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';
import { executeAICinematographer, generateVideo, CinematographerRequest, CinematographerResponse } from '@/actions/tools/ai-cinematographer';
import { getCinematographerVideos } from '@/actions/database/cinematographer-database';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';

export function useAICinematographer() {
  const { credits } = useCredits(); // Use real credits hook
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CinematographerResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [videos, setVideos] = useState<CinematographerVideo[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
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
  };

  // Subscribe to real-time updates for video status
  useEffect(() => {
    if (!user?.id || !result?.batch_id) return;

    const subscription = supabase
      .channel('cinematographer_videos')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cinematographer_videos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedVideo = payload.new as CinematographerVideo;
          
          // Update current result if it matches
          if (result && updatedVideo.id === result.batch_id) {
            setResult(prev => prev ? {
              ...prev,
              video: prev.video ? {
                ...prev.video,
                video_url: updatedVideo.final_video_url || '',
                thumbnail_url: updatedVideo.preview_urls?.[0] || '',
              } : undefined
            } : prev);
            
            // Set isGenerating to false when video generation is complete
            if (updatedVideo.status === 'completed' || updatedVideo.status === 'failed') {
              setIsGenerating(false);
            }
          }
          
          // Update videos list
          setVideos(prev => prev.map(video => 
            video.id === updatedVideo.id ? updatedVideo : video
          ));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, result?.batch_id, supabase, result]);

  // Load initial history
  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  }, [user?.id, loadHistory]);

  return {
    // Generation state
    isGenerating,
    result,
    error,
    
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
  };
}