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
/**
 * The AI presenter who opens a video (tall or wide) and says the first line (presenter.ts: about $0.58 at the APIs, the same
 * rate as ReelEstate's animated photos). Charged on its own and given back when the presenter does not make it into the video.
 */
export const PHANTOM_PRESENTER_CREDITS = 10;
/**
 * An edit with "Change the presenter" (or "Add a presenter"): a new AI presenter, or the same one saying new words
 * (owner 2026-10-13: its own choice and its own price, never decided from the note). On top of
 * PHANTOM_REVISION_CREDITS, charged before the edit starts and given back when the presenter does not make it in.
 */
export const PHANTOM_PRESENTER_CHANGE_CREDITS = 30;

/** The automatic listing video (ReelEstate): the video itself, plus each photo that becomes a moving clip. */
export const LISTING_CREDITS = 25;
/**
 * A photo's moving clip: 2 credits per second of clip (fal LTX 2.3 fast, $0.04 a second; owner-approved 2026-11-02).
 * A clip is 6, 8, 10 or 12 seconds (listingClipSeconds), as long as its photo is on screen: 12 to 24 credits.
 */
export const LISTING_CLIP_CREDITS_PER_SECOND = 2;
export const listingClipCredits = (clipSeconds: number) => clipSeconds * LISTING_CLIP_CREDITS_PER_SECOND;
/** The shortest clip, the one most photos get (a room is on screen about 3 seconds). */
export const LISTING_SHORTEST_CLIP_SECONDS = 6;
/**
 * The clip lengths are only known once the voice is recorded, so the page quotes a ceiling: 6 seconds a photo plus
 * these seconds for the photos that stay on screen longer (the price with the figures, the last photo with the
 * contact card). The balance is checked against it before the video starts and the clips are never charged above it.
 */
export const LISTING_LONGER_CLIP_SECONDS = 10;
/** The most the moving clips of a video with this many photos cost. */
export const listingClipCap = (photos: number) =>
  listingClipCredits(photos * LISTING_SHORTEST_CLIP_SECONDS + LISTING_LONGER_CLIP_SECONDS);

export const MAX_LIFESTYLE_PHOTOS = 3;
export const MAX_ANIMATED_PHOTOS = 2;
/** Whiteboard videos: one line drawing per scene, about $0.04 each. */
export const MAX_DRAWINGS = 8;
/** Cartoon videos: flat cartoon pictures, one per scene that shows one (about $0.013 each). */
export const MAX_CARTOONS = 6;

const WORDS_PER_MINUTE = 140;

/** Credits for a new video. Only an exact-words script longer than a minute costs more. */
export function phantomCredits(brief: string, exactWords: boolean): number {
  if (!exactWords) return PHANTOM_CREDITS;
  const minutes = Math.max(1, Math.ceil(brief.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE));
  return PHANTOM_CREDITS + (minutes - 1) * PHANTOM_EXTRA_MINUTE_CREDITS;
}
