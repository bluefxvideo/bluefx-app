'use server';

/**
 * MiniMax Music v2 - fal.ai Integration
 * High-quality music generation with vocals or instrumental
 * Cost: $0.03 per generation → 6 credits
 */

export interface FalMiniMaxInput {
  prompt: string;         // Style description (10-300 chars)
  lyrics_prompt: string;  // Lyrics with tags or "[Instrumental]" (10-3000 chars)
  audio_setting?: {
    sample_rate?: number;  // Default: 44100
    bitrate?: number;      // Default: 256000
    format?: 'mp3' | 'pcm' | 'flac';
  };
}

export interface FalMiniMaxOutput {
  audio: {
    url: string;
    content_type: string;
    file_name: string;
    file_size: number;
  };
}

export interface FalQueueResponse {
  request_id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response_url?: string;
}

export interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  logs?: string[];
  response_url?: string;
}

/**
 * Submit a music generation request to fal.ai queue
 */
export async function createFalMiniMaxPrediction(
  params: FalMiniMaxInput
): Promise<FalQueueResponse> {
  try {
    console.log(`🎵 Creating fal.ai MiniMax prediction: "${params.prompt.substring(0, 50)}..."`);

    // Build webhook URL for completion callback
    // fal.ai requires webhook as a query parameter, not in the request body
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal-ai`;
    console.log(`🎵 fal.ai webhook URL: ${webhookUrl}`);

    const queueUrl = `https://queue.fal.run/fal-ai/minimax-music/v2?fal_webhook=${encodeURIComponent(webhookUrl)}`;

    const response = await fetch(queueUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${process.env.FAL_KEY}`,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        lyrics_prompt: params.lyrics_prompt,
        audio_setting: params.audio_setting || {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'mp3'
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`fal.ai MiniMax API error: ${response.status} - ${errorText}`);
      throw new Error(`fal.ai error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ fal.ai MiniMax request queued: ${result.request_id}`);
    return result;
  } catch (error) {
    console.error('createFalMiniMaxPrediction error:', error);
    throw error;
  }
}

/**
 * Check the status of a queued request
 * fal.ai queue requires full model path: /fal-ai/minimax-music/v2/requests/{id}/status
 */
export async function getFalMiniMaxStatus(requestId: string): Promise<FalStatusResponse> {
  try {
    const response = await fetch(
      `https://queue.fal.run/fal-ai/minimax-music/v2/requests/${requestId}/status`,
      {
        headers: {
          'Authorization': `Key ${process.env.FAL_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`fal.ai status error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('getFalMiniMaxStatus error:', error);
    throw error;
  }
}

/**
 * Get the result of a completed request
 * fal.ai queue requires full model path: /fal-ai/minimax-music/v2/requests/{id}
 */
export async function getFalMiniMaxResult(requestId: string): Promise<FalMiniMaxOutput> {
  try {
    const response = await fetch(
      `https://queue.fal.run/fal-ai/minimax-music/v2/requests/${requestId}`,
      {
        headers: {
          'Authorization': `Key ${process.env.FAL_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`fal.ai result error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('getFalMiniMaxResult error:', error);
    throw error;
  }
}

/**
 * Get model information
 */
export async function getFalMiniMaxModelInfo() {
  return {
    name: 'MiniMax Music v2',
    provider: 'fal.ai',
    description: 'High-quality music generation with vocals or instrumental',
    capabilities: [
      'Full songs with natural singing vocals',
      'Instrumental-only generation',
      'Lyrics support with [Verse], [Chorus], [Bridge], [Outro] tags',
      'Multiple audio formats (mp3, flac, pcm)',
    ],
    limitations: [
      'English and Chinese lyrics only',
      'Max 3000 characters for lyrics',
    ],
    pricing: {
      credits: 6,
      fal_cost: '$0.03 per generation'
    },
    output_format: 'mp3 (44.1kHz, 256kbps)',
  };
}

/**
 * Poll for music generation result
 * Used as fallback when webhooks aren't available (e.g., local development)
 */
export interface PollMusicResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  audio_url?: string;
  error?: string;
}

export async function pollMusicGeneration(requestId: string): Promise<PollMusicResult> {
  try {
    // Check status first
    const statusResponse = await getFalMiniMaxStatus(requestId);
    console.log(`🔄 Polling fal.ai status for ${requestId}: ${statusResponse.status}`);

    if (statusResponse.status === 'IN_QUEUE') {
      return { status: 'pending' };
    }

    if (statusResponse.status === 'IN_PROGRESS') {
      return { status: 'processing' };
    }

    if (statusResponse.status === 'FAILED') {
      return { status: 'failed', error: 'Music generation failed' };
    }

    if (statusResponse.status === 'COMPLETED') {
      // Get the result
      const result = await getFalMiniMaxResult(requestId);

      if (result?.audio?.url) {
        // Import storage and database functions
        const { downloadAndUploadAudio } = await import('@/actions/supabase-storage');
        const { updateMusicRecordAdmin } = await import('@/actions/database/music-database');
        const { createAdminClient } = await import('@/app/supabase/server');

        console.log(`🎵 Polling: Downloading audio for ${requestId}`);

        // Download and upload audio to our storage
        const uploadResult = await downloadAndUploadAudio(
          result.audio.url,
          'music-machine',
          `music_${requestId}`
        );

        if (uploadResult.success && uploadResult.url) {
          // Find and update music record
          const supabase = createAdminClient();
          const { data: musicRecords } = await supabase
            .from('music_history')
            .select('id, user_id')
            .contains('generation_settings', { prediction_id: requestId });

          if (musicRecords && musicRecords.length > 0) {
            const musicId = musicRecords[0].id;

            await updateMusicRecordAdmin(musicId, {
              status: 'completed',
              audio_url: uploadResult.url,
            });

            console.log(`✅ Polling: Music complete - ${musicId}`);
          }

          return { status: 'completed', audio_url: uploadResult.url };
        } else {
          console.error('Polling: Failed to upload audio:', uploadResult.error);
          return { status: 'failed', error: 'Failed to upload audio' };
        }
      }

      return { status: 'failed', error: 'No audio URL in result' };
    }

    return { status: 'pending' };
  } catch (error) {
    console.error('pollMusicGeneration error:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Polling failed'
    };
  }
}
