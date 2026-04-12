/**
 * fal.ai LTX 2.3 Fast — Image-to-Video
 * Model: fal-ai/ltx-2.3/image-to-video/fast
 *
 * Turns a still image into a cinematic video clip.
 * Uses the queue API (submit → poll → result).
 *
 * Pricing: $0.04 per second of output video at 1080p
 */

export interface FalLTX23Input {
  image_url: string;
  prompt: string;
  duration?: number;         // 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20
  resolution?: string;       // "1080p" | "1440p" | "2160p"
  aspect_ratio?: string;     // "auto" | "16:9" | "9:16"
  fps?: number;              // 24 | 25 | 48 | 50
  generate_audio?: boolean;
  end_image_url?: string;
}

export interface FalLTX23VideoOutput {
  video: {
    url: string;
    content_type: string;
    file_name: string;
    file_size: number;
    width: number;
    height: number;
    fps: number;
    duration: number;
    num_frames: number;
  };
}

export interface FalQueueResponse {
  request_id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  response_url?: string;
}

export interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  logs?: string[];
  response_url?: string;
}

const MODEL_ID = 'fal-ai/ltx-2.3/image-to-video/fast';
// Status/result endpoints use shorter base path
const MODEL_BASE = 'fal-ai/ltx-2.3';

/**
 * Submit an image-to-video job to the FAL queue
 */
export async function createFalLTX23Prediction(
  params: FalLTX23Input
): Promise<FalQueueResponse> {
  try {
    console.log(`🎬 Creating fal.ai LTX 2.3 Fast prediction: ${params.aspect_ratio || '16:9'}, ${params.duration || 6}s`);

    const queueUrl = `https://queue.fal.run/${MODEL_ID}`;

    const requestBody: Record<string, unknown> = {
      image_url: params.image_url,
      prompt: params.prompt,
      duration: params.duration || 6,
      resolution: params.resolution || '1080p',
      aspect_ratio: params.aspect_ratio || '16:9',
      fps: params.fps || 25,
      generate_audio: params.generate_audio ?? false,
    };

    if (params.end_image_url) {
      requestBody.end_image_url = params.end_image_url;
    }

    const response = await fetch(queueUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${process.env.FAL_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`fal.ai LTX 2.3 API error: ${response.status} - ${errorText}`);
      throw new Error(`fal.ai error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ fal.ai LTX 2.3 request queued: ${result.request_id}`);
    return result;
  } catch (error) {
    console.error('createFalLTX23Prediction error:', error);
    throw error;
  }
}

/**
 * Check queue status for a request
 */
export async function getFalLTX23Status(requestId: string): Promise<FalStatusResponse> {
  try {
    const response = await fetch(
      `https://queue.fal.run/${MODEL_BASE}/requests/${requestId}/status`,
      {
        headers: {
          'Authorization': `Key ${process.env.FAL_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`fal.ai status error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('getFalLTX23Status error:', error);
    throw error;
  }
}

/**
 * Get the result of a completed request
 */
export async function getFalLTX23Result(requestId: string): Promise<FalLTX23VideoOutput> {
  try {
    const response = await fetch(
      `https://queue.fal.run/${MODEL_BASE}/requests/${requestId}`,
      {
        headers: {
          'Authorization': `Key ${process.env.FAL_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`fal.ai result error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('getFalLTX23Result error:', error);
    throw error;
  }
}
