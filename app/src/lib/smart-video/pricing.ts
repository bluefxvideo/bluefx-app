/**
 * The Phantom's prices. The server charges with phantomCredits() and the page
 * shows the same numbers, so the price a user sees is the price they pay.
 *
 * One flat price covers whatever the director decides to do; the caps below
 * keep the worst-case API cost of a video (about $1) well under that price.
 */
export const PHANTOM_CREDITS = 50;
/** "Say exactly what I wrote": each started minute of script after the first. */
export const PHANTOM_EXTRA_MINUTE_CREDITS = 20;
/** A change to a finished video from a note. */
export const PHANTOM_REVISION_CREDITS = 10;

export const MAX_LIFESTYLE_PHOTOS = 3;
export const MAX_ANIMATED_PHOTOS = 2;

const WORDS_PER_MINUTE = 140;

/** Credits for a new video. Only an exact-words script longer than a minute costs more. */
export function phantomCredits(brief: string, exactWords: boolean): number {
  if (!exactWords) return PHANTOM_CREDITS;
  const minutes = Math.max(1, Math.ceil(brief.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE));
  return PHANTOM_CREDITS + (minutes - 1) * PHANTOM_EXTRA_MINUTE_CREDITS;
}
