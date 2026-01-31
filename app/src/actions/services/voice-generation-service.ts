'use server';

import { generateMinimaxVoice } from './minimax-voice-service';

export interface VoiceGenerationRequest {
  segments: Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    duration: number;
  }>;
  voice_settings: {
    voice_id: string; // Minimax voice ID (e.g., 'Friendly_Person', 'Deep_Voice_Man')
    speed: number | 'slower' | 'normal' | 'faster';
    emotion?: 'neutral' | 'excited' | 'calm' | 'authoritative' | 'confident';
    pitch?: number; // -12 to +12 for Minimax
    volume?: number; // 0-10 for Minimax
    emphasis?: 'strong' | 'moderate' | 'none';
  };
  user_id: string;
  batch_id: string;
}

export interface VoiceGenerationResponse {
  success: boolean;
  audio_url?: string;
  segment_audio_urls?: Array<{
    segment_id: string;
    audio_url: string;
    duration: number;
  }>;
  credits_used: number;
  generation_time_ms: number;
  metadata?: {
    actual_duration?: number;
    file_size_bytes?: number;
    estimated_bitrate?: number;
    analysis_method?: string;
    [key: string]: any;
  };
  error?: string;
}

// Map speed settings to numeric values
const SPEED_MAPPING = {
  'slower': 0.75,
  'normal': 1.0,
  'faster': 1.25
} as const;

// Convert speed setting to numeric value (Minimax range: 0.5-2.0)
const convertSpeed = (speed: number | 'slower' | 'normal' | 'faster'): number => {
  if (typeof speed === 'number') {
    // Clamp between 0.5 and 2.0 as per Minimax limits
    return Math.max(0.5, Math.min(2.0, speed));
  }
  return SPEED_MAPPING[speed] || 1.0;
};

// Map emotion to Minimax emotion format
const mapEmotion = (emotion?: string): 'auto' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'neutral' => {
  switch (emotion) {
    case 'excited': return 'happy';
    case 'calm': return 'neutral';
    case 'authoritative': return 'neutral';
    case 'confident': return 'neutral';
    default: return 'auto';
  }
};

/**
 * Generate voice for a simple script (for script-to-video and talking avatar)
 * Simplified interface for single text generation
 */
export async function generateVoiceForScript(
  script: string,
  voice_settings: {
    voice_id: string;
    speed?: number;
    pitch?: number;
    volume?: number;
    emphasis?: 'strong' | 'moderate' | 'none';
  },
  user_id: string
): Promise<{
  success: boolean;
  audio_url?: string;
  credits_used: number;
  error?: string;
}> {
  try {
    const request: VoiceGenerationRequest = {
      segments: [{
        id: 'single',
        text: script,
        start_time: 0,
        end_time: 0,
        duration: 0
      }],
      voice_settings: {
        voice_id: voice_settings.voice_id,
        speed: voice_settings.speed || 1.0,
        emotion: 'neutral',
        pitch: voice_settings.pitch,
        volume: voice_settings.volume,
        emphasis: voice_settings.emphasis
      },
      user_id,
      batch_id: crypto.randomUUID()
    };

    const result = await generateVoiceForAllSegments(request);

    return {
      success: result.success,
      audio_url: result.audio_url,
      credits_used: result.credits_used,
      error: result.error
    };
  } catch (error) {
    console.error('❌ Voice generation for script failed:', error);
    return {
      success: false,
      credits_used: 0,
      error: error instanceof Error ? error.message : 'Voice generation failed'
    };
  }
}

/**
 * Generate voice for all segments as one continuous audio file
 * Uses Minimax Speech 2.6 HD via Replicate
 */
export async function generateVoiceForAllSegments(
  request: VoiceGenerationRequest
): Promise<VoiceGenerationResponse> {
  const startTime = Date.now();

  try {
    console.log(`🎤 Generating voice for ${request.segments.length} segments using ${request.voice_settings.voice_id}`);

    // Combine all segment texts with natural pauses
    const fullScript = request.segments
      .map(segment => segment.text.trim())
      .join('... '); // Add pause between segments

    const speedValue = convertSpeed(request.voice_settings.speed);
    const emotion = mapEmotion(request.voice_settings.emotion);

    console.log(`🔊 Minimax TTS: voice=${request.voice_settings.voice_id}, speed=${speedValue}, emotion=${emotion}`);

    // Generate speech using Minimax via Replicate
    const result = await generateMinimaxVoice({
      text: fullScript,
      voice_settings: {
        voice_id: request.voice_settings.voice_id,
        speed: speedValue,
        pitch: request.voice_settings.pitch,
        volume: request.voice_settings.volume,
        emotion: emotion
      },
      user_id: request.user_id,
      batch_id: request.batch_id
    });

    if (!result.success || !result.audio_url) {
      throw new Error(result.error || 'Minimax voice generation failed');
    }

    // Use Minimax subtitles for timing if available, otherwise fall back to estimate
    let actualDuration: number | undefined;
    let actualSpeechDuration: number | undefined;
    const subtitles = result.metadata?.subtitles as Array<{ text: string; start_time: number; end_time: number }> | undefined;

    if (result.metadata?.duration_estimate) {
      actualDuration = result.metadata.duration_estimate;
    }

    // Use Minimax subtitle timestamps for accurate duration (no Whisper needed!)
    if (subtitles && subtitles.length > 0) {
      // Get the end time of the last subtitle segment
      actualSpeechDuration = Math.max(...subtitles.map(s => s.end_time));
      console.log(`📝 Using Minimax subtitles: ${subtitles.length} segments, speech duration: ${actualSpeechDuration.toFixed(2)}s`);
    } else {
      // Fall back to duration estimate if no subtitles
      actualSpeechDuration = actualDuration;
      console.log(`⚠️ No subtitles from Minimax, using duration estimate: ${actualDuration?.toFixed(2)}s`);
    }

    const generationTime = Date.now() - startTime;
    console.log(`✅ Voice generated successfully in ${generationTime}ms: ${result.audio_url}`);

    // Include duration and subtitle metadata for timing correction
    const metadata = {
      actual_duration: actualSpeechDuration || actualDuration,
      speech_duration: actualSpeechDuration,
      file_duration: actualDuration,
      file_size_bytes: result.metadata?.file_size_bytes,
      estimated_bitrate: 128000,
      analysis_method: subtitles ? 'minimax_subtitles' : 'file_size_estimation',
      provider: 'minimax',
      subtitles: subtitles // Pass through for caption generation
    };

    return {
      success: true,
      audio_url: result.audio_url,
      credits_used: result.credits_used,
      generation_time_ms: generationTime,
      metadata
    };

  } catch (error) {
    console.error('Voice generation error:', error);
    return {
      success: false,
      credits_used: 0,
      generation_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Voice generation failed'
    };
  }
}

