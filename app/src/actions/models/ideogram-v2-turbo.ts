'use server';

/**
 * Generated from: Ideogram V2 Turbo
 * Base URL: https://api.replicate.com/v1
 * Description: Fast, high-quality image generation with enhanced style options
 * Model: ideogram-ai/ideogram-v2-turbo
 */

interface IdeogramV2aInput {
  prompt: string;
  seed?: number; // Max: 2147483647
  resolution?: string; // Default: "None"
  style_type?: 'None' | 'Auto' | 'General' | 'Realistic' | 'Design' | 'Render 3D' | 'Anime';
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '16:10' | '10:16' | '3:1' | '1:3';
  magic_prompt_option?: 'Auto' | 'On' | 'Off';
  negative_prompt?: string; // Added in V2 Turbo
  image?: string; // For inpainting (V2 Turbo feature)
  mask?: string; // For inpainting (V2 Turbo feature)
}

interface IdeogramV2aOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: IdeogramV2aInput;
  output?: string; // Single image URL (URI format)
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

interface CreatePredictionParams extends IdeogramV2aInput {
  webhook?: string;
}

/**
 * Create a new thumbnail generation prediction using Ideogram V2 Turbo
 */
export async function createIdeogramV2aPrediction(
  params: CreatePredictionParams
): Promise<IdeogramV2aOutput> {
  try {
    console.log(`🎨 Creating Ideogram V2 Turbo prediction: "${params.prompt}"`);
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: '35eacd3dbd088d6421f7ee27646701b5e03ec5a9a0f68f43112fa228d6fc2522', // Ideogram V2 Turbo
        input: {
          prompt: params.prompt,
          ...(params.seed && { seed: params.seed }),
          resolution: params.resolution || 'None',
          style_type: params.style_type || 'Auto',
          aspect_ratio: params.aspect_ratio || '1:1',
          magic_prompt_option: params.magic_prompt_option || 'Auto',
          ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
          ...(params.image && { image: params.image }),
          ...(params.mask && { mask: params.mask }),
        },
        ...(params.webhook && { webhook: params.webhook }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ideogram V2a API error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Ideogram V2a prediction created: ${result.id}`);
    return result;
  } catch (error) {
    console.error('createIdeogramV2aPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of an Ideogram V2a prediction
 */
export async function getIdeogramV2aPrediction(
  predictionId: string
): Promise<IdeogramV2aOutput> {
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
    console.error('getIdeogramV2aPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running Ideogram V2a prediction
 */
export async function cancelIdeogramV2aPrediction(
  predictionId: string
): Promise<IdeogramV2aOutput> {
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
    console.error('cancelIdeogramV2aPrediction error:', error);
    throw error;
  }
}

/**
 * Utility function to wait for prediction completion with polling
 */
export async function waitForIdeogramV2aCompletion(
  predictionId: string,
  maxWaitTime: number = 300000, // 5 minutes default
  pollInterval: number = 2000 // 2 seconds default
): Promise<IdeogramV2aOutput> {
  const startTime = Date.now();
  console.log(`⏳ Waiting for Ideogram V2a completion: ${predictionId}`);

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getIdeogramV2aPrediction(predictionId);
    
    console.log(`📊 Ideogram V2a status: ${prediction.status} (${Math.round((Date.now() - startTime) / 1000)}s)`);
    
    if (prediction.status === 'succeeded') {
      console.log(`🎉 Ideogram V2a completed: ${prediction.output}`);
      return prediction;
    }
    
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      console.error(`❌ Ideogram V2a failed: ${prediction.error || prediction.status}`);
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Ideogram V2a prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}

/**
 * Helper function for thumbnail generation with optimized defaults
 */
export async function generateThumbnail(
  prompt: string,
  options?: {
    aspectRatio?: IdeogramV2aInput['aspect_ratio'];
    styleType?: IdeogramV2aInput['style_type'];
    seed?: number;
    webhook?: string;
  }
): Promise<IdeogramV2aOutput> {
  return createIdeogramV2aPrediction({
    prompt,
    aspect_ratio: options?.aspectRatio || '16:9', // YouTube standard
    style_type: options?.styleType || 'Auto', // Let Ideogram decide best style
    magic_prompt_option: 'On', // Enhanced prompts for better thumbnails
    seed: options?.seed,
    webhook: options?.webhook,
  });
}

/**
 * Generate multiple thumbnails by creating multiple predictions
 * Note: Ideogram V2a returns single images, so we need multiple calls for batches
 */
export async function generateMultipleThumbnails(
  prompt: string,
  count: number = 4,
  options?: {
    aspectRatio?: IdeogramV2aInput['aspect_ratio'];
    styleType?: IdeogramV2aInput['style_type'];
    webhook?: string;
  }
): Promise<IdeogramV2aOutput[]> {
  const predictions: Promise<IdeogramV2aOutput>[] = [];
  
  // Create multiple predictions with different seeds for variety
  for (let i = 0; i < count; i++) {
    predictions.push(
      createIdeogramV2aPrediction({
        prompt,
        aspect_ratio: options?.aspectRatio || '16:9',
        style_type: options?.styleType || 'Auto',
        magic_prompt_option: 'On',
        seed: Math.floor(Math.random() * 2147483647), // Random seed for variety
        webhook: options?.webhook,
      })
    );
  }
  
  return Promise.all(predictions);
}