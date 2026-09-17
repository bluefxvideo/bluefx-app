'use server';

import { createAdminClient, createClient } from '@/app/supabase/server';
import { generateWithFalNanaBanana2 } from '@/actions/models/fal-nano-banana-2';
import { generateWithGptImage25 } from '@/actions/models/fal-gpt-image-25';
import { imageEngine } from '@/lib/image-engine';
import { PAGE_IMAGE_BUDGET_MS, msLeftForPage } from '@/lib/image-deadline';
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

/** An engine message as one sentence, then the promise that nothing was charged. */
function notCharged(message: string): string {
  return `${message.trim().replace(/[.!?]+$/, '')}. No credits were taken.`;
}

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
  // The page waits for this request and the live proxy cuts it after about 55 s
  // (see src/lib/image-deadline.ts). The clock starts here: the checks count too.
  const requestStartedAt = Date.now();
  try {
    if (!process.env.FAL_KEY) {
      return { success: false, error: 'FAL_KEY not configured' };
    }

    // The signed-in user pays. The id the page sends is only checked against the
    // session: a server action is a public endpoint.
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return { success: false, error: 'You are signed out. Sign in again and retry.' };
    if (request.user_id && request.user_id !== user.id) {
      return { success: false, error: 'Your session changed. Reload the page and try again.' };
    }
    const userId = user.id;

    // Check credits
    const creditsResult = await getUserCredits(userId);
    if (!creditsResult.success) {
      return { success: false, error: 'Failed to check credits' };
    }

    if ((creditsResult.credits || 0) < AVATAR_GENERATION_CREDIT_COST) {
      return {
        success: false,
        error: `Not enough credits. An avatar photo costs ${AVATAR_GENERATION_CREDIT_COST} credits.`,
      };
    }
    // Credits are taken only once the photo is stored (they used to go first and were
    // kept when the image engine refused the prompt)

    // Build the full prompt
    const styleSuffix = STYLE_PRESETS[request.style_preset] || '';
    const fullPrompt = styleSuffix
      ? `${request.prompt.trim()} ${styleSuffix}`
      : request.prompt.trim();

    // GPT Image 2.5 by default (photoreal people from a prompt, and it accepts
    // a real headshot as reference); IMAGE_ENGINE=nb2 rolls back to Nano Banana 2.
    const generate = imageEngine() === 'gpt25' ? generateWithGptImage25 : generateWithFalNanaBanana2;
    const generated = await generate({
      prompt: fullPrompt,
      aspect_ratio: '16:9',
      resolution: '1K',
      output_format: 'png',
      image_input: request.reference_image_url ? [request.reference_image_url] : undefined,
      deadlineAt: requestStartedAt + PAGE_IMAGE_BUDGET_MS,
    });

    if (!generated.success || !generated.imageUrl) {
      console.error(`Avatar generator image error: ${generated.error}`);
      return { success: false, error: notCharged(generated.error || 'The photo could not be made') };
    }

    const generatedImageUrl = generated.imageUrl;

    // Download and upload to Supabase Storage, within what is left of the request
    const imageResponse = await fetch(generatedImageUrl, {
      signal: AbortSignal.timeout(Math.max(2_000, msLeftForPage(requestStartedAt))),
    });
    if (!imageResponse.ok) {
      return { success: false, error: 'The photo could not be saved. Try again. No credits were taken.' };
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
      return { success: false, error: 'The photo could not be saved. Try again. No credits were taken.' };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(storagePath);

    // Credits only for a photo the page can still receive
    if (msLeftForPage(requestStartedAt) <= 0) {
      console.warn(`Avatar photo stored ${Math.round((Date.now() - requestStartedAt) / 1000)} s after the request started, past the proxy cut; not charged`);
      return { success: true, image_url: publicUrl };
    }

    const deductResult = await deductCredits(
      userId,
      AVATAR_GENERATION_CREDIT_COST,
      'avatar_generation',
      { style_preset: request.style_preset, image_url: publicUrl }
    );
    if (!deductResult.success) {
      // The photo exists and the user keeps it; the missed charge is only logged
      console.error('Avatar photo made but the credit deduction failed:', deductResult.error);
    }

    return { success: true, image_url: publicUrl, remaining_credits: deductResult.remainingCredits };
  } catch (error) {
    // Credits are taken last and that step does not throw: a throw never cost credits
    console.error('generateAvatarImage error:', error);
    return {
      success: false,
      error: notCharged('The photo could not be made. Try again in a minute'),
    };
  }
}
