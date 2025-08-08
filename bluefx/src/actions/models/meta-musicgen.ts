'use server';

/**
 * Generated from: Meta MusicGen
 * Base URL: https://api.replicate.com/v1
 * 
 * Generate music from text description using Meta's MusicGen model
 * with stereo output and melody conditioning
 */

export interface MusicGenInput {
  /** A description of the music you want to generate */
  prompt: string;
  
  /** Duration of the generated audio in seconds (1-300) */
  duration?: number;
  
  /** An audio file that will influence the generated music */
  input_audio?: string;
  
  /** Model to use for generation */
  model_version?: 'stereo-melody-large' | 'stereo-large' | 'melody-large' | 'large';
  
  /** If True, generated music will continue from input_audio */
  continuation?: boolean;
  
  /** Output format for the generated audio */
  output_format?: 'wav' | 'mp3';
  
  /** Strategy for normalizing audio */
  normalization_strategy?: 'loudness' | 'clip' | 'peak' | 'rms';
  
  /** Reduces sampling to the k most likely tokens */
  top_k?: number;
  
  /** Reduces sampling to tokens with cumulative probability of p */
  top_p?: number;
  
  /** Controls randomness: lower values for more focused, higher values for more random outputs */
  temperature?: number;
  
  /** Higher values follow the prompt more closely */
  classifier_free_guidance?: number;
}

export interface MusicGenPrediction {
  /** Unique identifier for the prediction */
  id: string;
  
  /** The version of the model used */
  version: string;
  
  /** Current status of the prediction */
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  
  /** Input parameters used for generation */
  input: MusicGenInput;
  
  /** URL to the generated audio file (when succeeded) */
  output?: string | null;
  
  /** Error message if prediction failed */
  error?: string | null;
  
  /** Logs from the prediction process */
  logs?: string;
  
  /** When the prediction was created */
  created_at: string;
  
  /** When the prediction started processing */
  started_at?: string | null;
  
  /** When the prediction completed */
  completed_at?: string | null;
  
  /** Webhook URL for completion notification */
  webhook?: string | null;
  
  /** List of webhook events to filter */
  webhook_events_filter?: string[];
}

export interface CreateMusicGenPredictionInput {
  /** The version ID of the MusicGen model */
  version?: string;
  
  /** Input parameters for music generation */
  input: MusicGenInput;
  
  /** HTTPS URL to receive a POST request with prediction results */
  webhook?: string;
}

export interface MusicGenResponse {
  success: boolean;
  prediction?: MusicGenPrediction;
  error?: string;
}

/**
 * Create a MusicGen prediction for music generation
 */
export async function createMusicGenPrediction(
  params: CreateMusicGenPredictionInput
): Promise<MusicGenResponse> {
  try {
    const requestBody = {
      version: params.version || 'facebook/musicgen-stereo-melody:6ad9d07e53bf7e1f5ce9f58b11ad5d5fadc0e2e4b48fa35f47f55ff9b9db6de0',
      input: {
        prompt: params.input.prompt,
        duration: params.input.duration || 8,
        input_audio: params.input.input_audio,
        model_version: params.input.model_version || 'stereo-melody-large',
        continuation: params.input.continuation || false,
        output_format: params.input.output_format || 'wav',
        normalization_strategy: params.input.normalization_strategy || 'loudness',
        top_k: params.input.top_k || 250,
        top_p: params.input.top_p || 0.0,
        temperature: params.input.temperature || 1.0,
        classifier_free_guidance: params.input.classifier_free_guidance || 3.0,
      },
      webhook: params.webhook,
    };

    console.log('🎵 Creating MusicGen prediction:', {
      prompt: params.input.prompt,
      duration: params.input.duration,
      model_version: params.input.model_version
    });

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MusicGen prediction error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const prediction = await response.json() as MusicGenPrediction;
    
    console.log('🎵 MusicGen prediction created:', prediction.id);

    return {
      success: true,
      prediction
    };

  } catch (error) {
    console.error('createMusicGenPrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Music generation request failed'
    };
  }
}

/**
 * Get the current status and results of a MusicGen prediction
 */
export async function getMusicGenPrediction(predictionId: string): Promise<MusicGenResponse> {
  try {
    console.log('🎵 Getting MusicGen prediction status:', predictionId);

    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MusicGen status error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const prediction = await response.json() as MusicGenPrediction;
    
    console.log('🎵 MusicGen prediction status:', prediction.status);

    return {
      success: true,
      prediction
    };

  } catch (error) {
    console.error('getMusicGenPrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    };
  }
}

/**
 * Cancel a running MusicGen prediction
 */
export async function cancelMusicGenPrediction(predictionId: string): Promise<MusicGenResponse> {
  try {
    console.log('🎵 Cancelling MusicGen prediction:', predictionId);

    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MusicGen cancel error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const prediction = await response.json() as MusicGenPrediction;
    
    console.log('🎵 MusicGen prediction cancelled:', prediction.id);

    return {
      success: true,
      prediction
    };

  } catch (error) {
    console.error('cancelMusicGenPrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cancellation failed'
    };
  }
}

/**
 * Calculate estimated credits for MusicGen generation
 */
export async function calculateMusicGenCredits(input: MusicGenInput): Promise<number> {
  const baseCreditPerSecond = 0.5; // Base cost per second
  const duration = input.duration || 8;
  
  // Model version multipliers
  const modelMultipliers = {
    'stereo-melody-large': 1.5,
    'stereo-large': 1.3,
    'melody-large': 1.2,
    'large': 1.0
  };
  
  const modelMultiplier = modelMultipliers[input.model_version || 'stereo-melody-large'];
  
  // Additional cost for input audio conditioning
  const inputAudioMultiplier = input.input_audio ? 1.2 : 1.0;
  
  const totalCredits = Math.ceil(duration * baseCreditPerSecond * modelMultiplier * inputAudioMultiplier);
  
  return Math.max(totalCredits, 1); // Minimum 1 credit
}

/**
 * Get MusicGen model information
 */
export async function getMusicGenModelInfo() {
  return {
    name: 'MusicGen Stereo Melody',
    version: 'facebook/musicgen-stereo-melody:6ad9d07e53bf7e1f5ce9f58b11ad5d5fadc0e2e4b48fa35f47f55ff9b9db6de0',
    description: 'Generate high-quality stereo music with melody conditioning',
    supported_formats: ['mp3', 'wav'],
    max_duration: 300, // seconds
    min_duration: 1,
    default_duration: 8,
    model_versions: [
      'stereo-melody-large',
      'stereo-large', 
      'melody-large',
      'large'
    ],
    features: [
      'Text-to-music generation',
      'Melody-conditioned generation', 
      'Stereo output',
      'Multiple model versions',
      'Audio continuation',
      'Variable duration (1-300s)'
    ]
  };
}