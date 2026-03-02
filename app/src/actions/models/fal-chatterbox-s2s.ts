'use server';

/**
 * ChatterboxHD Speech-to-Speech via fal.ai
 * Converts voice in audio to a different target voice.
 * https://fal.ai/models/resemble-ai/chatterboxhd/speech-to-speech
 *
 * Pricing: $0.02/min of audio processed
 */

import { type ChatterboxPresetVoice } from './chatterbox-voices';

interface ChatterboxS2SInput {
  source_audio_url: string;
  target_voice?: ChatterboxPresetVoice;
  target_voice_audio_url?: string;
  high_quality_audio?: boolean;
}

interface ChatterboxS2SOutput {
  audio: {
    url: string;
    content_type?: string;
    file_name?: string;
    file_size?: number;
  };
}

/**
 * Convert voice in audio using ChatterboxHD Speech-to-Speech.
 * Either target_voice (preset) or target_voice_audio_url (custom) must be provided.
 */
export async function convertVoiceWithChatterbox(params: ChatterboxS2SInput): Promise<{
  success: boolean;
  audioUrl?: string;
  error?: string;
}> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return { success: false, error: 'FAL_KEY not configured' };
  }

  if (!params.target_voice && !params.target_voice_audio_url) {
    return { success: false, error: 'Either a preset voice or custom voice audio must be provided' };
  }

  try {
    const endpoint = 'https://fal.run/resemble-ai/chatterboxhd/speech-to-speech';

    console.log(`🔄 ChatterboxHD S2S: converting voice (target: ${params.target_voice || 'custom'}, HQ: ${params.high_quality_audio || false})...`);

    const body: Record<string, unknown> = {
      source_audio_url: params.source_audio_url,
      high_quality_audio: params.high_quality_audio || false,
    };

    if (params.target_voice) {
      body.target_voice = params.target_voice;
    }
    if (params.target_voice_audio_url) {
      body.target_voice_audio_url = params.target_voice_audio_url;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 ChatterboxHD error:', response.status, errorText.substring(0, 200));
      return { success: false, error: `ChatterboxHD API error (${response.status}): ${errorText.substring(0, 100)}` };
    }

    const result: ChatterboxS2SOutput = await response.json();

    if (!result.audio?.url) {
      return { success: false, error: 'No audio returned from ChatterboxHD' };
    }

    console.log('✅ ChatterboxHD S2S: voice converted successfully');
    return { success: true, audioUrl: result.audio.url };

  } catch (error) {
    console.error('🚨 ChatterboxHD S2S error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert voice via ChatterboxHD',
    };
  }
}
