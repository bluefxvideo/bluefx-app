'use server';

import { friendlyFalImageError } from './fal-error';
import type { NanoBananaAspectRatio } from './fal-nano-banana-2';

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
}

type Size = { width: number; height: number };

// Pixel sizes that match what the Nano Banana resolution tiers meant to callers.
// 'auto' is handled separately: edits keep the input image's size.
const SIZES: Record<ImageResolution, Partial<Record<NanoBananaAspectRatio, Size>>> = {
  '1K': {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1024, height: 1024 },
    '4:3': { width: 1024, height: 768 },
    '3:4': { width: 768, height: 1024 },
    '3:2': { width: 1536, height: 1024 },
    '2:3': { width: 1024, height: 1536 },
    '21:9': { width: 1920, height: 816 },
  },
  '2K': {
    '16:9': { width: 2560, height: 1440 },
    '9:16': { width: 1440, height: 2560 },
    '1:1': { width: 2048, height: 2048 },
    '4:3': { width: 2048, height: 1536 },
    '3:4': { width: 1536, height: 2048 },
    '3:2': { width: 2160, height: 1440 },
    '2:3': { width: 1440, height: 2160 },
    '21:9': { width: 2560, height: 1088 },
  },
  '4K': {
    '16:9': { width: 3840, height: 2160 },
    '9:16': { width: 2160, height: 3840 },
    '1:1': { width: 3072, height: 3072 },
    '4:3': { width: 3072, height: 2304 },
    '3:4': { width: 2304, height: 3072 },
    '3:2': { width: 3240, height: 2160 },
    '2:3': { width: 2160, height: 3240 },
    '21:9': { width: 3840, height: 1632 },
  },
};

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
  const size = aspect === 'auto' ? undefined : SIZES[params.resolution || '1K'][aspect];

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

  try {
    console.log(
      `🎨 fal.ai gpt-image-2.5/${variant}${hasImages ? '/edit' : ''}: ${params.quality || 'high'} ` +
        `${size ? `${size.width}x${size.height}` : 'auto'}${hasImages ? `, ${params.image_input!.length} reference(s)` : ''}`
    );

    const controller = new AbortController();
    // Edits with several references have run 30-40 s at high; leave room for
    // Sunburst and 4K but stay under the ~55 s Traefik cutoff-safe server paths.
    const timeout = setTimeout(() => controller.abort(), 170_000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${falKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 fal.ai gpt-image-2.5 error:', response.status, errorText.substring(0, 200));
      return { success: false, error: friendlyFalImageError(response.status, errorText) };
    }

    const result: { images?: { url: string; width?: number; height?: number }[] } = await response.json();
    if (!result.images || result.images.length === 0) {
      return { success: false, error: 'No image returned from GPT Image 2.5' };
    }

    console.log('✅ fal.ai gpt-image-2.5: image generated');
    return { success: true, imageUrl: result.images[0].url };
  } catch (error) {
    console.error('🚨 fal.ai gpt-image-2.5 error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image via fal.ai',
    };
  }
}
