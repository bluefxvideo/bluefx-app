'use server';

import { createHash } from 'crypto';
import { friendlyFalImageError, isFalSafetyRefusal } from './fal-error';
import type { NanoBananaAspectRatio } from './fal-nano-banana-2';
import { pixelSizeFor } from '@/lib/image-sizes';
import { msUntil } from '@/lib/image-deadline';

/**
 * GPT Image 2.5 via fal.ai (billed through FAL, no OpenAI account needed).
 * Text-to-image: https://fal.run/openai/gpt-image-2.5/{flare|sunburst}/text-to-image
 * Image-to-image: https://fal.run/openai/gpt-image-2.5/{flare|sunburst}/edit
 * Synchronous — returns the generated image URL directly.
 *
 * Drop-in for generateWithFalNanaBanana2: same parameters, same result shape,
 * so call sites can pick an engine with one ternary (see src/lib/image-engine.ts).
 * Flare is the fast default; Sunburst trades time for edit precision.
 *
 * OpenAI's checker is stricter than Google's: it refuses ordinary swimwear,
 * lingerie catalog shots and low-cut tops that Nano Banana renders. fal
 * exposes no moderation level for this endpoint, so a safety refusal (422
 * content_policy_violation, not billed) reruns the same request on Nano
 * Banana 2, the engine every call site used before the switch. Only a
 * refusal by both engines reaches the user. The same rerun covers an engine
 * that is down or too slow (5xx, 429, timeout, network error): a client
 * should not lose an image because one provider has a bad minute. A 4xx
 * that is not a refusal (bad input) is NOT rerun: it would fail there too
 * and would hide a bug on our side.
 *
 * fal prices per image, 2026-09 (high quality): 1920x1080 $0.040, 2560x1440
 * $0.055, 3840x2160 $0.100; edits run about 20% more. Nano Banana 2 was
 * $0.08 / $0.12 / $0.16 at 1K / 2K / 4K. Measured: ~20 s text-to-image at
 * 1080p high, ~30-40 s for reference-image edits.
 */

export type GptImage25Quality = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type GptImage25Variant = 'flare' | 'sunburst';
type ImageResolution = '1K' | '2K' | '4K';

interface GptImage25Input {
  prompt: string;
  aspect_ratio?: NanoBananaAspectRatio;
  resolution?: ImageResolution;
  output_format?: 'jpeg' | 'png' | 'webp';
  /** Reference images. When present the /edit endpoint is used. */
  image_input?: string[];
  quality?: GptImage25Quality;
  variant?: GptImage25Variant;
  background?: 'auto' | 'transparent' | 'opaque';
  /** Epoch ms by which the call must be over (see src/lib/image-deadline.ts). */
  deadlineAt?: number;
}

/** A Nano Banana 2 rerun is only worth starting with this much time left. */
const MIN_RERUN_MS = 15_000;

/**
 * Requests GPT refused lately (process memory). When a refusal arrives too late for
 * the rerun, the user is told to try again, and that try skips GPT: it would refuse
 * the same request again and use up the time Nano Banana 2 needs.
 */
const REFUSAL_MEMORY_MS = 15 * 60 * 1000;
const recentRefusals = new Map<string, number>();

function refusalKey(params: GptImage25Input): string {
  return createHash('sha256')
    .update(JSON.stringify([params.prompt, params.image_input || [], params.background || '', params.aspect_ratio || '']))
    .digest('hex');
}

function rememberRefusal(key: string): void {
  const now = Date.now();
  for (const [k, at] of recentRefusals) {
    if (now - at > REFUSAL_MEMORY_MS) recentRefusals.delete(k);
  }
  recentRefusals.set(key, now);
}

function refusedRecently(key: string): boolean {
  const at = recentRefusals.get(key);
  return at !== undefined && Date.now() - at <= REFUSAL_MEMORY_MS;
}

/**
 * Generate or edit an image with GPT Image 2.5 via fal.ai (synchronous).
 * Uses the /edit endpoint when reference images are provided.
 */
