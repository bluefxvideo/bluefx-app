'use client';

import { useState, useCallback } from 'react';
import { cropGridToFrames } from '@/lib/utils/grid-cropper';
import { processSingleFrame, checkExtractionCredits } from '@/actions/tools/grid-frame-extractor';

export interface ExtractedFrameResult {
  frameNumber: number;
  row: number;
  col: number;
  originalUrl: string;
  upscaledUrl?: string;
  width: number;
  height: number;
  status: 'pending' | 'cropping' | 'uploading' | 'upscaling' | 'completed' | 'failed';
  error?: string;
}

interface UseGridExtractionOptions {
  gridConfig?: {
    columns: number;
    rows: number;
  };
  shouldUpscale?: boolean;
  userId?: string;
}

/**
 * Hook for extracting frames from a storyboard grid
 * Uses client-side canvas cropping + server-side upscaling
 * Processes frames one at a time for progressive UI updates
 * Cost: 1 credit per frame
 */
export function useGridExtraction(options: UseGridExtractionOptions = {}) {
  const { gridConfig = { columns: 3, rows: 3 }, shouldUpscale = true, userId } = options;

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrameResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  const [error, setError] = useState<string | null>(null);

  /**
   * Extract all frames from a grid image - one at a time with progressive updates
   */
  const extractAllFrames = useCallback(async (
    gridImageUrl: string,
    projectId: string,
    userIdOverride?: string
  ) => {
    const effectiveUserId = userIdOverride || userId;
    if (!effectiveUserId) {
      setError('User ID is required for extraction');
      return { success: false, error: 'User ID is required' };
    }

    setIsExtracting(true);
    setError(null);
    setExtractedFrames([]);

    const totalFrames = gridConfig.columns * gridConfig.rows;
    setProgress({ current: 0, total: totalFrames, stage: 'Checking credits...' });

    try {
      // Step 0: Check if user has enough credits
      const creditCheck = await checkExtractionCredits(effectiveUserId, totalFrames);
      if (!creditCheck.success || !creditCheck.canAfford) {
        const errorMsg = creditCheck.error ||
          `Insufficient credits. Required: ${creditCheck.requiredCredits}, Available: ${creditCheck.availableCredits}`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Step 1: Client-side canvas crop
      setProgress({ current: 0, total: totalFrames, stage: 'Cropping frames...' });
      const croppedFrames = await cropGridToFrames(gridImageUrl, gridConfig);

      // Initialize UI with all frames as pending
      setExtractedFrames(croppedFrames.map(f => ({
        ...f,
        originalUrl: f.base64Data, // Temporary base64 preview
        status: 'pending' as const,
        width: f.width,
        height: f.height,
      })));

      // Step 2: Process each frame one at a time for progressive updates
      const completedFrames: ExtractedFrameResult[] = [];

      for (let i = 0; i < croppedFrames.length; i++) {
        const frame = croppedFrames[i];
        setProgress({
          current: i,
          total: totalFrames,
          stage: `Processing frame ${frame.frameNumber}/${totalFrames}...`
        });

        // Mark current frame as uploading
        setExtractedFrames(prev => prev.map(f =>
          f.frameNumber === frame.frameNumber
            ? { ...f, status: 'uploading' as const }
            : f
        ));

        // Process single frame on server (includes credit deduction)
        const result = await processSingleFrame(
          projectId,
          effectiveUserId,
          frame,
          shouldUpscale
        );

        if (result.success && result.frame) {
          const completedFrame: ExtractedFrameResult = {
            ...result.frame,
            status: 'completed' as const,
          };
          completedFrames.push(completedFrame);

          // Update UI immediately with this completed frame
          setExtractedFrames(prev => prev.map(f =>
            f.frameNumber === frame.frameNumber
              ? completedFrame
              : f
          ));

          // Update progress after each frame
          setProgress({
            current: i + 1,
            total: totalFrames,
            stage: `Completed ${i + 1}/${totalFrames} frames`
          });
        } else {
          // Mark frame as failed but continue with others
          setExtractedFrames(prev => prev.map(f =>
            f.frameNumber === frame.frameNumber
              ? { ...f, status: 'failed' as const, error: result.error }
              : f
          ));
          console.error(`Frame ${frame.frameNumber} failed:`, result.error);
        }
      }

      setProgress({ current: totalFrames, total: totalFrames, stage: 'Complete!' });

      return {
        success: completedFrames.length > 0,
        frames: completedFrames,
        error: completedFrames.length === 0 ? 'All frames failed to extract' : undefined
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Frame extraction failed';
      setError(errorMessage);
      setExtractedFrames(prev => prev.map(f => ({
        ...f,
        status: f.status === 'completed' ? 'completed' : 'failed' as const,
        error: f.status === 'completed' ? undefined : errorMessage,
      })));
      return { success: false, error: errorMessage };
    } finally {
      setIsExtracting(false);
    }
  }, [gridConfig, shouldUpscale, userId]);

  /**
   * Extract specific frames only - one at a time with progressive updates
   */
  const extractSelectedFrames = useCallback(async (
    gridImageUrl: string,
    projectId: string,
    frameNumbers: number[],
    userIdOverride?: string
  ) => {
    const effectiveUserId = userIdOverride || userId;
    if (!effectiveUserId) {
      setError('User ID is required for extraction');
      return { success: false, error: 'User ID is required' };
    }

    setIsExtracting(true);
    setError(null);

    setProgress({ current: 0, total: frameNumbers.length, stage: 'Checking credits...' });

    try {
      // Step 0: Check if user has enough credits
      const creditCheck = await checkExtractionCredits(effectiveUserId, frameNumbers.length);
      if (!creditCheck.success || !creditCheck.canAfford) {
        const errorMsg = creditCheck.error ||
          `Insufficient credits. Required: ${creditCheck.requiredCredits}, Available: ${creditCheck.availableCredits}`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Step 1: Crop all frames client-side
      setProgress({ current: 0, total: frameNumbers.length, stage: 'Cropping frames...' });
      const allCroppedFrames = await cropGridToFrames(gridImageUrl, gridConfig);

      // Filter to only the selected frame numbers
      const selectedFrames = allCroppedFrames.filter(f =>
        frameNumbers.includes(f.frameNumber)
      );

      // Initialize selected frames as pending
      setExtractedFrames(prev => {
        const unchanged = prev.filter(f => !frameNumbers.includes(f.frameNumber));
        const newPending = selectedFrames.map(f => ({
          ...f,
          originalUrl: f.base64Data,
          status: 'pending' as const,
          width: f.width,
          height: f.height,
        }));
        return [...unchanged, ...newPending].sort((a, b) => a.frameNumber - b.frameNumber);
      });

      // Step 2: Process each frame one at a time
      const completedFrames: ExtractedFrameResult[] = [];

      for (let i = 0; i < selectedFrames.length; i++) {
        const frame = selectedFrames[i];
        setProgress({
          current: i,
          total: frameNumbers.length,
          stage: `Processing frame ${frame.frameNumber}...`
        });

        // Mark current frame as uploading
        setExtractedFrames(prev => prev.map(f =>
          f.frameNumber === frame.frameNumber
            ? { ...f, status: 'uploading' as const }
            : f
        ));

        // Process single frame on server
        const result = await processSingleFrame(
          projectId,
          effectiveUserId,
          frame,
          shouldUpscale
        );

        if (result.success && result.frame) {
          const completedFrame: ExtractedFrameResult = {
            ...result.frame,
            status: 'completed' as const,
          };
          completedFrames.push(completedFrame);

          // Update UI immediately
          setExtractedFrames(prev => prev.map(f =>
            f.frameNumber === frame.frameNumber
              ? completedFrame
              : f
          ));

          setProgress({
            current: i + 1,
            total: frameNumbers.length,
            stage: `Completed ${i + 1}/${frameNumbers.length} frames`
          });
        } else {
          setExtractedFrames(prev => prev.map(f =>
            f.frameNumber === frame.frameNumber
              ? { ...f, status: 'failed' as const, error: result.error }
              : f
          ));
        }
      }

      setProgress({ current: frameNumbers.length, total: frameNumbers.length, stage: 'Complete!' });

      return {
        success: completedFrames.length > 0,
        frames: completedFrames
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Frame extraction failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsExtracting(false);
    }
  }, [gridConfig, shouldUpscale, userId]);

  /**
   * Clear all extracted frames
   */
  const clearFrames = useCallback(() => {
    setExtractedFrames([]);
    setError(null);
    setProgress({ current: 0, total: 0, stage: '' });
  }, []);

  return {
    isExtracting,
    extractedFrames,
    progress,
    error,
    extractAllFrames,
    extractSelectedFrames,
    clearFrames,
  };
}
