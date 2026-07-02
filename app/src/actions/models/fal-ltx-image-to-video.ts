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
  /** Present → image-to-video; absent → text-to-video */
  image_url?: string;
  prompt: string;
  duration?: number;         // 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20
  resolution?: string;       // "1080p" | "1440p" | "2160p"
  aspect_ratio?: string;     // "auto" | "16:9" | "9:16"
  fps?: number;              // 24 | 25 | 48 | 50
  generate_audio?: boolean;
  end_image_url?: string;
  /** fal_webhook target for completion callbacks (prod) */
  webhook_url?: string;
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
const MODEL_ID_T2V = 'fal-ai/ltx-2.3/text-to-video/fast';
// Status/result endpoints use shorter base path
const MODEL_BASE = 'fal-ai/ltx-2.3';

/**
 * Submit an LTX 2.3 Fast job to the FAL queue.
 * Uses the image-to-video endpoint when image_url is provided, text-to-video otherwise.
 */
export async function createFalLTX23Prediction(
  params: FalLTX23Input
): Promise<FalQueueResponse> {
  try {
    console.log(`🎬 Creating fal.ai LTX 2.3 Fast prediction: ${params.aspect_ratio || '16:9'}, ${params.duration || 6}s${params.image_url ? '' : ' (text-to-video)'}`);

    let queueUrl = `https://queue.fal.run/${params.image_url ? MODEL_ID : MODEL_ID_T2V}`;
    if (params.webhook_url) {
      queueUrl += `?fal_webhook=${encodeURIComponent(params.webhook_url)}`;
    }

    const requestBody: Record<string, unknown> = {
      prompt: params.prompt,
      duration: params.duration || 6,
      resolution: params.resolution || '1080p',
      aspect_ratio: params.aspect_ratio || '16:9',
      fps: params.fps || 25,
      generate_audio: params.generate_audio ?? false,
    };

    if (params.image_url) {
      requestBody.image_url = params.image_url;
    }
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
 * Get the result of a completed request.
 * Captures x-fal-billable-units (billed output seconds) for cost tracking.
 */
export async function getFalLTX23Result(requestId: string): Promise<FalLTX23VideoOutput & { billable_units?: number }> {
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

    const result = await response.json();
    const units = response.headers.get('x-fal-billable-units');
    if (units) result.billable_units = parseFloat(units);
    return result;
  } catch (error) {
    console.error('getFalLTX23Result error:', error);
    throw error;
  }
}
