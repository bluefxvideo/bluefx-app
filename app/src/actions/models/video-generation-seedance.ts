'use server';

/**
 * Seedance 1.5 Pro Video Generation Model
 * Model: bytedance/seedance-1.5-pro
 * Base URL: https://api.replicate.com/v1
 * Description: High-quality video generation with lip sync, singing, first/last frame control
 *
 * Key Features:
 * - Text-to-video (no reference image required)
 * - Image-to-video (optional first frame image)
 * - Last frame image support (for scene transitions)
 * - Built-in AI audio generation with lip sync
 * - Singing capability
 * - Seed control for consistency
 * - Multiple aspect ratios: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, 9:21
 * - Durations: 2-12 seconds
 * - Resolution: 1280x720 (720p)
 */

export type SeedanceAspectRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | '9:21';
export type SeedanceDuration = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface SeedanceVideoInput {
  prompt: string; // Text prompt for video generation (required)
  image?: string; // Optional first frame image for image-to-video mode
  last_frame_image?: string; // Optional last frame image (requires first frame)
  duration?: SeedanceDuration; // Duration in seconds (2-12, default: 5)
  aspect_ratio?: SeedanceAspectRatio; // Aspect ratio (default: 16:9)
  seed?: number | null; // Seed for reproducible generation
  camera_fixed?: boolean; // Lock camera position (default: false)
  generate_audio?: boolean; // Enable AI audio generation (default: true)
}

interface SeedanceVideoOutput {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  version?: string;
  model?: string;
  input: SeedanceVideoInput;
  output?: string | string[]; // URL(s) of generated video
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

interface CreateSeedancePredictionParams {
  prompt: string;
  duration?: SeedanceDuration;
  aspect_ratio?: SeedanceAspectRatio;
  generate_audio?: boolean;
  image?: string; // First frame image URL
  last_frame_image?: string; // Last frame image URL
  seed?: number | null;
  camera_fixed?: boolean;
  webhook?: string;
}

// Valid durations for Seedance 1.5 Pro (2-12 seconds)
const VALID_SEEDANCE_DURATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

// Valid aspect ratios
const VALID_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', '9:21'] as const;

/**
 * Create a new video generation prediction using Seedance 1.5 Pro
 */
export async function createSeedancePrediction(
  params: CreateSeedancePredictionParams
): Promise<SeedanceVideoOutput> {
  try {
    // Validate and normalize duration (2-12 seconds)
    let duration = params.duration || 5;
    if (!VALID_SEEDANCE_DURATIONS.includes(duration as typeof VALID_SEEDANCE_DURATIONS[number])) {
      // Clamp to valid range
      duration = Math.max(2, Math.min(12, Math.round(duration))) as SeedanceDuration;
    }

    // Validate aspect ratio
    let aspect_ratio = params.aspect_ratio || '16:9';
    if (!VALID_ASPECT_RATIOS.includes(aspect_ratio)) {
      aspect_ratio = '16:9';
    }

    // Build input for Seedance 1.5 Pro
    const input: Record<string, unknown> = {
      prompt: params.prompt,
      duration: duration,
      aspect_ratio: aspect_ratio,
      generate_audio: params.generate_audio !== false, // Default to true
    };

    // Add optional parameters
    if (params.image) {
      input.image = params.image;
    }

    if (params.last_frame_image) {
      // Last frame requires first frame
      if (!params.image) {
        console.warn('Last frame image provided without first frame image. Ignoring last frame.');
      } else {
        input.last_frame_image = params.last_frame_image;
      }
    }

    if (params.seed !== undefined && params.seed !== null) {
      input.seed = params.seed;
    }

    if (params.camera_fixed !== undefined) {
      input.camera_fixed = params.camera_fixed;
    }

    console.log('🎬 Creating Seedance 1.5 Pro prediction with input:', {
      ...input,
      image: params.image ? '[FIRST_FRAME_URL]' : undefined,
      last_frame_image: params.last_frame_image ? '[LAST_FRAME_URL]' : undefined
    });

    // Use the model endpoint for Seedance 1.5 Pro
    const response = await fetch('https://api.replicate.com/v1/models/bytedance/seedance-1.5-pro/predictions', {
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
          webhook_events_filter: ['start', 'output', 'completed', 'logs']
        }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Seedance 1.5 Pro API error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Seedance 1.5 Pro prediction created:', result.id);
    return result;
  } catch (error) {
    console.error('createSeedancePrediction error:', error);
    throw error;
  }
}

/**
 * Get the status and results of a Seedance prediction
 */
export async function getSeedancePrediction(
  predictionId: string
): Promise<SeedanceVideoOutput> {
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
    console.error('getSeedancePrediction error:', error);
    throw error;
  }
}

/**
 * Cancel a running Seedance prediction
 */
export async function cancelSeedancePrediction(
  predictionId: string
): Promise<SeedanceVideoOutput> {
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
    console.error('cancelSeedancePrediction error:', error);
    throw error;
  }
}
