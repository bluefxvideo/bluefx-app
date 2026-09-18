/**
 * Score model-bakeoff results.json.
 *   npx tsx scripts/bakeoff-score.ts "<OUT_DIR>/results.json" [--details]
 *
 * Disagreements with the approved edit are sorted by kind:
 *   lost content   the model cut 3+ words that aren't repeated in a kept segment nearby
 *   retake         the model cut something that IS repeated nearby (fine, maybe a miss in the approved edit)
 *   filler         1-2 word segments ("Okay.", "So")
 *   left twice     the model kept a line that is also kept nearby (the viewer hears it twice)
 */
import { readFile } from 'fs/promises';

type Item = { id: number; text: string; words: number; reason?: string; repeatScore: number; repeatedBy?: number; seconds: number };
type Row = {
  model: string; case: string; ok: boolean; error?: string; seconds?: number;
  usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number };
  overCut?: Item[]; missed?: Item[]; outputSeconds?: number; sourceSeconds?: number;
};

const [file, flag] = process.argv.slice(2);
const rows: Row[] = JSON.parse(await readFile(file, 'utf-8'));
const details = flag === '--details';
const models = [...new Set(rows.map((r) => r.model))];

console.log('model                           ok  lost  lostSec  retakes  fillerCut | leftTwice  fillerKept | $/video  s/video');
for (const m of models) {
  const rs = rows.filter((r) => r.model === m);
  const ok = rs.filter((r) => r.ok);
  const over = ok.flatMap((r) => r.overCut ?? []);
  const miss = ok.flatMap((r) => r.missed ?? []);
  const lost = over.filter((x) => x.words >= 3 && x.repeatScore < 0.6);
  const retakes = over.filter((x) => x.words >= 3 && x.repeatScore >= 0.6);
  const fillerCut = over.filter((x) => x.words < 3);
  const leftTwice = miss.filter((x) => x.words >= 3 && x.repeatScore >= 0.6);
  const fillerKept = miss.filter((x) => x.words < 3);
  const cost = ok.reduce((s, r) => s + (r.usage?.cost ?? 0), 0) / Math.max(1, ok.length);
  const secs = ok.reduce((s, r) => s + (r.seconds ?? 0), 0) / Math.max(1, ok.length);
  console.log(
    `${m.padEnd(32)}${`${ok.length}/${rs.length}`.padEnd(4)}${String(lost.length).padStart(5)}${lost.reduce((s, x) => s + x.seconds, 0).toFixed(0).padStart(9)}` +
      `${String(retakes.length).padStart(9)}${String(fillerCut.length).padStart(11)} |${String(leftTwice.length).padStart(10)}${String(fillerKept.length).padStart(12)} |` +
      `${cost.toFixed(3).padStart(8)}${secs.toFixed(0).padStart(9)}`,
  );
  for (const r of rs.filter((x) => !x.ok)) console.log(`   ❌ ${r.case}: ${r.error?.slice(0, 160)}`);
  if (details) {
    for (const r of ok) {
      const l = (r.overCut ?? []).filter((x) => x.words >= 3 && x.repeatScore < 0.6);
      const t = (r.missed ?? []).filter((x) => x.words >= 3 && x.repeatScore >= 0.6);
      for (const x of l) console.log(`   LOST   ${r.case} [${x.id}] "${x.text}"  (reason: ${x.reason ?? '-'}; best repeat ${x.repeatScore} in [${x.repeatedBy ?? '-'}])`);
      for (const x of t) console.log(`   TWICE  ${r.case} [${x.id}] "${x.text}"  (also in [${x.repeatedBy}], ${x.repeatScore})`);
    }
  }
}
