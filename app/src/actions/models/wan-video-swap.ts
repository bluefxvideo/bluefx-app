'use server';

/**
 * Wan 2.2 Animate Replace - Video Character Swap Model
 * Base URL: https://api.replicate.com/v1
 * Model: wan-video/wan-2.2-animate-replace
 *
 * This model replaces a character in a video with a new character image
 * while preserving motion, expressions, lip sync, and scene lighting.
 */

export interface WanVideoSwapInput {
  video: string;           // Source video URL (mp4, mov, webm, m4v, gif)
  character_image: string; // New character image URL (jpg, png, webp, gif)
  seed?: number;           // Random seed for reproducibility
  go_fast?: boolean;       // Accelerate processing (default: true)
  refert_num?: 1 | 5;      // Reference frames: 1 or 5 (default: 1)
  resolution?: '720' | '480'; // Output resolution (default: 720)
  merge_audio?: boolean;   // Preserve input video audio (default: true)
  frames_per_second?: number; // 5-60 fps (default: 24)
}

export interface WanVideoSwapPrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: WanVideoSwapInput & {
    user_id?: string;
    job_id?: string;
  };
  output?: string; // Generated video URL
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

interface CreatePredictionInput {
  input: WanVideoSwapInput & {
    user_id?: string;
    job_id?: string;
  };
  webhook?: string;
  webhook_events_filter?: string[];
}

// Model identifier for the API endpoint
const MODEL_OWNER = 'wan-video';
const MODEL_NAME = 'wan-2.2-animate-replace';

/**
 * Create a new video swap prediction
 */
export async function createVideoSwapPrediction(
  params: WanVideoSwapInput,
  webhook?: string,
  user_id?: string,
  job_id?: string
): Promise<WanVideoSwapPrediction> {
  try {
    const requestBody: CreatePredictionInput = {
      input: {
        ...params,
        // Ensure defaults
        go_fast: params.go_fast ?? true,
        refert_num: params.refert_num ?? 1,
        resolution: params.resolution ?? '720',
        merge_audio: params.merge_audio ?? true,
        frames_per_second: params.frames_per_second ?? 24,
        // Metadata for webhook processing
        ...(user_id && { user_id }),
        ...(job_id && { job_id }),
      },
    };

    if (webhook) {
      requestBody.webhook = webhook;
      requestBody.webhook_events_filter = ['completed'];
    }

    console.log('🎬 Video Swap: Creating prediction', {
      video: params.video.substring(0, 50) + '...',
      character_image: params.character_image.substring(0, 50) + '...',
      resolution: params.resolution || '720',
      webhook: webhook ? 'YES' : 'NO',
    });

    const response = await fetch(`https://api.replicate.com/v1/models/${MODEL_OWNER}/${MODEL_NAME}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Video Swap: Replicate API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const prediction = await response.json();
    console.log(`✅ Video Swap: Prediction created: ${prediction.id}`);

    return prediction;
  } catch (error) {
    console.error('🚨 createVideoSwapPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a video swap prediction
 */
export async function getVideoSwapPrediction(predictionId: string): Promise<WanVideoSwapPrediction> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('🚨 getVideoSwapPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running video swap prediction
 */
export async function cancelVideoSwapPrediction(predictionId: string): Promise<WanVideoSwapPrediction> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    console.log(`🛑 Video Swap: Prediction cancelled: ${predictionId}`);
    return await response.json();
  } catch (error) {
    console.error('🚨 cancelVideoSwapPrediction error:', error);
    throw error;
  }
}

/**
 * Helper function to wait for a video swap prediction to complete
 * Polls the prediction status until it's finished
 */
export async function waitForVideoSwapCompletion(
  predictionId: string,
  maxWaitTime: number = 600000, // 10 minutes default (video processing takes longer)
  pollInterval: number = 5000   // 5 seconds default
): Promise<WanVideoSwapPrediction> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getVideoSwapPrediction(predictionId);

    console.log(`⏳ Video Swap: Polling ${predictionId} - Status: ${prediction.status}`);

    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Video swap prediction ${predictionId} timed out after ${maxWaitTime}ms`);
}

/**
 * Complete video swap workflow: create prediction and optionally wait for results
 * If webhook is provided, returns prediction ID immediately for async handling
 */
export async function performVideoSwap(
  videoUrl: string,
  characterImageUrl: string,
  options: Partial<WanVideoSwapInput> = {},
  webhook?: string,
  user_id?: string,
  job_id?: string
): Promise<{ predictionId: string; output?: string }> {
  try {
    // Validate URLs
    console.log('🔍 Video Swap: URL validation', {
      videoUrl: videoUrl.substring(0, 80),
      characterImageUrl: characterImageUrl.substring(0, 80),
      videoIsValidURL: videoUrl.startsWith('http'),
      characterIsValidURL: characterImageUrl.startsWith('http'),
    });

    // Create the prediction
    const prediction = await createVideoSwapPrediction(
      {
        video: videoUrl,
        character_image: characterImageUrl,
        ...options,
      },
      webhook,
      user_id,
      job_id
    );

    console.log(`🎬 Video Swap: Prediction created: ${prediction.id}`);

    // If webhook is provided, return prediction ID for async handling
    if (webhook) {
      console.log(`🚀 Video Swap: Returning prediction ID for webhook processing: ${prediction.id}`);
      return { predictionId: prediction.id };
    }

    // Otherwise, wait for completion (sync mode)
    const completedPrediction = await waitForVideoSwapCompletion(prediction.id);

    if (completedPrediction.status === 'failed') {
      throw new Error(`Video swap failed: ${completedPrediction.error}`);
    }

    if (!completedPrediction.output) {
      throw new Error('Video swap completed but no output URL was returned');
    }

    return {
      predictionId: prediction.id,
      output: completedPrediction.output,
    };
  } catch (error) {
    console.error('🚨 performVideoSwap error:', error);
    throw error;
  }
}
