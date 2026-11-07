import type { DirectorPlan } from './types';

/**
 * Script first (owner 2026-11-02): the client reads the voice-over before the video is made and changes it in ONE text
 * box ("not different scenes, just the voiceover copy ... in one text box", owner 2026-11-02). Each scene's line is a
 * paragraph of the box. This file turns a plan into that text and the client's text back into the plan's scenes, so the
 * page and the server count words the same way. No server code here: the page imports it too.
 */

/** At most this many words for the line the AI presenter says on camera (presenter.ts PRESENTER_MAX_WORDS). */
export const PRESENTER_LINE_MAX_WORDS = 16;
/** The shortest voice-over a video can be made from. */
export const SCRIPT_MIN_WORDS = 20;
/** About a minute of voice-over: what one video ad's price covers. */
export const WORDS_PER_MINUTE = 140;
const ONE_MINUTE_WORDS = 150;

export interface DraftScene {
  /** What is said in the scene. */
  say: string;
  /** A person in the client's own clip says it in their own voice: it is not in the box and stays as it is. */
  speaker?: boolean;
  /** The AI presenter says it on camera (scene 1 of a video with a presenter). */
  presenter?: boolean;
}

/** The script as it was written, scene by scene (the page shows it as one text). */
export interface DraftScript {
  scenes: DraftScene[];
  /** The longest voice-over the client may write: about a minute, or the minutes an exact-words video was priced for. */
  maxWords: number;
}

/** What the page sends back on approval: the whole voice-over as the client left it. */
export interface ApprovedScript {
  text: string;
}

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The most words a voice-over may have: a minute, or more for an exact-words script (priced by its minutes). */
export const maxWordsFor = (plan: DirectorPlan, exactWords: boolean) =>
  exactWords ? Math.max(ONE_MINUTE_WORDS, Math.ceil(countWords(plan.scenes.map((s) => s.narration).join(' ')) / WORDS_PER_MINUTE) * WORDS_PER_MINUTE + 10) : ONE_MINUTE_WORDS;

export function draftOf(plan: DirectorPlan, presenter: boolean, exactWords: boolean): DraftScript {
  return {
    scenes: plan.scenes.map((scene, i) => ({
      say: scene.narration,
      ...(scene.speaker ? { speaker: true } : {}),
      ...(presenter && i === 0 && !scene.speaker ? { presenter: true } : {}),
    })),
    maxWords: maxWordsFor(plan, exactWords),
  };
}

/** The text in the box: one paragraph per narrated scene. */
export const voiceText = (draft: DraftScript) =>
  draft.scenes
    .filter((scene) => !scene.speaker)
    .map((scene) => scene.say.trim())
    .join('\n\n');

const paragraphsOf = (text: string) =>
  text
    .split(/\n\s*\n|\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/**
 * The client's text as the narrated scenes' lines. Paragraphs that still match the scenes one to one stay as they are.
 * Otherwise the words are shared out in the same proportions as the script the director wrote, cut at the end of a
 * sentence when one is near (the voice is recorded as one passage, so a cut only moves when the next picture shows).
 * With a presenter, the first paragraph is always the presenter's line.
 */
export function splitIntoScenes(draft: DraftScript, text: string): string[] {
  const narrated = draft.scenes.filter((scene) => !scene.speaker);
  const paragraphs = paragraphsOf(text);
  if (paragraphs.length === narrated.length) return paragraphs;
  const opening = narrated[0]?.presenter && paragraphs.length > 1 ? paragraphs[0] : null;
  const rest = opening ? paragraphs.slice(1) : paragraphs;
  const scenes = opening ? narrated.slice(1) : narrated;
  const words = rest.join(' ').split(' ').filter(Boolean);
  const weights = scenes.map((scene) => Math.max(1, countWords(scene.say)));
  const total = weights.reduce((a, b) => a + b, 0);
  const lines: string[] = [];
  let at = 0;
  let share = 0;
  for (const [i, weight] of weights.entries()) {
    const left = scenes.length - i - 1;
    if (left === 0) {
      lines.push(words.slice(at).join(' '));
      break;
    }
    share += weight;
    const target = Math.round((share / total) * words.length);
    // The end of a sentence within 4 words of the target, else the target itself; every scene keeps a word.
    let cut = Math.min(Math.max(target, at + 1), words.length - left);
    for (let d = 0; d <= 4; d++) {
      const later = cut + d;
      const earlier = cut - d;
      if (later <= words.length - left && /[.!?]["')]?$/.test(words[later - 1] || '')) {
        cut = later;
        break;
      }
      if (earlier > at && /[.!?]["')]?$/.test(words[earlier - 1] || '')) {
        cut = earlier;
        break;
      }
    }
    lines.push(words.slice(at, cut).join(' '));
    at = cut;
  }
  return opening ? [opening, ...lines] : lines;
}

/** What is wrong with the client's text, in plain words for the page; null when it can be made. */
export function checkDraft(draft: DraftScript, text: string): string | null {
  const words = countWords(text);
  const narrated = draft.scenes.filter((scene) => !scene.speaker).length;
  if (words < Math.max(SCRIPT_MIN_WORDS, narrated)) return `The script is too short. Write at least ${Math.max(SCRIPT_MIN_WORDS, narrated)} words.`;
  if (words > draft.maxWords) return `The script is too long: ${words} words. Keep it to ${draft.maxWords} words or fewer.`;
  if (draft.scenes.find((scene) => !scene.speaker)?.presenter) {
    const first = splitIntoScenes(draft, text)[0] ?? '';
    if (countWords(first) > PRESENTER_LINE_MAX_WORDS) {
      return `The first line is said by the presenter on camera. Keep it to ${PRESENTER_LINE_MAX_WORDS} words or fewer (it has ${countWords(first)}).`;
    }
  }
  return null;
}

/**
 * Writes the client's text into a copy of the plan. Returns the scenes whose words changed: their words on screen are
 * matched to the new line afterwards (script-sync.ts), so a claim taken out of the voice-over leaves the screen too.
 */
export function applyDraft(plan: DirectorPlan, draft: DraftScript, text: string): { plan: DirectorPlan; changed: number[] } | { error: string } {
  if (draft.scenes.length !== plan.scenes.length) return { error: 'The script changed while you were reading it. Please reload the page.' };
  const problem = checkDraft(draft, text);
  if (problem) return { error: problem };
  const lines = splitIntoScenes(draft, text);
  const next: DirectorPlan = structuredClone(plan);
  const changed: number[] = [];
  let k = 0;
  for (const [i, scene] of next.scenes.entries()) {
    if (scene.speaker) continue;
    const line = lines[k++];
    if (line && line !== scene.narration.replace(/\s+/g, ' ').trim()) {
      scene.narration = line;
      changed.push(i);
    }
  }
  return { plan: next, changed };
}
