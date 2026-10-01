'use server';

import { google } from '@ai-sdk/google';
import { generateObject, type ModelMessage } from 'ai';
import { z } from 'zod';
import type { ImageAnalysis, ZillowListingData, ScriptGenerationResult, ScriptSegment, TargetDuration } from '@/types/reelestate';
import {
  MIN_WORDS_PER_PHOTO,
  countWords,
  estimateScriptSeconds,
  estimateSegmentSeconds,
  secondsForWords,
  wordBudget,
} from '@/lib/reelestate-voice-pace';

// The model writes the words only. How long the words take is measured from
// the text (reelestate-voice-pace): the model's own guess in seconds was wrong
// by a factor of two.
const scriptSchema = z.object({
  segments: z.array(z.object({
    image_index: z.number(),
    voiceover: z.string(),
  })),
});

/** A script within this much of the chosen length is accepted as written. */
const ACCEPT_OVER = 1.08;
const ACCEPT_UNDER = 0.8;
const MAX_ATTEMPTS = 3;
/** No new attempt starts after this long: the live proxy cuts a request at about 55 seconds. */
const RETRY_DEADLINE_MS = 25_000;

/**
 * Generate a voiceover script for a listing video.
 * One segment per selected image, matched to visible features + listing data,
 * sized so the chosen voice reads the script in the chosen video length.
 */
