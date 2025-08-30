'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getIdeogramV2aPrediction } from '@/actions/models/ideogram-v2-turbo';
import { getFaceSwapPrediction } from '@/actions/models/face-swap-cdingram';

interface PredictionPollingOptions {
  predictionId: string;
  predictionType: 'ideogram' | 'face-swap';
  onSuccess: (output: string | string[]) => void;
  onError: (error: string) => void;
  onProgress?: (status: string) => void;
  enabled?: boolean;
  pollInterval?: number;
  maxRetries?: number;
}

/**
 * Robust polling mechanism for Replicate predictions
 * This serves as a fallback when webhooks fail
 */
export function usePredictionPolling({
  predictionId,
  predictionType,
  onSuccess,
  onError,
  onProgress,
  enabled = true,
  pollInterval = 2000,
  maxRetries = 150 // 5 minutes with 2 second intervals
}: PredictionPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retriesRef = useRef(0);
  const isPollingRef = useRef(false);

  const checkPrediction = useCallback(async () => {
    if (!enabled || !predictionId || isPollingRef.current) return;
    
    try {
      isPollingRef.current = true;
      
      // Call appropriate API based on prediction type
      const prediction = predictionType === 'ideogram' 
        ? await getIdeogramV2aPrediction(predictionId)
        : await getFaceSwapPrediction(predictionId);
      
      // Update progress if callback provided
      if (onProgress && prediction.status !== 'succeeded' && prediction.status !== 'failed') {
        onProgress(prediction.status);
      }
      
      // Handle completion states
      if (prediction.status === 'succeeded' && prediction.output) {
        console.log(`✅ Polling: ${predictionType} completed successfully`);
        onSuccess(prediction.output);
        stopPolling();
      } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
        console.error(`❌ Polling: ${predictionType} failed:`, prediction.error);
        onError(prediction.error || `${predictionType} generation failed`);
        stopPolling();
      } else if (retriesRef.current >= maxRetries) {
        console.error(`⏱️ Polling: Timeout after ${maxRetries} attempts`);
        onError('Generation timed out. Please try again.');
        stopPolling();
      }
      
      retriesRef.current++;
    } catch (error) {
      console.error('Polling error:', error);
      // Don't stop polling on network errors - they might be temporary
      if (retriesRef.current >= maxRetries) {
        onError('Failed to check generation status');
        stopPolling();
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [predictionId, predictionType, onSuccess, onError, onProgress, enabled, maxRetries]);

  const startPolling = useCallback(() => {
    if (!enabled || !predictionId) return;
    
    console.log(`🔄 Starting polling for ${predictionType} prediction: ${predictionId}`);
    retriesRef.current = 0;
    
    // Initial check
    checkPrediction();
    
    // Set up interval for subsequent checks
    intervalRef.current = setInterval(checkPrediction, pollInterval);
  }, [enabled, predictionId, predictionType, checkPrediction, pollInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log(`⏹️ Stopped polling for ${predictionType}`);
    }
  }, [predictionType]);

  // Start polling when enabled and predictionId is available
  useEffect(() => {
    if (enabled && predictionId) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [enabled, predictionId, startPolling, stopPolling]);

  return {
    startPolling,
    stopPolling,
    isPolling: !!intervalRef.current,
    retryCount: retriesRef.current
  };
}