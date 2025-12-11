'use server';

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface VoiceGenerationRequest {
  segments: Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    duration: number;
  }>;
  voice_settings: {
    voice_id: string; // Any OpenAI TTS voice ID
    speed: number | 'slower' | 'normal' | 'faster'; // Support both new number format and legacy strings
    emotion?: 'neutral' | 'excited' | 'calm' | 'authoritative' | 'confident';
    pitch?: number; // -20 to 20 semitones
    volume?: number; // 0.0 to 1.0
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

// Map your voice IDs to OpenAI TTS voices
const VOICE_MAPPING: Record<string, string> = {
  // UI voice names
  'anna': 'nova',      // Female, friendly
  'eric': 'onyx',      // Male, confident  
  'felix': 'echo',     // Male, warm
  'oscar': 'fable',    // Male, authoritative
  'nina': 'shimmer',   // Female, gentle
  'sarah': 'alloy',    // Female, professional
  
  // Direct OpenAI voice names (pass-through)
  'alloy': 'alloy',
  'echo': 'echo',
  'fable': 'fable',
  'nova': 'nova',
  'onyx': 'onyx',
  'shimmer': 'shimmer'
};

// Map speed settings to OpenAI speed values
const SPEED_MAPPING = {
  'slower': 0.75,
  'normal': 1.0,
  'faster': 1.25
} as const;

// Convert speed setting to numeric value
const convertSpeed = (speed: number | 'slower' | 'normal' | 'faster'): number => {
  if (typeof speed === 'number') {
    // Clamp between 0.25 and 4.0 as per OpenAI TTS limits
    return Math.max(0.25, Math.min(4.0, speed));
  }
  return SPEED_MAPPING[speed] || 1.0;
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
    // Convert to segments format for compatibility
    const segments = [{
      id: 'single',
      text: script,
      start_time: 0,
      end_time: 0,
      duration: 0
    }];

    const request: VoiceGenerationRequest = {
      segments,
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
 * More efficient and ensures consistent voice across segments
 */
export async function generateVoiceForAllSegments(
  request: VoiceGenerationRequest
): Promise<VoiceGenerationResponse> {
  const startTime = Date.now();
  const openai = getOpenAI();
  const supabase = getSupabaseClient();

  try {
    console.log(`🎤 Generating voice for ${request.segments.length} segments using ${request.voice_settings.voice_id}`);

    // Combine all segment texts with natural pauses
    const fullScript = request.segments
      .map(segment => segment.text.trim())
      .join('... '); // Add pause between segments

    // Get the OpenAI voice name - support direct OpenAI voice IDs
    const openAIVoice = VOICE_MAPPING[request.voice_settings.voice_id] || request.voice_settings.voice_id || 'alloy';
    const speedValue = convertSpeed(request.voice_settings.speed);
    
    console.log(`🔊 OpenAI TTS: voice=${openAIVoice}, speed=${speedValue}`);
    
    // Generate speech using OpenAI TTS
    const response = await openai.audio.speech.create({
      model: 'tts-1', // or 'tts-1-hd' for higher quality
      voice: openAIVoice as any, // OpenAI expects specific voice strings
      input: fullScript,
      speed: speedValue,
      response_format: 'mp3'
    });

    // Convert response to buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Measure actual audio duration by analyzing the MP3 buffer
    let actualDuration: number | null = null;
    let actualSpeechDuration: number | null = null;
    try {
      // Simple MP3 duration estimation based on file size and bitrate
      // This gives us the TOTAL file duration (including silence)
      const fileSizeBytes = audioBuffer.length;
      // OpenAI TTS-1 model uses ~96kbps for standard quality
      // If file seems to be 47s but is actually 38s, the real bitrate is:
      // Real bitrate = (assumed bitrate * assumed duration) / actual duration
      // Real bitrate = (128000 * 47.76) / 38 ≈ 160000 bps
      // This suggests OpenAI is actually using ~160kbps for better quality
      const estimatedBitrate = 160000; // OpenAI TTS actually uses ~160kbps based on empirical testing
      const fileDurationSeconds = (fileSizeBytes * 8) / estimatedBitrate;
      actualDuration = fileDurationSeconds;

      console.log(`🎵 File duration: ${fileSizeBytes} bytes → ~${actualDuration.toFixed(2)}s total`);

      // Use Whisper to detect actual speech duration (excluding trailing silence)
      // This is more accurate than file size estimation
      try {
        console.log(`🔍 Analyzing speech duration with Whisper...`);

        // Convert buffer to File-like Blob for OpenAI API
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        (audioBlob as any).name = 'audio.mp3';
        const audioFile = audioBlob as File;

        // Use Whisper to get precise word timings
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['word']
        });

        // Find the last spoken word's end time
        const whisperWords = (transcription as any).words || [];
        if (whisperWords.length > 0) {
          actualSpeechDuration = Math.max(...whisperWords.map((w: any) => w.end));
          console.log(`✅ Actual speech duration: ${actualSpeechDuration.toFixed(2)}s (last word ends)`);
          console.log(`📊 Silence detected: ${(actualDuration - actualSpeechDuration).toFixed(2)}s of trailing silence`);
        } else {
          // Fallback to file duration if no words detected
          actualSpeechDuration = actualDuration;
          console.log(`⚠️ No words detected, using file duration`);
        }
      } catch (whisperError) {
        console.warn('⚠️ Whisper analysis failed, using file duration:', whisperError);
        actualSpeechDuration = actualDuration;
      }

    } catch (durationError) {
      console.warn('⚠️ Could not measure audio duration:', durationError);
      // Continue without duration - the timing fix won't run but generation won't fail
    }
    
    // Upload to Supabase Storage
    const fileName = `${request.user_id}/voice/${request.batch_id}.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('script-videos')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true // Allow overwriting
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('script-videos')
      .getPublicUrl(fileName);

    const generationTime = Date.now() - startTime;
    console.log(`✅ Voice generated successfully in ${generationTime}ms: ${urlData.publicUrl}`);
    
    // Include actual duration in metadata for timing correction
    // Use speech duration (without silence) if available, otherwise file duration
    const metadata = (actualSpeechDuration || actualDuration) ? {
      actual_duration: actualSpeechDuration || actualDuration, // Use speech duration preferentially
      file_duration: actualDuration, // Total file duration including silence
      speech_duration: actualSpeechDuration, // Actual speech duration without trailing silence
      file_size_bytes: audioBuffer.length,
      estimated_bitrate: 160000,
      analysis_method: actualSpeechDuration ? 'whisper_speech_detection' : 'file_size_estimation',
      silence_duration: actualSpeechDuration && actualDuration ? actualDuration - actualSpeechDuration : 0
    } : undefined;

    return {
      success: true,
      audio_url: urlData.publicUrl,
      credits_used: 5, // Base cost for voice generation
      generation_time_ms: generationTime,
      metadata: metadata
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
  const openai = getOpenAI();
  const supabase = getSupabaseClient();

  try {
    console.log(`🎤 Generating individual voice files for ${request.segments.length} segments`);

    for (const segment of request.segments) {
      try {
        // Generate speech for this segment
        const response = await openai.audio.speech.create({
          model: 'tts-1',
          voice: VOICE_MAPPING[request.voice_settings.voice_id],
          input: segment.text.trim(),
          speed: SPEED_MAPPING[request.voice_settings.speed],
          response_format: 'mp3'
        });

        // Convert to buffer
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        
        // Upload to storage
        const fileName = `${request.user_id}/voice/segments/${segment.id}.mp3`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('script-videos')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('script-videos')
          .getPublicUrl(fileName);

        segmentAudios.push({
          segment_id: segment.id,
          audio_url: urlData.publicUrl,
          duration: segment.duration
        });

        totalCredits += 2; // Cost per segment
        
        console.log(`✅ Generated voice for segment ${segment.id}`);

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
  const openai = getOpenAI();
  const supabase = getSupabaseClient();

  try {
    console.log(`🔄 Regenerating voice for segment ${segment_id}`);

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: VOICE_MAPPING[voice_settings.voice_id],
      input: text.trim(),
      speed: SPEED_MAPPING[voice_settings.speed],
      response_format: 'mp3'
    });

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const fileName = `${user_id}/voice/segments/${segment_id}_${Date.now()}.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('script-videos')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('script-videos')
      .getPublicUrl(fileName);

    console.log(`✅ Regenerated voice for segment ${segment_id}`);

    return {
      success: true,
      audio_url: urlData.publicUrl
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
  // Rough estimate: ~100ms per character for TTS processing
  return Math.max(2000, textLength * 100); // Minimum 2 seconds
}


// Validation logic moved inline to orchestrator to avoid server action constraints