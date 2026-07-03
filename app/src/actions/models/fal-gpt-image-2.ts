'use server';

/**
 * GPT Image 2 image editing via fal.ai (billed through FAL, no OpenAI account needed).
 * Edit endpoint: https://fal.run/openai/gpt-image-2/edit — synchronous.
 *
 * Clone Studio uses this as the alternate keyframe-edit engine: it beats
 * nano-banana-2 on multi-object scale/perspective (e.g. swapping four products
 * on a table at natural sizes) while nb2 is stronger on person swaps — the two
 * engines fail differently, so scenes get a per-scene toggle.
 */

interface GptImage2EditInput {
  prompt: string;
  image_urls: string[];
  quality?: 'low' | 'medium' | 'high';
  output_format?: 'jpeg' | 'png' | 'webp';
}

interface FalImageResult {
  url: string;
  width?: number;
  height?: number;
}

export async function editWithGptImage2(params: GptImage2EditInput): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
}> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return { success: false, error: 'FAL_KEY not configured' };
  }

  try {
    console.log(`🎨 fal.ai gpt-image-2/edit: editing with ${params.image_urls.length} input image(s)...`);

    const controller = new AbortController();
    // GPT Image 2 edits run 60-90s at high quality; abort before upstream proxies do
    const timeout = setTimeout(() => controller.abort(), 170_000);

    const response = await fetch('https://fal.run/openai/gpt-image-2/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        image_urls: params.image_urls,
        quality: params.quality || 'high',
        output_format: params.output_format || 'jpeg',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 fal.ai gpt-image-2 error:', response.status, errorText.substring(0, 200));
      return { success: false, error: `GPT Image 2 error (${response.status}): ${errorText.substring(0, 100)}` };
    }

    const result: { images?: FalImageResult[] } = await response.json();
    if (!result.images || result.images.length === 0) {
      return { success: false, error: 'No image returned from GPT Image 2' };
    }

    console.log('✅ fal.ai gpt-image-2/edit: image generated');
    return { success: true, imageUrl: result.images[0].url };
  } catch (error) {
    console.error('🚨 fal.ai gpt-image-2 error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'GPT Image 2 edit failed',
    };
  }
}
