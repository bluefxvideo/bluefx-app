'use server';

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ImageAnalysis, ImageAnalysisResult, ZillowListingData } from '@/types/reelestate';
import { ROOM_TYPES, SHOT_TYPES, CAMERA_MOTIONS } from '@/types/reelestate';

const imageAnalysisSchema = z.object({
  analyses: z.array(z.object({
    index: z.number(),
    room_type: z.enum(ROOM_TYPES as unknown as [string, ...string[]]),
    description: z.string(),
    key_features: z.array(z.string()),
    shot_type: z.enum(SHOT_TYPES as unknown as [string, ...string[]]),
    camera_motion: z.enum(CAMERA_MOTIONS as unknown as [string, ...string[]]),
    motion_reasoning: z.string(),
    quality_score: z.number().min(1).max(10),
    is_usable: z.boolean(),
    issues: z.array(z.string()),
    cleanup_needed: z.boolean(),
    pair_candidate: z.number().nullable(),
  })),
});

/**
 * Analyze listing photos using Gemini 2.5 Flash vision.
 * Returns structured analysis per photo: room type, features, camera motion, issues, etc.
 */
export async function analyzeListingImages(
  photoUrls: string[],
  listingData?: Partial<ZillowListingData>
): Promise<ImageAnalysisResult> {
  if (!photoUrls.length) {
    return { success: false, analyses: [], error: 'No photos provided' };
  }

  try {
    console.log(`🔍 Analyzing ${photoUrls.length} listing photos with Gemini vision...`);

    // Process in batches of 5 to avoid token limits
    const batchSize = 5;
    const allAnalyses: ImageAnalysis[] = [];

    for (let batchStart = 0; batchStart < photoUrls.length; batchStart += batchSize) {
      const batch = photoUrls.slice(batchStart, batchStart + batchSize);
      const batchIndices = batch.map((_, i) => batchStart + i);

      const listingContext = listingData
        ? `\nListing info: ${listingData.address || ''}, ${listingData.price_formatted || ''}, ${listingData.beds || '?'} bed / ${listingData.baths || '?'} bath, ${listingData.sqft || '?'} sqft. ${listingData.description?.slice(0, 300) || ''}`
        : '';

      const imageContent = batch.map((url, i) => ({
        type: 'image' as const,
        image: new URL(url),
      }));

      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
        schema: imageAnalysisSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a real estate photography analyst. Analyze these ${batch.length} listing photos (indices: ${batchIndices.join(', ')}).
${listingContext}

For EACH photo, return:
- room_type: What room or area is shown
- description: Brief visual description (1 sentence)
- key_features: Notable features visible (countertops, appliances, flooring, etc.)
- shot_type: wide, medium, close_up, or detail
- camera_motion: Best LTX video camera motion for this photo. ONLY use these exact values: none, dolly_in, dolly_out, dolly_left, dolly_right, jib_up, jib_down, static, focus_shift
  - Exteriors/aerials: jib_up or jib_down (overhead reveal)
  - Kitchens/living rooms: dolly_in (walk towards the space)
  - Bedrooms/bathrooms: dolly_out or static
  - Detail shots: focus_shift
  - Hallways/foyers: dolly_left or dolly_right (lateral movement)
- motion_reasoning: 1 sentence why this camera motion fits
- quality_score: 1-10 (lighting, composition, focus)
- is_usable: false if severely blurry, dark, or unusable
- issues: Any problems detected:
  - "contains_person" - people visible
  - "license_plate" - license plates visible
  - "personal_items" - family photos, religious items, personal effects
  - "clutter" - messy counters, scattered items
  - "low_quality" - blurry, dark, overexposed
  - "duplicate" - very similar to another photo (note which one)
- cleanup_needed: true if any issues that should be cleaned before video
- pair_candidate: Index of another photo showing the same room at a different distance (e.g., wide kitchen + close-up countertop). null if no pair. This creates start→end frame video transitions.

Important pairing rules:
- Same room_type AND different shot_type (wide + close_up, or wide + medium)
- Only pair within this batch. Use actual indices (${batchIndices.join(', ')}).`,
              },
              ...imageContent,
            ],
          },
        ],
      });

      allAnalyses.push(...(object.analyses as ImageAnalysis[]));
      console.log(`✅ Batch analyzed: indices ${batchIndices.join(', ')}`);
    }

    // Second pass: cross-batch pairing (check if photos from different batches could pair)
    // For now, pairs are only within batches. Can be enhanced later.

    console.log(`✅ All ${photoUrls.length} photos analyzed. Found ${allAnalyses.filter(a => a.pair_candidate !== null).length} pair candidates.`);

    return { success: true, analyses: allAnalyses };
  } catch (error) {
    console.error('❌ Image analysis error:', error);
    return {
      success: false,
      analyses: [],
      error: error instanceof Error ? error.message : 'Failed to analyze images',
    };
  }
}
