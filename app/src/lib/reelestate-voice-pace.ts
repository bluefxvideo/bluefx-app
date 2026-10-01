/**
 * How long a listing voice needs for a script.
 *
 * Asking the script model for "about 30 seconds" does not work: the model
 * cannot hear, so 48 listing voiceovers ran on average 2.1 times the chosen
 * length (30 seconds chosen, 44 to 115 seconds delivered). The script writer
 * now turns the chosen length into a word budget with the numbers below, and
 * the page shows the same estimate while the user edits.
 *
 * Measured 2026-10-01 with the app's own voice request (MiniMax speech-2.8-hd,
 * speed 1.0) on four listing scripts per voice (75 to 118 words, 4 to 14
 * photos). seconds = letters x secondsPerChar + photos x pauseSeconds fits
 * every sample within about 5%, and the same script read twice differs by
 * about as much.
 */

interface VoicePace {
  /** Seconds per character of script text, spaces included. */
  secondsPerChar: number;
  /** Extra seconds per photo: the pause the voice takes between two photos. */
  pauseSeconds: number;
}

const VOICE_PACE: Record<string, VoicePace> = {
  Friendly_Person: { secondsPerChar: 0.0605, pauseSeconds: 0.39 },
  Deep_Voice_Man: { secondsPerChar: 0.0627, pauseSeconds: 0.34 },
  Calm_Woman: { secondsPerChar: 0.0642, pauseSeconds: 0.48 },
  Inspirational_girl: { secondsPerChar: 0.0582, pauseSeconds: 0.31 },
  Wise_Woman: { secondsPerChar: 0.075, pauseSeconds: 0.29 },
  Patient_Man: { secondsPerChar: 0.0906, pauseSeconds: 0.67 },
  Casual_Guy: { secondsPerChar: 0.0658, pauseSeconds: 0.41 },
  Lovely_Girl: { secondsPerChar: 0.0722, pauseSeconds: 0.48 },
};

/** A voice that was never measured gets the average of the measured ones. */
const AVERAGE_PACE: VoicePace = { secondsPerChar: 0.0687, pauseSeconds: 0.42 };

/** Plain listing language averages this many characters per word, the space included. */
const CHARS_PER_WORD = 5.8;

/** A script may run this much over the chosen length before the page warns. */
export const SCRIPT_OVERRUN_TOLERANCE = 1.15;

/** The shortest line worth speaking over a photo. */
export const MIN_WORDS_PER_PHOTO = 3;

/** Under this many seconds a photo, a spoken line no longer fits. */
export const MIN_SECONDS_PER_PHOTO = 2.5;

function paceOf(voiceId?: string | null): VoicePace {
  return (voiceId && VOICE_PACE[voiceId]) || AVERAGE_PACE;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Seconds the voice needs for one photo's line, the pause after the line included. */
export function estimateSegmentSeconds(text: string, voiceId?: string | null): number {
  const pace = paceOf(voiceId);
  const chars = text.trim().length;
  if (chars === 0) return 0;
  return chars * pace.secondsPerChar + pace.pauseSeconds;
}

/** Seconds the voice needs for the whole script, one entry per photo. */
export function estimateScriptSeconds(segmentTexts: string[], voiceId?: string | null): number {
  return segmentTexts.reduce((total, text) => total + estimateSegmentSeconds(text, voiceId), 0);
}

/** How many words fit in the chosen length for this voice and this many photos. */
export function wordBudget(targetSeconds: number, photoCount: number, voiceId?: string | null): number {
  const pace = paceOf(voiceId);
  const speakingSeconds = targetSeconds - photoCount * pace.pauseSeconds;
  return Math.max(0, Math.floor(speakingSeconds / (pace.secondsPerChar * CHARS_PER_WORD)));
}

/** Seconds the voice needs for this many words spread over this many photos. */
export function secondsForWords(words: number, photoCount: number, voiceId?: string | null): number {
  const pace = paceOf(voiceId);
  return words * CHARS_PER_WORD * pace.secondsPerChar + photoCount * pace.pauseSeconds;
}

/** Seconds the voice needs for the lines of the selected photos: the lines the voice reads. */
export function spokenScriptSeconds(
  segments: { image_index: number; voiceover: string }[],
  selectedIndices: number[],
  voiceId?: string | null,
): number {
  const spoken = segments.filter(s => selectedIndices.includes(s.image_index));
  return estimateScriptSeconds(spoken.map(s => s.voiceover), voiceId);
}

/** The same script with every line's length in seconds measured for this voice. */
export function retimeSegments<T extends { voiceover: string; duration_seconds: number }>(
  segments: T[],
  voiceId?: string | null,
): { segments: T[]; total_duration_seconds: number } {
  const retimed = segments.map(s => ({
    ...s,
    duration_seconds: Math.round(estimateSegmentSeconds(s.voiceover, voiceId) * 10) / 10,
  }));
  return {
    segments: retimed,
    total_duration_seconds: Math.round(retimed.reduce((total, s) => total + s.duration_seconds, 0)),
  };
}
