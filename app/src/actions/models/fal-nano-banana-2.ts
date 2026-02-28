'use server';

/**
 * Nano-Banana 2 via fal.ai (replaces Nano-Banana Pro — same quality, half the cost, faster)
 * Text-to-image: https://fal.run/fal-ai/nano-banana-2
 * Image-to-image: https://fal.run/fal-ai/nano-banana-2/edit
 * Synchronous — returns generated image URL directly.
 *
 * When image_input is provided, uses the /edit endpoint with image_urls parameter.
 */

export type NanoBananaAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9';

interface FalNanoBanana2Input {
  prompt: string;
  aspect_ratio?: NanoBananaAspectRatio;
  resolution?: '1K' | '2K' | '4K';
  output_format?: 'jpeg' | 'png' | 'webp';
  image_input?: string[];
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
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout for 4K

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 fal.ai error:', response.status, errorText.substring(0, 200));
      return { success: false, error: `fal.ai API error (${response.status}): ${errorText.substring(0, 100)}` };
    }

    const result: FalNanoBanana2Output = await response.json();

    if (!result.images || result.images.length === 0) {
      return { success: false, error: 'No image returned from fal.ai' };
    }

    console.log('✅ fal.ai nano-banana-2: image generated successfully');
    return { success: true, imageUrl: result.images[0].url };

  } catch (error) {
    console.error('🚨 fal.ai nano-banana-2 error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image via fal.ai',
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
  outputFormat: 'jpg' | 'png' | 'webp' = 'jpg'
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  // Map 'jpg' to 'jpeg' for fal.ai API compatibility (same binary JPEG format)
  const falOutputFormat = outputFormat === 'jpg' ? 'jpeg' : outputFormat;

  return generateWithFalNanaBanana2({
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    output_format: falOutputFormat as 'jpeg' | 'png' | 'webp',
    image_input: referenceImages,
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
