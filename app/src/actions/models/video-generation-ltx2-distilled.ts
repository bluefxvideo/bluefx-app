'use server';

/**
 * LTX-2 Distilled Video Generation Model
 * Model: lightricks/ltx-2-distilled
 * Base URL: https://api.replicate.com/v1
 *
 * Description: Generate synchronized video and audio at production quality.
 * Speed-optimized version of LTX-2 that generates 4K video with synchronized sound.
 *
 * Key Features:
 * - Text-to-video (no reference image required)
 * - Image-to-video (optional reference image)
 * - Built-in synchronized AI audio generation (dialogue, ambient sound, music)
 * - Multiple aspect ratios: 16:9, 9:16, 4:3, 3:4, 1:1, 21:9
 * - Up to 20 seconds duration (num_frames 25-241)
 * - Resolution up to 4K (1080p recommended)
 */

// Valid aspect ratios for LTX-2 Distilled
export const LTX2_DISTILLED_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'] as const;
export type LTX2DistilledAspectRatio = typeof LTX2_DISTILLED_ASPECT_RATIOS[number];

interface LTX2DistilledInput {
  prompt: string; // Text prompt for video generation (required)
  image?: string; // Optional input image for image-to-video generation
  aspect_ratio?: LTX2DistilledAspectRatio; // Video aspect ratio (default: 16:9)
  num_frames?: number; // Number of frames: 25-241, must be 8k+1 (default: 121 = ~5s at 24fps)
  seed?: number; // Random seed for reproducibility
  enhance_prompt?: boolean; // Use model's prompt enhancement (default: false)
  image_strength?: number; // Conditioning strength for i2v (0.0-1.0, default: 1.0)
}

interface LTX2DistilledOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version?: string;
  model?: string;
  input: LTX2DistilledInput;
  output?: string | string[]; // URL(s) of generated video
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
  image?: string; // Optional reference image URL
  aspect_ratio?: LTX2DistilledAspectRatio;
  duration?: number; // Duration in seconds (will be converted to num_frames)
  num_frames?: number; // Direct frame count (overrides duration if provided)
  seed?: number;
  enhance_prompt?: boolean;
  image_strength?: number;
  webhook?: string;
}

// Valid frame counts: must be 8k+1 formula (25, 33, 41, 49, 57, 65, 73, 81, 89, 97, 105, 113, 121, 129, 137, 145, 153, 161, 169, 177, 185, 193, 201, 209, 217, 225, 233, 241)
const VALID_FRAME_COUNTS = [25, 33, 41, 49, 57, 65, 73, 81, 89, 97, 105, 113, 121, 129, 137, 145, 153, 161, 169, 177, 185, 193, 201, 209, 217, 225, 233, 241] as const;

// Convert duration (seconds) to frame count (at ~24fps)
// Formula: frames = duration * 24, then find nearest valid 8k+1 value
function durationToFrames(durationSeconds: number): number {
  const targetFrames = durationSeconds * 24;
  // Find the closest valid frame count
  return VALID_FRAME_COUNTS.reduce((prev, curr) =>
    Math.abs(curr - targetFrames) < Math.abs(prev - targetFrames) ? curr : prev
  );
}

// Duration to frame mapping for common durations
const DURATION_TO_FRAMES: Record<number, number> = {
  6: 145,   // ~6s at 24fps
  8: 193,   // ~8s at 24fps
  10: 241,  // ~10s at 24fps (max)
  12: 241,  // Cap at max
  14: 241,
  16: 241,
  18: 241,
  20: 241,
};

/**
 * Create a new video generation prediction using LTX-2 Distilled
 */
export async function createLTX2DistilledPrediction(
  params: CreateVideoPredictionParams
): Promise<LTX2DistilledOutput> {
  try {
    // Calculate frame count from duration or use provided num_frames
    let numFrames = params.num_frames;
    if (!numFrames && params.duration) {
      numFrames = DURATION_TO_FRAMES[params.duration] || durationToFrames(params.duration);
    }
    numFrames = numFrames || 121; // Default: ~5 seconds

    // Ensure frame count is within valid range
    numFrames = Math.max(25, Math.min(241, numFrames));

    // Find nearest valid frame count (8k+1 formula)
    if (!VALID_FRAME_COUNTS.includes(numFrames as typeof VALID_FRAME_COUNTS[number])) {
      numFrames = VALID_FRAME_COUNTS.reduce((prev, curr) =>
        Math.abs(curr - numFrames!) < Math.abs(prev - numFrames!) ? curr : prev
      );
    }

    // Build input for LTX-2 Distilled
    const input: Record<string, unknown> = {
      prompt: params.prompt,
      num_frames: numFrames,
      aspect_ratio: params.aspect_ratio || '16:9',
      enhance_prompt: params.enhance_prompt ?? false,
    };

    // Add optional parameters
    if (params.image) {
      input.image = params.image;
      input.image_strength = params.image_strength ?? 1.0;
    }
    if (params.seed !== undefined) {
      input.seed = params.seed;
    }

    console.log('🎬 Creating LTX-2 Distilled prediction with input:', {
      ...input,
      image: params.image ? '[IMAGE_URL]' : undefined
    });

    // Use the model endpoint for LTX-2 Distilled
    const response = await fetch('https://api.replicate.com/v1/models/lightricks/ltx-2-distilled/predictions', {
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
      console.error('LTX-2 Distilled API error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ LTX-2 Distilled prediction created:', result.id);
    return result;
  } catch (error) {
    console.error('createLTX2DistilledPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a video generation prediction
 */
export async function getLTX2DistilledPrediction(
  predictionId: string
): Promise<LTX2DistilledOutput> {
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
    console.error('getLTX2DistilledPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running video generation prediction
 */
export async function cancelLTX2DistilledPrediction(
  predictionId: string
): Promise<LTX2DistilledOutput> {
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
    console.error('cancelLTX2DistilledPrediction error:', error);
    throw error;
  }
}

/**
 * Utility function to wait for prediction completion with polling
 */
export async function waitForLTX2DistilledCompletion(
  predictionId: string,
  maxWaitTime: number = 600000, // 10 minutes default
  pollInterval: number = 5000 // 5 seconds default
): Promise<LTX2DistilledOutput> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getLTX2DistilledPrediction(predictionId);

    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}