export async function generateListingScript(
  selectedAnalyses: ImageAnalysis[],
  listingData: ZillowListingData | null,
  targetDuration: TargetDuration = 30,
  voiceId?: string,
): Promise<ScriptGenerationResult> {
  if (!selectedAnalyses.length) {
    return { success: false, error: 'No images selected' };
  }

  try {
    const photoCount = selectedAnalyses.length;
    // Too many photos for the chosen length (a Zillow import brings 30 to 48):
    // the script then aims for the shortest lines worth speaking, and the page
    // tells the user that the video runs longer than chosen.
    const fitWords = wordBudget(targetDuration, photoCount, voiceId);
    const shortestWords = photoCount * MIN_WORDS_PER_PHOTO;
    const fits = fitWords >= shortestWords;
    const maxWords = fits ? fitWords : shortestWords;
    const minWords = fits ? Math.round(maxWords * 0.85) : shortestWords;
    const wordsPerPhoto = Math.max(MIN_WORDS_PER_PHOTO, Math.round(maxWords / photoCount));
    const aimSeconds = fits ? targetDuration : secondsForWords(shortestWords, photoCount, voiceId);

    console.log(`📝 Generating listing script for ${photoCount} images, target: ${targetDuration}s = ${maxWords} words (${voiceId || 'default voice'})${fits ? '' : ` — too many photos, aiming for ${Math.round(aimSeconds)}s`}`);

    const imageDescriptions = selectedAnalyses.map((a, i) => (
      `Image ${i} (index ${a.index}): ${a.room_type} - ${a.description}. Features: ${a.key_features.join(', ')}`
    )).join('\n');

    // Listing data is optional — for manually-uploaded photos with no listing context,
    // the script is generated purely from image analyses.
    const listingBlock = listingData
      ? `LISTING:
Address: ${listingData.address || 'Property'}
Beds/Baths: ${listingData.beds || '?'} bed / ${listingData.baths || '?'} bath
Sqft: ${listingData.sqft?.toLocaleString() || '?'}
${listingData.year_built ? `Year Built: ${listingData.year_built}` : ''}
${listingData.lot_size ? `Lot: ${listingData.lot_size}` : ''}
Description: ${listingData.description?.slice(0, 500) || ''}`
      : `LISTING: A residential property (no detailed metadata provided — write the script using only the visible details in the images).`;

    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: `You are a professional real estate video narrator. Write a voiceover script for a listing video.

${listingBlock}

SELECTED IMAGES (in order):
${imageDescriptions}

${fits
  ? `LENGTH: the video is ${targetDuration} seconds long. The voice reads ${maxWords} words in that time.
Write between ${minWords} and ${maxWords} words in total: about ${wordsPerPhoto} words per image.`
  : `LENGTH: ${photoCount} images are more than fit in the ${targetDuration} seconds chosen, so every line is as short as a line can be.
Write ${MIN_WORDS_PER_PHOTO} words per image, ${maxWords} words in total at most.`}

RULES:
1. Write one voiceover segment per image.
2. The word limit is strict. Count the words of the whole script before you answer. A script over ${maxWords} words does not fit the video.
3. ONLY mention features that are VISIBLE in the photo AND confirmed in the listing data. Never invent features.
4. Start with a hook: the address or a bold claim about the property.
5. End with a brief call to action ("Schedule your showing today"). Do NOT mention the price anywhere in the script.
6. Tone: professional, warm, aspirational. Not salesy or over-the-top.
7. Each segment's "image_index" is the photo index from the listing.
8. Keep segments concise — every word should earn its place. Short, plain sentences. One feature per image is enough.

Return the segments array.`,
      },
    ];

    const validIndices = new Set(selectedAnalyses.map(a => a.index));
    let best: { segments: ScriptSegment[]; seconds: number } | null = null;
    const startedAt = Date.now();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (best && Date.now() - startedAt > RETRY_DEADLINE_MS) break;
      const { object } = await generateObject({
        model: google('gemini-3-flash-preview'),
        schema: scriptSchema,
        messages,
      });

      const segments = toSegments(object.segments, selectedAnalyses, validIndices, voiceId);
      if (segments.length === 0) continue;

      const texts = segments.map(s => s.voiceover);
      const seconds = estimateScriptSeconds(texts, voiceId);
      const words = texts.reduce((n, t) => n + countWords(t), 0);
      console.log(`📝 Attempt ${attempt}: ${segments.length} segments, ${words} words, about ${seconds.toFixed(1)}s`);

      if (!best || Math.abs(seconds - aimSeconds) < Math.abs(best.seconds - aimSeconds)) {
        best = { segments, seconds };
      }
      if (seconds <= aimSeconds * ACCEPT_OVER && seconds >= aimSeconds * ACCEPT_UNDER) break;

      // Say exactly how far off the script is and ask again
      const tooLong = seconds > aimSeconds;
      const aim = Math.round(aimSeconds);
      messages.push(
        { role: 'assistant', content: JSON.stringify(object) },
        {
          role: 'user',
          content: tooLong
            ? `That script has ${words} words and takes about ${Math.round(seconds)} seconds to read. It has to fit in ${aim} seconds. Rewrite the whole script with at most ${Math.max(shortestWords, Math.floor(words * aimSeconds / seconds))} words in total. Keep one segment per image and the same image_index values. Cut adjectives and second features first.`
            : `That script has ${words} words and takes only about ${Math.round(seconds)} seconds to read. It has ${aim} seconds to fill. Rewrite the whole script with about ${Math.floor(words * aimSeconds / seconds)} words in total. Keep one segment per image and the same image_index values.`,
        },
      );
    }

    if (!best) {
      return { success: false, error: 'Failed to generate script' };
    }

    console.log(`✅ Script generated: ${best.segments.length} segments, about ${best.seconds.toFixed(1)}s for a ${targetDuration}s video`);

    return {
      success: true,
      script: {
        segments: best.segments,
        total_duration_seconds: Math.round(best.seconds),
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

/**
 * Turn the model's answer into script segments: positions come from the order,
 * the length in seconds comes from the text, and a photo index the listing does
 * not have never gets through.
 */
function toSegments(
  raw: { image_index: number; voiceover: string }[],
  selectedAnalyses: ImageAnalysis[],
  validIndices: Set<number>,
  voiceId?: string,
): ScriptSegment[] {
  const written = raw.filter(s => s.voiceover.trim().length > 0);
  const seen = new Set<number>();
  const isPermutation = written.length === selectedAnalyses.length
    && written.every(s => validIndices.has(s.image_index) && !seen.has(s.image_index) && seen.add(s.image_index));

  const withPhoto = isPermutation
    ? written
    : written.length === selectedAnalyses.length
      // Right count, wrong photo numbers: the segments follow the order given
      ? written.map((s, i) => ({ ...s, image_index: selectedAnalyses[i].index }))
      : written.filter((s, i, all) => validIndices.has(s.image_index) && all.findIndex(o => o.image_index === s.image_index) === i);

  return withPhoto.map((s, i) => ({
    index: i,
    image_index: s.image_index,
    voiceover: s.voiceover.trim(),
    duration_seconds: Math.round(estimateSegmentSeconds(s.voiceover, voiceId) * 10) / 10,
  }));
}
