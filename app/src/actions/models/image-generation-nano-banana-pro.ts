'use server';

/**
 * Google Nano-Banana Pro Image Generation Model
 * Model: google/nano-banana-pro
 * Base URL: https://api.replicate.com/v1
 * Description: Higher quality image generation for storyboard grids
 *
 * Used by: Storyboard feature in AI Cinematographer
 * Supports higher resolution outputs compared to standard nano-banana
 */

// Aspect ratio type for nano-banana-pro
export type NanoBananaAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9';

interface ImageGenerationInput {
  prompt: string;
  aspect_ratio?: NanoBananaAspectRatio;
  num_outputs?: number; // 1-4, default 1
  image_input?: string[]; // Reference image URLs
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
  resolution?: '1K' | '2K' | '4K';
  output_format?: 'jpg' | 'png' | 'webp';
  image_input?: string[]; // Reference image URLs
  webhook?: string;
}

/**
 * Create a new image generation prediction using nano-banana-pro
 */
export async function createNanoBananaProPrediction(
  params: CreateImagePredictionParams
): Promise<ImageGenerationOutput> {
  try {
    const input: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: params.aspect_ratio || '16:9',
      resolution: params.resolution || '2K',
      output_format: params.output_format || 'jpg',
      num_outputs: 1,
      ...(params.image_input && params.image_input.length > 0 && { image_input: params.image_input }),
    };

    console.log('🖼️ Creating nano-banana-pro prediction with input:', {
      prompt: params.prompt.substring(0, 100) + '...',
      aspect_ratio: params.aspect_ratio,
      resolution: params.resolution || '2K',
      output_format: params.output_format || 'jpg',
      reference_images: params.image_input?.length || 0
    });

    const response = await fetch('https://api.replicate.com/v1/models/google/nano-banana-pro/predictions', {
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
      console.error('nano-banana-pro API error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ nano-banana-pro prediction created:', result.id);
    return result;
  } catch (error) {
    console.error('createNanoBananaProPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of an image generation prediction
 */
export async function getNanoBananaProPrediction(
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
    console.error('getNanoBananaProPrediction error:', error);
    throw error;
  }
}

/**
 * Wait for image generation to complete with polling
 * nano-banana-pro may take a bit longer for higher quality output
 */
export async function waitForNanoBananaProCompletion(
  predictionId: string,
  maxWaitTime: number = 600000, // 10 minutes default (Replicate can be slow on busy days)
  pollInterval: number = 3000 // 3 seconds between polls
): Promise<ImageGenerationOutput> {
  const startTime = Date.now();
  let pollCount = 0;

  console.log(`⏳ Starting to poll for prediction ${predictionId}...`);

  while (Date.now() - startTime < maxWaitTime) {
    pollCount++;
    const prediction = await getNanoBananaProPrediction(predictionId);

    console.log(`📊 Poll #${pollCount} - Status: ${prediction.status}, Output: ${prediction.output ? 'YES' : 'NO'}`);

    if (prediction.status === 'succeeded') {
      console.log(`✅ Prediction succeeded after ${pollCount} polls, output:`, prediction.output);
      return prediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      console.log(`❌ Prediction ${prediction.status}:`, prediction.error);
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  console.error(`⏰ Prediction ${predictionId} timed out after ${pollCount} polls (${maxWaitTime}ms)`);
  throw new Error(`Image prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}

/**
 * Generate an image using Nano Banana Pro and wait for completion
 * @param prompt - Text description of the image to generate
 * @param aspectRatio - Aspect ratio of the output image
 * @param referenceImages - Optional array of reference image URLs
 * @param resolution - Output resolution (1K, 2K, 4K) - defaults to 2K
 * @param outputFormat - Output format (jpg, png, webp) - defaults to jpg
 */
export async function generateImageWithPro(
  prompt: string,
  aspectRatio: NanoBananaAspectRatio = '16:9',
  referenceImages?: string[],
  resolution: '1K' | '2K' | '4K' = '2K',
  outputFormat: 'jpg' | 'png' | 'webp' = 'jpg'
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    // Create prediction
    const prediction = await createNanoBananaProPrediction({
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      output_format: outputFormat,
      image_input: referenceImages,
    });

    // Wait for completion
    const result = await waitForNanoBananaProCompletion(prediction.id);

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
    console.error('generateImageWithPro error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate an image using Nano Banana Pro with webhook (async, no polling)
 * Returns immediately with prediction ID - result will be delivered via webhook
 * Use this for large images (4K) that may take several minutes
 *
 * @param prompt - Text description of the image to generate
 * @param aspectRatio - Aspect ratio of the output image
 * @param referenceImages - Optional array of reference image URLs
 * @param resolution - Output resolution (1K, 2K, 4K) - defaults to 4K for storyboards
 * @param outputFormat - Output format (jpg, png, webp) - defaults to jpg
 * @param webhookUrl - URL to receive completion callback
 */
export async function generateImageWithProAsync(
  prompt: string,
  aspectRatio: NanoBananaAspectRatio = '16:9',
  referenceImages?: string[],
  resolution: '1K' | '2K' | '4K' = '4K',
  outputFormat: 'jpg' | 'png' | 'webp' = 'jpg',
  webhookUrl?: string
): Promise<{ success: boolean; predictionId?: string; error?: string }> {
  try {
    // Create prediction with webhook
    const prediction = await createNanoBananaProPrediction({
      prompt,
      aspect_ratio: aspectRatio,
      resolution,
      output_format: outputFormat,
      image_input: referenceImages,
      webhook: webhookUrl,
    });

    console.log(`✅ Async nano-banana-pro prediction created: ${prediction.id}`);

    return {
      success: true,
      predictionId: prediction.id
    };
  } catch (error) {
    console.error('generateImageWithProAsync error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
