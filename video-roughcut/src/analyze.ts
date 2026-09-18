import * as z from 'zod';
import { alignToFrame } from './timecode.js';
import type {
  Transcript,
  TranscriptSegment,
  WordTiming,
  EditDecision,
  KeepSegment,
  SilenceGap,
  RemovalDetail,
} from './types.js';

/**
 * The model that decides the cuts, called through fal's OpenRouter proxy (FAL_KEY).
 *
 * Picked in a September 2026 bake-off of 12 model/effort settings on three edits that
 * had been approved by hand: Claude Fable 5.1 at low reasoning effort was the fastest
 * setting that still cut cleanly (about 36 s per 12-minute video). Gemini at low effort
 * and DeepSeek cut real content; Sonnet 5 dropped an opening hook.
 * Claude Opus 5 is the fallback if Fable is unavailable.
 * Override with ROUGHCUT_MODEL / ROUGHCUT_FALLBACK_MODEL / ROUGHCUT_EFFORT for experiments.
 */
const FAL_URL = 'https://fal.run/openrouter/router/openai/v1/chat/completions';
const MODEL = process.env.ROUGHCUT_MODEL || 'anthropic/claude-fable-5.1';
const FALLBACK_MODEL = process.env.ROUGHCUT_FALLBACK_MODEL || 'anthropic/claude-opus-5';
const EFFORT = process.env.ROUGHCUT_EFFORT || 'low';
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

export const SYSTEM_PROMPT = `You edit rough cuts of single-speaker talking-head recordings, usually read from a teleprompter. When the speaker stumbles, they pause and say the line again, sometimes several times. The final complete attempt of a line is the take to keep.

You get the transcript as numbered segments: short phrases split at sentence ends and pauses, with start and end times. Decide what to cut so the kept segments play as one clean take.

Remove:
- Earlier attempts of a line the speaker repeats later, including partial attempts and fragments that trail off.
- Filler segments between takes, such as "okay", "so", "um", "yeah", "right?", "wait", "let me start again".
- Garbled bursts and repeated sounds, such as "do do do do".

Keep:
- Anything that is not said again later, even with a small stumble. Losing content is worse than leaving a stumble, so trim a stumble instead of removing the segment.
- The last complete version of each repeated line. If the last attempt is incomplete and an earlier one is complete, keep the complete one.
- Enough for the kept text to read as coherent sentences, in order.

Trim a kept segment when it starts or ends with a stumble:
- keepFrom: the exact words where the clean part starts, copied from that segment. Example: for "their co, their co CEO said", keepFrom is "their co CEO said".
- keepUntil: the exact final words to keep, when the segment ends by restarting the next line.
- Use an empty string for an end you don't trim.

Segments you don't list in "remove" are kept. Give a short reason for each removal group and each trim.`;

/** What the model returns. Anything not listed in `remove` is kept. */
export const DecisionsSchema = z.object({
  remove: z.array(
    z.object({
      ids: z.array(z.number().int()),
      reason: z.string(),
    }),
  ),
  trim: z.array(
    z.object({
      id: z.number().int(),
      keepFrom: z.string(),
      keepUntil: z.string(),
      reason: z.string(),
    }),
  ),
});
export type ModelDecisions = z.infer<typeof DecisionsSchema>;

/** DecisionsSchema written out for strict structured output through OpenRouter. */
const DECISIONS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    remove: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ids: { type: 'array', items: { type: 'integer' } }, reason: { type: 'string' } },
        required: ['ids', 'reason'],
        additionalProperties: false,
      },
    },
    trim: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          keepFrom: { type: 'string' },
          keepUntil: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['id', 'keepFrom', 'keepUntil', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['remove', 'trim'],
  additionalProperties: false,
};

interface TrimEntry {
  id: number;
  startTime?: number;
  endTime?: number;
  reason: string;
}

/** An error that retrying won't fix (bad key, bad request, response too long). */
class NonRetryableError extends Error {}

/**
 * Ask the model which segments to remove and which to trim. Retries once on network
 * or server errors and on malformed output.
 */
