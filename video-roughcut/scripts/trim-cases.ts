/**
 * Unit checks for quoted-word trim resolution and the stutter / overlap safety nets.
 *   npx tsx scripts/trim-cases.ts
 */
import { buildEditDecision } from '../src/analyze.js';
import type { Transcript, TranscriptSegment } from '../src/types.js';

function seg(id: number, text: string, start: number): TranscriptSegment {
  const words = text.split(' ').map((w, i) => ({ word: w, start: start + i * 0.3, end: start + i * 0.3 + 0.25 }));
  return { id, text, start, end: words[words.length - 1].end, words };
}

let failures = 0;
function check(
  name: string,
  segs: TranscriptSegment[],
  trim: { id: number; keepFrom: string; keepUntil: string }[],
  remove: number[],
  expected: string[],
) {
  const t: Transcript = {
    fullText: '',
    segments: segs,
    words: segs.flatMap((s) => s.words),
    duration: segs[segs.length - 1].end + 1,
    language: 'en',
  };
  const ed = buildEditDecision(
    t,
    {
      remove: remove.length ? [{ ids: remove, reason: 'test' }] : [],
      trim: trim.map((x) => ({ ...x, reason: 'test' })),
    },
    29.97,
    [],
  );
  const kept = ed.segments.map((k) =>
    t.words
      .filter((w) => w.start >= k.sourceIn - 0.02 && w.end <= k.sourceOut + 0.02)
      .map((w) => w.word)
      .join(' '),
  );
  const ok = JSON.stringify(kept) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${name.padEnd(36)} ${kept.map((k) => `[${k}]`).join(' ')}`);
  if (!ok) console.log(`   expected ${expected.map((k) => `[${k}]`).join(' ')}`);
}

check(
  'keepFrom picks the last clean repeat',
  [seg(8, 'This is one of the most trusted voice this is one of the most trusted voices in SEO.', 10)],
  [{ id: 8, keepFrom: 'one of the most trusted voices in SEO.', keepUntil: '' }],
  [],
  ['one of the most trusted voices in SEO.'],
);
check(
  'keepFrom, short quote',
  [seg(1, 'their co, their co CEO said hello.', 10)],
  [{ id: 1, keepFrom: 'their co CEO said', keepUntil: '' }],
  [],
  ['their co CEO said hello.'],
);
check(
  'keepUntil drops a restart at the end',
  [seg(2, 'the best tool in the world. The best', 10)],
  [{ id: 2, keepFrom: '', keepUntil: 'best tool in the world.' }],
  [],
  ['the best tool in the world.'],
);
check(
  'quote not found leaves segment whole',
  [seg(3, 'we rebuild your website today.', 10)],
  [{ id: 3, keepFrom: 'totally different words here', keepUntil: '' }],
  [],
  ['we rebuild your website today.'],
);
check(
  'remove beats trim on the same segment',
  [seg(4, 'keep me please.', 10), seg(5, 'so so remove me.', 12)],
  [{ id: 5, keepFrom: 'remove me.', keepUntil: '' }],
  [5],
  ['keep me please.'],
);
check('auto: "so so we start"', [seg(6, 'so so we start here.', 10)], [], [], ['so we start here.']);
check(
  'auto: "Why do do you" untouched',
  [seg(7, 'Why do do you need so many answers?', 10)],
  [],
  [],
  ['Why do do you need so many answers?'],
);
check('auto: "And I I showed"', [seg(8, 'And I I showed the book.', 10)], [], [], ['I showed the book.']);
check(
  'overlap of one word is ignored',
  [seg(9, 'a demo here for you.', 10), seg(10, 'You can add the person.', 11.6)],
  [],
  [],
  ['a demo here for you. You can add the person.'],
);
check(
  'overlap of two words is cut',
  [seg(11, 'we sold a midweek listing.', 10), seg(12, 'midweek listing that sold fast.', 12)],
  [],
  [],
  ['we sold a', 'midweek listing that sold fast.'],
);
check(
  'trimmed start splits a merged range',
  [seg(13, 'First line is clean.', 10), seg(14, 'the the second line.', 11.3)],
  [],
  [],
  ['First line is clean.', 'the second line.'],
);

// Deepgram sometimes stretches the last word before a restart across the next words.
// The cut must still land before "to to put" starts.
{
  const words = [
    { word: 'a', start: 10.0, end: 10.1 },
    { word: 'video', start: 10.1, end: 10.4 },
    { word: 'like', start: 10.4, end: 10.6 },
    { word: 'this', start: 10.6, end: 12.1 },
    { word: 'to', start: 11.0, end: 11.3 },
    { word: 'to', start: 11.3, end: 11.6 },
    { word: 'put', start: 11.6, end: 11.9 },
  ];
  const s: TranscriptSegment = { id: 1, text: words.map((w) => w.word).join(' '), start: 10, end: 12.1, words };
  const t: Transcript = { fullText: '', segments: [s], words, duration: 14, language: 'en' };
  const ed = buildEditDecision(t, { remove: [], trim: [{ id: 1, keepFrom: '', keepUntil: 'a video like this', reason: 'test' }] }, 29.97, []);
  const out = ed.segments[0]?.sourceOut ?? 0;
  const ok = out > 10.6 && out <= 11.0 + 1 / 29.97;
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${'stretched word ends before next'.padEnd(36)} OUT at ${out.toFixed(3)}s (next word starts 11.000s)`);
}

console.log(failures === 0 ? '\nAll trim checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
