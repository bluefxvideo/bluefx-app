/**
 * Caption Generation Types
 * Shared types for caption generation system
 */

export interface CaptionGenerationOptions {
  maxWordsPerChunk?: number;      // Default: 6 words
  minChunkDuration?: number;      // Default: 0.833 seconds (5/6 second)
  maxChunkDuration?: number;      // Default: 4.0 seconds
  frameRate?: number;             // Default: 30fps
  maxCharsPerLine?: number;       // Default: 42 characters
  contentType?: 'educational' | 'standard' | 'fast';  // Default: 'standard'
}

export interface ProfessionalCaptionChunk {
  id: string;
  text: string;
  start_time: number;       // Frame-aligned absolute timing
  end_time: number;         // Frame-aligned absolute timing
  duration: number;
  word_count: number;
  char_count: number;
  lines: string[];          // Split into 1-2 lines for display
  confidence: number;       // Average word confidence
  word_boundaries: {        // Individual word timings for fine control
    word: string;
    start: number;
    end: number;
    confidence: number;
  }[];
}

export interface CaptionGenerationResponse {
  success: boolean;
  captions: ProfessionalCaptionChunk[];
  total_chunks: number;
  total_duration: number;
  avg_words_per_chunk: number;
  quality_metrics: {
    avg_confidence: number;
    timing_precision: number;  // Frame alignment accuracy
    readability_score: number; // Based on chunk length and line breaks
  };
  whisper_data?: any; // Include for debugging/reuse
  error?: string;
}

export interface GenerateCaptionsRequest {
  // Audio source (one of these required)
  audioUrl?: string;
  
  // Editor data (extract audio from timeline)
  editorData?: {
    trackItems?: any[];
    currentAudioTrack?: any;
  };
  
  // Existing Whisper data (for reuse/optimization)
  existingWhisperData?: any;
  
  // Generation options
  options?: CaptionGenerationOptions;
}