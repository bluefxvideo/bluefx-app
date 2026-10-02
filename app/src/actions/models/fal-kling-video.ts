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
// The standard tier of the same engine: 720p, takes the same inputs. Measured 2026-10-01:
// 0.6 billable units a second without sound ($0.084), 0.8 with sound.
const KLING_STANDARD_I2V_SUBMIT_URL = 'https://queue.fal.run/fal-ai/kling-video/o3/standard/image-to-video';
const KLING_T2V_SUBMIT_URL = 'https://queue.fal.run/fal-ai/kling-video/o3/pro/text-to-video';
const KLING_BASE = 'fal-ai/kling-video';

export interface KlingO3ProSubmitParams {
  /** Ignored when multi_prompt is provided (the API takes one or the other). */
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
  /** Prompt adherence strength, 0-1. */
  cfg_scale?: number;
  /** 'customize' follows the prompt/shots; 'intelligent' lets the engine cut. */
  shot_type?: 'customize' | 'intelligent';
  /** Timed shots; per-shot duration 1-15s, total ≤ 15s. Replaces prompt. */
  multi_prompt?: Array<{ prompt: string; duration: number }>;
  generate_audio?: boolean;
  webhook_url?: string;
  /** Image-to-video only: 'standard' orders the 720p tier. Absent = pro. */
  tier?: 'pro' | 'standard';
}

async function submitKlingO3Pro(
  params: KlingO3ProSubmitParams
): Promise<{ success: boolean; request_id?: string; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };

  try {
    let url = params.image_url ? (params.tier === 'standard' ? KLING_STANDARD_I2V_SUBMIT_URL : KLING_I2V_SUBMIT_URL) : KLING_T2V_SUBMIT_URL;
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
        // prompt XOR multi_prompt per the API contract
        ...(params.multi_prompt?.length
          ? {
              multi_prompt: params.multi_prompt.map((m) => ({
                prompt: m.prompt,
                duration: String(Math.min(15, Math.max(1, Math.round(m.duration)))),
              })),
            }
          : { prompt: params.prompt }),
        ...(params.image_url ? { image_url: params.image_url } : {}),
        ...(params.image_url && params.end_image_url ? { end_image_url: params.end_image_url } : {}),
        duration,
        // aspect_ratio is a t2v-only field; i2v follows the start image
        ...(params.image_url ? {} : { aspect_ratio: params.aspect_ratio || '16:9' }),
        generate_audio: params.generate_audio !== false,
        shot_type: params.shot_type || 'customize',
        ...(params.cfg_scale != null ? { cfg_scale: Math.min(1, Math.max(0, params.cfg_scale)) } : {}),
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

    console.log(`🎬 Kling O3 ${params.image_url && params.tier === 'standard' ? 'Standard' : 'Pro'} submitted: ${result.request_id} (${duration}s, ${params.image_url ? 'i2v' : 't2v'}, audio ${params.generate_audio !== false ? 'on' : 'off'})`);
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

const KLING_VOICE_SUBMIT_URL = 'https://queue.fal.run/fal-ai/kling-video/create-voice';
// The sibling of image-to-video that takes the picture as the first frame plus an "element" for the
// person, and an element can carry a saved voice. Same price a second (measured 2026-10-01).
const KLING_VOICE_CLIP_SUBMIT_URL = 'https://queue.fal.run/fal-ai/kling-video/o3/pro/reference-to-video';

/**
 * Saves a voice with the video engine from a recording (5 to 30 seconds of one person talking)
 * and returns its id. Clips ordered with the id speak in that voice. Waits for the engine:
 * about ten seconds.
 */
export async function createKlingVoice(voiceUrl: string): Promise<{ success: boolean; voiceId?: string; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };
  try {
    const headers = { 'Content-Type': 'application/json', Authorization: `Key ${falKey}` };
    const submit = await fetch(KLING_VOICE_SUBMIT_URL, { method: 'POST', headers, body: JSON.stringify({ voice_url: voiceUrl }) });
    if (!submit.ok) return { success: false, error: `Voice submit failed (${submit.status}): ${(await submit.text()).substring(0, 150)}` };
    const { request_id } = await submit.json();
    if (!request_id) return { success: false, error: 'Voice submit returned no request_id' };
    for (let waited = 0; waited < 180; waited += 3) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const status = await fetch(`https://queue.fal.run/${KLING_BASE}/requests/${request_id}/status`, { headers });
      if (!status.ok) continue;
      const state = (await status.json()).status;
      if (state === 'FAILED') return { success: false, error: 'The voice could not be saved' };
      if (state !== 'COMPLETED') continue;
      const result = await fetch(`https://queue.fal.run/${KLING_BASE}/requests/${request_id}`, { headers });
      const body = await result.json();
      if (!result.ok || !body?.voice_id) return { success: false, error: `Voice result failed (${result.status}): ${JSON.stringify(body).substring(0, 150)}` };
      return { success: true, voiceId: body.voice_id as string };
    }
    return { success: false, error: 'Saving the voice took too long' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Voice submit failed' };
  }
}

/**
 * A talking clip in a saved voice: the picture is the first frame, the person in it is the
 * element the voice belongs to. The prompt is sent as written.
 */
export async function submitKlingO3ProVoiceClip(params: {
  prompt: string;
  image_url: string;
  /** Seconds, 3-15. */
  duration: number;
  aspect_ratio: '16:9' | '9:16' | '1:1';
  voice_id: string;
  webhook_url?: string;
}): Promise<{ success: boolean; request_id?: string; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };
  try {
    const duration = String(Math.min(15, Math.max(3, Math.round(params.duration))));
    const response = await fetch(params.webhook_url ? `${KLING_VOICE_CLIP_SUBMIT_URL}?fal_webhook=${encodeURIComponent(params.webhook_url)}` : KLING_VOICE_CLIP_SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${falKey}` },
      body: JSON.stringify({
        prompt: params.prompt,
        start_image_url: params.image_url,
        elements: [{ frontal_image_url: params.image_url, reference_image_urls: [params.image_url], voice_id: params.voice_id }],
        duration,
        aspect_ratio: params.aspect_ratio,
        generate_audio: true,
        shot_type: 'customize',
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Kling O3 Pro voice clip submit error:', response.status, errorText.substring(0, 300));
      return { success: false, error: `Video submit failed (${response.status}): ${errorText.substring(0, 150)}` };
    }
    const result = await response.json();
    if (!result.request_id) return { success: false, error: 'Video submit returned no request_id' };
    console.log(`🎬 Kling O3 Pro submitted: ${result.request_id} (${duration}s, saved voice)`);
    return { success: true, request_id: result.request_id };
  } catch (error) {
    console.error('🚨 Kling O3 Pro voice clip submit error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Video submit failed' };
  }
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
