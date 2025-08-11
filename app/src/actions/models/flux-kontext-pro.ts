'use server';

/**
 * FLUX Kontext Pro - Text-based Image Generation for Script-to-Video
 * Model: black-forest-labs/flux-kontext-pro
 * A state-of-the-art text-based image editing model that delivers high-quality outputs
 */

interface FluxKontextProInput {
  prompt: string;
  seed?: number;
  input_image?: string; // Optional reference image
  aspect_ratio?: string; // Default: match_input_image
  output_format?: 'jpg' | 'png';
  safety_tolerance?: number; // 0-6, default: 2
  prompt_upsampling?: boolean; // Default: false
}

interface FluxKontextProOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: FluxKontextProInput;
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

interface CreatePredictionParams extends FluxKontextProInput {
  webhook?: string;
}

/**
 * Create a new image generation prediction using FLUX Kontext Pro
 */
export async function createFluxKontextPrediction(
  params: CreatePredictionParams
): Promise<FluxKontextProOutput> {
  try {
    console.log(`🎨 Creating FLUX Kontext Pro prediction: "${params.prompt}"`);
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: 'aa776ca45ce7f7d185418f700df8ec6ca6cb367bfd88e9cd225666c4c179d1d7',
        input: {
          prompt: params.prompt,
          ...(params.seed && { seed: params.seed }),
          ...(params.input_image && { input_image: params.input_image }),
          aspect_ratio: params.aspect_ratio || 'match_input_image',
          output_format: params.output_format || 'png',
          safety_tolerance: params.safety_tolerance ?? 2,
          prompt_upsampling: params.prompt_upsampling ?? false,
        },
        ...(params.webhook && { webhook: params.webhook }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`FLUX Kontext Pro API error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ FLUX Kontext Pro prediction created: ${result.id}`);
    return result;
  } catch (error) {
    console.error('createFluxKontextPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of an image generation prediction
 */
export async function getFluxKontextPrediction(
  predictionId: string
): Promise<FluxKontextProOutput> {
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
    console.error('getFluxKontextPrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running image generation prediction
 */
export async function cancelFluxKontextPrediction(
  predictionId: string
): Promise<FluxKontextProOutput> {
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
    console.error('cancelFluxKontextPrediction error:', error);
    throw error;
  }
}

/**
 * Utility function to wait for prediction completion with polling
 */
export async function waitForFluxKontextCompletion(
  predictionId: string,
  maxWaitTime: number = 300000, // 5 minutes default
  pollInterval: number = 3000 // 3 seconds default (slower for FLUX)
): Promise<FluxKontextProOutput> {
  const startTime = Date.now();
  console.log(`⏳ Waiting for FLUX Kontext Pro completion: ${predictionId}`);

  while (Date.now() - startTime < maxWaitTime) {
    const prediction = await getFluxKontextPrediction(predictionId);
    
    console.log(`📊 FLUX Kontext Pro status: ${prediction.status} (${Math.round((Date.now() - startTime) / 1000)}s)`);
    
    if (prediction.status === 'succeeded') {
      console.log(`🎉 FLUX Kontext Pro completed: ${prediction.output}`);
      return prediction;
    }
    
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      console.error(`❌ FLUX Kontext Pro failed: ${prediction.error || prediction.status}`);
      return prediction;
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`FLUX Kontext Pro prediction ${predictionId} did not complete within ${maxWaitTime}ms`);
}