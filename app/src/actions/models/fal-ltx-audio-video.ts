/**
 * fal.ai LTX Audio-to-Video Integration
 * Model: fal-ai/ltx-2-19b/distilled/audio-to-video
 *
 * Generates talking avatar videos from audio input
 * - Frame rate: 25 fps (fixed)
 * - Max duration: 60 seconds (1000 MP limit)
 * - Pricing: $0.0008 per megapixel
 *
 * Supported resolutions:
 * - Landscape: 1024×576 (~$0.71/min)
 * - Portrait: 576×1024 (~$0.71/min)
 */

export interface FalLTXInput {
  audio_url: string;           // URL to audio file (required)
  image_url?: string;          // Reference image URL (optional but strongly recommended)
  prompt?: string;             // Action/style description (optional)
  video_size: {
    width: number;             // 1024 or 576
    height: number;            // 576 or 1024
  };
  num_frames: number;          // audio_duration_seconds × 25 (max 1500 for 60 sec)
}

export interface FalLTXOutput {
  video: {
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

// Resolution presets
export const LTX_RESOLUTIONS = {
  landscape: { width: 1024, height: 576, label: 'Landscape (1024×576)' },
  portrait: { width: 576, height: 1024, label: 'Portrait (576×1024)' },
} as const;

export type LTXResolution = keyof typeof LTX_RESOLUTIONS;

// Constants
export const LTX_FRAME_RATE = 25;
export const LTX_MAX_DURATION_SECONDS = 60;
export const LTX_MAX_FRAMES = LTX_MAX_DURATION_SECONDS * LTX_FRAME_RATE; // 1500
export const LTX_COST_PER_MEGAPIXEL = 0.0008;

/**
 * Calculate cost for a video generation
 */
export function calculateLTXCost(
  resolution: LTXResolution,
  durationSeconds: number
): { megapixels: number; costUSD: number; credits: number } {
  const { width, height } = LTX_RESOLUTIONS[resolution];
  const numFrames = Math.min(durationSeconds, LTX_MAX_DURATION_SECONDS) * LTX_FRAME_RATE;
  const totalPixels = width * height * numFrames;
  const megapixels = totalPixels / 1_000_000;
  const costUSD = megapixels * LTX_COST_PER_MEGAPIXEL;

  // 1 credit per second, minimum 10
  const credits = Math.max(10, Math.ceil(Math.min(durationSeconds, LTX_MAX_DURATION_SECONDS)));

  return { megapixels, costUSD, credits };
}

/**
 * Validate audio duration
 */
export function validateAudioDuration(durationSeconds: number): { valid: boolean; error?: string } {
  if (durationSeconds <= 0) {
    return { valid: false, error: 'Audio duration must be greater than 0 seconds' };
  }
  if (durationSeconds > LTX_MAX_DURATION_SECONDS) {
    return {
      valid: false,
      error: `Audio must be ${LTX_MAX_DURATION_SECONDS} seconds or less. Your audio is ${Math.ceil(durationSeconds)} seconds.`
    };
  }
  return { valid: true };
}

/**
 * Submit a video generation request to fal.ai queue
 */
export async function createFalLTXPrediction(
  params: FalLTXInput
): Promise<FalQueueResponse> {
  try {
    console.log(`🎬 Creating fal.ai LTX prediction: ${params.video_size.width}×${params.video_size.height}, ${params.num_frames} frames`);

    // Validate frames limit
    if (params.num_frames > LTX_MAX_FRAMES) {
      throw new Error(`Frame count ${params.num_frames} exceeds maximum ${LTX_MAX_FRAMES} (60 seconds)`);
    }

    // Build webhook URL for completion callback
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/fal-ai`;
    console.log(`🎬 fal.ai webhook URL: ${webhookUrl}`);

    const queueUrl = `https://queue.fal.run/fal-ai/ltx-2-19b/distilled/audio-to-video?fal_webhook=${encodeURIComponent(webhookUrl)}`;

    // Build request body - prompt is required by fal.ai
    const requestBody: Record<string, unknown> = {
      audio_url: params.audio_url,
      video_size: params.video_size,
      num_frames: params.num_frames,
      prompt: params.prompt || 'A person speaking naturally to camera with professional lighting',
    };

    // Add optional parameters
    if (params.image_url) {
      requestBody.image_url = params.image_url;
    }

    const response = await fetch(queueUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${process.env.FAL_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`fal.ai LTX API error: ${response.status} - ${errorText}`);
      throw new Error(`fal.ai error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ fal.ai LTX request queued: ${result.request_id}`);
    console.log(`📋 fal.ai queue response:`, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('createFalLTXPrediction error:', error);
    throw error;
  }
}

/**
 * Check the status of a queued request
 * fal.ai returns status_url with shorter path: fal-ai/ltx-2-19b (not the full model path)
 */
export async function getFalLTXStatus(requestId: string): Promise<FalStatusResponse> {
  try {
    const response = await fetch(
      `https://queue.fal.run/fal-ai/ltx-2-19b/requests/${requestId}/status`,
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
    console.error('getFalLTXStatus error:', error);
    throw error;
  }
}

/**
 * Get the result of a completed request
 * fal.ai uses shorter path for results: fal-ai/ltx-2-19b (not the full model path)
 */
export async function getFalLTXResult(requestId: string): Promise<FalLTXOutput> {
  try {
    const response = await fetch(
      `https://queue.fal.run/fal-ai/ltx-2-19b/requests/${requestId}`,
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
    console.error('getFalLTXResult error:', error);
    throw error;
  }
}

/**
 * Get model information
 */
export function getFalLTXModelInfo() {
  return {
    name: 'LTX Audio-to-Video',
    model_id: 'fal-ai/ltx-2-19b/distilled/audio-to-video',
    provider: 'fal.ai',
    description: 'Generate talking avatar videos from audio input with optional reference image',
    capabilities: [
      'Audio-driven avatar generation',
      'Optional reference image for appearance',
      'Action/style prompts for visual guidance',
      'Landscape (1024×576) and Portrait (576×1024) formats',
    ],
    limitations: [
      'Maximum 60 seconds duration',
      '1000 megapixel limit per generation',
      'Fixed 25 fps frame rate',
    ],
    pricing: {
      cost_per_megapixel: '$0.0008',
      landscape_per_minute: '~$0.71',
      portrait_per_minute: '~$0.71',
    },
    frame_rate: LTX_FRAME_RATE,
    max_duration_seconds: LTX_MAX_DURATION_SECONDS,
    resolutions: LTX_RESOLUTIONS,
  };
}

/**
 * Poll for video generation result
 * Used as fallback when webhooks aren't available (e.g., local development)
 */
export interface PollLTXResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
}

export async function pollLTXGeneration(requestId: string): Promise<PollLTXResult> {
  try {
    // First check database to see if video was already completed (by webhook)
    const { createAdminClient } = await import('@/app/supabase/server');
    const supabase = createAdminClient();

    const { data: videoRecord } = await supabase
      .from('avatar_videos')
      .select('id, status, video_url')
      .eq('fal_request_id', requestId)
      .single();

    if (videoRecord?.status === 'completed' && videoRecord?.video_url) {
      console.log(`✅ Polling: Video already completed (from webhook): ${videoRecord.id}`);
      return { status: 'completed', video_url: videoRecord.video_url };
    }

    if (videoRecord?.status === 'failed') {
      return { status: 'failed', error: 'Video generation failed' };
    }

    // Check fal.ai status first (like music machine pattern)
    const statusResponse = await getFalLTXStatus(requestId);
    console.log(`🔄 Polling fal.ai LTX status for ${requestId}: ${statusResponse.status}`);

    if (statusResponse.status === 'IN_QUEUE') {
      return { status: 'pending' };
    }

    if (statusResponse.status === 'IN_PROGRESS') {
      return { status: 'processing' };
    }

    if (statusResponse.status === 'FAILED') {
      return { status: 'failed', error: 'Video generation failed' };
    }

    if (statusResponse.status === 'COMPLETED') {
      // Get the result - wrap in try-catch to handle transient 500 errors
      try {
        const result = await getFalLTXResult(requestId);

        if (result?.video?.url) {
          const { downloadAndUploadVideo } = await import('@/actions/supabase-storage');
          const { updateTalkingAvatarVideoAdmin } = await import('@/actions/database/talking-avatar-database');

          console.log(`🎬 Polling: Downloading video for ${requestId}`);

          // Download and upload video to our storage
          const uploadResult = await downloadAndUploadVideo(
            result.video.url,
            'talking-avatar',
            `ltx_${requestId}`
          );

          if (uploadResult.success && uploadResult.url) {
            if (videoRecord) {
              await updateTalkingAvatarVideoAdmin(videoRecord.id, {
                status: 'completed',
                video_url: uploadResult.url,
              });
              console.log(`✅ Polling: Video complete - ${videoRecord.id}`);
            }

            return { status: 'completed', video_url: uploadResult.url };
          } else {
            console.error('Polling: Failed to upload video:', uploadResult.error);
            return { status: 'failed', error: 'Failed to upload video' };
          }
        }

        return { status: 'failed', error: 'No video URL in result' };
      } catch (resultError) {
        // 500 errors from fal.ai might be temporary - keep polling
        const errorMsg = resultError instanceof Error ? resultError.message : 'Unknown error';
        if (errorMsg.includes('500')) {
          console.warn(`⚠️ Polling: fal.ai 500 error, will retry: ${errorMsg}`);
          return { status: 'processing' };
        }
        // Re-throw other errors
        throw resultError;
      }
    }

    return { status: 'pending' };
  } catch (error) {
    console.error('pollLTXGeneration error:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Polling failed'
    };
  }
}
