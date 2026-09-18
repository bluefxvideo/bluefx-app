/**
 * Rough Cut pricing. The server quotes and charges with roughcutCredits(), and the page
 * shows the same numbers, so the price a user sees is the price they pay.
 */
export const ROUGHCUT_CREDITS_PER_MINUTE = 2;
export const ROUGHCUT_MIN_CREDITS = 20;
/** A re-run of audio that was already transcribed skips transcription: half price. */
export const ROUGHCUT_RERUN_CREDITS_PER_MINUTE = 1;
export const ROUGHCUT_RERUN_MIN_CREDITS = 10;

export const ROUGHCUT_PRICE_TEXT = `${ROUGHCUT_CREDITS_PER_MINUTE} credits per minute of video, ${ROUGHCUT_MIN_CREDITS} credits minimum`;

/** Credits for a video of this length. Every started minute counts. */
export function roughcutCredits(seconds: number, rerun = false): number {
  const perMinute = rerun ? ROUGHCUT_RERUN_CREDITS_PER_MINUTE : ROUGHCUT_CREDITS_PER_MINUTE;
  const minimum = rerun ? ROUGHCUT_RERUN_MIN_CREDITS : ROUGHCUT_MIN_CREDITS;
  return Math.max(minimum, Math.ceil(Math.max(0, seconds) / 60) * perMinute);
}

/** The sum behind a price, e.g. "25 min × 2 credits per minute". */
export function roughcutPriceBreakdown(seconds: number, rerun = false): string {
  const perMinute = rerun ? ROUGHCUT_RERUN_CREDITS_PER_MINUTE : ROUGHCUT_CREDITS_PER_MINUTE;
  const minimum = rerun ? ROUGHCUT_RERUN_MIN_CREDITS : ROUGHCUT_MIN_CREDITS;
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  const prefix = rerun ? 'Already transcribed, half price: ' : '';
  if (minutes * perMinute < minimum) {
    return `${prefix}${minimum} credits minimum for videos under ${minimum / perMinute} minutes`;
  }
  return `${prefix}${minutes} min × ${perMinute} credit${perMinute === 1 ? '' : 's'} per minute`;
}
