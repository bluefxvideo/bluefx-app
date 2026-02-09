'use server';

/**
 * Nano-Banana Pro via fal.ai
 * Text-to-image: https://fal.run/fal-ai/nano-banana-pro
 * Image-to-image: https://fal.run/fal-ai/nano-banana-pro/edit
 * Synchronous — returns generated image URL directly.
 *
 * When image_input is provided, uses the /edit endpoint with image_urls parameter.
 */

export type NanoBananaAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9';

interface FalNanoBananaProInput {
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

interface FalNanoBananaProOutput {
  images: FalImageResult[];
  timings?: Record<string, number>;
  seed?: number;
  has_nsfw_concepts?: boolean[];
  prompt?: string;
}

/**
 * Generate an image using nano-banana-pro via fal.ai (synchronous)
 * When reference images are provided, uses the /edit endpoint for image-to-image generation.
 */
export async function generateWithFalNanaBananaPro(params: FalNanoBananaProInput): Promise<{
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
      ? 'https://fal.run/fal-ai/nano-banana-pro/edit'
      : 'https://fal.run/fal-ai/nano-banana-pro';

    console.log(`🎨 fal.ai nano-banana-pro${hasImages ? '/edit' : ''}: generating image...`);
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

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 fal.ai error:', response.status, errorText.substring(0, 200));
      return { success: false, error: `fal.ai API error (${response.status}): ${errorText.substring(0, 100)}` };
    }

    const result: FalNanoBananaProOutput = await response.json();

    if (!result.images || result.images.length === 0) {
      return { success: false, error: 'No image returned from fal.ai' };
    }

    console.log('✅ fal.ai nano-banana-pro: image generated successfully');
    return { success: true, imageUrl: result.images[0].url };

  } catch (error) {
    console.error('🚨 fal.ai nano-banana-pro error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image via fal.ai',
    };
  }
}
