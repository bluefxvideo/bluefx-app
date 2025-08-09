'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/app/supabase/client';
import { executeAICinematographer, CinematographerRequest, CinematographerResponse } from '@/actions/tools/ai-cinematographer';
import { getCinematographerVideos } from '@/actions/database/cinematographer-database';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';

interface UseAICinematographerProps {
  userId: string;
}

export function useAICinematographer({ userId }: UseAICinematographerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CinematographerResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [videos, setVideos] = useState<CinematographerVideo[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const supabase = createClient();
  
  // Load video history
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const { videos: historyVideos } = await getCinematographerVideos(userId);
      setVideos(historyVideos);
    } catch (err) {
      console.error('Failed to load video history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [userId]);

  // Generate video
  const generateVideo = async (request: CinematographerRequest) => {
    setIsGenerating(true);
    setError(undefined);
    setResult(undefined);
    
    try {
      const response = await executeAICinematographer({
        ...request,
        user_id: userId,
      });
      
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
    if (!userId || !result?.batch_id) return;

    const subscription = supabase
      .channel('cinematographer_videos')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cinematographer_videos',
          filter: `user_id=eq.${userId}`,
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
  }, [userId, result?.batch_id, supabase, result]);

  // Load initial history
  useEffect(() => {
    if (userId) {
      loadHistory();
    }
  }, [userId, loadHistory]);

  return {
    // Generation state
    isGenerating,
    result,
    error,
    
    // History state
    videos,
    isLoadingHistory,
    
    // Actions
    generateVideo,
    clearResults,
    loadHistory,
  };
}