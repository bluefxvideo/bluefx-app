'use server';

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type MinimaxEmotion = 'auto' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'neutral';

export interface MinimaxVoiceSettings {
  voice_id: string;
  speed?: number; // 0.5-2.0 (default 1.0)
  pitch?: number; // -12 to +12 (default 0)
  volume?: number; // 0-10 (default 5)
  emotion?: MinimaxEmotion;
  subtitle_enable?: boolean; // Legacy param, no longer used (fal.ai returns duration_ms instead)
}

export interface MinimaxVoiceRequest {
  text: string;
  voice_settings: MinimaxVoiceSettings;
  user_id: string;
  batch_id: string;
}

export interface MinimaxVoiceResponse {
  success: boolean;
  audio_url?: string;
  credits_used: number;
  generation_time_ms: number;
  metadata?: {
    voice_id: string;
    duration_estimate?: number;
    [key: string]: any;
  };
  error?: string;
}

// Minimax system voice IDs - 17 core + 39 extended English voices (internal, not exported)
const MINIMAX_SYSTEM_VOICES = [
  // Core 17 voices
  'Wise_Woman',
  'Friendly_Person',
  'Inspirational_girl',
  'Deep_Voice_Man',
  'Calm_Woman',
  'Casual_Guy',
  'Lively_Girl',
  'Patient_Man',
  'Young_Knight',
  'Determined_Man',
  'Lovely_Girl',
  'Decent_Boy',
  'Imposing_Manner',
  'Elegant_Man',
  'Abbess',
  'Sweet_Girl_2',
  'Exuberant_Girl',
  // Extended Professional voices
  'English_Trustworth_Man',
  'English_Diligent_Man',
  'English_Graceful_Lady',
  'English_ManWithDeepVoice',
  'English_MaturePartner',
  'English_MatureBoss',
  'English_Debator',
  'English_Steadymentor',
  'English_Deep-VoicedGentleman',
  'English_Wiselady',
  'English_WiseScholar',
  'English_ConfidentWoman',
  'English_PatientMan',
  'English_BossyLeader',
  // Extended Natural voices
  'English_CalmWoman',
  'English_Gentle-voiced_man',
  'English_ReservedYoungMan',
  'English_FriendlyPerson',
  'English_LovelyGirl',
  'English_DecentYoungMan',
  'English_Soft-spokenGirl',
  'English_SereneWoman',
  'English_Kind-heartedGirl',
  // Extended Expressive voices
  'English_UpsetGirl',
  'English_Whispering_girl',
  'English_PlayfulGirl',
  'English_CaptivatingStoryteller',
  'English_SentimentalLady',
  'English_SadTeen',
  'English_Strong-WilledBoy',
  'English_StressedLady',
  'English_Jovialman',
  'English_WhimsicalGirl',
  // Extended Character voices
  'English_Aussie_Bloke',
  'English_ImposingManner',
  'English_PassionateWarrior',
  'English_Comedian',
  'English_AssertiveQueen',
  'English_AnimeCharacter'
] as const;

// fal.ai response shape for Speech-02 HD
interface FalSpeechResponse {
  audio: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
  duration_ms: number;
}

/**
 * Generate voice using Minimax Speech-02 HD via fal.ai
 */
export async function generateMinimaxVoice(
  request: MinimaxVoiceRequest
): Promise<MinimaxVoiceResponse> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  try {
    console.log(`🎤 Generating Minimax voice with ${request.voice_settings.voice_id}`);

    // Validate text length (max 5,000 characters for fal.ai Speech-02 HD)
    if (request.text.length > 5000) {
      throw new Error('Text exceeds maximum length of 5,000 characters');
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      throw new Error('FAL_KEY not configured');
    }

    // Prepare fal.ai input
    const speed = Math.max(0.5, Math.min(2.0, request.voice_settings.speed ?? 1.0));
    const pitch = Math.max(-12, Math.min(12, request.voice_settings.pitch ?? 0));
    const vol = Math.max(0, Math.min(10, request.voice_settings.volume ?? 1));
    const emotion = request.voice_settings.emotion ?? 'auto';

    const voiceSetting: Record<string, unknown> = {
      voice_id: request.voice_settings.voice_id,
      speed,
      vol,
      pitch,
    };

    // fal.ai doesn't support 'auto' emotion — omit it to let the model decide naturally
    if (emotion !== 'auto') {
      voiceSetting.emotion = emotion;
    }

    console.log(`🔊 Minimax TTS (fal.ai): voice=${voiceSetting.voice_id}, speed=${speed}, pitch=${pitch}, vol=${vol}, emotion=${emotion}`);

    // Call fal.ai Speech-02 HD
    const response = await fetch('https://fal.run/fal-ai/minimax/speech-02-hd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify({
        text: request.text,
        voice_setting: voiceSetting,
        audio_setting: {
          sample_rate: 44100,
          bitrate: 128000,
          format: 'mp3',
          channel: 1,
        },
        output_format: 'url',
        language_boost: 'English',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`fal.ai API error (${response.status}): ${errorText}`);
    }

    const result: FalSpeechResponse = await response.json();

    if (!result.audio?.url) {
      throw new Error('No audio URL in fal.ai response');
    }

    const audioUrl = result.audio.url;
    const durationMs = result.duration_ms;
    const durationSeconds = durationMs / 1000;

    console.log(`📥 Received audio from fal.ai: ${audioUrl} (${durationSeconds.toFixed(1)}s)`);

    // Fetch the audio file from fal.ai's output URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`);
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Upload to Supabase Storage
    const fileName = `${request.user_id}/voice/${request.batch_id}.mp3`;

    const { error: uploadError } = await supabase.storage
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
    console.log(`✅ Minimax voice generated in ${generationTime}ms: ${urlData.publicUrl}`);

    return {
      success: true,
      audio_url: urlData.publicUrl,
      credits_used: 2,
      generation_time_ms: generationTime,
      metadata: {
        voice_id: request.voice_settings.voice_id,
        duration_estimate: durationSeconds,
        file_size_bytes: audioBuffer.length,
        provider: 'minimax-fal',
      }
    };

  } catch (error) {
    console.error('❌ Minimax voice generation error:', error);
    return {
      success: false,
      credits_used: 0,
      generation_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Voice generation failed'
    };
  }
}

/**
 * Generate voice for a simple script (compatibility wrapper)
 */
export async function generateVoiceForScript(
  script: string,
  voice_settings: MinimaxVoiceSettings,
  user_id: string
): Promise<{
  success: boolean;
  audio_url?: string;
  credits_used: number;
  error?: string;
}> {
  const request: MinimaxVoiceRequest = {
    text: script,
    voice_settings,
    user_id,
    batch_id: crypto.randomUUID()
  };

  const result = await generateMinimaxVoice(request);

  return {
    success: result.success,
    audio_url: result.audio_url,
    credits_used: result.credits_used,
    error: result.error
  };
}

/**
 * Check if a voice ID is a system voice or a cloned voice
 */
export async function isSystemVoice(voiceId: string): Promise<boolean> {
  return MINIMAX_SYSTEM_VOICES.includes(voiceId as typeof MINIMAX_SYSTEM_VOICES[number]);
}
