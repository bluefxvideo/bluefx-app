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
 * Supports multiple audio sources (audio + video tracks) with timeline offsets.
 */
export async function generateCaptionsFromRequest(request: GenerateCaptionsRequest) {
  try {
    console.log('🎬 Caption Request:', {
      hasAudioUrl: !!request.audioUrl,
      hasAudioSources: !!request.audioSources,
      audioSourceCount: request.audioSources?.length || 0,
      hasEditorData: !!request.editorData,
      hasWhisperData: !!request.existingWhisperData,
      hasOriginalScript: !!request.originalScript
    });

    // Multi-source path: process each audio source separately and merge
    if (request.audioSources && request.audioSources.length > 0) {
      console.log(`🎬 Multi-source caption generation: ${request.audioSources.length} source(s)`);

      const allCaptions: ProfessionalCaptionChunk[] = [];
      let totalDuration = 0;
      let totalConfidence = 0;
      let totalTimingPrecision = 0;
      let totalReadability = 0;
      let successCount = 0;

      for (let i = 0; i < request.audioSources.length; i++) {
        const source = request.audioSources[i];
        console.log(`🎤 Processing source ${i + 1}/${request.audioSources.length}: ${source.type} @ offset ${source.offsetMs}ms`);

        try {
          const result = await generateCaptionsForAudio(
            source.url,
            undefined, // No existing whisper data for individual sources
            {
              ...request.options,
              timelineOffsetMs: source.offsetMs,
              audioDuration: source.durationMs / 1000, // Convert ms to seconds
            },
            // Only pass original script for the primary audio track (voiceover)
            source.type === 'audio' ? request.originalScript : undefined
          );

          if (result.success && result.captions.length > 0) {
            allCaptions.push(...result.captions);
            totalDuration = Math.max(totalDuration, result.total_duration + (source.offsetMs / 1000));
            totalConfidence += result.quality_metrics.avg_confidence;
            totalTimingPrecision += result.quality_metrics.timing_precision;
            totalReadability += result.quality_metrics.readability_score;
            successCount++;
            console.log(`✅ Source ${i + 1}: ${result.captions.length} captions generated`);
          } else {
            console.warn(`⚠️ Source ${i + 1} (${source.type}): ${result.error || 'No captions generated'}`);
          }
        } catch (sourceError) {
          console.error(`❌ Source ${i + 1} failed:`, sourceError);
          // Continue with other sources — don't fail the whole generation
        }
      }

      if (allCaptions.length === 0) {
        return {
          success: false,
          error: 'No captions could be generated from any audio source',
          captions: [],
          total_chunks: 0,
          total_duration: 0,
          avg_words_per_chunk: 0,
          quality_metrics: { avg_confidence: 0, timing_precision: 0, readability_score: 0 }
        };
      }

      // Sort all captions by start_time and re-index IDs
      allCaptions.sort((a, b) => a.start_time - b.start_time);
      allCaptions.forEach((caption, idx) => {
        caption.id = `caption-${idx}`;
      });

      const avgWordsPerChunk = allCaptions.reduce((sum, c) => sum + c.word_count, 0) / allCaptions.length;

      console.log(`🎉 Multi-source merge complete: ${allCaptions.length} total captions from ${successCount} source(s)`);

      return {
        success: true,
        captions: allCaptions,
        total_chunks: allCaptions.length,
        total_duration: totalDuration,
        avg_words_per_chunk: avgWordsPerChunk,
        quality_metrics: {
          avg_confidence: successCount > 0 ? totalConfidence / successCount : 0,
          timing_precision: successCount > 0 ? totalTimingPrecision / successCount : 0,
          readability_score: successCount > 0 ? totalReadability / successCount : 0,
        }
      };
    }

    // Single-source fallback: extract audio URL from various sources
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

    // Generate captions using the orchestrator — pass original script for punctuation
    const result = await generateCaptionsForAudio(
      audioUrl,
      request.existingWhisperData,
      request.options,
      request.originalScript
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