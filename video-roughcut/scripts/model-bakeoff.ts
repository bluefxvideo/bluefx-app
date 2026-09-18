/**
 * Model bake-off through fal's OpenRouter proxy: every candidate gets the production prompt
 * and transcript format, and its cuts are compared with edits that were approved by hand.
 *
 *   FAL_KEY=... FFMPEG_PATH=/opt/homebrew/bin/ffmpeg OUT_DIR=... npx tsx scripts/model-bakeoff.ts
 *
 * Writes results.json (every disagreement, with text and the model's reason) and one XML per
 * model and video into OUT_DIR, so the best candidates can be compared by ear in Premiere.
 */
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { execSync } from 'child_process';
import { join, basename } from 'path';
import {
  SYSTEM_PROMPT,
  formatTranscriptForLLM,
  DecisionsSchema,
  buildEditDecision,
  type ModelDecisions,
} from '../src/analyze.js';
import { generateFCPXML } from '../src/generate-xml.js';
import { detectSilences } from '../src/transcribe.js';
import type { Transcript, TranscriptSegment } from '../src/types.js';

const FAL_URL = 'https://fal.run/openrouter/router/openai/v1/chat/completions';
const OUT = process.env.OUT_DIR || '/tmp/roughcut-bakeoff';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

const DEFAULT_MODELS = [
  'anthropic/claude-fable-5.1',
  'anthropic/claude-opus-5',
  'anthropic/claude-sonnet-5',
  'google/gemini-3.1-pro-preview',
  'google/gemini-3.8-flash',
  'deepseek/deepseek-v4-pro-0813',
  'deepseek/deepseek-v4.1-flash',
];
const MODELS = process.env.MODELS ? process.env.MODELS.split(',') : DEFAULT_MODELS;
const RESULTS_FILE = process.env.RESULTS_FILE || 'results.json';
/** Stream so slow thinkers keep the connection alive (non-streamed calls hit fetch's 5-minute header timeout). */
const STREAM = process.env.STREAM === '1';
/** Reasoning effort for every model in this run. Non-default efforts are labelled model@effort. */
const EFFORT = process.env.EFFORT || 'high';
const label = (model: string) => (EFFORT === 'high' ? model : `${model}@${EFFORT}`);

const NEWS = '/Users/gyorfiszilard/Dropbox/00_Work In Progress/Social media videos/News Videos';
const CASES = [
  { name: 'Google 61%', dir: `${NEWS}/Google Just Lost 61 Percent Of Your Website Traffic - 2026-06-11`, base: 'Ecamm Recording on 2026-06-14 at 19.35.03', ext: '.mov' },
  { name: 'ChatGPT competitor', dir: `${NEWS}/ChatGPT Just Started Sending Buyers Straight To Your Competitor's Website`, base: 'raw-footage', ext: '.mp4' },
  { name: 'HubSpot 70%', dir: `${NEWS}/HubSpot Just Lost 70 Percent Of Their Google Traffic - 2026-06-11`, base: 'Ecamm Recording on 2026-06-14 at 20.06.13', ext: '.mov' },
];

