/**
 * Prices of the voice tools (owner-approved 2026-11-02: no tool may cost us more than about $0.03 per credit).
 * The server charges with these functions and the pages show the same numbers, so the price a user sees is the
 * price they pay. Plain module (no 'use server'): imported by server actions and client components alike.
 */

/** Voice Clone: one cloned voice. Replicate MiniMax voice cloning costs $3 per clone. */
export const VOICE_CLONE_CREDITS = 100;

/** Voice Over: credits per started 1,000 characters of the script (MiniMax costs $0.10 per 1,000 characters). */
export const VOICE_OVER_CREDITS_PER_1000_CHARACTERS = 3;

/** Voice Over price of a script: 1 to 1,000 characters = 3 credits, 1,001 to 2,000 = 6, and so on. */
export function voiceOverCredits(script: string): number {
  const characters = script.trim().length;
  return Math.max(1, Math.ceil(characters / 1000)) * VOICE_OVER_CREDITS_PER_1000_CHARACTERS;
}

/** Voice Changer: credits per started minute of the source (fal Chatterbox HD costs $0.02 per minute). */
export const VOICE_CHANGER_CREDITS_PER_MINUTE = 2;
/** The least a Voice Changer run costs, standard and high quality. */
export const VOICE_CHANGER_MIN_CREDITS = 3;
export const VOICE_CHANGER_HQ_MIN_CREDITS = 4;
/** Longer sources are refused before anything is charged. */
export const VOICE_CHANGER_MAX_SECONDS = 10 * 60;

/**
 * Browsers and ffprobe read a file's length a fraction of a second apart: a minute starts only after this much more,
 * so the price on the page and the price charged agree.
 */
const LENGTH_SLACK_SECONDS = 1;

/** Too long for the Voice Changer (checked on the page and again on the server before anything is charged). */
export const voiceChangerTooLong = (sourceSeconds: number) => sourceSeconds > VOICE_CHANGER_MAX_SECONDS + LENGTH_SLACK_SECONDS;

/** Voice Changer price of a source this many seconds long: 2 credits per started minute, at least 3 (high quality: at least 4). */
export function voiceChangerCredits(sourceSeconds: number, highQuality: boolean): number {
  const minutes = Math.max(1, Math.ceil(Math.max(0, sourceSeconds - LENGTH_SLACK_SECONDS) / 60));
  return Math.max(highQuality ? VOICE_CHANGER_HQ_MIN_CREDITS : VOICE_CHANGER_MIN_CREDITS, minutes * VOICE_CHANGER_CREDITS_PER_MINUTE);
}

export const VOICE_CHANGER_TOO_LONG = 'The Voice Changer takes recordings of up to 10 minutes. Cut this file into parts of 10 minutes or less and change each part.';
