'use server';

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client for server actions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface VoiceGenerationRequest {
  segments: Array<{
    id: string;
    text: string;
    start_time: number;
    end_time: number;
    duration: number;
  }>;
  voice_settings: {
    voice_id: 'anna' | 'eric' | 'felix' | 'oscar' | 'nina' | 'sarah';
    speed: 'slower' | 'normal' | 'faster';
    emotion: 'neutral' | 'excited' | 'calm' | 'authoritative' | 'confident';
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
  'slower': 0.85,
  'normal': 1.0,
  'faster': 1.25
} as const;

/**
 * Generate voice for all segments as one continuous audio file
 * More efficient and ensures consistent voice across segments
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

    // Get the OpenAI voice name
    const openAIVoice = VOICE_MAPPING[request.voice_settings.voice_id] || 'alloy';
    const speedValue = SPEED_MAPPING[request.voice_settings.speed] || 1.0;
    
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

    return {
      success: true,
      audio_url: urlData.publicUrl,
      credits_used: 5, // Base cost for voice generation
      generation_time_ms: generationTime
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

/**
 * Generate voice for a simple script (used in step-by-step generator)
 * Creates a single segment and generates voice for it
 */
export async function generateVoiceForScript(
  script: string,
  voice_settings: {
    voice_id: 'anna' | 'eric' | 'felix' | 'oscar' | 'nina' | 'sarah';
    speed?: 'slower' | 'normal' | 'faster';
    emotion?: 'neutral' | 'excited' | 'calm' | 'authoritative' | 'confident';
  },
  user_id: string
): Promise<{ success: boolean; audio_url?: string; error?: string; credits_used: number }> {
  const startTime = Date.now();
  
  try {
    console.log(`🎤 Generating voice for script using ${voice_settings.voice_id}`);
    
    // Get the OpenAI voice name
    const openAIVoice = VOICE_MAPPING[voice_settings.voice_id] || 'alloy';
    const speedValue = SPEED_MAPPING[voice_settings.speed || 'normal'] || 1.0;
    
    console.log(`🔊 OpenAI TTS: voice=${openAIVoice}, speed=${speedValue}`);
    
    // Generate speech using OpenAI TTS
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: openAIVoice as any,
      input: script.trim(),
      speed: speedValue,
      response_format: 'mp3'
    });

    // Convert response to buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Upload to Supabase Storage
    const timestamp = Date.now();
    const fileName = `${user_id}/voice/preview/script_${timestamp}.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('script-videos')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
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

    return {
      success: true,
      audio_url: urlData.publicUrl,
      credits_used: 3 // Cost for preview generation
    };

  } catch (error) {
    console.error('Voice generation error:', error);
    return {
      success: false,
      credits_used: 0,
      error: error instanceof Error ? error.message : 'Voice generation failed'
    };
  }
}

// Validation logic moved inline to orchestrator to avoid server action constraints