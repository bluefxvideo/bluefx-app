'use client';

import { useState, useCallback } from 'react';
import { cropGridToFrames } from '@/lib/utils/grid-cropper';
import { processExtractedFrames } from '@/actions/tools/grid-frame-extractor';

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
}

/**
 * Hook for extracting frames from a storyboard grid
 * Uses client-side canvas cropping + server-side upscaling
 */
export function useGridExtraction(options: UseGridExtractionOptions = {}) {
  const { gridConfig = { columns: 4, rows: 4 }, shouldUpscale = true } = options;

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrameResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  const [error, setError] = useState<string | null>(null);

  /**
   * Extract all frames from a grid image
   */
  const extractAllFrames = useCallback(async (
    gridImageUrl: string,
    projectId: string
  ) => {
    setIsExtracting(true);
    setError(null);
    setExtractedFrames([]);

    const totalFrames = gridConfig.columns * gridConfig.rows;
    setProgress({ current: 0, total: totalFrames, stage: 'Preparing...' });

    try {
      // Step 1: Client-side canvas crop
      setProgress({ current: 0, total: totalFrames, stage: 'Cropping frames...' });

      const croppedFrames = await cropGridToFrames(gridImageUrl, gridConfig);

      // Update UI with cropped frames (pending upload)
      setExtractedFrames(croppedFrames.map(f => ({
        ...f,
        originalUrl: f.base64Data, // Temporary base64 preview
        status: 'cropping' as const,
        width: f.width,
        height: f.height,
      })));

      setProgress({ current: totalFrames, total: totalFrames, stage: 'Uploading & upscaling...' });

      // Step 2: Server-side upload + upscale
      const result = await processExtractedFrames(
        projectId,
        croppedFrames,
        shouldUpscale
      );

      if (result.success && result.frames) {
        setExtractedFrames(result.frames.map(f => ({
          ...f,
          status: 'completed' as const,
        })));
        setProgress({ current: totalFrames, total: totalFrames, stage: 'Complete!' });
      } else {
        throw new Error(result.error || 'Extraction failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Frame extraction failed';
      setError(errorMessage);
      setExtractedFrames(prev => prev.map(f => ({
        ...f,
        status: 'failed' as const,
        error: errorMessage,
      })));
      return { success: false, error: errorMessage };
    } finally {
      setIsExtracting(false);
    }
  }, [gridConfig, shouldUpscale]);

  /**
   * Extract specific frames only
   */
  const extractSelectedFrames = useCallback(async (
    gridImageUrl: string,
    projectId: string,
    frameNumbers: number[]
  ) => {
    setIsExtracting(true);
    setError(null);

    setProgress({ current: 0, total: frameNumbers.length, stage: 'Preparing...' });

    try {
      // Step 1: Crop all frames client-side
      const allCroppedFrames = await cropGridToFrames(gridImageUrl, gridConfig);

      // Filter to only the selected frame numbers
      const selectedFrames = allCroppedFrames.filter(f =>
        frameNumbers.includes(f.frameNumber)
      );

      // Update UI
      setExtractedFrames(prev => [
        ...prev.filter(f => !frameNumbers.includes(f.frameNumber)),
        ...selectedFrames.map(f => ({
          ...f,
          originalUrl: f.base64Data,
          status: 'cropping' as const,
          width: f.width,
          height: f.height,
        })),
      ]);

      setProgress({ current: selectedFrames.length, total: frameNumbers.length, stage: 'Uploading & upscaling...' });

      // Step 2: Server-side upload + upscale
      const result = await processExtractedFrames(
        projectId,
        selectedFrames,
        shouldUpscale
      );

      if (result.success && result.frames) {
        setExtractedFrames(prev => {
          const unchanged = prev.filter(f => !frameNumbers.includes(f.frameNumber));
          const updated = result.frames!.map(f => ({
            ...f,
            status: 'completed' as const,
          }));
          return [...unchanged, ...updated].sort((a, b) => a.frameNumber - b.frameNumber);
        });
      } else {
        throw new Error(result.error || 'Extraction failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Frame extraction failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsExtracting(false);
    }
  }, [gridConfig, shouldUpscale]);

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
