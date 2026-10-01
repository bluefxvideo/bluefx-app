import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const FFMPEG_MAX_BUFFER = 32 * 1024 * 1024;

/**
 * Clone Studio's editor: the rules that turn finished scene clips into a finished ad.
 * Each rule answers a defect seen on a real cut (owner review of the first finished
 * pizza ad, 2026-10-01): the music covered the voice, and shots that held for 5 to 7
 * seconds made the ad drag.
 */

/**
 * Every voice and the music are brought to this loudness before the render, so the
 * renderer's fixed gains (voice 1.12, music bed 0.14) always give the same mix: the
 * bed 18 dB under the voice. Unlevelled, a loud music master sat 6 dB under a quiet
 * clip voice.
 */
export const STEM_LUFS = -18;

/** Integrated loudness (LUFS) of a file's sound; null when it has none or is silent. */
export async function measureLoudness(file: string): Promise<number | null> {
  try {
    const { stderr } = await execFileAsync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { maxBuffer: FFMPEG_MAX_BUFFER });
    const loudness = Number(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/.exec(stderr)?.[1]);
    return Number.isFinite(loudness) && loudness > -60 ? loudness : null;
  } catch {
    return null;
  }
}

/** dB to add so a stem plays at STEM_LUFS. A stem with no measurable sound is left alone. */
export function levelGain(measured: number | null): number {
  if (measured === null) return 0;
  return Math.min(18, Math.max(-24, STEM_LUFS - measured));
}

/** ffmpeg audio filter that applies a level gain without clipping. */
export const levelFilter = (gainDb: number) => `volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.95:level=disabled`;

/** A narrator slower than this drags next to a person talking on camera (who speaks about 3 words a second). */
export const NARRATOR_WORDS_PER_SECOND = 2.9;
const MAX_SPEED_UP = 1.25; // beyond this a sped-up voice starts to sound rushed

/** Words per second of a recording, pauses included; 0 when nothing was said. */
export function speakingRate(words: { start: number; end: number }[]): number {
  if (words.length < 2) return 0;
  const seconds = words[words.length - 1].end - words[0].start;
  return seconds > 0 ? words.length / seconds : 0;
}

/** Speed factor that brings a recording up to the target pace: never slower, at most 25% faster. */
export function paceFactor(words: { start: number; end: number }[], target = NARRATOR_WORDS_PER_SECOND): number {
  const rate = speakingRate(words);
  if (!rate) return 1;
  return Math.min(MAX_SPEED_UP, Math.max(1, target / rate));
}

const PUNCH_SCALE = 1.14;
const MIN_HOLD = 1.3; // a zoom cut sooner than this after the last change reads as a glitch

/**
 * Zoom cuts for one shot. The picture jumps in (or back out) where the speaker pauses,
 * after a comma or at the end of a sentence, so a long shot reads as several.
 * `words` are the spoken words on the video timeline, with their punctuation.
 */
export function punchCuts(words: { text: string; start: number }[], start: number, end: number): { at: number; scale: number }[] {
  const cuts: { at: number; scale: number }[] = [];
  let last = start;
  let tight = false;
  for (let i = 0; i + 1 < words.length; i++) {
    if (!/[.,!?;:]$/.test(words[i].text)) continue;
    const at = words[i + 1].start - 0.05;
    if (at - last < MIN_HOLD || end - at < MIN_HOLD) continue;
    tight = !tight;
    cuts.push({ at: Math.round(at * 100) / 100, scale: tight ? PUNCH_SCALE : 1 });
    last = at;
  }
  return cuts;
}

const MIN_OVERLAY_SECONDS = 1.3; // less than this and a price tag is gone before it is read

/**
 * When a text or tag may appear at the latest. Text lands on its spoken word, and a word at the
 * end of a line leaves it no time on screen (a "$6" tile cued on the last word showed for half a
 * second), so text due later than this is shown earlier instead.
 */
export function latestOverlayTime(sceneStart: number, sceneEnd: number): number {
  return Math.max(sceneStart, sceneEnd - MIN_OVERLAY_SECONDS);
}

/** Seconds the end card holds after the last spoken word. */
export const END_HOLD = 2.8;
