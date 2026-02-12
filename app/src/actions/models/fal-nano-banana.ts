'use server';

/**
 * Nano-Banana (Fast) via fal.ai
 * Text-to-image: https://fal.run/fal-ai/nano-banana
 * Image-to-image: https://fal.run/fal-ai/nano-banana/edit
 * Synchronous — returns generated image URL directly.
 *
 * When referenceImages are provided, uses the /edit endpoint with image_urls parameter.
 */

type NanoBananaAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '2:3' | '3:2' | '21:9';

interface FalNanoBananaOutput {
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
  timings?: Record<string, number>;
  seed?: number;
  has_nsfw_concepts?: boolean[];
  prompt?: string;
}

/**
 * Generate an image using nano-banana via fal.ai (synchronous).
 * Signature matches the Replicate version in image-generation-nano-banana.ts.
 */
export async function generateImage(
  prompt: string,
  aspectRatio: NanoBananaAspectRatio = '16:9',
  referenceImages?: string[]
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return { success: false, error: 'FAL_KEY not configured' };
  }

  try {
    const hasImages = referenceImages && referenceImages.length > 0;
    const endpoint = hasImages
      ? 'https://fal.run/fal-ai/nano-banana/edit'
      : 'https://fal.run/fal-ai/nano-banana';

    console.log(`🎨 fal.ai nano-banana${hasImages ? '/edit' : ''}: generating image...`);
    if (hasImages) {
      console.log(`📎 Reference images: ${referenceImages.length}`);
    }

    const body: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspectRatio,
      output_format: 'jpeg',
    };

    if (hasImages) {
      body.image_urls = referenceImages;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

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

    const result: FalNanoBananaOutput = await response.json();

    if (!result.images || result.images.length === 0) {
      return { success: false, error: 'No image returned from fal.ai' };
    }

    console.log('✅ fal.ai nano-banana: image generated successfully');
    return { success: true, imageUrl: result.images[0].url };

  } catch (error) {
    console.error('🚨 fal.ai nano-banana error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image via fal.ai',
    };
  }
}
