'use server';

/**
 * Seedream v5 Lite Edit via fal.ai
 * Image editing/cleanup endpoint — cheaper and ~20% faster than Nano Banana 2.
 * https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit
 * Synchronous — returns edited image URL directly.
 */

interface SeedreamEditInput {
  prompt: string;
  image_urls: string[];
  image_size?: string;
  num_images?: number;
  enable_safety_checker?: boolean;
}

interface FalImageResult {
  url: string;
  width: number | null;
  height: number | null;
  content_type: string;
}

interface SeedreamEditOutput {
  images: FalImageResult[];
  seed?: number;
}

/**
 * Edit/cleanup an image using Seedream v5 Lite via fal.ai (synchronous).
 * Drop-in replacement for generateWithFalNanaBanana2 for cleanup/edit use cases.
 */
export async function generateWithSeedreamEdit(params: SeedreamEditInput): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
}> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return { success: false, error: 'FAL_KEY not configured' };
  }

  try {
    const endpoint = 'https://fal.run/fal-ai/bytedance/seedream/v5/lite/edit';

    console.log('🎨 fal.ai seedream v5 lite/edit: editing image...');
    console.log(`📎 Reference images: ${params.image_urls.length}`);

    const body: Record<string, unknown> = {
      prompt: params.prompt,
      image_urls: params.image_urls,
      image_size: params.image_size || 'auto_2K',
      num_images: params.num_images || 1,
      enable_safety_checker: params.enable_safety_checker ?? true,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout

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
      console.error('🚨 fal.ai seedream error:', response.status, errorText.substring(0, 200));
      return { success: false, error: `fal.ai API error (${response.status}): ${errorText.substring(0, 100)}` };
    }

    const result: SeedreamEditOutput = await response.json();

    if (!result.images || result.images.length === 0) {
      return { success: false, error: 'No image returned from fal.ai' };
    }

    console.log('✅ fal.ai seedream v5 lite/edit: image edited successfully');
    return { success: true, imageUrl: result.images[0].url };

  } catch (error) {
    console.error('🚨 fal.ai seedream edit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to edit image via fal.ai',
    };
  }
}