export async function getModelDecisions(transcript: Transcript): Promise<ModelDecisions> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not set');
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await requestDecisions(transcript, key);
    } catch (err) {
      lastError = err;
      if (err instanceof NonRetryableError) break;
      console.warn(`⚠️ AI attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The AI request failed');
}

async function requestDecisions(transcript: Transcript, falKey: string): Promise<ModelDecisions> {
  const started = Date.now();
  const res = await fetch(FAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${falKey}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      models: [MODEL, FALLBACK_MODEL], // OpenRouter tries the next model if the first fails
      max_tokens: 32000,
      reasoning: { effort: EFFORT },
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'roughcut_decisions', strict: true, schema: DECISIONS_JSON_SCHEMA },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: formatTranscriptForLLM(transcript) },
      ],
      // Streaming keeps long requests alive past fetch's 5-minute header timeout.
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    const message = `AI request failed: HTTP ${res.status} ${detail}`;
    if ([400, 401, 402, 403].includes(res.status)) throw new NonRetryableError(message);
    throw new Error(message);
  }

  let content = '';
  let servedBy = MODEL;
  let finishReason = '';
  let usage: { prompt_tokens?: number; completion_tokens?: number; cost?: number } = {};
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue; // skips ": OPENROUTER PROCESSING" keep-alives
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let evt: any;
      try {
        evt = JSON.parse(data);
      } catch {
        continue;
      }
      if (evt.error) throw new Error(`AI stream error: ${JSON.stringify(evt.error).slice(0, 300)}`);
      if (evt.model) servedBy = evt.model;
      if (evt.usage) usage = evt.usage;
      const choice = evt.choices?.[0];
      content += choice?.delta?.content ?? '';
      if (choice?.finish_reason) finishReason = choice.finish_reason;
    }
  }

  if (finishReason === 'length') {
    throw new NonRetryableError('The AI response was cut off. The video may be too long.');
  }
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error(`The AI returned no JSON (finish reason: ${finishReason || 'none'}).`);
  }
  const parsed = DecisionsSchema.safeParse(JSON.parse(content.slice(start, end + 1)));
  if (!parsed.success) {
    throw new Error(`The AI returned an unexpected format: ${parsed.error.message.slice(0, 300)}`);
  }

  console.log(
    `🧠 ${servedBy} (${EFFORT} effort): ${usage.prompt_tokens ?? '?'} in / ${usage.completion_tokens ?? '?'} out tokens, ` +
      `$${(usage.cost ?? 0).toFixed(4)}, ${parsed.data.remove.length} removal groups, ${parsed.data.trim.length} trims, ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  return parsed.data;
}

/**
 * Full analysis: model decisions, then deterministic cut-point placement.
 * `frameRate` is the sequence rate the XML will use (see resolveSequenceRate).
 */
export async function analyzeTranscript(
  transcript: Transcript,
  frameRate: number,
  silences: SilenceGap[],
): Promise<EditDecision> {
  const decisions = await getModelDecisions(transcript);
  return buildEditDecision(transcript, decisions, frameRate, silences);
}

/**
 * Pure part of the pipeline: turn model decisions into frame-aligned keep ranges.
 * No network calls, so it can be regression-tested against past edits.
 */
export function buildEditDecision(
  transcript: Transcript,
  decisions: ModelDecisions,
  frameRate: number,
  silences: SilenceGap[],
): EditDecision {
  const segments = transcript.segments;
  const segById = new Map(segments.map((s) => [s.id, s]));

  // 1. Removals. An ID in both "remove" and "trim" is removed: removal is the explicit intent.
  const removeIds = new Set<number>();
  const reasonById = new Map<number, string>();
  for (const group of decisions.remove) {
    for (const id of group.ids) {
      if (!segById.has(id)) continue;
      removeIds.add(id);
      reasonById.set(id, group.reason);
    }
  }
  const keepIds = new Set(segments.filter((s) => !removeIds.has(s.id)).map((s) => s.id));

  // 2. Model trims, resolved from quoted words to word timestamps.
  const trimMap = new Map<number, TrimEntry>();
  for (const t of decisions.trim) {
    const seg = segById.get(t.id);
    if (!seg || !keepIds.has(t.id)) continue;
    const resolved = resolveTrim(seg, t.keepFrom, t.keepUntil, t.reason);
    if (resolved) trimMap.set(t.id, resolved);
  }

  // 3. Deterministic safety nets for stutters the model missed.
  for (const seg of segments) {
    if (!keepIds.has(seg.id) || trimMap.get(seg.id)?.startTime !== undefined) continue;
    const stutter = detectLeadingStutter(seg);
    if (stutter) trimMap.set(seg.id, { ...trimMap.get(seg.id), ...stutter });
  }
  for (const overlap of detectOverlaps(segments, keepIds, trimMap)) {
    trimMap.set(overlap.id, { ...trimMap.get(overlap.id), ...overlap, reason: overlap.reason });
  }

  const keepSegments = buildKeepSegments(segments, keepIds, trimMap, frameRate, silences);
  const totalOutputDuration = keepSegments.reduce((sum, s) => sum + (s.recordOut - s.recordIn), 0);

  return {
    segments: keepSegments,
    totalSourceDuration: transcript.duration,
    totalOutputDuration,
    removedDuration: Math.max(0, transcript.duration - totalOutputDuration),
    removedCount: removeIds.size,
    removals: buildRemovalDetails(segments, keepIds, trimMap, reasonById),
  };
}

// ---------------------------------------------------------------------------
// Transcript formatting
// ---------------------------------------------------------------------------

export function formatTranscriptForLLM(transcript: Transcript): string {
  const lines = transcript.segments.map(
    (s) => `[${s.id}] ${formatTime(s.start)}-${formatTime(s.end)} ${s.text}`,
  );
  return `Transcript: ${transcript.segments.length} segments, ${formatTime(transcript.duration)} long.\n\n${lines.join('\n')}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Trims
// ---------------------------------------------------------------------------

/** Lowercase letters and digits only, so "CEO," matches "ceo" and "don't" matches "dont". */
function norm(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function phraseTokens(phrase: string): string[] {
  return phrase.split(/\s+/).map(norm).filter(Boolean);
}

/** How many phrase tokens match the segment going forward from index `at`. */
function forwardMatch(tokens: string[], phrase: string[], at: number): number {
  let n = 0;
  while (n < phrase.length && at + n < tokens.length && tokens[at + n] === phrase[n]) n++;
  return n;
}

/** How many phrase tokens match the segment going backward from index `endAt`. */
function backwardMatch(tokens: string[], phrase: string[], endAt: number): number {
  let n = 0;
  while (n < phrase.length && endAt - n >= 0 && tokens[endAt - n] === phrase[phrase.length - 1 - n]) n++;
  return n;
}

/**
 * Convert the model's quoted words into times.
 *
 * Retakes repeat words, so a quote can match in several places. The longest match wins,
 * and ties go to the later position: the clean take is the last attempt, and a later
 * end keeps more content. At least 3 words (or the whole quote, if shorter) must match,
 * which tolerates small copying differences in long quotes.
 * Returns null when nothing needs trimming or the quote can't be found.
 */
function resolveTrim(
  seg: TranscriptSegment,
  keepFrom: string,
  keepUntil: string,
  reason: string,
): TrimEntry | null {
  const tokens = seg.words.map((w) => norm(w.word));
  let startIdx = 0;
  let endIdx = seg.words.length - 1;

  const from = phraseTokens(keepFrom);
  if (from.length > 0) {
    const need = Math.min(3, from.length);
    let best = -1;
    let bestLen = 0;
    for (let i = 0; i < tokens.length; i++) {
      const len = forwardMatch(tokens, from, i);
      if (len >= need && len >= bestLen) {
        best = i;
        bestLen = len;
      }
    }
    if (best < 0) {
      console.warn(`⚠️ trim for segment ${seg.id}: keepFrom "${keepFrom}" not found, ignoring start trim`);
    } else {
      startIdx = best;
    }
  }

  const until = phraseTokens(keepUntil);
  if (until.length > 0) {
    const need = Math.min(3, until.length);
    let best = -1;
    let bestLen = 0;
    for (let j = 0; j < tokens.length; j++) {
      const len = backwardMatch(tokens, until, j);
      if (len >= need && len >= bestLen) {
        best = j;
        bestLen = len;
      }
    }
    if (best < 0) {
      console.warn(`⚠️ trim for segment ${seg.id}: keepUntil "${keepUntil}" not found, ignoring end trim`);
    } else {
      endIdx = best;
    }
  }

  if (startIdx > endIdx) return null;
  const entry: TrimEntry = { id: seg.id, reason };
  if (startIdx > 0) entry.startTime = seg.words[startIdx].start;
  if (endIdx < seg.words.length - 1) entry.endTime = seg.words[endIdx].end;
  return entry.startTime !== undefined || entry.endTime !== undefined ? entry : null;
}

const LEADING_FILLERS = new Set(['and', 'so', 'but', 'now', 'then', 'okay', 'ok', 'well', 'um', 'uh', 'like', 'yeah', 'or', 'because']);

/**
 * A stutter at the very start of a kept segment: "so so we...", "their co their co CEO".
 * Deliberately narrow. Wider versions of this check chopped normal sentences in testing.
 */
function detectLeadingStutter(seg: TranscriptSegment): TrimEntry | null {
  const t = seg.words.map((w) => norm(w.word));
  if (t.length < 3) return null;

  for (let i = 0; i <= 1; i++) {
    // "Why do do you" must not lose "Why", so a repeat at position 1 only counts
    // when the first word is a filler like "so", "and", "now".
    if (i === 1 && !LEADING_FILLERS.has(t[0])) continue;
    if (t[i] && t[i] === t[i + 1]) {
      let last = i + 1;
      while (last + 1 < t.length && t[last + 1] === t[i]) last++;
      if (last >= t.length - 1) return null;
      return {
        id: seg.id,
        startTime: seg.words[last].start,
        reason: `Stutter: "${seg.words[i].word}" repeated`,
      };
    }
  }

  for (const len of [3, 2]) {
    if (t.length > len * 2 && t.slice(0, len).join(' ') === t.slice(len, len * 2).join(' ')) {
      return {
        id: seg.id,
        startTime: seg.words[len].start,
        reason: `Stutter: "${seg.words.slice(0, len).map((w) => w.word).join(' ')}" repeated`,
      };
    }
  }
  return null;
}

/**
 * A kept segment that ends with the same words the next kept segment starts with:
 * "...a midweek listing." followed by "midweek listing that sold...". Cut the tail.
 */
function detectOverlaps(
  segments: TranscriptSegment[],
  keepIds: Set<number>,
  trimMap: Map<number, TrimEntry>,
): TrimEntry[] {
  const out: TrimEntry[] = [];
  const kept = segments.filter((s) => keepIds.has(s.id));

  for (let i = 0; i < kept.length - 1; i++) {
    const seg = kept[i];
    const next = kept[i + 1];
    if (trimMap.get(seg.id)?.endTime !== undefined) continue;

    // Compare the words that will actually play, after any start trims.
    const segStart = trimMap.get(seg.id)?.startTime;
    const nextStart = trimMap.get(next.id)?.startTime;
    const segWords = segStart === undefined ? seg.words : seg.words.filter((w) => w.start >= segStart - 0.01);
    const nextWords = nextStart === undefined ? next.words : next.words.filter((w) => w.start >= nextStart - 0.01);
    if (segWords.length < 2 || nextWords.length < 2) continue;

    // Two words minimum: a single shared word ("...for you. You can...") is normal speech.
    for (let len = 3; len >= 2; len--) {
      if (segWords.length <= len || nextWords.length < len) continue;
      const tail = segWords.slice(-len).map((w) => norm(w.word)).join(' ');
      const head = nextWords.slice(0, len).map((w) => norm(w.word)).join(' ');
      if (tail === head && tail.length > 1) {
        const cutIdx = segWords.length - len;
        out.push({
          id: seg.id,
          endTime: segWords[cutIdx - 1].end,
          reason: `Repeated at the start of the next line: "${segWords.slice(-len).map((w) => w.word).join(' ')}"`,
        });
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Keep ranges and cut points
// ---------------------------------------------------------------------------

/**
 * Merge kept segments into continuous ranges and place frame-aligned cut points.
 *
 * IN points use the END of the silence before the range (where speech resumes);
 * Deepgram word timestamps run ~100-150ms late, silence detection is ground truth.
 * OUT points use the last kept word + 50ms (silence-based OUT bled into cut material).
 *
 * A trimmed segment always starts or ends its own range. Without that, a trimmed
 * segment that directly follows another kept segment merged into it and the trim
 * was silently ignored.
 */
function buildKeepSegments(
  allSegments: TranscriptSegment[],
  keepIds: Set<number>,
  trimMap: Map<number, TrimEntry>,
  frameRate: number,
  silences: SilenceGap[],
): KeepSegment[] {
  const kept = allSegments
    .filter((s) => keepIds.has(s.id))
    .map((seg) => {
      const trim = trimMap.get(seg.id);
      const start = trim?.startTime ?? seg.start;
      const end = trim?.endTime ?? seg.end;
      const words = seg.words.filter((w) => w.start >= start - 0.01 && w.end <= end + 0.01);
      return {
        id: seg.id,
        start,
        end,
        text: words.map((w) => w.word).join(' ').trim() || seg.text,
        trimmedStart: trim?.startTime !== undefined,
        trimmedEnd: trim?.endTime !== undefined,
      };
    })
    .filter((k) => k.end > k.start)
    .sort((a, b) => a.start - b.start);
  if (kept.length === 0) return [];

  type Range = { start: number; end: number; texts: string[]; trimmedStart: boolean; trimmedEnd: boolean };
  const ranges: Range[] = [];
  let cur: Range = { ...kept[0], texts: [kept[0].text] };

  for (let i = 1; i < kept.length; i++) {
    const seg = kept[i];
    const removedBetween = allSegments.some(
      (s) => !keepIds.has(s.id) && s.start >= cur.end - 0.05 && s.end <= seg.start + 0.05,
    );
    const breakHere = removedBetween || seg.start - cur.end >= 2.0 || seg.trimmedStart || cur.trimmedEnd;
    if (breakHere) {
      ranges.push(cur);
      cur = { ...seg, texts: [seg.text] };
    } else {
      cur.end = seg.end;
      cur.trimmedEnd = seg.trimmedEnd;
      cur.texts.push(seg.text);
    }
  }
  ranges.push(cur);

  const allWords = allSegments.flatMap((s) => s.words);
  const results: KeepSegment[] = [];
  let recordTime = 0;

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const prevEnd = i === 0 ? 0 : ranges[i - 1].end;
    // Everything between the previous range and this one is cut material. The IN point
    // must not come before the end of its last word, or the cut words play again.
    const floor = allWords
      .filter((w) => w.start >= prevEnd - 0.01 && w.end <= range.start + 0.01)
      .reduce((max, w) => Math.max(max, w.end), prevEnd);

    let sourceIn: number;
    if (i === 0) {
      sourceIn = findSilenceEndingBefore(range.start, floor, silences)?.end ?? range.start;
    } else {
      // A trimmed start sits inside continuous speech, so only accept a silence that
      // ends right at the kept word; a looser match could clip the first word.
      const tolerance = range.trimmedStart ? 0.15 : 0.5;
      sourceIn = findSilenceBetween(prevEnd, range.start, floor, silences, tolerance)?.end ?? range.start;
    }

    sourceIn = alignToFrame(Math.max(0, sourceIn), frameRate);
    const sourceOut = alignToFrame(range.end + 0.05, frameRate);
    if (results.length > 0) {
      const prev = results[results.length - 1];
      if (sourceIn < prev.sourceOut) sourceIn = prev.sourceOut;
    }

    const duration = sourceOut - sourceIn;
    if (duration < 0.1) continue;

    results.push({
      id: results.length + 1,
      sourceIn,
      sourceInPremiere: sourceIn,
      sourceOut,
      recordIn: recordTime,
      recordOut: recordTime + duration,
      text: range.texts.join(' '),
    });
    recordTime += duration;
  }
  return results;
}

function findSilenceEndingBefore(time: number, floor: number, silences: SilenceGap[]): SilenceGap | undefined {
  let best: SilenceGap | undefined;
  for (const s of silences) {
    if (s.end <= time && s.end >= time - 2.0 && s.end >= floor - 0.02 && (!best || s.end > best.end)) best = s;
  }
  return best;
}

function findSilenceBetween(
  prevEnd: number,
  rangeStart: number,
  floor: number,
  silences: SilenceGap[],
  tolerance: number,
): SilenceGap | undefined {
  let best: SilenceGap | undefined;
  for (const s of silences) {
    if (s.start >= prevEnd - 0.5 && s.end >= floor - 0.02 && s.end <= rangeStart + tolerance) {
      if (!best || Math.abs(s.end - rangeStart) < Math.abs(best.end - rangeStart)) best = s;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// "What was cut" list for the UI
// ---------------------------------------------------------------------------

function buildRemovalDetails(
  segments: TranscriptSegment[],
  keepIds: Set<number>,
  trimMap: Map<number, TrimEntry>,
  reasonById: Map<number, string>,
): RemovalDetail[] {
  const details: RemovalDetail[] = [];

  // Consecutive removed segments become one entry.
  let group: TranscriptSegment[] = [];
  const flush = () => {
    if (group.length === 0) return;
    details.push({
      start: group[0].start,
      end: group[group.length - 1].end,
      text: group.map((s) => s.text).join(' '),
      reason: reasonById.get(group[0].id) || 'Removed',
    });
    group = [];
  };
  for (const seg of segments) {
    if (keepIds.has(seg.id)) flush();
    else group.push(seg);
  }
  flush();

  // Trimmed words at the start or end of kept segments.
  const segById = new Map(segments.map((s) => [s.id, s]));
  for (const trim of trimMap.values()) {
    const seg = segById.get(trim.id);
    if (!seg) continue;
    const addPart = (words: WordTiming[]) => {
      if (words.length === 0) return;
      details.push({
        start: words[0].start,
        end: words[words.length - 1].end,
        text: words.map((w) => w.word).join(' '),
        reason: trim.reason,
      });
    };
    if (trim.startTime !== undefined) addPart(seg.words.filter((w) => w.start < trim.startTime! - 0.01));
    if (trim.endTime !== undefined) addPart(seg.words.filter((w) => w.end > trim.endTime! + 0.01));
  }

  return details.sort((a, b) => a.start - b.start);
}
