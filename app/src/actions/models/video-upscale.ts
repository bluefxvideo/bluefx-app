'use server';

/**
 * Topaz Labs Video Upscale Model
 * Model: topazlabs/video-upscale
 * Base URL: https://api.replicate.com/v1
 * Description: AI-powered video upscaling from 720p to 1080p or 4K
 *
 * Pricing (approximate):
 * - 720p → 1080p @ 30fps: ~$0.037/sec
 * - 720p → 4K @ 30fps: ~$0.15/sec
 */

export type UpscaleResolution = '720p' | '1080p' | '4k';
export type UpscaleFps = 15 | 24 | 30 | 60;

interface VideoUpscaleInput {
  video: string; // Video URL to upscale (required)
  target_resolution?: UpscaleResolution; // Target resolution (default: 1080p)
  target_fps?: UpscaleFps; // Target frame rate (default: 30)
}

interface VideoUpscaleOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version?: string;
  model?: string;
  input: VideoUpscaleInput;
  output?: string; // URL of upscaled video
  error?: string;
  logs?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  metrics?: {
    predict_time?: number;
  };
  urls: {
    get: string;
    cancel: string;
  };
}

interface CreateUpscalePredictionParams {
  video: string; // Video URL to upscale
  target_resolution?: UpscaleResolution;
  target_fps?: UpscaleFps;
  webhook?: string;
}

/**
 * Create a new video upscale prediction using Topaz Labs
 */
export async function createVideoUpscalePrediction(
  params: CreateUpscalePredictionParams
): Promise<VideoUpscaleOutput> {
  try {
    const input: Record<string, unknown> = {
      video: params.video,
      target_resolution: params.target_resolution || '1080p',
      target_fps: params.target_fps || 30,
    };

    console.log('🔍 Creating Topaz video upscale prediction with input:', {
      ...input,
      video: '[VIDEO_URL]'
    });

    const response = await fetch('https://api.replicate.com/v1/models/topazlabs/video-upscale/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Prefer': 'respond-async',
      },
      body: JSON.stringify({
        input,
        ...(params.webhook && {
          webhook: params.webhook,
          webhook_events_filter: ['start', 'output', 'completed', 'logs']
        }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Topaz video upscale API error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Video upscale prediction created:', result.id);
    return result;
  } catch (error) {
    console.error('createVideoUpscalePrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a video upscale prediction
 */
export async function getVideoUpscalePrediction(
  predictionId: string
): Promise<VideoUpscaleOutput> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('getVideoUpscalePrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running video upscale prediction
 */
export async function cancelVideoUpscalePrediction(
  predictionId: string
): Promise<VideoUpscaleOutput> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('cancelVideoUpscalePrediction error:', error);
    throw error;
  }
}
