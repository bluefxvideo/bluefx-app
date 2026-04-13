'use server';

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ImageAnalysis, ZillowListingData, ScriptGenerationResult, TargetDuration } from '@/types/reelestate';

const scriptSchema = z.object({
  segments: z.array(z.object({
    index: z.number(),
    image_index: z.number(),
    voiceover: z.string(),
    duration_seconds: z.number(),
  })),
  total_duration_seconds: z.number(),
});

/**
 * Generate a voiceover script for a listing video.
 * One segment per selected image, matched to visible features + listing data.
 */
export async function generateListingScript(
  selectedAnalyses: ImageAnalysis[],
  listingData: ZillowListingData,
  targetDuration: TargetDuration = 30,
): Promise<ScriptGenerationResult> {
  if (!selectedAnalyses.length) {
    return { success: false, error: 'No images selected' };
  }

  try {
    console.log(`📝 Generating listing script for ${selectedAnalyses.length} images, target: ~${targetDuration}s`);

    const imageDescriptions = selectedAnalyses.map((a, i) => (
      `Image ${i} (index ${a.index}): ${a.room_type} - ${a.description}. Features: ${a.key_features.join(', ')}`
    )).join('\n');

    const { object } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: scriptSchema,
      messages: [
        {
          role: 'user',
          content: `You are a professional real estate video narrator. Write a voiceover script for a listing video.

LISTING:
Address: ${listingData.address}
Beds/Baths: ${listingData.beds} bed / ${listingData.baths} bath
Sqft: ${listingData.sqft.toLocaleString()}
${listingData.year_built ? `Year Built: ${listingData.year_built}` : ''}
${listingData.lot_size ? `Lot: ${listingData.lot_size}` : ''}
Description: ${listingData.description.slice(0, 500)}

SELECTED IMAGES (in order):
${imageDescriptions}

TARGET DURATION: ~${targetDuration} seconds total

RULES:
1. Write one voiceover segment per image. Each segment = 2–5 seconds of speech.
2. ONLY mention features that are VISIBLE in the photo AND confirmed in the listing data. Never invent features.
3. Start with a hook: the address or a bold claim about the property.
4. End with a brief call to action ("Schedule your showing today"). Do NOT mention the price anywhere in the script.
5. Tone: professional, warm, aspirational. Not salesy or over-the-top.
6. Total speech duration must be close to ${targetDuration} seconds.
7. Each segment's "index" is its position (0-based), "image_index" is the photo index from the listing.
8. Keep segments concise — every word should earn its place.

Return the segments array and total_duration_seconds.`,
        },
      ],
    });

    console.log(`✅ Script generated: ${object.segments.length} segments, ~${object.total_duration_seconds}s total`);

    return {
      success: true,
      script: {
        segments: object.segments,
        total_duration_seconds: object.total_duration_seconds,
      },
    };
  } catch (error) {
    console.error('❌ Script generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate script',
    };
  }
}
