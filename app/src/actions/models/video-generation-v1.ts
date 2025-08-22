'use server';

/**
 * Generated from: Replicate Kling Video Generation Model v1.6
 * Model: kwaivgi/kling-v1.6-standard
 * Base URL: https://api.replicate.com/v1
 * Description: Generate cinematic videos from prompts and reference images using Kling v1.6
 */

interface VideoGenerationV1Input {
  prompt: string; // Text prompt for video generation (required)
  duration?: 5 | 10; // Duration of the video in seconds (only 5 or 10 allowed)
  cfg_scale?: number; // Flexibility in video generation (default: 0.5)
  start_image?: string; // First frame of the video (optional)
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4'; // Aspect ratio (default: "16:9")
  negative_prompt?: string; // Things you do not want to see in the video (optional)
  reference_images?: string[]; // Reference images to use in video generation (optional)
}

interface VideoGenerationV1Output {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: VideoGenerationV1Input;
  output?: string[]; // URLs of generated videos
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

interface CreateVideoPredictionParams extends VideoGenerationV1Input {
  webhook?: string;
}

/**
 * Create a new video generation prediction
 */
export async function createVideoGenerationPrediction(
  params: CreateVideoPredictionParams
): Promise<VideoGenerationV1Output> {
  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: 'ad7e130132a2ae0c815fb3a5d31d897530cda5860e5f464f5eef48efd9ee8b4b', // Kling v1.6 Standard
        input: {
          prompt: params.prompt,
          duration: params.duration && [5, 10].includes(params.duration) ? params.duration : 5, // Validate duration: only 5 or 10
          cfg_scale: params.cfg_scale || 0.5,
          aspect_ratio: params.aspect_ratio || '16:9',
          ...(params.start_image && { start_image: params.start_image }),
          ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
          ...(params.reference_images && { reference_images: params.reference_images }),
        },
        ...(params.webhook && { webhook: params.webhook }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
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
  maxWaitTime: number = 600000, // 10 minutes default (videos take longer)
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