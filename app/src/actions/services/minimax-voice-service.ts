'use server';

import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

function getReplicate() {
  return new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
  });
}

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
  subtitle_enable?: boolean;
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


/**
 * Generate voice using Minimax Speech-2.8 HD via Replicate
 */
export async function generateMinimaxVoice(
  request: MinimaxVoiceRequest
): Promise<MinimaxVoiceResponse> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();

  try {
    console.log(`🎤 Generating Minimax voice with ${request.voice_settings.voice_id}`);

    // Validate text length (max 10,000 characters for Replicate Speech-2.8 HD)
    if (request.text.length > 10000) {
      throw new Error('Text exceeds maximum length of 10,000 characters');
    }

    const replicate = getReplicate();

    // Prepare Replicate input
    const speed = Math.max(0.5, Math.min(2.0, request.voice_settings.speed ?? 1.0));
    const pitch = Math.max(-12, Math.min(12, request.voice_settings.pitch ?? 0));
    const volume = Math.max(0, Math.min(10, request.voice_settings.volume ?? 1));
    const emotion = request.voice_settings.emotion ?? 'auto';

    const input: Record<string, unknown> = {
      text: request.text,
      voice_id: request.voice_settings.voice_id,
      speed,
      pitch,
      volume,
      emotion,
      sample_rate: 44100,
      bitrate: 128000,
      audio_format: 'mp3',
      channel: 'mono',
      language_boost: 'English',
      english_normalization: true,
    };

    console.log(`🔊 Minimax TTS (Replicate speech-2.8-hd): voice=${input.voice_id}, speed=${speed}, pitch=${pitch}, volume=${volume}, emotion=${emotion}`);

    // Call Replicate Speech-2.8 HD
    const output = await replicate.run(
      'minimax/speech-2.8-hd',
      { input }
    );

    // Replicate returns a URI string or a ReadableStream
    let audioUrl: string;
    if (typeof output === 'string') {
      audioUrl = output;
    } else if (output && typeof output === 'object' && 'url' in (output as any)) {
      audioUrl = (output as any).url();
    } else {
      throw new Error('Unexpected response format from Replicate');
    }

    if (!audioUrl) {
      throw new Error('No audio URL in Replicate response');
    }

    console.log(`📥 Received audio from Replicate: ${audioUrl}`);

    // Fetch the audio file from Replicate's output URL
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
        file_size_bytes: audioBuffer.length,
        provider: 'minimax-replicate',
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
