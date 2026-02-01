'use server';

/**
 * ElevenLabs Music - Pro Tier Music Generation
 * Model: elevenlabs/music
 * Premium quality music, up to 300 seconds
 * Cost: 15 credits
 */

export interface ElevenLabsMusicInput {
  prompt: string;
  duration: number; // up to 300 seconds
}

export interface ElevenLabsMusicOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: ElevenLabsMusicInput;
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

interface CreatePredictionParams extends ElevenLabsMusicInput {
  webhook?: string;
  user_id?: string;
  batch_id?: string;
}

/**
 * Create a new music generation prediction using ElevenLabs Music
 */
export async function createElevenLabsMusicPrediction(
  params: CreatePredictionParams
): Promise<ElevenLabsMusicOutput> {
  try {
    console.log(`🎵 Creating ElevenLabs Music prediction: "${params.prompt}"`);

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'elevenlabs/music',
        input: {
          prompt: params.prompt,
          duration: Math.min(params.duration || 30, 300), // Cap at 300 seconds
        },
        ...(params.webhook && { webhook: params.webhook }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs Music API error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ ElevenLabs Music prediction created: ${result.id}`);
    return result;
  } catch (error) {
    console.error('createElevenLabsMusicPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of an ElevenLabs Music prediction
 */
export async function getElevenLabsMusicPrediction(
  predictionId: string
): Promise<ElevenLabsMusicOutput> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs Music get prediction error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('getElevenLabsMusicPrediction error:', error);
    throw error;
  }
}

/**
 * Get ElevenLabs Music Model Information
 */
export async function getElevenLabsMusicModelInfo() {
  return {
    name: 'ElevenLabs Music',
    version: 'elevenlabs-music',
    description: 'Premium quality music generation by ElevenLabs',
    provider: 'elevenlabs',
    tier: 'pro',
    capabilities: [
      'Premium studio-quality output',
      'Long duration support (up to 5 minutes)',
      'Full track generation',
      'Professional mixing quality'
    ],
    limitations: [
      'Higher cost per generation'
    ],
    pricing: {
      credits: 15,
      replicate_cost: '~$0.25 per 30 seconds'
    },
    output_format: 'Audio file',
  };
}

/**
 * Calculate credits for ElevenLabs Music generation
 */
export async function calculateElevenLabsMusicCredits(): Promise<number> {
  return 15; // Fixed cost for Pro tier
}