/** Same shape as DecisionsSchema, written out for strict structured output. */
const JSON_SCHEMA = {
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

type Usage = { prompt_tokens?: number; completion_tokens?: number; cost?: number; completion_tokens_details?: { reasoning_tokens?: number } };

async function callModel(model: string, transcript: Transcript): Promise<{ decisions: ModelDecisions; usage: Usage; seconds: number }> {
  const started = Date.now();
  const res = await fetch(FAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${process.env.FAL_KEY}` },
    body: JSON.stringify({
      model,
      max_tokens: 32000,
      reasoning: { effort: EFFORT },
      response_format: { type: 'json_schema', json_schema: { name: 'roughcut_decisions', strict: true, schema: JSON_SCHEMA } },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: formatTranscriptForLLM(transcript) },
      ],
      ...(STREAM ? { stream: true } : {}),
    }),
  });
  let content = '';
  let usageOut: Usage = {};
  if (!STREAM) {
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    const body = JSON.parse(text);
    content = body.choices?.[0]?.message?.content ?? '';
    usageOut = body.usage ?? {};
  } else {
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let evt: any;
        try { evt = JSON.parse(data); } catch { continue; }
        if (evt.error) throw new Error(`Stream error: ${JSON.stringify(evt.error).slice(0, 300)}`);
        content += evt.choices?.[0]?.delta?.content ?? '';
        if (evt.usage) usageOut = evt.usage;
      }
    }
  }
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`No JSON in response: ${content.slice(0, 200)}`);
  const parsed = DecisionsSchema.safeParse(JSON.parse(content.slice(start, end + 1)));
  if (!parsed.success) throw new Error(`Schema mismatch: ${parsed.error.message.slice(0, 300)}`);
  return { decisions: parsed.data, usage: usageOut, seconds: (Date.now() - started) / 1000 };
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const words = (s: TranscriptSegment) => s.text.split(/\s+/).map(norm).filter(Boolean);

/** Share of `a`'s words that also appear in `b`. High means `a` is probably a take of the same line. */
function containment(a: string[], b: string[]): number {
  if (a.length === 0) return 0;
  const bag = new Map<string, number>();
  for (const w of b) bag.set(w, (bag.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of a) {
    const n = bag.get(w) ?? 0;
    if (n > 0) { hit++; bag.set(w, n - 1); }
  }
  return hit / a.length;
}

/** Is this segment's content said again in a kept segment nearby? Then cutting it loses nothing. */
function repeatedNearby(seg: TranscriptSegment, all: TranscriptSegment[], kept: Set<number>): { score: number; by?: number } {
  const a = words(seg);
  let best = { score: 0, by: undefined as number | undefined };
  for (const other of all) {
    if (other.id === seg.id || !kept.has(other.id) || Math.abs(other.id - seg.id) > 12) continue;
    const score = containment(a, words(other));
    if (score > best.score) best = { score, by: other.id };
  }
  return best;
}

async function pool<T>(items: (() => Promise<T>)[], size: number): Promise<T[]> {
  const out: T[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await items[i]();
    }
  }));
  return out;
}

await mkdir(OUT, { recursive: true });

const prepared = await Promise.all(CASES.map(async (c) => {
  const video = join(c.dir, c.base + c.ext);
  const transcript: Transcript = JSON.parse(await readFile(join(c.dir, `${c.base}_transcription.json`), 'utf-8'));
  const approved = JSON.parse(await readFile(join(c.dir, `${c.base}_decisions.json`), 'utf-8'));
  const approvedKept = new Set<number>([...approved.keep, ...(approved.trim ?? []).map((t: { id: number }) => t.id)]);
  const mp3 = join(OUT, `${basename(c.base)}.mp3`);
  try { await access(mp3); } catch { execSync(`${FFMPEG} -y -v error -i "${video}" -vn -ac 1 -ar 16000 -b:a 64k "${mp3}"`); }
  const silences = await detectSilences(mp3);
  const probe = JSON.parse(execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height:format=duration -of json "${video}"`).toString());
  return { ...c, video, transcript, approvedKept, silences, probe };
}));

const jobs = MODELS.flatMap((model) => prepared.map((c) => async () => {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const { decisions, usage, seconds } = await callModel(model, c.transcript);
      const segs = c.transcript.segments;
      const removed = new Set(decisions.remove.flatMap((g) => g.ids));
      const modelKept = new Set(segs.filter((s) => !removed.has(s.id)).map((s) => s.id));
      const reasonById = new Map<number, string>();
      for (const g of decisions.remove) for (const id of g.ids) reasonById.set(id, g.reason);

      const overCut = segs.filter((s) => removed.has(s.id) && c.approvedKept.has(s.id)).map((s) => {
        const rep = repeatedNearby(s, segs, modelKept);
        return { id: s.id, text: s.text, words: words(s).length, reason: reasonById.get(s.id), repeatScore: +rep.score.toFixed(2), repeatedBy: rep.by, seconds: +(s.end - s.start).toFixed(1) };
      });
      const missed = segs.filter((s) => !removed.has(s.id) && !c.approvedKept.has(s.id)).map((s) => {
        const rep = repeatedNearby(s, segs, c.approvedKept);
        return { id: s.id, text: s.text, words: words(s).length, repeatScore: +rep.score.toFixed(2), repeatedBy: rep.by, seconds: +(s.end - s.start).toFixed(1) };
      });

      const ed = buildEditDecision(c.transcript, decisions, 29.97, c.silences);
      const xml = generateFCPXML(
        { fileName: basename(c.video), duration: +c.probe.format.duration, frameRate: 30, width: c.probe.streams[0].width, height: c.probe.streams[0].height },
        ed,
      );
      await writeFile(join(OUT, `${c.name.replace(/[^a-z0-9]+/gi, '-')} - ${label(model).split('/')[1]}.xml`), xml);

      console.log(`✅ ${label(model).padEnd(38)} ${c.name.padEnd(20)} ${seconds.toFixed(0).padStart(4)}s  $${(usage.cost ?? 0).toFixed(4)}  removed ${removed.size}  over-cut ${overCut.length}  missed ${missed.length}`);
      return { model: label(model), case: c.name, ok: true, seconds, usage, decisions, overCut, missed, outputSeconds: ed.totalOutputDuration, sourceSeconds: c.transcript.duration };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt < 2) { console.log(`↻ ${model} ${c.name}: ${message.slice(0, 120)} (retrying)`); continue; }
      console.log(`❌ ${label(model).padEnd(38)} ${c.name.padEnd(20)} ${message.slice(0, 200)}`);
      return { model: label(model), case: c.name, ok: false, error: message };
    }
  }
}));

const results = await pool(jobs, 7);
await writeFile(join(OUT, RESULTS_FILE), JSON.stringify(results, null, 2));
console.log(`\nWrote ${join(OUT, RESULTS_FILE)}`);
