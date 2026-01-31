'use server';

import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization
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

export interface VoiceCloneRequest {
  voice_file_url: string; // URL to audio file (10s-5min, <20MB)
  need_noise_reduction?: boolean;
  need_volume_normalization?: boolean;
}

export interface VoiceCloneResponse {
  success: boolean;
  voice_id?: string; // Minimax voice ID (e.g., "R8_FDU1SV5S")
  preview_url?: string;
  error?: string;
}

/**
 * Clone a voice using Minimax voice cloning via Replicate
 *
 * Requirements:
 * - Audio file: MP3, M4A, or WAV
 * - Duration: 10 seconds to 5 minutes
 * - File size: Less than 20MB
 *
 * The returned voice_id can be used with speech-2.6-hd for generation
 */
export async function cloneVoice(
  request: VoiceCloneRequest
): Promise<VoiceCloneResponse> {
  const replicate = getReplicate();

  try {
    console.log(`🎙️ Cloning voice from: ${request.voice_file_url}`);

    // Prepare input for voice cloning
    const input = {
      voice_file: request.voice_file_url,
      model: 'speech-2.6-hd', // Use the HD model for cloning
      need_noise_reduction: request.need_noise_reduction ?? true,
      need_volume_normalization: request.need_volume_normalization ?? true,
      accuracy: 0.7 // Text validation threshold
    };

    console.log(`🔊 Voice cloning settings:`, input);

    // Run voice cloning model
    const output = await replicate.run(
      'minimax/voice-cloning',
      { input }
    ) as { voice_id: string; preview?: string } | string;

    // Handle different response formats
    let voiceId: string;
    let previewUrl: string | undefined;

    if (typeof output === 'string') {
      // Some models return just the voice ID
      voiceId = output;
    } else if (output && typeof output === 'object') {
      voiceId = output.voice_id;
      previewUrl = output.preview;
    } else {
      throw new Error('Invalid response from voice cloning model');
    }

    if (!voiceId) {
      throw new Error('No voice ID received from cloning');
    }

    console.log(`✅ Voice cloned successfully: ${voiceId}`);

    return {
      success: true,
      voice_id: voiceId,
      preview_url: previewUrl
    };

  } catch (error) {
    console.error('❌ Voice cloning error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Voice cloning failed'
    };
  }
}

/**
 * Upload a voice file to Supabase storage for cloning
 * Returns the public URL to use with the cloning API
 */
export async function uploadVoiceForCloning(
  file: Buffer,
  userId: string,
  fileName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = getSupabaseClient();

  try {
    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.length > maxSize) {
      throw new Error('File size exceeds 20MB limit');
    }

    // Determine content type from filename
    const ext = fileName.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'wav': 'audio/wav'
    };
    const contentType = contentTypes[ext || ''] || 'audio/mpeg';

    // Upload to storage
    const storagePath = `${userId}/voice-cloning/${Date.now()}_${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('script-videos')
      .upload(storagePath, file, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('script-videos')
      .getPublicUrl(storagePath);

    console.log(`📤 Voice file uploaded: ${urlData.publicUrl}`);

    return {
      success: true,
      url: urlData.publicUrl
    };

  } catch (error) {
    console.error('❌ Voice upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Clone voice from uploaded file - combines upload and cloning
 * @param fileData - Base64 encoded audio file data
 */
export async function cloneVoiceFromFile(
  fileData: string,
  userId: string,
  fileName: string,
  options?: {
    noise_reduction?: boolean;
    volume_normalization?: boolean;
  }
): Promise<VoiceCloneResponse> {
  // Decode base64 to Buffer
  const file = Buffer.from(fileData, 'base64');

  // First upload the file
  const uploadResult = await uploadVoiceForCloning(file, userId, fileName);

  if (!uploadResult.success || !uploadResult.url) {
    return {
      success: false,
      error: uploadResult.error || 'Failed to upload voice file'
    };
  }

  // Then clone the voice
  return cloneVoice({
    voice_file_url: uploadResult.url,
    need_noise_reduction: options?.noise_reduction ?? true,
    need_volume_normalization: options?.volume_normalization ?? true
  });
}