/**
 * Generate voice for individual segments (for editing scenarios)
 * Less efficient but allows per-segment customization
 */
export async function generateVoiceForSegments(
  request: VoiceGenerationRequest
): Promise<VoiceGenerationResponse> {
  const startTime = Date.now();
  const segmentAudios: Array<{ segment_id: string; audio_url: string; duration: number }> = [];
  let totalCredits = 0;

  try {
    console.log(`🎤 Generating individual voice files for ${request.segments.length} segments`);

    const speedValue = convertSpeed(request.voice_settings.speed);
    const emotion = mapEmotion(request.voice_settings.emotion);

    for (const segment of request.segments) {
      try {
        // Generate speech for this segment using Minimax
        const result = await generateMinimaxVoice({
          text: segment.text.trim(),
          voice_settings: {
            voice_id: request.voice_settings.voice_id,
            speed: speedValue,
            pitch: request.voice_settings.pitch,
            volume: request.voice_settings.volume,
            emotion: emotion
          },
          user_id: request.user_id,
          batch_id: `${request.batch_id}_${segment.id}`
        });

        if (result.success && result.audio_url) {
          segmentAudios.push({
            segment_id: segment.id,
            audio_url: result.audio_url,
            duration: result.metadata?.duration_estimate || segment.duration
          });
          totalCredits += result.credits_used;
          console.log(`✅ Generated voice for segment ${segment.id}`);
        } else {
          console.error(`Error generating voice for segment ${segment.id}:`, result.error);
        }

      } catch (segmentError) {
        console.error(`Error generating voice for segment ${segment.id}:`, segmentError);
        // Continue with other segments, don't fail entire process
      }
    }

    const generationTime = Date.now() - startTime;

    return {
      success: segmentAudios.length > 0,
      segment_audio_urls: segmentAudios,
      credits_used: totalCredits,
      generation_time_ms: generationTime,
      error: segmentAudios.length === 0 ? 'Failed to generate any segment audio' : undefined
    };

  } catch (error) {
    console.error('Segment voice generation error:', error);
    return {
      success: false,
      credits_used: totalCredits,
      generation_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Segment voice generation failed'
    };
  }
}

/**
 * Generate voice for a single segment (for regeneration)
 */
export async function regenerateSegmentVoice(
  segment_id: string,
  text: string,
  voice_settings: VoiceGenerationRequest['voice_settings'],
  user_id: string
): Promise<{ success: boolean; audio_url?: string; error?: string }> {
  try {
    console.log(`🔄 Regenerating voice for segment ${segment_id}`);

    const speedValue = convertSpeed(voice_settings.speed);
    const emotion = mapEmotion(voice_settings.emotion);

    const result = await generateMinimaxVoice({
      text: text.trim(),
      voice_settings: {
        voice_id: voice_settings.voice_id,
        speed: speedValue,
        pitch: voice_settings.pitch,
        volume: voice_settings.volume,
        emotion: emotion
      },
      user_id,
      batch_id: `${segment_id}_${Date.now()}`
    });

    if (!result.success || !result.audio_url) {
      throw new Error(result.error || 'Voice regeneration failed');
    }

    console.log(`✅ Regenerated voice for segment ${segment_id}`);

    return {
      success: true,
      audio_url: result.audio_url
    };

  } catch (error) {
    console.error(`Error regenerating voice for segment ${segment_id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Voice regeneration failed'
    };
  }
}

/**
 * Utility function to estimate voice generation duration
 * Helpful for progress tracking
 */
export async function estimateVoiceGenerationTime(textLength: number): Promise<number> {
  // Rough estimate: ~150ms per character for Minimax TTS processing via Replicate
  return Math.max(3000, textLength * 150); // Minimum 3 seconds
}
