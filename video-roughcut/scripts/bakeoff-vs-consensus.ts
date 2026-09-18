/**
 * Compare faster configurations against what the best high-effort models agreed on.
 *   npx tsx scripts/bakeoff-vs-consensus.ts <high results.json> <other results.json> [...]
 *
 * Consensus per segment = cut if a majority of the reference models cut it.
 * For every other configuration: average time and cost, and each segment where it
 * disagrees with the consensus, with the text, so the difference can be judged.
 */
import { readFile } from 'fs/promises';
import type { Transcript } from '../src/types.js';

const REFERENCE = ['anthropic/claude-fable-5.1', 'anthropic/claude-opus-5', 'google/gemini-3.1-pro-preview', 'google/gemini-3.8-flash'];
const NEWS = '/Users/gyorfiszilard/Dropbox/00_Work In Progress/Social media videos/News Videos';
const CASES: Record<string, string> = {
  'Google 61%': `${NEWS}/Google Just Lost 61 Percent Of Your Website Traffic - 2026-06-11/Ecamm Recording on 2026-06-14 at 19.35.03`,
  'ChatGPT competitor': `${NEWS}/ChatGPT Just Started Sending Buyers Straight To Your Competitor's Website/raw-footage`,
  'HubSpot 70%': `${NEWS}/HubSpot Just Lost 70 Percent Of Their Google Traffic - 2026-06-11/Ecamm Recording on 2026-06-14 at 20.06.13`,
};

type Row = {
  model: string; case: string; ok: boolean; seconds?: number; error?: string;
  usage?: { cost?: number };
  decisions?: { remove: { ids: number[] }[]; trim: { id: number; keepFrom: string; keepUntil: string }[] };
};

const [highFile, ...others] = process.argv.slice(2);
const high: Row[] = JSON.parse(await readFile(highFile, 'utf-8'));
const rows: Row[] = [...high];
for (const f of others) rows.push(...JSON.parse(await readFile(f, 'utf-8')));

const transcripts = new Map<string, Transcript>();
for (const [c, base] of Object.entries(CASES)) transcripts.set(c, JSON.parse(await readFile(`${base}_transcription.json`, 'utf-8')));

const removedSet = (r?: Row) => new Set(r?.decisions?.remove.flatMap((g) => g.ids) ?? []);
const consensus = new Map<string, Set<number>>();
for (const c of Object.keys(CASES)) {
  const refs = REFERENCE.map((m) => high.find((r) => r.ok && r.model === m && r.case === c)).filter(Boolean) as Row[];
  const votes = new Map<number, number>();
  for (const r of refs) for (const id of removedSet(r)) votes.set(id, (votes.get(id) ?? 0) + 1);
  consensus.set(c, new Set([...votes].filter(([, v]) => v > refs.length / 2).map(([id]) => id)));
}

const configs = [...new Set(rows.map((r) => r.model))];
console.log('config                                   ok   s/video  $/video  differs-from-consensus');
for (const m of configs) {
  const rs = rows.filter((r) => r.model === m);
  const ok = rs.filter((r) => r.ok);
  const secs = ok.reduce((s, r) => s + (r.seconds ?? 0), 0) / Math.max(1, ok.length);
  const cost = ok.reduce((s, r) => s + (r.usage?.cost ?? 0), 0) / Math.max(1, ok.length);
  let diffs = 0;
  const lines: string[] = [];
  for (const r of ok) {
    const t = transcripts.get(r.case)!;
    const cons = consensus.get(r.case)!;
    const mine = removedSet(r);
    for (const s of t.segments) {
      const a = mine.has(s.id), b = cons.has(s.id);
      if (a === b) continue;
      diffs++;
      lines.push(`      ${a ? 'CUT ' : 'KEPT'} ${r.case} [${s.id}] "${s.text.slice(0, 110)}"`);
    }
  }
  console.log(`${m.padEnd(40)} ${`${ok.length}/${rs.length}`.padEnd(5)}${secs.toFixed(0).padStart(7)}${cost.toFixed(3).padStart(9)}  ${diffs}`);
  for (const r of rs.filter((x) => !x.ok)) console.log(`      ❌ ${r.case}: ${r.error?.slice(0, 140)}`);
  if (!REFERENCE.includes(m)) for (const l of lines) console.log(l);
}
