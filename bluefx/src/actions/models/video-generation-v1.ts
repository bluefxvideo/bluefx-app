'use server';

/**
 * Generated from: Replicate Video Generation Model
 * Base URL: https://api.replicate.com/v1
 * Description: Generate cinematic videos from prompts and reference images
 */

interface VideoGenerationV1Input {
  prompt: string;
  image?: string; // Reference image URL or base64
  duration?: number; // Video duration in seconds
  fps?: number; // Frames per second (12, 24, or 30)
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  motion_scale?: number; // 0-2, controls motion intensity
  seed?: number;
  guidance_scale?: number; // 1-10
  num_inference_steps?: number; // 10-50
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
        version: 'dc91b71f6bafe90e311c8b6e03b9b5c1ce53f932b47e243c3a2ebf90d2d2a12d', // Stable Video Diffusion
        input: {
          prompt: params.prompt,
          ...(params.image && { image: params.image }),
          duration: params.duration || 4,
          fps: params.fps || 24,
          aspect_ratio: params.aspect_ratio || '16:9',
          motion_scale: params.motion_scale || 1.0,
          guidance_scale: params.guidance_scale || 7.5,
          num_inference_steps: params.num_inference_steps || 20,
          ...(params.seed && { seed: params.seed }),
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