export async function generateWithGptImage25(params: GptImage25Input): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
}> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return { success: false, error: 'FAL_KEY not configured' };
  }

  const hasImages = !!params.image_input && params.image_input.length > 0;
  const variant: GptImage25Variant = params.variant || 'flare';
  const endpoint = `https://fal.run/openai/gpt-image-2.5/${variant}/${hasImages ? 'edit' : 'text-to-image'}`;
  const aspect = params.aspect_ratio || '16:9';
  const size = aspect === 'auto' ? undefined : pixelSizeFor(aspect, params.resolution || '1K');

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    quality: params.quality || 'high',
    output_format: params.output_format || 'jpeg',
    num_images: 1,
  };
  if (size) {
    body.image_size = size;
  } else if (hasImages) {
    body.image_size = 'auto'; // keep the reference image's dimensions
  }
  if (hasImages) body.image_urls = params.image_input;
  if (params.background) body.background = params.background;

  console.log(
    `🎨 fal.ai gpt-image-2.5/${variant}${hasImages ? '/edit' : ''}: ${params.quality || 'high'} ` +
      `${size ? `${size.width}x${size.height}` : 'auto'}${hasImages ? `, ${params.image_input!.length} reference(s)` : ''}`
  );

  // Nano Banana 2 cannot make a transparent background. On an outage a transparent
  // (logo) request gets a clear "try again" instead, because the next try on GPT will
  // most likely work. A safety refusal still reruns, transparent or not: GPT would
  // refuse again, and an opaque logo (what IMAGE_ENGINE=nb2 always makes) beats none.
  const canRerunOnOutage = params.background !== 'transparent';
  const hasTimeForRerun = () => msUntil(params.deadlineAt, Number.MAX_SAFE_INTEGER) >= MIN_RERUN_MS;

  const requestKey = refusalKey(params);
  if (refusedRecently(requestKey)) {
    console.log('🛟 gpt-image-2.5 refused this request a moment ago; going straight to nano-banana-2');
    return rerunOnNanoBanana2();
  }

  // Edits with several references have run 30-40 s at high. Without a deadline the
  // call may take up to 170 s (Sunburst, 4K); a caller's deadline shortens it.
  const budgetMs = msUntil(params.deadlineAt, 170_000);
  if (budgetMs < 5_000) {
    return { success: false, error: 'The image engine took too long. Try again in a minute.' };
  }

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), budgetMs);
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${falKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    // No answer at all: our own timeout or a network error
    const aborted = error instanceof Error && error.name === 'AbortError';
    console.error('🚨 fal.ai gpt-image-2.5 did not answer:', error);
    if (canRerunOnOutage && hasTimeForRerun()) {
      console.log('🛟 gpt-image-2.5 did not answer; rerunning on nano-banana-2');
      return rerunOnNanoBanana2();
    }
    return {
      success: false,
      error: aborted
        ? 'The image engine took too long. Try again in a minute.'
        : 'The image engine could not be reached. Try again in a minute.',
    };
  }

  try {
    if (!response.ok) {
      const errorText = await response.text();
      clearTimeout(timeout);
      console.error('🚨 fal.ai gpt-image-2.5 error:', response.status, errorText.substring(0, 200));
      if (isFalSafetyRefusal(errorText)) {
        rememberRefusal(requestKey);
        if (hasTimeForRerun()) {
          console.log('🛟 gpt-image-2.5 refused on safety grounds; rerunning on nano-banana-2');
          return rerunOnNanoBanana2();
        }
        // The refusal came too late for the rerun. The wording must not blame the
        // prompt: the second engine may well accept it, and the next try goes there.
        return { success: false, error: 'The image engine turned this picture down. Try again. The next try uses the backup engine.' };
      }
      if ((response.status >= 500 || response.status === 429) && canRerunOnOutage && hasTimeForRerun()) {
        console.log(`🛟 gpt-image-2.5 is unavailable (${response.status}); rerunning on nano-banana-2`);
        return rerunOnNanoBanana2();
      }
      return { success: false, error: friendlyFalImageError(response.status, errorText) };
    }

    // The image exists and is paid for at this point: a failure reading the answer is
    // reported, never rerun (that would pay for a second picture)
    const result: { images?: { url: string; width?: number; height?: number }[] } = await response.json();
    clearTimeout(timeout);
    if (!result.images || result.images.length === 0) {
      return { success: false, error: 'The image engine finished without an image. Try again.' };
    }

    console.log('✅ fal.ai gpt-image-2.5: image generated');
    return { success: true, imageUrl: result.images[0].url };
  } catch (error) {
    clearTimeout(timeout);
    console.error('🚨 fal.ai gpt-image-2.5 answer could not be read:', error);
    return { success: false, error: 'The image engine answer could not be read. Try again in a minute.' };
  }

  /** Same request on Nano Banana 2, the engine every call site used before the switch. */
  async function rerunOnNanoBanana2() {
    // Dynamic import: fal-nano-banana-2 imports this module for its own
    // engine picker, so a static import would form a cycle.
    const { generateWithFalNanaBanana2 } = await import('./fal-nano-banana-2');
    return generateWithFalNanaBanana2({
      prompt: params.prompt,
      aspect_ratio: aspect,
      resolution: params.resolution || '1K',
      output_format: params.output_format || 'jpeg',
      image_input: params.image_input,
      deadlineAt: params.deadlineAt,
    });
  }
}
