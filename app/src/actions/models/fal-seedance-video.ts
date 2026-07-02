/**
 * fal.ai ByteDance Seedance — video generation client
 *
 * Covers both generations behind the Video Maker tiers:
 * - Seedance 1.5 Pro ("Pro" tier)  — fal-ai/bytedance/seedance/v1.5/pro/...
 * - Seedance 2.0    ("Ultra" tier) — bytedance/seedance-2.0/...
 *
 * Queue API: submit → webhook (prod) / poll (local fallback) → result.
 * NOTE: fal queue status/result URLs use the BASE app id, not the full
 * endpoint path (a /variant suffix on those returns 405).
 *
 * Verified pricing (2026-07-02): 1.5 Pro 720p ≈ $0.052/s; 2.0 720p $0.3034/s.
 */

export type SeedanceGeneration = '1.5' | '2.0';

export interface FalSeedanceInput {
  generation: SeedanceGeneration;
  prompt: string;
  image_url?: string;        // present → image-to-video, absent → text-to-video
  end_image_url?: string;
  /**
   * 2.0 only: reference images (up to 9) → uses the reference-to-video
   * endpoint. Reference them in the prompt as [Image1], [Image2], …
   * Mutually exclusive with image_url/end_image_url (refs win).
   */
  reference_image_urls?: string[];
  /**
   * 2.0 only: reference audio clips (up to 3, combined ≤15s). Free — fal's
   * token formula only bills video durations. Requires at least one image
   * reference. Reference them in the prompt as [Audio1], … .
   */
  reference_audio_urls?: string[];
  duration?: number;         // 1.5: 4-12s, 2.0: 4-15s
  resolution?: string;       // '480p' | '720p' | '1080p' (2.0 also '4k')
  aspect_ratio?: string;
  generate_audio?: boolean;
  seed?: number;             // 1.5 only
  camera_fixed?: boolean;    // 1.5 only
  webhook_url?: string;      // fal_webhook target for completion callbacks
}

export interface FalSeedanceQueueResponse {
  request_id: string;
  status: string;
  status_url?: string;
  response_url?: string;
}

export interface FalSeedanceStatus {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  logs?: unknown;
}

export interface FalSeedanceResult {
  video?: {
    url: string;
    content_type?: string;
    file_size?: number;
    duration?: number;
  };
  seed?: number;
  /** Raw provider cost units from the x-fal-billable-units header (for margin tracking). */
  billable_units?: number;
}

function endpointFor(
  generation: SeedanceGeneration,
  hasImage: boolean,
  hasReferences = false
): { submit: string; base: string } {
  if (generation === '2.0') {
    const mode = hasReferences ? 'reference-to-video' : hasImage ? 'image-to-video' : 'text-to-video';
    return { submit: `bytedance/seedance-2.0/${mode}`, base: 'bytedance/seedance-2.0' };
  }
  const mode = hasImage ? 'image-to-video' : 'text-to-video';
  return { submit: `fal-ai/bytedance/seedance/v1.5/pro/${mode}`, base: 'fal-ai/bytedance' };
}

/**
 * Submit a Seedance generation to the fal queue.
 */
export async function createFalSeedancePrediction(params: FalSeedanceInput): Promise<FalSeedanceQueueResponse> {
  const hasReferences = params.generation === '2.0' && !!params.reference_image_urls?.length;
  const { submit } = endpointFor(params.generation, !!params.image_url, hasReferences);

  let queueUrl = `https://queue.fal.run/${submit}`;
  if (params.webhook_url) {
    queueUrl += `?fal_webhook=${encodeURIComponent(params.webhook_url)}`;
  }

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    // Seedance expects duration as a string enum ('4'..'15')
    duration: String(params.duration || 6),
    resolution: params.resolution || '720p',
    aspect_ratio: params.aspect_ratio || '16:9',
    generate_audio: params.generate_audio ?? true,
  };
  if (hasReferences) {
    // reference-to-video: up to 9 images, referenced as [Image1]… in the prompt.
    // First/last-frame inputs don't exist on this endpoint (refs replace them).
    body.image_urls = params.reference_image_urls!.slice(0, 9);
    // Audio refs require an image/video ref — only attach alongside images.
    if (params.reference_audio_urls?.length) {
      body.audio_urls = params.reference_audio_urls.slice(0, 3);
    }
  } else {
    if (params.image_url) body.image_url = params.image_url;
    if (params.end_image_url) body.end_image_url = params.end_image_url;
  }
  if (params.generation === '1.5') {
    if (params.seed !== undefined) body.seed = params.seed;
    if (params.camera_fixed !== undefined) body.camera_fixed = params.camera_fixed;
  }

  console.log(`🎬 fal Seedance ${params.generation} submit: ${submit} (${body.duration}s, ${body.resolution})`);

  const response = await fetch(queueUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${process.env.FAL_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`fal Seedance ${params.generation} error: ${response.status} - ${errorText}`);
    throw new Error(`fal.ai error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ fal Seedance ${params.generation} queued: ${result.request_id}`);
  return result;
}

/**
 * Check queue status for a Seedance request.
 */
export async function getFalSeedanceStatus(generation: SeedanceGeneration, requestId: string): Promise<FalSeedanceStatus> {
  const { base } = endpointFor(generation, true);
  const response = await fetch(
    `https://queue.fal.run/${base}/requests/${requestId}/status`,
    { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`fal.ai status error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

/**
 * Fetch the result of a completed Seedance request.
 * Also captures the x-fal-billable-units header for cost tracking.
 */
export async function getFalSeedanceResult(generation: SeedanceGeneration, requestId: string): Promise<FalSeedanceResult> {
  const { base } = endpointFor(generation, true);
  const response = await fetch(
    `https://queue.fal.run/${base}/requests/${requestId}`,
    { headers: { 'Authorization': `Key ${process.env.FAL_KEY}` } }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`fal.ai result error: ${response.status} - ${errorText}`);
  }
  const result: FalSeedanceResult = await response.json();
  const units = response.headers.get('x-fal-billable-units');
  if (units) result.billable_units = parseFloat(units);
  return result;
}
