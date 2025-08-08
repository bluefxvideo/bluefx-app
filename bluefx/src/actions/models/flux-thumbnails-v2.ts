'use server';

/**
 * Generated from: Replicate flux-thumbnails-v2 Model
 * Base URL: https://api.replicate.com/v1
 * Description: Generate thumbnails for Youtube using popular templates and styles
 */

interface FluxThumbnailsV2Input {
  prompt: string;
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
  num_outputs?: number; // 1-4
  guidance_scale?: number; // 0-10
  num_inference_steps?: number; // 1-50
  output_format?: 'webp' | 'jpg' | 'png';
  output_quality?: number; // 0-100
  seed?: number;
  enable_safety_checker?: boolean;
}

interface FluxThumbnailsV2Output {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: FluxThumbnailsV2Input;
  output?: string[]; // URLs of generated thumbnails
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

interface CreatePredictionParams extends FluxThumbnailsV2Input {
  webhook?: string;
}

/**
 * Create a new thumbnail generation prediction using flux-thumbnails-v2
 */
export async function createFluxThumbnailPrediction(
  params: CreatePredictionParams
): Promise<FluxThumbnailsV2Output> {
  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: 'be1f9d9a43c18c9c0d8c9024d285aa5fa343914648a7fe35be291ed04a9dfeb0',
        input: {
          prompt: params.prompt,
          aspect_ratio: params.aspect_ratio || '1:1',
          num_outputs: params.num_outputs || 1,
          guidance_scale: params.guidance_scale || 3,
          num_inference_steps: params.num_inference_steps || 28,
          output_format: params.output_format || 'webp',
          output_quality: params.output_quality || 80,
          ...(params.seed && { seed: params.seed }),
          enable_safety_checker: params.enable_safety_checker !== false,
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
    console.error('createFluxThumbnailPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a thumbnail generation prediction
 */
export async function getFluxThumbnailPrediction(
  predictionId: string
): Promise<FluxThumbnailsV2Output> {
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
    console.error('getFluxThumbnailPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running thumbnail generation prediction
 */
export async function cancelFluxThumbnailPrediction(
  predictionId: string
): Promise<FluxThumbnailsV2Output> {
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
    console.error('cancelFluxThumbnailPrediction error:', error);
    throw error;
  }
}

/**
 * Utility function to wait for prediction completion with polling
 */
export async function waitForFluxThumbnailCompletion(
  predictionId: string,
  maxWaitTime: number = 300000, // 5 minutes default
  pollInterval: number = 2000 // 2 seconds default
): Promise<FluxThumbnailsV2Output> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getFluxThumbnailPrediction(predictionId);
    
    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}