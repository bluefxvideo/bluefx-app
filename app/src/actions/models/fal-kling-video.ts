'use server';

/**
 * Kling O3 Pro image-to-video via the fal.ai queue API.
 *
 * Clone Studio's animation engine: animates approved swapped keyframes with
 * generate_audio ON (per-scene diegetic sound). ~0.8 billable units/s;
 * audio-on ≈ $0.14/s.
 *
 * API quirks (verified, cost a prod incident once):
 * - Submit URL uses the full variant path, but status/result URLs use the
 *   BASE app id `fal-ai/kling-video` — a variant suffix 404s/405s.
 * - O3 i2v takes `image_url` (v3 i2v takes `start_image_url` — different param).
 * - `duration` is a STRING, "3".."15".
 */

const KLING_I2V_SUBMIT_URL = 'https://queue.fal.run/fal-ai/kling-video/o3/pro/image-to-video';
const KLING_T2V_SUBMIT_URL = 'https://queue.fal.run/fal-ai/kling-video/o3/pro/text-to-video';
const KLING_BASE = 'fal-ai/kling-video';

export interface KlingO3ProSubmitParams {
  prompt: string;
  /** Start frame; omit for text-to-video. */
  image_url?: string;
  /** Optional end frame (i2v only, per the fal schema). */
  end_image_url?: string;
  /** Seconds, 3-15. Sent as a string per the API contract. */
  duration: number;
  /** t2v only — i2v output follows the start image's aspect ratio. */
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  negative_prompt?: string;
  generate_audio?: boolean;
  webhook_url?: string;
}

async function submitKlingO3Pro(
  params: KlingO3ProSubmitParams
): Promise<{ success: boolean; request_id?: string; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };

  try {
    let url = params.image_url ? KLING_I2V_SUBMIT_URL : KLING_T2V_SUBMIT_URL;
    if (params.webhook_url) {
      url += `?fal_webhook=${encodeURIComponent(params.webhook_url)}`;
    }

    const duration = String(Math.min(15, Math.max(3, Math.round(params.duration))));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        ...(params.image_url ? { image_url: params.image_url } : {}),
        ...(params.image_url && params.end_image_url ? { end_image_url: params.end_image_url } : {}),
        duration,
        // aspect_ratio is a t2v-only field; i2v follows the start image
        ...(params.image_url ? {} : { aspect_ratio: params.aspect_ratio || '16:9' }),
        generate_audio: params.generate_audio !== false,
        shot_type: 'customize',
        ...(params.negative_prompt ? { negative_prompt: params.negative_prompt } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Kling O3 Pro submit error:', response.status, errorText.substring(0, 300));
      return { success: false, error: `Video submit failed (${response.status}): ${errorText.substring(0, 150)}` };
    }

    const result = await response.json();
    if (!result.request_id) {
      return { success: false, error: 'Video submit returned no request_id' };
    }

    console.log(`🎬 Kling O3 Pro submitted: ${result.request_id} (${duration}s, ${params.image_url ? 'i2v' : 't2v'}, audio ${params.generate_audio !== false ? 'on' : 'off'})`);
    return { success: true, request_id: result.request_id };
  } catch (error) {
    console.error('🚨 Kling O3 Pro submit error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Video submit failed' };
  }
}

export async function submitKlingO3ProImageToVideo(
  params: KlingO3ProSubmitParams & { image_url: string }
): Promise<{ success: boolean; request_id?: string; error?: string }> {
  return submitKlingO3Pro(params);
}

export async function submitKlingO3ProTextToVideo(
  params: Omit<KlingO3ProSubmitParams, 'image_url'>
): Promise<{ success: boolean; request_id?: string; error?: string }> {
  return submitKlingO3Pro(params);
}

export async function getKlingQueueStatus(
  requestId: string
): Promise<{ success: boolean; status?: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED'; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };

  try {
    const response = await fetch(
      `https://queue.fal.run/${KLING_BASE}/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${falKey}` } }
    );
    if (!response.ok) {
      return { success: false, error: `Status check failed (${response.status})` };
    }
    const result = await response.json();
    return { success: true, status: result.status };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Status check failed' };
  }
}

export async function getKlingResult(
  requestId: string
): Promise<{ success: boolean; videoUrl?: string; billableUnits?: number; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };

  try {
    const response = await fetch(
      `https://queue.fal.run/${KLING_BASE}/requests/${requestId}`,
      { headers: { 'Authorization': `Key ${falKey}` } }
    );
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Result fetch failed (${response.status}): ${errorText.substring(0, 150)}` };
    }
    const billableUnits = parseFloat(response.headers.get('x-fal-billable-units') || '0');
    const result = await response.json();
    const videoUrl = result?.video?.url;
    if (!videoUrl) {
      return { success: false, error: 'Kling result contained no video URL' };
    }
    return { success: true, videoUrl, billableUnits };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Result fetch failed' };
  }
}
