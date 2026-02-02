'use server';

/**
 * Stable Audio 2.5 - HD Tier Music Generation
 * Model: stability-ai/stable-audio-2.5
 * High-quality instrumentals, max 47 seconds
 * Cost: 8 credits
 */

export interface StableAudioInput {
  prompt: string;
  seconds: number; // max 47
  negative_prompt?: string;
}

export interface StableAudioOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: StableAudioInput;
  output?: string; // Audio file URL
  error?: string;
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

interface CreatePredictionParams extends StableAudioInput {
  webhook?: string;
  user_id?: string;
  batch_id?: string;
}

/**
 * Create a new music generation prediction using Stable Audio 2.5
 */
export async function createStableAudioPrediction(
  params: CreatePredictionParams
): Promise<StableAudioOutput> {
  try {
    console.log(`🎵 Creating Stable Audio prediction: "${params.prompt}"`);

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: 'a61ac8edbb27cd2eda1b2eff2bbc03dcff1131f5560836ff77a052df05b77491',
        input: {
          prompt: params.prompt,
          seconds: Math.min(params.seconds || 30, 47), // Cap at 47 seconds
          negative_prompt: params.negative_prompt || 'vocals, singing, voice, spoken word, lyrics',
        },
        ...(params.webhook && { webhook: params.webhook }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Stable Audio API error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Stable Audio prediction created: ${result.id}`);
    return result;
  } catch (error) {
    console.error('createStableAudioPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a Stable Audio prediction
 */
export async function getStableAudioPrediction(
  predictionId: string
): Promise<StableAudioOutput> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Stable Audio get prediction error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('getStableAudioPrediction error:', error);
    throw error;
  }
}

/**
 * Get Stable Audio Model Information
 */
export async function getStableAudioModelInfo() {
  return {
    name: 'Stable Audio 2.5',
    version: 'stable-audio-2.5',
    description: 'High-quality instrumental music generation by Stability AI',
    provider: 'stability-ai',
    tier: 'hd',
    capabilities: [
      'High-quality instrumentals',
      'Duration control (up to 47 seconds)',
      'Negative prompt support',
      'Good for background music'
    ],
    limitations: [
      'Max 47 seconds duration',
      'Better for instrumentals than vocals'
    ],
    pricing: {
      credits: 8,
      replicate_cost: '$0.20 per generation'
    },
    output_format: 'Audio file',
  };
}

/**
 * Calculate credits for Stable Audio generation
 */
export async function calculateStableAudioCredits(): Promise<number> {
  return 8; // Fixed cost for HD tier
}
