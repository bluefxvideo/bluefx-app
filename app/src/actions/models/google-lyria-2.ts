'use server';

/**
 * Generated from: Google Lyria-2
 * Base URL: https://api.replicate.com/v1
 * Description: Advanced text-to-music model by Google DeepMind
 * Model: google/lyria-2
 */

export interface Lyria2Input {
  prompt: string;
  seed?: number;
  negative_prompt?: string;
  user_id?: string;
  batch_id?: string;
}

interface Lyria2Output {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version: string;
  input: Lyria2Input;
  output?: string; // Audio file URL (URI format)
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

interface CreatePredictionParams extends Lyria2Input {
  webhook?: string;
}

/**
 * Create a new music generation prediction using Google Lyria-2
 */
export async function createLyria2Prediction(
  params: CreatePredictionParams
): Promise<Lyria2Output> {
  try {
    console.log(`🎵 Creating Lyria-2 prediction: "${params.prompt}"`);
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: 'bb621623ee2772c96d300b2a303c9e444b482f6b0fafcc7424923e1429971120',
        input: {
          prompt: params.prompt,
          ...(params.seed && { seed: params.seed }),
          ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
        },
        ...(params.webhook && { webhook: params.webhook }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lyria-2 API error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Lyria-2 prediction created: ${result.id}`);
    return result;
  } catch (error) {
    console.error('createLyria2Prediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a Lyria-2 prediction
 */
export async function getLyria2Prediction(
  predictionId: string
): Promise<Lyria2Output> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lyria-2 get prediction error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('getLyria2Prediction error:', error);
    throw error;
  }
}

/**
 * Wait for Lyria-2 prediction completion with polling
 * Following the same pattern as Ideogram
 */
export async function waitForLyria2Completion(
  predictionId: string,
  timeoutMs: number = 300000, // 5 minutes
  intervalMs: number = 2000   // 2 seconds
): Promise<Lyria2Output> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const prediction = await getLyria2Prediction(predictionId);
    
    console.log(`🎵 Lyria-2 prediction ${predictionId} status: ${prediction.status}`);
    
    if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
      return prediction;
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Lyria-2 prediction ${predictionId} timed out after ${timeoutMs}ms`);
}

/**
 * Calculate Lyria-2 Credits Based on Generation Parameters
 * Simple calculation: $2 per thousand seconds = 2 credits per ~10 seconds of audio
 */
export async function calculateLyria2Credits(input: Lyria2Input): Promise<number> {
  // Base cost: Lyria-2 pricing is ~$2 per 1000 seconds
  // We'll estimate ~10-30 seconds per generation, so base cost of 2 credits
  const baseCost = 3; // Conservative estimate
  
  // Add complexity bonus for detailed prompts
  const promptComplexity = input.prompt.split(' ').length;
  const complexityBonus = promptComplexity > 20 ? 1 : 0;
  
  return baseCost + complexityBonus;
}

/**
 * Get Lyria-2 Model Information
 */
export async function getLyria2ModelInfo() {
  return {
    name: 'Google Lyria-2',
    version: 'lyria-2',
    description: 'Advanced text-to-music model by Google DeepMind',
    provider: 'google',
    tier: 'unlimited',
    capabilities: [
      'Text-to-music generation',
      'High-quality 48kHz stereo output',
      'Seed control for reproducibility',
      'Negative prompt support'
    ],
    limitations: [
      'CPU-based generation (slower)',
      'No duration control',
      'No audio conditioning',
      'Simpler parameter set'
    ],
    pricing: {
      credits: 0,
      estimate: 'Free (included in plan)'
    },
    output_format: 'Audio file (48kHz stereo)',
    hardware: 'CPU',
  };
}

/**
 * Optimize prompt for Lyria-2
 * Lyria-2 works better with musical descriptors and style information
 */
export async function optimizeLyria2Prompt(
  prompt: string,
  genre?: string,
  mood?: string
): Promise<string> {
  let optimized = prompt.trim();
  
  // Add genre and mood context
  const contexts: string[] = [];
  if (genre && !optimized.toLowerCase().includes(genre.toLowerCase())) {
    contexts.push(genre);
  }
  if (mood && !optimized.toLowerCase().includes(mood.toLowerCase())) {
    contexts.push(mood);
  }
  
  if (contexts.length > 0) {
    optimized = `${contexts.join(' ')} ${optimized}`;
  }
  
  // Add musical context if missing
  const musicalTerms = ['music', 'song', 'track', 'melody', 'rhythm', 'beat', 'instrumental'];
  const hasMusicalContext = musicalTerms.some(term => 
    optimized.toLowerCase().includes(term.toLowerCase())
  );
  
  if (!hasMusicalContext) {
    optimized = `${optimized} music`;
  }
  
  return optimized;
}