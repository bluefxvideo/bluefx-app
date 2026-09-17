'use server';

import { friendlyFalImageError } from './fal-error';
import { msUntil } from '@/lib/image-deadline';
import { generateWithGptImage25 } from './fal-gpt-image-25';
import { imageEngine } from '@/lib/image-engine';

/**
 * Nano-Banana 2 via fal.ai (replaces Nano-Banana Pro — same quality, half the cost, faster)
 * Text-to-image: https://fal.run/fal-ai/nano-banana-2
 * Image-to-image: https://fal.run/fal-ai/nano-banana-2/edit
 * Synchronous — returns generated image URL directly.
 *
 * When image_input is provided, uses the /edit endpoint with image_urls parameter.
 */

export type NanoBananaAspectRatio = 'auto' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9';

interface FalNanoBanana2Input {
  prompt: string;
  aspect_ratio?: NanoBananaAspectRatio;
  resolution?: '1K' | '2K' | '4K';
  output_format?: 'jpeg' | 'png' | 'webp';
  image_input?: string[];
  /**
   * Epoch ms by which the call must be over. Callers behind the live proxy (it cuts a
   * request after about 55 s while the server keeps working) pass one so the answer
   * reaches the page instead of a lost request that still costs credits.
   */
  deadlineAt?: number;
}

interface FalImageResult {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

interface FalNanoBanana2Output {
  images: FalImageResult[];
  timings?: Record<string, number>;
  seed?: number;
  has_nsfw_concepts?: boolean[];
  prompt?: string;
}

/**
 * Generate an image using nano-banana-2 via fal.ai (synchronous)
 * When reference images are provided, uses the /edit endpoint for image-to-image generation.
 */
export async function generateWithFalNanaBanana2(params: FalNanoBanana2Input): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
}> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return { success: false, error: 'FAL_KEY not configured' };
  }

  try {
    const hasImages = params.image_input && params.image_input.length > 0;
    const endpoint = hasImages
      ? 'https://fal.run/fal-ai/nano-banana-2/edit'
      : 'https://fal.run/fal-ai/nano-banana-2';

    console.log(`🎨 fal.ai nano-banana-2${hasImages ? '/edit' : ''}: generating image...`);
    if (hasImages) {
      console.log(`📎 Reference images: ${params.image_input!.length}`);
    }

    const body: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: params.aspect_ratio || '16:9',
      resolution: params.resolution || '1K',
      output_format: params.output_format || 'jpeg',
    };

    if (hasImages) {
      body.image_urls = params.image_input;
    }

    const controller = new AbortController();
    // 90s timeout: 4K can be slow but anything over 90s usually means stuck.
    // A caller's deadline shortens it.
    const budgetMs = msUntil(params.deadlineAt, 90_000);
    if (budgetMs < 5_000) {
      return { success: false, error: 'The image engine took too long. Try again in a minute.' };
    }
    // The timer runs until the answer is fully read: a body that stalls after the
    // headers must not hold the request past the caller's deadline
    const timeout = setTimeout(() => controller.abort(), budgetMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${falKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🚨 fal.ai error:', response.status, errorText.substring(0, 200));
        return { success: false, error: friendlyFalImageError(response.status, errorText) };
      }

      const result: FalNanoBanana2Output = await response.json();

      if (!result.images || result.images.length === 0) {
        return { success: false, error: 'The image engine finished without an image. Try again.' };
      }

      console.log('✅ fal.ai nano-banana-2: image generated successfully');
      return { success: true, imageUrl: result.images[0].url };
    } finally {
      clearTimeout(timeout);
    }

  } catch (error) {
    console.error('🚨 fal.ai nano-banana-2 error:', error);
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      success: false,
      error: aborted
        ? 'The image engine took too long. Try again in a minute.'
        : 'The image engine could not be reached. Try again in a minute.',
    };
  }
}

/**
 * Generate an image using Nano Banana 2 via fal.ai and wait for completion.
 * Drop-in replacement for generateImageWithPro from fal-nano-banana-pro.ts.
 */
export async function generateImageWithPro(
  prompt: string,
  aspectRatio: NanoBananaAspectRatio = '16:9',
  referenceImages?: string[],
  resolution: '1K' | '2K' | '4K' = '2K',
  outputFormat: 'jpg' | 'png' | 'webp' = 'jpg',
  options?: { deadlineAt?: number }
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  // Map 'jpg' to 'jpeg' for fal.ai API compatibility (same binary JPEG format)
  const falOutputFormat = outputFormat === 'jpg' ? 'jpeg' : outputFormat;

  // GPT Image 2.5 by default (see src/lib/image-engine.ts); IMAGE_ENGINE=nb2 rolls back.
  const generate = imageEngine() === 'gpt25' ? generateWithGptImage25 : generateWithFalNanaBanana2;
  return generate({
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    output_format: falOutputFormat as 'jpeg' | 'png' | 'webp',
    image_input: referenceImages,
    deadlineAt: options?.deadlineAt,
  });
}

/**
 * Async variant for backwards compatibility.
 * Since fal.ai is synchronous, this delegates to the sync version.
 */
export async function generateImageWithProAsync(
  prompt: string,
  aspectRatio: NanoBananaAspectRatio = '16:9',
  referenceImages?: string[],
  resolution: '1K' | '2K' | '4K' = '4K',
  outputFormat: 'jpg' | 'png' | 'webp' = 'jpg',
  _webhookUrl?: string
): Promise<{ success: boolean; predictionId?: string; imageUrl?: string; error?: string }> {
  const result = await generateImageWithPro(prompt, aspectRatio, referenceImages, resolution, outputFormat);
  return {
    success: result.success,
    predictionId: undefined,
    imageUrl: result.imageUrl,
    error: result.error,
  };
}
