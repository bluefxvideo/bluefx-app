'use server';

/**
 * MiniMax Music 1.5 - Vocals Tier Music Generation
 * Model: minimax/music-1.5
 * Full songs with singing, lyrics, and style transfer
 * Cost: 10 credits (~$0.03/output)
 */

export interface MiniMaxMusicInput {
  prompt: string;              // Style description (10-300 chars)
  lyrics?: string;             // Song lyrics (10-600 chars)
  reference_audio?: string;    // URL for style reference
  style_strength?: number;     // 0.0-1.0, how much to use reference
}

export interface MiniMaxMusicOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  input: MiniMaxMusicInput;
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

interface CreatePredictionParams extends MiniMaxMusicInput {
  webhook?: string;
  user_id?: string;
  batch_id?: string;
}

/**
 * Create a new music generation prediction using MiniMax Music 1.5
 */
export async function createMiniMaxMusicPrediction(
  params: CreatePredictionParams
): Promise<MiniMaxMusicOutput> {
  try {
    console.log(`🎤 Creating MiniMax Music prediction: "${params.prompt}"`);

    const input: Record<string, unknown> = {
      prompt: params.prompt,
    };

    // Add lyrics if provided
    if (params.lyrics && params.lyrics.trim().length >= 10) {
      input.lyrics = params.lyrics.trim();
      console.log(`🎤 Including lyrics (${params.lyrics.length} chars)`);
    }

    // Add reference audio if provided
    if (params.reference_audio) {
      input.reference_audio = params.reference_audio;
      input.style_strength = params.style_strength ?? 0.5;
      console.log(`🎤 Including reference audio with strength: ${input.style_strength}`);
    }

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'minimax/music-1.5',
        input,
        ...(params.webhook && { webhook: params.webhook }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MiniMax Music API error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ MiniMax Music prediction created: ${result.id}`);
    return result;
  } catch (error) {
    console.error('createMiniMaxMusicPrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a MiniMax Music prediction
 */
export async function getMiniMaxMusicPrediction(
  predictionId: string
): Promise<MiniMaxMusicOutput> {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MiniMax Music get prediction error: ${response.status} - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('getMiniMaxMusicPrediction error:', error);
    throw error;
  }
}

/**
 * Get MiniMax Music Model Information
 */
export async function getMiniMaxMusicModelInfo() {
  return {
    name: 'MiniMax Music 1.5',
    version: 'music-1.5',
    description: 'Full songs with natural vocals and rich instrumentation',
    provider: 'minimax',
    tier: 'vocals',
    capabilities: [
      'Full-length songs (up to 4 minutes)',
      'Lyrics-to-song generation',
      'Natural singing vocals',
      'Style transfer from reference audio',
      'Section tags: [verse], [chorus], [bridge], [outro]'
    ],
    limitations: [
      'English and Chinese lyrics only',
      'Max 600 characters for lyrics',
      'Reference audio: 5-30 seconds, max 60MB'
    ],
    pricing: {
      credits: 10,
      replicate_cost: '~$0.03 per generation'
    },
    output_format: 'Audio file',
  };
}

/**
 * Calculate credits for MiniMax Music generation
 */
export async function calculateMiniMaxMusicCredits(): Promise<number> {
  return 10; // Fixed cost for Vocals tier
}
