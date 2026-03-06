'use server';

/**
 * LTX-2.3-Fast Video Generation Model
 * Model: lightricks/ltx-2.3-fast
 * Base URL: https://api.replicate.com/v1
 * Description: Generate high-quality videos with built-in audio using LTX-2.3-Fast
 *
 * Key Features:
 * - Text-to-video (no reference image required)
 * - Image-to-video (optional reference image)
 * - First frame + last frame interpolation
 * - Built-in AI audio generation
 * - Multiple resolutions: 1080p, 2k, 4k
 * - Aspect ratios: 16:9, 9:16
 * - Camera motions: dolly_in, dolly_out, dolly_left, dolly_right, jib_up, jib_down, static, focus_shift, none
 * - Durations: 6, 8, 10, 12, 14, 16, 18, 20 seconds
 * - Note: Durations > 10 seconds require 1080p resolution
 */

interface VideoGenerationV1Input {
  prompt: string; // Text prompt for video generation (required)
  duration?: 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20; // Duration in seconds
  resolution?: '1080p' | '2k' | '4k'; // Video resolution (default: 1080p)
  aspect_ratio?: '16:9' | '9:16'; // Aspect ratio (default: 16:9)
  generate_audio?: boolean; // Enable AI audio generation (default: true)
  image?: string; // Optional reference/first frame image for image-to-video mode
  last_frame_image?: string; // Optional ending frame (requires image)
  camera_motion?: 'none' | 'dolly_in' | 'dolly_out' | 'dolly_left' | 'dolly_right' | 'jib_up' | 'jib_down' | 'static' | 'focus_shift';
}

interface VideoGenerationV1Output {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version?: string;
  model?: string;
  input: VideoGenerationV1Input;
  output?: string | string[]; // URL(s) of generated video (LTX returns single string)
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

interface CreateVideoPredictionParams {
  prompt: string;
  duration?: 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20;
  resolution?: '1080p' | '2k' | '4k';
  aspect_ratio?: '16:9' | '9:16';
  generate_audio?: boolean;
  image?: string; // Optional reference image URL
  last_frame_image?: string; // Optional ending frame URL (requires image)
  camera_motion?: 'none' | 'dolly_in' | 'dolly_out' | 'dolly_left' | 'dolly_right' | 'jib_up' | 'jib_down' | 'static' | 'focus_shift';
  start_image?: string; // Legacy field, mapped to image
  webhook?: string;
}

// Valid durations for LTX-2.3-Fast
const VALID_DURATIONS = [6, 8, 10, 12, 14, 16, 18, 20] as const;

/**
 * Create a new video generation prediction using LTX-2.3-Fast
 */
export async function createVideoGenerationPrediction(
  params: CreateVideoPredictionParams
): Promise<VideoGenerationV1Output> {
  try {
    // Validate and normalize duration
    let duration = params.duration || 6;
    if (!VALID_DURATIONS.includes(duration as typeof VALID_DURATIONS[number])) {
      // Find closest valid duration
      duration = VALID_DURATIONS.reduce((prev, curr) =>
        Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
      );
    }

    // Validate resolution - durations > 10s require 1080p
    let resolution = params.resolution || '1080p';
    if (duration > 10 && resolution !== '1080p') {
      console.warn(`Duration ${duration}s requires 1080p resolution. Forcing 1080p.`);
      resolution = '1080p';
    }

    // Map start_image to image for backwards compatibility
    const imageUrl = params.image || params.start_image;

    // Build input for LTX-2.3-Fast
    const input: Record<string, unknown> = {
      prompt: params.prompt,
      duration: duration,
      resolution: resolution,
      generate_audio: params.generate_audio !== false, // Default to true
    };

    // Add aspect ratio if specified
    if (params.aspect_ratio) {
      input.aspect_ratio = params.aspect_ratio;
    }

    // Add image only if provided (text-to-video is supported without image)
    if (imageUrl) {
      input.image = imageUrl;
    }

    // Add last frame image if provided (requires first frame image)
    if (params.last_frame_image && imageUrl) {
      input.last_frame_image = params.last_frame_image;
    }

    // Add camera motion if specified
    if (params.camera_motion && params.camera_motion !== 'none') {
      input.camera_motion = params.camera_motion;
    }

    console.log('🎬 Creating LTX-2.3-Fast prediction with input:', {
      ...input,
      image: imageUrl ? '[IMAGE_URL]' : undefined,
      last_frame_image: params.last_frame_image ? '[LAST_FRAME_URL]' : undefined,
    });

    // Use the model endpoint for LTX-2.3-Fast
    const response = await fetch('https://api.replicate.com/v1/models/lightricks/ltx-2.3-fast/predictions', {
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
      console.error('LTX-2.3-Fast API error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ LTX-2.3-Fast prediction created:', result.id);
    return result;
  } catch (error) {
    console.error('createVideoGenerationPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a video generation prediction
 */
export async function getVideoGenerationPrediction(
  predictionId: string
): Promise<VideoGenerationV1Output> {
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
    console.error('getVideoGenerationPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running video generation prediction
 */
export async function cancelVideoGenerationPrediction(
  predictionId: string
): Promise<VideoGenerationV1Output> {
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
    console.error('cancelVideoGenerationPrediction error:', error);
    throw error;
  }
}

/**
 * Utility function to wait for prediction completion with polling
 */
export async function waitForVideoGenerationCompletion(
  predictionId: string,
  maxWaitTime: number = 600000, // 10 minutes default
  pollInterval: number = 5000 // 5 seconds default
): Promise<VideoGenerationV1Output> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getVideoGenerationPrediction(predictionId);

    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}
