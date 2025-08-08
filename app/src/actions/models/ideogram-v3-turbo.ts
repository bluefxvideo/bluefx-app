'use server';

/**
 * Generated from: Ideogram V3 Turbo
 * Base URL: https://api.replicate.com/v1
 * Description: Fastest and cheapest Ideogram v3 model for high-quality logo generation with stunning realism and creative designs
 */

interface IdeogramV3TurboInput {
  prompt: string;
  aspect_ratio?: '1:1' | '16:10' | '10:16' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21' | '3:2' | '2:3';
  resolution?: '640x1344' | '768x1344' | '832x1216' | '896x1152' | '1024x1024' | '1152x896' | '1216x832' | '1344x768' | '1344x640';
  style_type?: 'None' | 'Auto' | 'General' | 'Realistic' | 'Design' | '3D' | 'Anime';
  magic_prompt_option?: 'Auto' | 'On' | 'Off';
  seed?: number;
  image?: string; // URI for image-to-image generation
  mask?: string; // URI for inpainting
  style_reference_images?: string[]; // Array of reference image URLs
}

interface IdeogramV3TurboOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: IdeogramV3TurboInput;
  output?: string[]; // URLs of generated images
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

interface CreatePredictionParams extends IdeogramV3TurboInput {
  webhook?: string;
}

/**
 * Create a new logo/image generation prediction using Ideogram V3 Turbo
 */
export async function createIdeogramV3TurboPrediction(
  params: CreatePredictionParams
): Promise<IdeogramV3TurboOutput> {
  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: 'f8a8eb2c75d7d86ec58e3b8309cee63acb437fbab2695bc5004acf64d2de61a7',
        input: {
          prompt: params.prompt,
          aspect_ratio: params.aspect_ratio || '1:1',
          resolution: params.resolution,
          style_type: params.style_type || 'Auto',
          magic_prompt_option: params.magic_prompt_option || 'Auto',
          ...(params.seed && { seed: params.seed }),
          ...(params.image && { image: params.image }),
          ...(params.mask && { mask: params.mask }),
          ...(params.style_reference_images && { style_reference_images: params.style_reference_images }),
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
    console.error('createIdeogramV3TurboPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of an Ideogram V3 Turbo prediction
 */
export async function getIdeogramV3TurboPrediction(
  predictionId: string
): Promise<IdeogramV3TurboOutput> {
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
    console.error('getIdeogramV3TurboPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running Ideogram V3 Turbo prediction
 */
export async function cancelIdeogramV3TurboPrediction(
  predictionId: string
): Promise<IdeogramV3TurboOutput> {
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
    console.error('cancelIdeogramV3TurboPrediction error:', error);
    throw error;
  }
}

/**
 * Utility function to wait for prediction completion with polling
 */
export async function waitForIdeogramV3TurboCompletion(
  predictionId: string,
  maxWaitTime: number = 300000, // 5 minutes default
  pollInterval: number = 2000 // 2 seconds default
): Promise<IdeogramV3TurboOutput> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getIdeogramV3TurboPrediction(predictionId);
    
    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}

/**
 * Helper function for logo generation with optimized defaults
 */
export async function generateLogo(
  prompt: string,
  options?: {
    aspectRatio?: IdeogramV3TurboInput['aspect_ratio'];
    styleType?: IdeogramV3TurboInput['style_type'];
    seed?: number;
    webhook?: string;
  }
): Promise<IdeogramV3TurboOutput> {
  return createIdeogramV3TurboPrediction({
    prompt,
    aspect_ratio: options?.aspectRatio || '1:1',
    style_type: options?.styleType || 'Design', // Design style is optimal for logos
    magic_prompt_option: 'On', // Enhanced prompts for better results
    seed: options?.seed,
    webhook: options?.webhook,
  });
}