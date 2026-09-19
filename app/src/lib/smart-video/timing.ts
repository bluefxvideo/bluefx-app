import type { SpokenWord } from './audio';

/**
 * Smart Video — pins the plan to the voice.
 * Script words are aligned to the transcribed words (longest common
 * subsequence); words the transcript spelled differently (numbers, brand
 * names) take an interpolated time between their matched neighbours.
 */

const normalize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/ş/g, 'ș')
    .replace(/ţ/g, 'ț')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

export interface ScriptTimeline {
  /** Every spoken word of the script, per scene: as written (`raw`), normalised (`token`) and when it starts. */
  sceneTokens: { token: string; raw: string; time: number }[][];
  lastWordEnd: number;
  /** Share of each scene's words that were actually heard in the recording (0-1). */
  sceneCoverage: number[];
}

export function alignScript(narration: string[], words: SpokenWord[]): ScriptTimeline {
  // One token per written word, so captions can show the script's own spelling.
  const written = narration.map((text) => text.split(/\s+/).map((raw) => ({ raw, token: normalize(raw).join('') })).filter((w) => w.token));
  const script = written.map((words) => words.map((w) => w.token));
  const flat = script.flat();
  const heard = words.map((w) => normalize(w.text).join(''));

  // LCS table
  const n = flat.length;
  const m = heard.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = flat[i] === heard[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const times: (number | null)[] = new Array(n).fill(null);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (flat[i] === heard[j]) {
      times[i] = words[j].start;
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }

  const heardFlags = times.map((t) => t !== null);

  // Interpolate the unmatched tokens between matched neighbours.
  const lastWordEnd = words.length ? words[words.length - 1].end : 0;
  let prevIndex = -1;
  let prevTime = words.length ? words[0].start : 0;
  for (let i = 0; i <= n; i++) {
    if (i < n && times[i] === null) continue;
    const nextTime = i < n ? (times[i] as number) : lastWordEnd;
    const gap = i - prevIndex;
    for (let k = prevIndex + 1; k < i; k++) times[k] = prevTime + ((nextTime - prevTime) * (k - prevIndex)) / gap;
    prevIndex = i;
    prevTime = nextTime;
  }

  let offset = 0;
  const sceneCoverage: number[] = [];
  const sceneTokens = script.map((tokens, sceneIndex) => {
    const out = tokens.map((token, k) => ({ token, raw: written[sceneIndex][k].raw, time: times[offset + k] as number }));
    const heardCount = heardFlags.slice(offset, offset + tokens.length).filter(Boolean).length;
    sceneCoverage.push(tokens.length ? heardCount / tokens.length : 1);
    offset += tokens.length;
    return out;
  });
  return { sceneTokens, lastWordEnd, sceneCoverage };
}

/** Time at which `cue` is spoken inside a scene, or null when it cannot be found. */
export function cueTime(tokens: { token: string; time: number }[], cue: string | null | undefined): number | null {
  if (!cue) return null;
  const wanted = cue.split(/\s+/).map((w) => normalize(w).join('')).filter(Boolean);
  if (!wanted.length) return null;
  for (let length = wanted.length; length >= 1; length--) {
    for (let i = 0; i + length <= tokens.length; i++) {
      if (wanted.slice(0, length).every((w, k) => tokens[i + k].token === w)) return tokens[i].time;
    }
  }
  return null;
}
