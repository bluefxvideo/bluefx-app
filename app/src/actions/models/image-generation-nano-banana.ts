'use server';

/**
 * Google Nano-Banana Image Generation Model
 * Model: google/nano-banana
 * Base URL: https://api.replicate.com/v1
 * Description: Fast, high-quality image generation for first frames
 *
 * Used by: Starting Shot feature in AI Cinematographer
 * Cost: ~$0.04 per image
 */

// Import shared types (can be used by both client and server)
import type { NanoBananaAspectRatio } from '@/types/cinematographer';
export type { NanoBananaAspectRatio };

interface ImageGenerationInput {
  prompt: string;
  aspect_ratio?: NanoBananaAspectRatio;
  num_outputs?: number; // 1-4, default 1
}

interface ImageGenerationOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  model?: string;
  version?: string;
  input: ImageGenerationInput;
  output?: string | string[]; // URL(s) of generated image(s)
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

interface CreateImagePredictionParams {
  prompt: string;
  aspect_ratio?: NanoBananaAspectRatio;
  webhook?: string;
}

/**
 * Create a new image generation prediction using nano-banana
 */
export async function createImageGenerationPrediction(
  params: CreateImagePredictionParams
): Promise<ImageGenerationOutput> {
  try {
    const input: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: params.aspect_ratio || '16:9',
      num_outputs: 1,
    };

    console.log('🖼️ Creating nano-banana prediction with input:', input);

    const response = await fetch('https://api.replicate.com/v1/models/google/nano-banana/predictions', {
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
          webhook_events_filter: ['completed']
        }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('nano-banana API error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ nano-banana prediction created:', result.id);
    return result;
  } catch (error) {
    console.error('createImageGenerationPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of an image generation prediction
 */
export async function getImageGenerationPrediction(
  predictionId: string
): Promise<ImageGenerationOutput> {
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
    console.error('getImageGenerationPrediction error:', error);
    throw error;
  }
}

/**
 * Wait for image generation to complete with polling
 * nano-banana is fast, typically completes in a few seconds
 */
export async function waitForImageGenerationCompletion(
  predictionId: string,
  maxWaitTime: number = 60000, // 1 minute default (images are fast)
  pollInterval: number = 1000 // 1 second default
): Promise<ImageGenerationOutput> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getImageGenerationPrediction(predictionId);

    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Image prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}

/**
 * Generate an image and wait for completion (convenience function)
 */
export async function generateImage(
  prompt: string,
  aspectRatio: NanoBananaAspectRatio = '16:9'
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    // Create prediction
    const prediction = await createImageGenerationPrediction({
      prompt,
      aspect_ratio: aspectRatio,
    });

    // Wait for completion
    const result = await waitForImageGenerationCompletion(prediction.id);

    if (result.status === 'succeeded' && result.output) {
      // Output can be string or array
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      return { success: true, imageUrl };
    }

    return {
      success: false,
      error: result.error || 'Image generation failed'
    };
  } catch (error) {
    console.error('generateImage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
