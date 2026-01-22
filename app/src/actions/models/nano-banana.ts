'use server';

/**
 * Nano-Banana - Google's Image Generation Model
 * Model: google/nano-banana
 * Excellent for character consistency and multi-image fusion
 */

export type NanoBananaAspectRatio =
  | 'match_input_image'
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3'
  | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';

interface NanoBananaInput {
  prompt: string;
  image_input?: string[]; // Up to 3 reference images
  aspect_ratio?: NanoBananaAspectRatio;
  output_format?: 'jpg' | 'png';
}

interface NanoBananaOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: NanoBananaInput;
  output?: string; // Single image URL
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

interface CreatePredictionParams extends NanoBananaInput {
  webhook?: string;
}

/**
 * Create a new image generation prediction using Nano-Banana
 */
export async function createNanoBananaPrediction(
  params: CreatePredictionParams
): Promise<NanoBananaOutput> {
  try {
    console.log(`🍌 Creating Nano-Banana prediction: "${params.prompt.substring(0, 100)}..."`);

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: 'd05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8',
        input: {
          prompt: params.prompt,
          ...(params.image_input && params.image_input.length > 0 && { image_input: params.image_input }),
          aspect_ratio: params.aspect_ratio || '16:9',
          output_format: params.output_format || 'png',
        },
        ...(params.webhook && { webhook: params.webhook }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Nano-Banana API error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Nano-Banana prediction created: ${result.id}`);
    return result;
  } catch (error) {
    console.error('createNanoBananaPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of an image generation prediction
 */
export async function getNanoBananaPrediction(
  predictionId: string
): Promise<NanoBananaOutput> {
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
    console.error('getNanoBananaPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running image generation prediction
 */
export async function cancelNanoBananaPrediction(
  predictionId: string
): Promise<NanoBananaOutput> {
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
    console.error('cancelNanoBananaPrediction error:', error);
    throw error;
  }
}

/**
 * Utility function to wait for prediction completion with polling
 */
export async function waitForNanoBananaCompletion(
  predictionId: string,
  maxWaitTime: number = 300000, // 5 minutes default
  pollInterval: number = 3000 // 3 seconds default
): Promise<NanoBananaOutput> {
  const startTime = Date.now();
  console.log(`⏳ Waiting for Nano-Banana completion: ${predictionId}`);

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getNanoBananaPrediction(predictionId);

    console.log(`📊 Nano-Banana status: ${prediction.status} (${Math.round((Date.now() - startTime) / 1000)}s)`);

    if (prediction.status === 'succeeded') {
      console.log(`🎉 Nano-Banana completed: ${prediction.output}`);
      return prediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      console.error(`❌ Nano-Banana failed: ${prediction.error || prediction.status}`);
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Nano-Banana prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}
