'use server';

import { generateWithSeedreamEdit } from '@/actions/models/fal-seedream-edit';
import { CLEANUP_PRESET_CONFIG } from '@/types/reelestate';
import type { CleanupPreset, CleanupResult } from '@/types/reelestate';

/**
 * Clean up a single listing photo using Seedream v5 Lite /edit endpoint.
 * Uses preset prompts for common real estate cleanup tasks.
 */
export async function cleanupPhoto(
  imageUrl: string,
  preset: CleanupPreset,
  customPrompt?: string,
): Promise<CleanupResult> {
  try {
    const config = CLEANUP_PRESET_CONFIG[preset];
    const prompt = customPrompt || config.prompt;

    console.log(`🧹 Cleaning photo: ${preset} — ${imageUrl.slice(0, 60)}...`);

    const result = await generateWithSeedreamEdit({
      prompt,
      image_urls: [imageUrl],
      image_size: 'auto_2K',
    });

    if (!result.success || !result.imageUrl) {
      return {
        success: false,
        original_url: imageUrl,
        preset,
        error: result.error || 'Cleanup generation failed',
      };
    }

    console.log(`✅ Photo cleaned: ${preset}`);

    return {
      success: true,
      original_url: imageUrl,
      cleaned_url: result.imageUrl,
      preset,
    };
  } catch (error) {
    console.error('❌ Photo cleanup error:', error);
    return {
      success: false,
      original_url: imageUrl,
      preset,
      error: error instanceof Error ? error.message : 'Failed to clean photo',
    };
  }
}

/**
 * Clean up multiple photos in parallel.
 */
export async function batchCleanupPhotos(
  imageUrls: string[],
  preset: CleanupPreset,
  customPrompt?: string,
): Promise<CleanupResult[]> {
  console.log(`🧹 Batch cleanup: ${imageUrls.length} photos, preset: ${preset}`);

  const results = await Promise.allSettled(
    imageUrls.map(url => cleanupPhoto(url, preset, customPrompt))
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      success: false,
      original_url: imageUrls[i],
      preset,
      error: 'Failed to process',
    };
  });
}
