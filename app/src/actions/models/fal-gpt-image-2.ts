'use server';

import { generateWithGptImage25 } from './fal-gpt-image-25';

/**
 * GPT Image edits via fal.ai (billed through FAL, no OpenAI account needed).
 * Since 2026-09 this targets GPT Image 2.5 Flare:
 * https://fal.run/openai/gpt-image-2.5/flare/edit — synchronous.
 *
 * Clone Studio's keyframe-edit engine. The GPT models beat nano-banana-2 on
 * multi-object scale/perspective (e.g. swapping four products on a table at
 * natural sizes); 2.5 also passed our real-person reference tests, so it is
 * the default engine, with nano-banana-2 kept as the alternate (see
 * src/lib/image-engine.ts).
 */

interface GptImage2EditInput {
  prompt: string;
  image_urls: string[];
  quality?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  output_format?: 'jpeg' | 'png' | 'webp';
}

/**
 * Keyframe edit for Clone Studio. Now runs on GPT Image 2.5 Flare (the
 * function name is kept so call sites need no change). Output keeps the
 * keyframe's own dimensions.
 */
export async function editWithGptImage2(params: GptImage2EditInput): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
}> {
  return generateWithGptImage25({
    prompt: params.prompt,
    image_input: params.image_urls,
    aspect_ratio: 'auto',
    quality: params.quality || 'high',
    output_format: params.output_format || 'jpeg',
  });
}
