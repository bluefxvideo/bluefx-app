'use server';

import { createAdminClient } from '@/app/supabase/server';
import { getUserCredits, deductCredits } from '@/actions/database/talking-avatar-database';

/**
 * Avatar Generator — Generate custom avatar images using Nano Banana Pro (fal.ai)
 *
 * Supports:
 * - Text prompt only (describe the person)
 * - Text prompt + reference image (image-to-image style transfer)
 * - Style presets for consistent UGC look
 *
 * Cost: 4 credits per generation (matches Nano Banana Pro 1K pricing)
 */

const AVATAR_GENERATION_CREDIT_COST = 4;

export interface AvatarGeneratorRequest {
  prompt: string;
  style_preset: 'ugc_portrait' | 'ugc_selfie' | 'professional' | 'custom';
  reference_image_url?: string; // Optional reference image for image-to-image
  user_id: string; // Required for credit deduction
}

export interface AvatarGeneratorResult {
  success: boolean;
  image_url?: string; // Public Supabase Storage URL
  remaining_credits?: number;
  error?: string;
}

// Style preset suffixes
const STYLE_PRESETS: Record<string, string> = {
  ugc_portrait: 'Looking directly at the camera with a natural, friendly expression. Natural soft lighting, shallow depth of field with soft bokeh background. Authentic candid portrait, not overly retouched. 16:9 landscape aspect ratio, head and shoulders framing, centered. The person is NOT holding anything — no phone, no camera, no device. Clean headshot portrait.',
  ugc_selfie: 'Shot on front-facing camera of an older smartphone, handheld at arm\'s length, slightly from above. Looking directly into the camera with a natural, casual expression. No phone visible in frame. Slightly grainy image quality, subtle digital noise. Imperfect natural lighting, no studio lights. 16:9 landscape aspect ratio, close-up selfie framing from upper chest up. Raw, unpolished, authentic UGC look.',
  professional: 'Professional headshot with studio lighting, clean neutral background, sharp focus. Looking directly at camera with a confident, approachable expression. 16:9 landscape aspect ratio, head and shoulders framing, centered. High quality professional portrait.',
  custom: '', // No suffix added — user controls full prompt
};

/**
 * Generate an avatar image using Nano Banana Pro
 */
export async function generateAvatarImage(
  request: AvatarGeneratorRequest
): Promise<AvatarGeneratorResult> {
  try {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return { success: false, error: 'FAL_KEY not configured' };
    }

    // Check credits
    const creditsResult = await getUserCredits(request.user_id);
    if (!creditsResult.success) {
      return { success: false, error: 'Failed to check credits' };
    }

    if ((creditsResult.credits || 0) < AVATAR_GENERATION_CREDIT_COST) {
      return {
        success: false,
        error: `Insufficient credits. You need ${AVATAR_GENERATION_CREDIT_COST} credits to generate an avatar.`,
      };
    }

    // Deduct credits before generation
    const deductResult = await deductCredits(
      request.user_id,
      AVATAR_GENERATION_CREDIT_COST,
      'avatar_generation',
      { style_preset: request.style_preset }
    );

    if (!deductResult.success) {
      return { success: false, error: deductResult.error || 'Failed to deduct credits' };
    }

    // Build the full prompt
    const styleSuffix = STYLE_PRESETS[request.style_preset] || '';
    const fullPrompt = styleSuffix
      ? `${request.prompt.trim()} ${styleSuffix}`
      : request.prompt.trim();

    // Build request body
    const body: Record<string, unknown> = {
      prompt: fullPrompt,
      aspect_ratio: '16:9',
      resolution: '1K',
      output_format: 'png',
    };

    // Add reference image for image-to-image (uses /edit endpoint with image_urls array)
    const hasReferenceImage = !!request.reference_image_url;
    if (hasReferenceImage) {
      body.image_urls = [request.reference_image_url];
    }

    // Use /edit endpoint when reference image provided, base endpoint otherwise
    const endpoint = hasReferenceImage
      ? 'https://fal.run/fal-ai/nano-banana-2/edit'
      : 'https://fal.run/fal-ai/nano-banana-2';
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
      console.error(`Avatar generator fal.ai error: ${response.status} - ${errorText}`);
      return { success: false, error: `Image generation failed: ${response.status}`, remaining_credits: deductResult.remainingCredits };
    }

    const result = await response.json();
    if (!result.images || result.images.length === 0) {
      return { success: false, error: 'No images returned', remaining_credits: deductResult.remainingCredits };
    }

    const generatedImageUrl = result.images[0].url;

    // Download and upload to Supabase Storage
    const imageResponse = await fetch(generatedImageUrl);
    if (!imageResponse.ok) {
      return { success: false, error: 'Failed to download generated image', remaining_credits: deductResult.remainingCredits };
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const timestamp = Date.now();
    const storagePath = `avatars/generated/avatar_${timestamp}.png`;

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return { success: false, error: 'Failed to upload image', remaining_credits: deductResult.remainingCredits };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(storagePath);

    return { success: true, image_url: publicUrl, remaining_credits: deductResult.remainingCredits };
  } catch (error) {
    console.error('generateAvatarImage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
