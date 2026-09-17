/**
 * Quality tiers for the AI Avatar tool.
 *
 * Standard is today's path: the user's voice (MiniMax or a clone) is rendered
 * to audio first and LTX-2 19B audio-to-video lip-syncs it, up to 60 s.
 *
 * Fast and Ultra reuse the Video Maker engines, which SPEAK the typed script
 * themselves from a quoted line in the prompt. No voice step, no voice upload,
 * no clip stitching: one clip per generation, capped by the engine's own
 * duration limit. The voice is chosen by the model and can differ between runs.
 *
 * This module is imported by the page (live meter, price preview) and by the
 * server action (validation and charge), so both always compute the same
 * seconds and credits. Keep it free of 'use server' and Node-only imports.
 */

export type AvatarQualityTier = 'standard' | 'fast' | 'ultra';

/** Natural speech rate used to turn a script into seconds (150 words per minute). */
export const AVATAR_WORDS_PER_SECOND = 2.5;
/** Breathing room added to every estimate so the last word is not cut. */
export const AVATAR_PAD_SECONDS = 1;

export interface AvatarTierConfig {
  id: Exclude<AvatarQualityTier, 'standard'>;
  label: string;
  /** Marketing line under the picker card. */
  blurb: string;
  /** fal endpoint the clip is rendered on. */
  modelVersion: string;
  /** Stored in avatar_videos.video_source so History and polling know the engine. */
  videoSource: 'fal-ltx-2.3' | 'fal-kling-o3-pro';
  /** Durations the engine accepts, ascending. The estimate snaps UP to one of these. */
  allowedDurations: readonly number[];
  maxSeconds: number;
  creditsPerSecond: number;
  /** Shown next to the spinner. */
  waitLabel: string;
  /** Whether the engine takes an explicit aspect ratio (LTX) or follows the photo (Kling). */
  aspectFromResolution: boolean;
}

export const AVATAR_TIER_CONFIG: Record<Exclude<AvatarQualityTier, 'standard'>, AvatarTierConfig> = {
  fast: {
    id: 'fast',
    label: 'Fast',
    blurb: 'Avatar speaks your script · up to 20 s · 1080p',
    modelVersion: 'fal-ai/ltx-2.3/image-to-video/fast',
    videoSource: 'fal-ltx-2.3',
    allowedDurations: [6, 8, 10, 12, 14, 16, 18, 20],
    maxSeconds: 20,
    creditsPerSecond: 2,
    waitLabel: 'about a minute',
    aspectFromResolution: true,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra',
    blurb: 'Avatar speaks your script · up to 15 s · best lip sync',
    modelVersion: 'fal-ai/kling-video/o3/pro/image-to-video',
    videoSource: 'fal-kling-o3-pro',
    allowedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    maxSeconds: 15,
    creditsPerSecond: 8,
    waitLabel: '3 to 6 minutes',
    aspectFromResolution: false,
  },
};

export function isScriptTier(tier: AvatarQualityTier | null | undefined): tier is Exclude<AvatarQualityTier, 'standard'> {
  return tier === 'fast' || tier === 'ultra';
}

export function countWords(text: string | null | undefined): number {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

/** Seconds a script needs at natural pace, with the pad. 0 for an empty script. */
export function estimateSpeechSeconds(words: number): number {
  if (words <= 0) return 0;
  return Math.ceil(words / AVATAR_WORDS_PER_SECOND) + AVATAR_PAD_SECONDS;
}

/** Smallest duration the engine accepts that still fits `seconds`; null when the script is too long. */
export function snapDuration(tier: Exclude<AvatarQualityTier, 'standard'>, seconds: number): number | null {
  const { allowedDurations } = AVATAR_TIER_CONFIG[tier];
  const fit = allowedDurations.find((d) => d >= seconds);
  return fit ?? null;
}

/** The longest script the tier can carry at natural pace. */
export function maxWordsFor(tier: Exclude<AvatarQualityTier, 'standard'>): number {
  const { maxSeconds } = AVATAR_TIER_CONFIG[tier];
  return Math.floor((maxSeconds - AVATAR_PAD_SECONDS) * AVATAR_WORDS_PER_SECOND);
}

export interface ScriptFit {
  words: number;
  /** Seconds the speech needs before snapping. */
  neededSeconds: number;
  /** Clip length that will be rendered and billed; null when the script does not fit. */
  clipSeconds: number | null;
  credits: number;
  fits: boolean;
  maxWords: number;
  /** Words to cut when it does not fit. */
  overBy: number;
}

/** Everything the page and the server need to know about a script on a tier. */
export function scriptFit(tier: Exclude<AvatarQualityTier, 'standard'>, text: string | null | undefined): ScriptFit {
  const words = countWords(text);
  const neededSeconds = estimateSpeechSeconds(words);
  const clipSeconds = words > 0 ? snapDuration(tier, neededSeconds) : null;
  const maxWords = maxWordsFor(tier);
  const fits = words > 0 && clipSeconds !== null;
  return {
    words,
    neededSeconds,
    clipSeconds,
    credits: clipSeconds ? clipSeconds * AVATAR_TIER_CONFIG[tier].creditsPerSecond : 0,
    fits,
    maxWords,
    overBy: Math.max(0, words - maxWords),
  };
}

/**
 * The one prompt the engines get. Dialogue goes in straight quotes, which is
 * how LTX, Seedance and Kling all pick up spoken lines. SHOT/timestamp-style
 * prefixes are stripped because LTX renders them as literal captions.
 */
export function buildAvatarSpeechPrompt(script: string, actionPrompt?: string | null): string {
  const raw = (script || '').trim();
  const stripped = raw
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // "SHOT 1 (0-2s):" style prefixes: drop the label, keep the words after it
    .replace(/^\s*(SHOT|SCENE)\s*\d+\s*(\([^)]*\))?\s*[:.-]?\s*/gim, '')
    .replace(/\(\s*\d+\s*-\s*\d+\s*s\s*\)/gi, '')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const cleaned = stripped || raw.replace(/"/g, "'");
  const action = (actionPrompt || '').trim();
  return [
    'The person in the image looks straight into the camera and speaks clearly to the viewer at a natural conversational pace, steady framing, subtle natural head movement.',
    `They say: "${cleaned}"`,
    action ? action : '',
    "Audio: only the person's voice with natural room ambience, no background music, no soundtrack, no melody.",
    'No captions, no subtitles, no on-screen text, no logos.',
  ].filter(Boolean).join(' ');
}

/** Tier of a stored row: the settings carry it for new rows, legacy rows are Standard. */
export function readAvatarTier(video: { video_settings?: unknown; video_source?: string | null } | null | undefined): AvatarQualityTier {
  if (!video) return 'standard';
  const settings = (video.video_settings || {}) as { tier?: string };
  if (settings.tier === 'fast' || settings.tier === 'ultra') return settings.tier;
  if (video.video_source === 'fal-ltx-2.3') return 'fast';
  if (video.video_source === 'fal-kling-o3-pro') return 'ultra';
  return 'standard';
}

export function tierLabel(tier: AvatarQualityTier): string {
  return tier === 'standard' ? 'Basic' : AVATAR_TIER_CONFIG[tier].label;
}
