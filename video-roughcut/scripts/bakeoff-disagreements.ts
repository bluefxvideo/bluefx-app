/**
 * Show every segment where bake-off models disagree, so the calls can be judged by reading.
 *   npx tsx scripts/bakeoff-disagreements.ts <results.json> [more-results.json ...]
 * Codes per model: R = removed, T = kept with a trim, . = kept whole.
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Transcript } from '../src/types.js';

const NEWS = '/Users/gyorfiszilard/Dropbox/00_Work In Progress/Social media videos/News Videos';
const CASES: Record<string, string> = {
  'Google 61%': `${NEWS}/Google Just Lost 61 Percent Of Your Website Traffic - 2026-06-11/Ecamm Recording on 2026-06-14 at 19.35.03`,
  'ChatGPT competitor': `${NEWS}/ChatGPT Just Started Sending Buyers Straight To Your Competitor's Website/raw-footage`,
  'HubSpot 70%': `${NEWS}/HubSpot Just Lost 70 Percent Of Their Google Traffic - 2026-06-11/Ecamm Recording on 2026-06-14 at 20.06.13`,
};
const SHORT: Record<string, string> = {
  'anthropic/claude-fable-5.1': 'fable',
  'anthropic/claude-opus-5': 'opus',
  'anthropic/claude-sonnet-5': 'sonnet',
  'google/gemini-3.1-pro-preview': 'gemPro',
  'google/gemini-3.8-flash': 'gemFlash',
  'deepseek/deepseek-v4-pro-0813': 'dsPro',
  'deepseek/deepseek-v4.1-flash': 'dsFlash',
};

type Row = { model: string; case: string; ok: boolean; decisions?: { remove: { ids: number[] }[]; trim: { id: number; keepFrom: string; keepUntil: string }[] } };
const rows: Row[] = [];
for (const f of process.argv.slice(2)) rows.push(...JSON.parse(await readFile(f, 'utf-8')));
const models = [...new Set(rows.filter((r) => r.ok).map((r) => r.model))];

for (const [caseName, base] of Object.entries(CASES)) {
  const t: Transcript = JSON.parse(await readFile(`${base}_transcription.json`, 'utf-8'));
  const approved = JSON.parse(await readFile(`${base}_decisions.json`, 'utf-8'));
  const approvedKept = new Set<number>([...approved.keep, ...(approved.trim ?? []).map((x: { id: number }) => x.id)]);
  const code = new Map<string, Map<number, string>>();
  for (const m of models) {
    const r = rows.find((x) => x.ok && x.model === m && x.case === caseName);
    const map = new Map<number, string>();
    const removed = new Set(r?.decisions?.remove.flatMap((g) => g.ids) ?? []);
    const trims = new Map((r?.decisions?.trim ?? []).map((x) => [x.id, x]));
    for (const s of t.segments) {
      const tr = trims.get(s.id);
      map.set(s.id, removed.has(s.id) ? 'R' : tr && (tr.keepFrom || tr.keepUntil) ? 'T' : '.');
    }
    code.set(m, map);
  }
  console.log(`\n=== ${caseName} ===   columns: ${models.map((m) => SHORT[m] ?? m).join(' ')}   | mine`);
  for (const s of t.segments) {
    const codes = models.map((m) => code.get(m)!.get(s.id)!);
    const removals = codes.filter((c) => c === 'R').length;
    if (removals === 0 || removals === codes.length) continue; // everyone agrees on cut vs keep
    const mine = approvedKept.has(s.id) ? '.' : 'R';
    const trimsOf = models
      .map((m) => {
        const r = rows.find((x) => x.ok && x.model === m && x.case === caseName);
        const tr = r?.decisions?.trim.find((x) => x.id === s.id);
        return tr && (tr.keepFrom || tr.keepUntil) ? `${SHORT[m]}: from "${tr.keepFrom}" until "${tr.keepUntil}"` : '';
      })
      .filter(Boolean);
    console.log(`[${s.id}] ${codes.join('      ')}   | ${mine}   "${s.text.slice(0, 150)}"`);
    for (const tr of trimsOf) console.log(`        trim ${tr}`);
  }
}
