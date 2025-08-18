'use client';

import { useState, useCallback } from 'react';
import type { 
  GenerateCaptionsRequest, 
  CaptionGenerationResponse, 
  ProfessionalCaptionChunk,
  CaptionGenerationOptions 
} from '../types/caption-types';

/**
 * React Hook for Caption Generation
 * 
 * Provides a clean interface for generating captions in the editor
 * with loading states, error handling, and progress tracking.
 */

export interface CaptionGeneratorState {
  isGenerating: boolean;
  progress: number;
  currentStage: string;
  error: string | null;
  lastResult: CaptionGenerationResponse | null;
}

export interface UseCaptionGeneratorReturn {
  state: CaptionGeneratorState;
  generateCaptions: (request: GenerateCaptionsRequest) => Promise<CaptionGenerationResponse>;
  clearError: () => void;
  reset: () => void;
}

export function useCaptionGenerator(): UseCaptionGeneratorReturn {
  const [state, setState] = useState<CaptionGeneratorState>({
    isGenerating: false,
    progress: 0,
    currentStage: '',
    error: null,
    lastResult: null
  });

  const updateState = useCallback((updates: Partial<CaptionGeneratorState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const generateCaptions = useCallback(async (request: GenerateCaptionsRequest): Promise<CaptionGenerationResponse> => {
    console.log('🎬 Hook: Starting caption generation...');
    
    // Reset state
    updateState({
      isGenerating: true,
      progress: 0,
      currentStage: 'Initializing...',
      error: null,
      lastResult: null
    });

    try {
      // Stage 1: Preparation
      updateState({ progress: 10, currentStage: 'Preparing audio analysis...' });
      
      // Add a small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stage 2: Whisper Analysis (or reuse existing)
      if (!request.existingWhisperData) {
        updateState({ progress: 30, currentStage: 'Analyzing audio with Whisper AI...' });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate Whisper delay
      } else {
        updateState({ progress: 50, currentStage: 'Using existing Whisper data...' });
      }

      // Stage 3: Caption Generation
      updateState({ progress: 70, currentStage: 'Generating professional captions...' });
      
      // Use real Whisper-based implementation
      const { generateCaptionsFromRequest } = await import('../actions/generate-captions');
      const result = await generateCaptionsFromRequest(request);
      
      if (!result.success) {
        throw new Error(result.error || 'Caption generation failed');
      }

      // Stage 4: Complete
      updateState({ 
        progress: 100, 
        currentStage: 'Complete!',
        isGenerating: false,
        lastResult: result
      });

      console.log('🎉 Hook: Caption generation completed:', {
        chunks: result.total_chunks,
        duration: result.total_duration.toFixed(1) + 's',
        quality: result.quality_metrics.readability_score
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Hook: Caption generation failed:', errorMessage);
      
      updateState({
        isGenerating: false,
        progress: 0,
        currentStage: '',
        error: errorMessage,
        lastResult: null
      });

      // Return error response
      return {
        success: false,
        error: errorMessage,
        captions: [],
        total_chunks: 0,
        total_duration: 0,
        avg_words_per_chunk: 0,
        quality_metrics: {
          avg_confidence: 0,
          timing_precision: 0,
          readability_score: 0
        }
      };
    }
  }, [updateState]);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      progress: 0,
      currentStage: '',
      error: null,
      lastResult: null
    });
  }, []);

  return {
    state,
    generateCaptions,
    clearError,
    reset
  };
}

/**
 * Utility: Extract audio info from editor timeline
 */
export function extractAudioFromTimeline(trackItems: any[]): { audioUrl?: string; duration?: number } {
  const audioTrack = trackItems.find(item => 
    item.type === 'audio' && item.details?.src
  );

  if (!audioTrack) {
    return {};
  }

  return {
    audioUrl: audioTrack.details.src,
    duration: audioTrack.duration
  };
}

/**
 * Utility: Check if existing captions are available
 */
export function hasExistingCaptions(trackItems: any[]): boolean {
  return trackItems.some(item => 
    item.type === 'text' && item.details?.isCaptionTrack
  );
}

/**
 * Utility: Convert captions to timeline track items
 */
export function captionsToTrackItems(
  captions: CaptionGenerationResponse['captions'],
  trackId: string = 'ai-captions'
): any[] {
  if (!captions || captions.length === 0) {
    return [];
  }

  return captions.map((caption, index) => ({
    id: `${trackId}-${index}`,
    type: 'text',
    start: Math.round(caption.start_time * 30), // Convert to frames
    duration: Math.round(caption.duration * 30), // Convert to frames
    details: {
      text: caption.text,
      lines: caption.lines,
      isCaptionTrack: true,
      confidence: caption.confidence,
      wordBoundaries: caption.word_boundaries,
      
      // Styling for professional captions
      style: {
        fontSize: 24,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        textAlign: 'center',
        position: 'bottom',
        padding: 8
      }
    },
    metadata: {
      source: 'ai-generated',
      generator: 'whisper-caption-orchestrator',
      frameAligned: true,
      qualityScore: caption.confidence
    }
  }));
}