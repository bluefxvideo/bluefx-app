'use server';

/**
 * Kling 2.6 Pro motion control via the fal.ai queue API.
 *
 * Video Swap's engine: the character from `image_url` performs the motion of
 * the person in `video_url`. fal takes about 2 minutes per second of video
 * (a 3 s clip measured at 376 s), so every run goes through the queue with
 * a webhook; the app never waits on the request.
 *
 * Inputs are exactly fal's: reference image, reference video, which of the
 * two decides the character's orientation, whether the original sound is
 * kept, and an optional prompt. Status/result URLs use the BASE app id
 * `fal-ai/kling-video` (a variant suffix 404s), as with Kling O3 Pro.
 */

const SUBMIT_URL = 'https://queue.fal.run/fal-ai/kling-video/v2.6/pro/motion-control';
const KLING_BASE = 'fal-ai/kling-video';

export interface KlingMotionControlSubmitParams {
  /** The new character. Clear body proportions, unobstructed, more than 5% of the frame. */
  image_url: string;
  /** The motion source: one realistic person, whole or upper body with the head visible. */
  video_url: string;
  /** 'video' follows the reference video (complex motion, up to 30 s); 'image' follows the image (camera moves, up to 10 s). */
  character_orientation: 'video' | 'image';
  keep_original_sound?: boolean;
  prompt?: string;
  webhook_url?: string;
}

export async function submitKlingMotionControl(
  params: KlingMotionControlSubmitParams
): Promise<{ success: boolean; request_id?: string; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };

  try {
    let url = SUBMIT_URL;
    if (params.webhook_url) url += `?fal_webhook=${encodeURIComponent(params.webhook_url)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${falKey}` },
      body: JSON.stringify({
        image_url: params.image_url,
        video_url: params.video_url,
        character_orientation: params.character_orientation,
        keep_original_sound: params.keep_original_sound !== false,
        ...(params.prompt?.trim() ? { prompt: params.prompt.trim() } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Kling motion control submit error:', response.status, errorText.substring(0, 300));
      return { success: false, error: `Video swap submit failed (${response.status}): ${errorText.substring(0, 150)}` };
    }

    const result = await response.json();
    if (!result.request_id) return { success: false, error: 'Video swap submit returned no request_id' };

    console.log(`🎭 Kling motion control submitted: ${result.request_id} (orientation ${params.character_orientation}, sound ${params.keep_original_sound !== false ? 'kept' : 'off'})`);
    return { success: true, request_id: result.request_id };
  } catch (error) {
    console.error('🚨 Kling motion control submit error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Video swap submit failed' };
  }
}

/** Queue status for a submitted run; used to self-heal when a webhook never arrives. */
export async function getKlingMotionControlStatus(
  requestId: string
): Promise<{ success: boolean; status?: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED'; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };
  try {
    const response = await fetch(`https://queue.fal.run/${KLING_BASE}/requests/${requestId}/status`, {
      headers: { Authorization: `Key ${falKey}` },
    });
    if (!response.ok) return { success: false, error: `Status check failed (${response.status})` };
    const result = await response.json();
    return { success: true, status: result.status };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Status check failed' };
  }
}

/** The finished video's URL once the queue reports COMPLETED. */
export async function getKlingMotionControlResult(
  requestId: string
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };
  try {
    const response = await fetch(`https://queue.fal.run/${KLING_BASE}/requests/${requestId}`, {
      headers: { Authorization: `Key ${falKey}` },
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Result fetch failed (${response.status}): ${errorText.substring(0, 150)}` };
    }
    const result = await response.json();
    const videoUrl = result?.video?.url;
    if (!videoUrl) return { success: false, error: 'No video in the result' };
    return { success: true, videoUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Result fetch failed' };
  }
}

/** Ask the queue to cancel a run that has not started; in-progress runs finish anyway. */
export async function cancelKlingMotionControl(requestId: string): Promise<{ success: boolean; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return { success: false, error: 'FAL_KEY not configured' };
  try {
    const response = await fetch(`https://queue.fal.run/${KLING_BASE}/requests/${requestId}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Key ${falKey}` },
    });
    return response.ok ? { success: true } : { success: false, error: `Cancel failed (${response.status})` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Cancel failed' };
  }
}
