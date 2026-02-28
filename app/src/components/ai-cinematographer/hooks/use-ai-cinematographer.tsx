'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/app/supabase/client';
import { User } from '@supabase/supabase-js';
import { useCredits } from '@/hooks/useCredits';
import {
  executeAICinematographer,
  executeStartingShot,
  StartingShotRequest,
  StartingShotResponse,
  executeStoryboardGeneration,
  executeFrameExtraction,
  StoryboardRequest,
  StoryboardResponse,
  ExtractedFrame,
  uploadGridImageToStorage,
} from '@/actions/tools/ai-cinematographer';
import type { CinematographerRequest, CinematographerResponse } from '@/types/cinematographer';
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

  // Remember last used aspect ratio across tabs
  const [lastUsedAspectRatio, setLastUsedAspectRatio] = useState<string>('16:9');

  // Store analyzer shots for pre-filling generator prompts
  const [analyzerShots, setAnalyzerShots] = useState<Array<{
    shotNumber: number;
    description: string;
    duration: string;
    shotType?: string;
    action?: string;    // What movement/action happens
    dialogue?: string;  // What is being said (narration, voiceover, dialogue)
  }>>([]);

  // Stored asset references for cross-grid consistency
  // These persist across multiple grid generations to maintain character/product consistency
  const [storedAssetReferences, setStoredAssetReferences] = useState<Array<{
    id: string;
    label: string;
    type: 'character' | 'product' | 'environment' | 'other';
    url: string; // Stored URL after upload
  }>>([]);

  // Animation Queue state for batch video generation
  const [animationQueue, setAnimationQueue] = useState<Array<{
    id: string;
    frameNumber: number;
    imageUrl: string;
    prompt: string;
    dialogue?: string;
    includeDialogue?: boolean; // Whether to include dialogue in video generation prompt (default: false)
    duration: number;
    cameraStyle: 'none' | 'amateur' | 'stable' | 'cinematic';
    aspectRatio: string;
    model: 'fast' | 'pro';
    status: 'pending' | 'generating' | 'completed' | 'failed';
    videoUrl?: string;
    error?: string;
    batchId?: string; // Track which database record this corresponds to
  }>>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });

  // Use ref to track current result without causing subscription re-creation
  const resultRef = useRef<CinematographerResponse | undefined>(undefined);
  const isGeneratingRef = useRef<boolean>(false);
  const animationQueueRef = useRef(animationQueue);

  // Keep animationQueueRef in sync
  useEffect(() => {
    animationQueueRef.current = animationQueue;
  }, [animationQueue]);

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

  // Helper function to upload file via API route
  const uploadFileViaApi = async (
    file: File,
    type: 'reference' | 'last_frame',
    batchId: string
  ): Promise<{ success: boolean; url?: string; error?: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('batchId', batchId);

    try {
      const response = await fetch('/api/upload/cinematographer', {
        method: 'POST',
        body: formData,
      });
      return response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  };

  // Generate video
  const generateVideo = async (request: CinematographerRequest) => {
    // Authentication check
    if (!user?.id) {
      setError('User must be authenticated to generate videos');
      return;
    }

    setIsGenerating(true);
    setError(undefined);
    setResult(undefined); // Clear previous result to prevent flash of old content

    // Generate batch_id upfront for file uploads
    const batch_id = `cinematographer_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      // Upload files via API route first (File objects don't serialize through server actions)
      let referenceImageUrl = request.reference_image_url;
      let lastFrameImageUrl = request.last_frame_image_url;

      // Upload reference image if provided as File
      if (request.reference_image) {
        console.log('📤 Uploading reference image via API...');
        const uploadResult = await uploadFileViaApi(request.reference_image, 'reference', batch_id);
        if (!uploadResult.success) {
          throw new Error(`Failed to upload reference image: ${uploadResult.error}`);
        }
        referenceImageUrl = uploadResult.url;
        console.log('✅ Reference image uploaded:', referenceImageUrl);
      }

      // Upload last frame image if provided as File (Pro mode only)
      if (request.last_frame_image) {
        console.log('📤 Uploading last frame image via API...');
        const uploadResult = await uploadFileViaApi(request.last_frame_image, 'last_frame', batch_id);
        if (!uploadResult.success) {
          throw new Error(`Failed to upload last frame image: ${uploadResult.error}`);
        }
        lastFrameImageUrl = uploadResult.url;
        console.log('✅ Last frame image uploaded:', lastFrameImageUrl);
      }

      // Debug: Log the request being sent
      console.log('🎥 Sending to executeAICinematographer:', {
        ...request,
        user_id: user.id,
        reference_image: undefined, // Don't send File objects
        reference_image_url: referenceImageUrl,
        last_frame_image: undefined, // Don't send File objects
        last_frame_image_url: lastFrameImageUrl,
      });

      // Send request with URLs instead of File objects
      const response = await executeAICinematographer({
        ...request,
        user_id: user.id,
        reference_image: undefined, // Clear File object
        reference_image_url: referenceImageUrl,
        last_frame_image: undefined, // Clear File object
        last_frame_image_url: lastFrameImageUrl,
      });

      // Only set result once - when server returns the job info
      // This avoids the flash caused by replacing placeholder with server response
      setResult(response);

      if (response.success) {
        // Keep pending image for multiple generations (user can generate multiple videos from same image)
        // Refresh history to show new video
        await loadHistory();
        // Keep isGenerating = true - the real-time subscription will set it to false
        // when the webhook updates the video status to 'completed' or 'failed'
        console.log('🎬 Video generation started successfully, keeping loading state until webhook completes');
      } else {
        setError(response.error);
        // Only stop generating state on failure
        setIsGenerating(false);
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
      // Only stop generating state on error
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
      // Upload reference image files client-side first, then pass URLs to server action
      // (File objects don't serialize reliably across the server action boundary)
      const referenceImageUrls: string[] = [...(request.reference_image_urls || [])];

      if (request.reference_image_files && request.reference_image_files.length > 0) {
        const batch_id = crypto.randomUUID();
        console.log(`📤 Uploading ${request.reference_image_files.length} reference image(s) via API...`);
        for (const file of request.reference_image_files) {
          const uploadResult = await uploadFileViaApi(file, 'reference', batch_id);
          if (uploadResult.success && uploadResult.url) {
            referenceImageUrls.push(uploadResult.url);
          } else {
            console.error('Failed to upload reference image:', uploadResult.error);
          }
        }
      }

      const response = await executeStartingShot({
        ...request,
        reference_image_files: undefined, // Don't send File objects to server action
        reference_image_urls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
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

  // Generate Storyboard (2x2 grid)
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
      // Upload reference image files client-side first (File objects don't serialize across server action boundaries)
      const referenceImageUrls: string[] = [...(request.reference_image_urls || [])];
      if (request.reference_image_files && request.reference_image_files.length > 0) {
        const batch_id = crypto.randomUUID();
        console.log(`📤 Uploading ${request.reference_image_files.length} storyboard reference image(s) via API...`);
        for (const file of request.reference_image_files) {
          const uploadResult = await uploadFileViaApi(file, 'reference', batch_id);
          if (uploadResult.success && uploadResult.url) {
            referenceImageUrls.push(uploadResult.url);
          } else {
            console.warn('⚠️ Failed to upload storyboard reference image:', uploadResult.error);
          }
        }
      }

      const response = await executeStoryboardGeneration({
        ...request,
        reference_image_files: undefined, // Don't send File objects to server action
        reference_image_urls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
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

  // Regenerate a single frame (re-extract it from the grid)
  const regenerateFrame = async (frameNumber: number) => {
    if (!user?.id) {
      setError('User must be authenticated to regenerate frames');
      return;
    }

    if (!storyboardResult?.storyboard) {
      setError('No storyboard available for frame regeneration');
      return;
    }

    // Remove the existing frame from extractedFrames first
    setExtractedFrames(prev => prev.filter(f => f.frame_number !== frameNumber));

    // Call extractFrames with just this one frame
    await extractFrames([frameNumber]);
  };

  // Upload an existing grid image for frame extraction
  const uploadGridImage = async (file: File) => {
    if (!user?.id) {
      setError('User must be authenticated to upload grid images');
      return;
    }

    setIsGeneratingStoryboard(true);
    setError(undefined);
    setExtractedFrames([]);

    try {
      // Upload the image to Supabase storage so the server can access it
      const uploadResult = await uploadGridImageToStorage(file, user.id);

      if (!uploadResult.success || !uploadResult.grid_image_url) {
        throw new Error(uploadResult.error || 'Failed to upload grid image');
      }

      // Set the storyboard result with the uploaded image URL
      setStoryboardResult({
        success: true,
        storyboard: {
          id: uploadResult.grid_id || `uploaded_${Date.now()}`,
          grid_image_url: uploadResult.grid_image_url,
          prompt: '[Uploaded Grid Image]',
          visual_style: 'custom',
          frame_aspect_ratio: '16:9',
          created_at: new Date().toISOString(),
        },
        batch_id: uploadResult.grid_id || `uploaded_${Date.now()}`,
        generation_time_ms: 0,
        credits_used: 0,
        remaining_credits: 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process uploaded grid';
      setError(errorMessage);
    } finally {
      setIsGeneratingStoryboard(false);
    }
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

            // Also update animation queue items that match this video
            const currentQueue = animationQueueRef.current;
            const matchingQueueItem = currentQueue.find(item => item.batchId === updatedVideo.id);
            if (matchingQueueItem && (updatedVideo.status === 'completed' || updatedVideo.status === 'failed')) {
              console.log('Updating animation queue item:', matchingQueueItem.id, 'status:', updatedVideo.status);
              setAnimationQueue(prev => prev.map(item =>
                item.batchId === updatedVideo.id
                  ? {
                      ...item,
                      status: updatedVideo.status === 'completed' ? 'completed' as const : 'failed' as const,
                      videoUrl: updatedVideo.final_video_url || undefined,
                      error: updatedVideo.status === 'failed' ? 'Video generation failed' : undefined,
                    }
                  : item
              ));
            }
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

  // Update stored asset references (for cross-grid consistency)
  const updateStoredAssetReferences = useCallback((assets: Array<{
    id: string;
    label: string;
    type: 'character' | 'product' | 'environment' | 'other';
    url: string;
  }>) => {
    setStoredAssetReferences(assets);
  }, []);

  // Clear stored asset references
  const clearStoredAssetReferences = useCallback(() => {
    setStoredAssetReferences([]);
  }, []);

  // Cancel ongoing generation (escape from stuck state)
  const cancelGeneration = useCallback(() => {
    setIsGenerating(false);
    setError(undefined);
  }, []);

  // ============ Animation Queue Functions ============

  // Add items to animation queue
  const addToAnimationQueue = useCallback((items: Array<{
    frameNumber: number;
    imageUrl: string;
    prompt: string;
    dialogue?: string;
    duration: number;
    cameraStyle: 'none' | 'amateur' | 'stable' | 'cinematic';
    aspectRatio: string;
    model: 'fast' | 'pro';
    batchNumber?: number;
    sceneNumber?: number;
  }>) => {
    setAnimationQueue(prev => {
      // Deduplicate: skip items whose imageUrl is already in the queue
      const existingUrls = new Set(prev.map(q => q.imageUrl));
      const uniqueItems = items.filter(item => !existingUrls.has(item.imageUrl));
      if (uniqueItems.length === 0) return prev;

      const newItems = uniqueItems.map(item => ({
        ...item,
        id: `queue_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        status: 'pending' as const,
      }));
      return [...prev, ...newItems];
    });
  }, []);

  // Remove item from queue
  const removeFromQueue = useCallback((id: string) => {
    setAnimationQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  // Update queue item
  const updateQueueItem = useCallback((id: string, updates: Partial<{
    prompt: string;
    dialogue?: string;
    duration: number;
    cameraStyle: 'none' | 'amateur' | 'stable' | 'cinematic';
    aspectRatio: string;
    model: 'fast' | 'pro';
    status: 'pending' | 'generating' | 'completed' | 'failed';
    videoUrl?: string;
    error?: string;
  }>) => {
    setAnimationQueue(prev =>
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  }, []);

  // Clear entire queue
  const clearAnimationQueue = useCallback(() => {
    setAnimationQueue([]);
    setIsProcessingQueue(false);
    setQueueProgress({ current: 0, total: 0 });
  }, []);

  // Helper function to execute with retry and exponential backoff
  const executeWithRetry = async <T,>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = 1000 * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }

    throw lastError;
  };

  // Process animation queue (generate all videos sequentially)
  const processAnimationQueue = useCallback(async () => {
    if (!user?.id) {
      console.error('User must be authenticated to process queue');
      return;
    }

    // Refresh session before starting batch processing
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('Session expired or invalid');
      setError('Session expired. Please refresh the page and try again.');
      return;
    }

    const pendingItems = animationQueue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) return;

    setIsProcessingQueue(true);
    setQueueProgress({ current: 0, total: pendingItems.length });

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];

      // Update status to generating
      setAnimationQueue(prev =>
        prev.map(q => q.id === item.id ? { ...q, status: 'generating' as const } : q)
      );
      setQueueProgress({ current: i + 1, total: pendingItems.length });

      try {
        // Build prompt with camera style
        let finalPrompt = item.prompt;
        // Only include dialogue if user explicitly enabled it (off by default)
        if (item.dialogue && item.includeDialogue) {
          finalPrompt += `\n\nNarration: "${item.dialogue}"`;
        }
        if (item.cameraStyle !== 'none') {
          const cameraText = {
            amateur: 'Amateur shot, handheld camera, slight shake.',
            stable: 'Stable tripod shot, smooth framing.',
            cinematic: 'Cinematic camera movement, dramatic angles.',
          }[item.cameraStyle];
          finalPrompt += ` ${cameraText}`;
        }

        // Generate video with retry logic
        const response = await executeWithRetry(async () => {
          return await executeAICinematographer({
            prompt: finalPrompt,
            reference_image_url: item.imageUrl,
            duration: item.duration,
            aspect_ratio: item.aspectRatio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | '9:21',
            model: item.model,  // Use item's model selection (fast or pro)
            resolution: '1080p',  // Always use 1080p for batch queue simplicity
            generate_audio: true,
            workflow_intent: 'generate',
            user_id: user.id,
          });
        });

        if (response.success) {
          // Video submission succeeded - keep as "generating" until webhook completes
          // Store the batchId so we can match updates from real-time subscription
          setAnimationQueue(prev =>
            prev.map(q => q.id === item.id ? {
              ...q,
              status: 'generating' as const, // Keep as generating until webhook confirms
              batchId: response.batch_id, // Store for real-time matching
            } : q)
          );
        } else {
          setAnimationQueue(prev =>
            prev.map(q => q.id === item.id ? {
              ...q,
              status: 'failed' as const,
              error: response.error || 'Unknown error',
            } : q)
          );
        }
      } catch (error) {
        setAnimationQueue(prev =>
          prev.map(q => q.id === item.id ? {
            ...q,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          } : q)
        );
      }

      // Small delay between generations to avoid rate limiting
      if (i < pendingItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsProcessingQueue(false);
    // Refresh history to show new videos
    await loadHistory();
  }, [animationQueue, user?.id, loadHistory, supabase.auth]);

  // Retry a single failed queue item
  const retryQueueItem = useCallback(async (id: string) => {
    const item = animationQueue.find(q => q.id === id);
    if (!item || item.status !== 'failed' || !user?.id) return;

    // Reset status to pending
    setAnimationQueue(prev =>
      prev.map(q => q.id === id ? { ...q, status: 'pending' as const, error: undefined } : q)
    );

    // Process just this one item
    setIsProcessingQueue(true);
    setQueueProgress({ current: 1, total: 1 });

    // Update status to generating
    setAnimationQueue(prev =>
      prev.map(q => q.id === id ? { ...q, status: 'generating' as const } : q)
    );

    try {
      // Build prompt with camera style
      let finalPrompt = item.prompt;
      // Only include dialogue if user explicitly enabled it (off by default)
      if (item.dialogue && item.includeDialogue) {
        finalPrompt += `\n\nNarration: "${item.dialogue}"`;
      }
      if (item.cameraStyle !== 'none') {
        const cameraText = {
          amateur: 'Amateur shot, handheld camera, slight shake.',
          stable: 'Stable tripod shot, smooth framing.',
          cinematic: 'Cinematic camera movement, dramatic angles.',
        }[item.cameraStyle];
        finalPrompt += ` ${cameraText}`;
      }

      // Generate video with retry logic
      const response = await executeWithRetry(async () => {
        return await executeAICinematographer({
          prompt: finalPrompt,
          reference_image_url: item.imageUrl,
          duration: item.duration,
          aspect_ratio: item.aspectRatio as '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | '9:21',
          model: item.model,
          resolution: '1080p',
          generate_audio: true,
          workflow_intent: 'generate',
          user_id: user.id,
        });
      });

      if (response.success) {
        // Video submission succeeded - keep as "generating" until webhook confirms
        setAnimationQueue(prev =>
          prev.map(q => q.id === id ? {
            ...q,
            status: 'generating' as const,
            batchId: response.batch_id,
          } : q)
        );
      } else {
        setAnimationQueue(prev =>
          prev.map(q => q.id === id ? {
            ...q,
            status: 'failed' as const,
            error: response.error || 'Unknown error',
          } : q)
        );
      }
    } catch (error) {
      setAnimationQueue(prev =>
        prev.map(q => q.id === id ? {
          ...q,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
        } : q)
      );
    }

    setIsProcessingQueue(false);
    await loadHistory();
  }, [animationQueue, user?.id, loadHistory]);

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
    storedAssetReferences, // For cross-grid consistency

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
    regenerateFrame,
    uploadGridImage,
    setImageForVideo,
    clearResults,
    clearStartingShotResults,
    clearStoryboardResults,
    updateStoredAssetReferences,
    clearStoredAssetReferences,
    loadHistory,
    deleteVideo,
    cancelGeneration,
    lastUsedAspectRatio,
    setLastUsedAspectRatio,
    analyzerShots,
    setAnalyzerShots,

    // Animation Queue
    animationQueue,
    isProcessingQueue,
    queueProgress,
    addToAnimationQueue,
    removeFromQueue,
    updateQueueItem,
    clearAnimationQueue,
    processAnimationQueue,
    retryQueueItem,
  };
}
