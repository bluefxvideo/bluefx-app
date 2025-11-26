'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useVideoSwapStore, VideoSwapJob, JobStatus } from '../store/video-swap-store';
import { executeVideoSwap, getVideoSwapStatus, getVideoSwapHistory, cancelVideoSwapJob } from '@/actions/tools/video-swap';
import { getUserCredits } from '@/actions/database/video-swap-database';
import { createClient } from '@/app/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * Custom hook for Video Swap functionality
 * Connects the Zustand store with server actions and handles real-time updates
 */
export function useVideoSwap() {
  const store = useVideoSwapStore();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const userId = user?.id || '';

  // Load user credits on mount
  useEffect(() => {
    async function loadCredits() {
      try {
        const result = await getUserCredits(userId);
        if (result.success && result.credits !== undefined) {
          store.setCredits(result.credits);
        }
      } catch (error) {
        console.error('Failed to load credits:', error);
      }
    }

    if (userId) {
      loadCredits();
    }
  }, [userId]);

  // Load job history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const result = await getVideoSwapHistory(userId, 20, 0);
        if (result.success && result.jobs) {
          store.setJobHistory(result.jobs.map(job => ({
            id: job.id,
            status: job.status as JobStatus,
            source_video_url: job.source_video_url,
            character_image_url: job.character_image_url,
            result_video_url: job.result_video_url,
            thumbnail_url: job.thumbnail_url,
            progress_percentage: job.status === 'completed' ? 100 : 0,
            created_at: job.created_at || new Date().toISOString(),
          })));
        }
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    }

    if (userId) {
      loadHistory();
    }
  }, [userId]);

  // Set up real-time subscription for job updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`video_swap_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_swap_jobs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updatedJob = payload.new as any;

          // Update current job if it matches
          const currentJob = store.currentJob;
          if (currentJob && currentJob.id === updatedJob.id) {
            store.setCurrentJob({
              ...currentJob,
              status: updatedJob.status as JobStatus,
              progress_percentage: updatedJob.progress_percentage || 0,
              result_video_url: updatedJob.result_video_url,
              thumbnail_url: updatedJob.thumbnail_url,
              error_message: updatedJob.error_message,
            });

            // Handle completion
            if (updatedJob.status === 'completed' && updatedJob.result_video_url) {
              store.setStep('result');
              store.setLoading(false);
              toast.success('Video swap completed!');

              // Stop polling
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }

            // Handle failure
            if (updatedJob.status === 'failed') {
              store.setStep('settings');
              store.setLoading(false);
              store.setError(updatedJob.error_message || 'Video swap failed');
              toast.error(updatedJob.error_message || 'Video swap failed');

              // Stop polling
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, store.currentJob?.id]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  /**
   * Start the video swap process
   */
  const startVideoSwap = useCallback(async () => {
    const { sourceVideo, characterImage, settings, availableCredits, creditsRequired } = store;

    // Validation
    if (!sourceVideo) {
      toast.error('Please upload a source video');
      return { success: false };
    }

    if (!characterImage) {
      toast.error('Please upload a character image');
      return { success: false };
    }

    if (availableCredits < creditsRequired) {
      toast.error(`Insufficient credits. Required: ${creditsRequired}, Available: ${availableCredits}`);
      return { success: false };
    }

    store.setLoading(true);
    store.setError(null);
    store.setStep('processing');

    try {
      const result = await executeVideoSwap({
        source_video: sourceVideo,
        character_image: characterImage,
        resolution: settings.resolution,
        frames_per_second: settings.frames_per_second,
        merge_audio: settings.merge_audio,
        go_fast: settings.go_fast,
        refert_num: settings.refert_num,
        seed: settings.seed,
        user_id: userId,
      });

      if (!result.success) {
        store.setError(result.error || 'Failed to start video swap');
        store.setStep('settings');
        store.setLoading(false);
        toast.error(result.error || 'Failed to start video swap');
        return { success: false };
      }

      // Set current job
      const job: VideoSwapJob = {
        id: result.job_id,
        status: 'processing',
        source_video_url: result.job?.source_video_url || '',
        character_image_url: result.job?.character_image_url || '',
        progress_percentage: 0,
        created_at: result.job?.created_at || new Date().toISOString(),
      };

      store.setCurrentJob(job);
      store.setCredits(result.remaining_credits);

      // Start polling for status (backup to real-time)
      startPolling(result.job_id);

      toast.success('Video swap started! This may take a few minutes...');
      return { success: true, jobId: result.job_id };

    } catch (error) {
      console.error('Video swap error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      store.setError(errorMessage);
      store.setStep('settings');
      store.setLoading(false);
      toast.error(errorMessage);
      return { success: false };
    }
  }, [store, userId]);

  /**
   * Start polling for job status
   */
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const status = await getVideoSwapStatus(jobId, userId);

        if (!status.success || !status.job) {
          console.warn('Failed to get job status');
          return;
        }

        // Update progress
        store.updateJobProgress(status.job.progress_percentage);

        // Handle completion
        if (status.job.status === 'completed' && status.job.result_video_url) {
          store.setJobResult(status.job.result_video_url);
          store.setStep('result');
          store.setLoading(false);

          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }

        // Handle failure
        if (status.job.status === 'failed') {
          store.updateJobStatus('failed', status.job.error_message || 'Processing failed');
          store.setStep('settings');
          store.setLoading(false);

          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }

      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

  }, [userId, store]);

  /**
   * Cancel current job
   */
  const cancelJob = useCallback(async () => {
    const { currentJob } = store;

    if (!currentJob) {
      return { success: false };
    }

    try {
      const result = await cancelVideoSwapJob(currentJob.id, userId);

      if (result.success) {
        store.updateJobStatus('failed', 'Cancelled by user');
        store.setStep('settings');
        store.setLoading(false);
        toast.info('Video swap cancelled');

        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }

      return result;

    } catch (error) {
      console.error('Cancel error:', error);
      return { success: false };
    }
  }, [store, userId]);

  /**
   * Refresh credits
   */
  const refreshCredits = useCallback(async () => {
    try {
      const result = await getUserCredits(userId);
      if (result.success && result.credits !== undefined) {
        store.setCredits(result.credits);
      }
    } catch (error) {
      console.error('Failed to refresh credits:', error);
    }
  }, [userId, store]);

  /**
   * Refresh history
   */
  const refreshHistory = useCallback(async () => {
    try {
      const result = await getVideoSwapHistory(userId, 20, 0);
      if (result.success && result.jobs) {
        store.setJobHistory(result.jobs.map(job => ({
          id: job.id,
          status: job.status as JobStatus,
          source_video_url: job.source_video_url,
          character_image_url: job.character_image_url,
          result_video_url: job.result_video_url,
          thumbnail_url: job.thumbnail_url,
          progress_percentage: job.status === 'completed' ? 100 : 0,
          created_at: job.created_at || new Date().toISOString(),
        })));
      }
    } catch (error) {
      console.error('Failed to refresh history:', error);
    }
  }, [userId, store]);

  /**
   * Check if can proceed to next step
   */
  const canProceed = useCallback(() => {
    const { currentStep, sourceVideo, characterImage, availableCredits, creditsRequired } = store;

    switch (currentStep) {
      case 'upload':
        return !!sourceVideo;
      case 'character':
        return !!characterImage;
      case 'settings':
        return availableCredits >= creditsRequired;
      default:
        return false;
    }
  }, [store]);

  return {
    // State
    ...store,

    // Actions
    startVideoSwap,
    cancelJob,
    refreshCredits,
    refreshHistory,
    canProceed,
  };
}
