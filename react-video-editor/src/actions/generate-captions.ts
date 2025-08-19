'use server';

import { generateCaptionsForAudio, CaptionGenerationOptions, extractAudioUrl } from './tools/caption-orchestrator';
import type { 
  GenerateCaptionsRequest, 
  CaptionGenerationResponse, 
  ProfessionalCaptionChunk 
} from '../types/caption-types';

/**
 * Generate Captions Server Action
 * 
 * Frontend-callable server action for generating professional captions
 * with frame-accurate timing using direct Whisper word boundaries.
 */

// Using imported GenerateCaptionsRequest from caption-types

export interface GenerateCaptionsFormData {
  audioUrl: string;
  existingWhisperData?: string; // JSON stringified
  options?: string; // JSON stringified  
}

/**
 * Server Action: Generate captions from form data
 */
export async function generateCaptions(formData: FormData) {
  try {
    const audioUrl = formData.get('audioUrl') as string;
    const existingWhisperDataStr = formData.get('existingWhisperData') as string;
    const optionsStr = formData.get('options') as string;

    if (!audioUrl) {
      return {
        success: false,
        error: 'Audio URL is required'
      };
    }

    // Parse optional data
    const existingWhisperData = existingWhisperDataStr 
      ? JSON.parse(existingWhisperDataStr) 
      : undefined;
    
    const options = optionsStr 
      ? JSON.parse(optionsStr) 
      : {};

    console.log('🎬 Server Action: Generating captions for:', audioUrl);

    // Call the orchestrator
    const result = await generateCaptionsForAudio(
      audioUrl,
      existingWhisperData,
      options
    );

    return result;

  } catch (error) {
    console.error('❌ Server Action Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Caption generation failed',
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
}

/**
 * Server Action: Generate captions from structured request
 */
export async function generateCaptionsFromRequest(request: GenerateCaptionsRequest) {
  try {
    console.log('🎬 Caption Request:', {
      hasAudioUrl: !!request.audioUrl,
      hasEditorData: !!request.editorData,
      hasWhisperData: !!request.existingWhisperData
    });

    // Extract audio URL from various sources
    let audioUrl = request.audioUrl;
    
    if (!audioUrl && request.editorData) {
      audioUrl = await extractAudioUrl({
        trackItems: request.editorData.trackItems,
        whisperData: request.existingWhisperData
      });
    }

    if (!audioUrl) {
      return {
        success: false,
        error: 'Could not find audio URL in request or editor data'
      };
    }

    // Generate captions using the orchestrator
    const result = await generateCaptionsForAudio(
      audioUrl,
      request.existingWhisperData,
      request.options
    );

    return result;

  } catch (error) {
    console.error('❌ Caption Request Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Caption generation failed',
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
}


/**
 * Type-safe wrapper for client components
 */
export type { 
  CaptionGenerationOptions, 
  ProfessionalCaptionChunk,
  CaptionGenerationResponse 
} from './tools/caption-orchestrator';