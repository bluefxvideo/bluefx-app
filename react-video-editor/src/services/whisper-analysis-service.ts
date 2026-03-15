'use server';

/**
 * Whisper Analysis Service (Editor)
 *
 * Proxies Whisper speech analysis through the main BlueFX app API
 * which has the OpenAI API key. The editor doesn't need its own key.
 */

export interface WhisperAnalysisRequest {
  audio_url: string;
  segments: Array<{
    id: string;
    text: string;
    start_time?: number;
    end_time?: number;
  }>;
  language?: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence: number;
  frame_start?: number;
  frame_end?: number;
  phonetic_match_score?: number;
}

export interface SegmentTiming {
  segment_id: string;
  text: string;
  start_time: number;
  end_time: number;
  duration: number;
  word_timings: WordTiming[];
}

export interface WhisperAnalysisResponse {
  success: boolean;
  total_duration: number;
  segment_timings: SegmentTiming[];
  raw_word_timings?: WordTiming[]; // All word timings (populated when segments is empty)
  /** Full transcript text from Whisper (includes punctuation and capitalization) */
  full_transcript?: string;
  word_count: number;
  speaking_rate: number; // words per minute
  confidence_score: number;
  alignment_quality: 'high' | 'medium' | 'low';
  frame_rate: number;
  timing_precision: 'frame' | 'millisecond';
  error?: string;
}

/**
 * Get the main BlueFX app API URL.
 * In production the editor is served from a different domain,
 * so we rely on the NEXT_PUBLIC_API_URL env var.
 */
function getMainAppApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:3000'
  );
}

/**
 * Analyze audio with Whisper via the main BlueFX app API.
 * The main app has the OpenAI API key and handles the actual Whisper call.
 */
export async function analyzeAudioWithWhisper(
  request: WhisperAnalysisRequest,
  frameRate: number = 30
): Promise<WhisperAnalysisResponse> {
  const startTime = Date.now();

  try {
    const apiUrl = getMainAppApiUrl();
    console.log(`🎤 Proxying Whisper analysis via ${apiUrl}/api/editor/whisper-analysis`);

    const response = await fetch(`${apiUrl}/api/editor/whisper-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_url: request.audio_url,
        segments: request.segments,
        language: request.language,
        frame_rate: frameRate,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Whisper API proxy error:', response.status, errorText.substring(0, 200));
      throw new Error(`Whisper analysis failed (${response.status}): ${errorText.substring(0, 100)}`);
    }

    const result: WhisperAnalysisResponse = await response.json();

    const processingTime = Date.now() - startTime;
    console.log(`✅ Whisper analysis completed in ${processingTime}ms:`, {
      duration: result.total_duration,
      words: result.word_count,
      quality: result.alignment_quality,
    });

    return result;
  } catch (error) {
    console.error('❌ Whisper analysis error:', error);
    return {
      success: false,
      total_duration: 0,
      segment_timings: [],
      word_count: 0,
      speaking_rate: 0,
      confidence_score: 0,
      error: error instanceof Error ? error.message : 'Whisper analysis failed',
      alignment_quality: 'low',
      frame_rate: frameRate,
      timing_precision: 'millisecond',
    };
  }
}
