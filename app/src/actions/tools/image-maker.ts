'use server';

/**
 * Image Maker — text-to-image generation using Nano Banana 2 (fal.ai).
 * Synchronous: generates 1–4 images, persists them to Supabase storage,
 * records them in `generated_images`, and deducts credits.
 */

import { createClient, createAdminClient } from '@/app/supabase/server';
import { generateWithFalNanaBanana2, type NanoBananaAspectRatio } from '../models/fal-nano-banana-2';
import { downloadAndUploadImage } from '../supabase-storage';
import { deductCredits } from '../database/cinematographer-database';
import { ensureCreditsForUsage } from '@/lib/credits/subscription-entitlement';

export type ImageResolution = '1K' | '2K' | '4K';

export interface ImageMakerRequest {
  prompt: string;
  aspect_ratio?: NanoBananaAspectRatio;
  resolution?: ImageResolution;
  num_outputs?: number; // 1–4
  reference_image_urls?: string[];
}

export interface ImageMakerResponse {
  success: boolean;
  image_urls?: string[];
  batch_id?: string;
  remaining_credits?: number;
  error?: string;
}

// Nano Banana 2 is ~half the cost of Pro. Per-image credit cost by resolution.
const CREDIT_COST: Record<ImageResolution, number> = { '1K': 2, '2K': 3, '4K': 6 };

export interface ImageHistoryItem {
  batch_id: string | null;
  prompt: string | null;
  image_urls: string[];
  created_at: string;
}

/** Load the signed-in user's Image Maker history (most recent first). */
export async function getImageHistory(): Promise<{ success: boolean; items?: ImageHistoryItem[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'You must be signed in.' };

    const { data, error } = await supabase
      .from('generated_images')
      .select('batch_id, prompt, image_urls, created_at')
      .eq('user_id', user.id)
      .eq('model_name', 'image-maker')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return { success: false, error: error.message };
    return { success: true, items: (data || []) as ImageHistoryItem[] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to load history.' };
  }
}

export async function generateImage(request: ImageMakerRequest): Promise<ImageMakerResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'You must be signed in.' };

    const prompt = (request.prompt || '').trim();
    if (!prompt) return { success: false, error: 'Please enter a prompt.' };

    const resolution: ImageResolution = request.resolution || '2K';
    const count = Math.min(Math.max(request.num_outputs || 1, 1), 4);
    const totalCost = CREDIT_COST[resolution] * count;

    // Gate on paying status + sufficient credits BEFORE spending compute.
    const gate = await ensureCreditsForUsage(user.id, totalCost);
    if (!gate.ok) return { success: false, error: gate.error || 'Not enough credits.' };

    const batch_id = crypto.randomUUID();

    // Generate N images in parallel (Nano Banana 2 returns one image per call).
    const results = await Promise.all(
      Array.from({ length: count }, () =>
        generateWithFalNanaBanana2({
          prompt,
          aspect_ratio: request.aspect_ratio || '1:1',
          resolution,
          output_format: 'png',
          image_input: request.reference_image_urls,
        })
      )
    );

    const rawUrls = results.filter(r => r.success && r.imageUrl).map(r => r.imageUrl!) as string[];
    if (rawUrls.length === 0) {
      return { success: false, error: results[0]?.error || 'Image generation failed. Please try again.' };
    }

    // Persist each generated image to our storage (fal URLs are temporary).
    const stored = await Promise.all(
      rawUrls.map(async (url, i) => {
        const res = await downloadAndUploadImage(url, 'image-maker', `${batch_id}_${i}`, {
          bucket: 'images',
          folder: 'image-maker',
          contentType: 'image/png',
        });
        return res.success && res.url ? res.url : url; // fall back to fal url if persist fails
      })
    );

    // Record in the library (best-effort — never fail the generation on a DB
    // hiccup). supabase-js returns errors instead of throwing, so CHECK the
    // result; an RLS denial on the user-scoped client was previously silent
    // and no history was ever written. Fall back to the admin client with the
    // authenticated user's id (the pattern the other tools' webhooks use).
    const row = {
      user_id: user.id,
      prompt,
      image_urls: stored,
      model_name: 'image-maker',
      batch_id,
      metadata: {
        aspect_ratio: request.aspect_ratio || '1:1',
        resolution,
        model: 'nano-banana-2',
        count: stored.length,
      },
    };
    try {
      const { error: insertError } = await supabase.from('generated_images').insert(row);
      if (insertError) {
        console.error('[image-maker] user-scoped insert failed, retrying with admin client:', insertError.message);
        const { error: adminError } = await createAdminClient().from('generated_images').insert(row);
        if (adminError) {
          console.error('[image-maker] admin insert also failed (history will miss this batch):', adminError.message);
        }
      }
    } catch (e) {
      console.error('[image-maker] generated_images insert threw (non-fatal):', e);
    }

    // Charge for the images that actually succeeded.
    const charge = CREDIT_COST[resolution] * stored.length;
    const deduction = await deductCredits(user.id, charge, 'image-maker', { batch_id, count: stored.length });

    return {
      success: true,
      image_urls: stored,
      batch_id,
      remaining_credits: deduction?.remainingCredits,
    };
  } catch (error) {
    console.error('[image-maker] generateImage error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Something went wrong.' };
  }
}
