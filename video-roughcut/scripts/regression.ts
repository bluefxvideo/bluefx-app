/**
 * Regression check: replay past, human-approved edits through the OLD engine (Dropbox CLI)
 * and the NEW worker engine with identical inputs, and diff the resulting cut points.
 *   FFMPEG_PATH=/opt/homebrew/bin/ffmpeg npx tsx scripts/regression.ts
 */
import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import { join, basename } from 'path';
import { buildEditDecision, type ModelDecisions } from '../src/analyze.js';
import { generateFCPXML } from '../src/generate-xml.js';
import { detectSilences } from '../src/transcribe.js';
import type { Transcript } from '../src/types.js';

const CLI = '/Users/gyorfiszilard/Dropbox/Calude Folder/video-roughcut/src';
const SCRATCH = process.env.SCRATCH || '/tmp';
const NEWS = '/Users/gyorfiszilard/Dropbox/00_Work In Progress/Social media videos/News Videos';
const CASES = [
  { name: 'Google 61%', dir: `${NEWS}/Google Just Lost 61 Percent Of Your Website Traffic - 2026-06-11`, base: 'Ecamm Recording on 2026-06-14 at 19.35.03', ext: '.mov' },
  { name: 'ChatGPT competitor', dir: `${NEWS}/ChatGPT Just Started Sending Buyers Straight To Your Competitor's Website`, base: 'raw-footage', ext: '.mp4' },
  { name: 'UGC tutorial', dir: '/Users/gyorfiszilard/Dropbox/00_Work In Progress/Social media videos/UGC Ad Clone 2', base: 'Ecamm Recording on 2026-09-15 at 12.07.42', ext: '.mov' },
];

type OldDecisions = { keep: number[]; trim?: { id: number; startTime?: number; endTime?: number; reason?: string }[]; remove?: { ids: number[]; reason: string }[] };

/** Old format (explicit keep list + timestamp trims) -> new format (remove list + quoted-word trims). */
function convert(t: Transcript, old: OldDecisions): ModelDecisions {
  const kept = new Set([...old.keep, ...(old.trim ?? []).map((x) => x.id)]);
  const reasonById = new Map<number, string>();
  for (const g of old.remove ?? []) for (const id of g.ids) reasonById.set(id, g.reason);
  const removed = t.segments.filter((s) => !kept.has(s.id)).map((s) => s.id);
  const remove = removed.map((id) => ({ ids: [id], reason: reasonById.get(id) || 'not in keep list' }));
  const trim = (old.trim ?? []).map((x) => {
    const seg = t.segments.find((s) => s.id === x.id)!;
    const from = x.startTime !== undefined ? seg.words.filter((w) => w.start >= x.startTime! - 0.05).slice(0, 4) : [];
    const until = x.endTime !== undefined ? seg.words.filter((w) => w.end <= x.endTime! + 0.05).slice(-4) : [];
    return { id: x.id, keepFrom: from.map((w) => w.word).join(' '), keepUntil: until.map((w) => w.word).join(' '), reason: x.reason || '' };
  });
  return { remove, trim };
}

function clips(xml: string): { inF: number; outF: number }[] {
  const out: { inF: number; outF: number }[] = [];
  const re = /<clipitem id="clipitem-v[^"]*">[\s\S]*?<in>(\d+)<\/in>\s*<out>(\d+)<\/out>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push({ inF: +m[1], outF: +m[2] });
  return out;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;

for (const c of CASES) {
  const video = join(c.dir, c.base + c.ext);
  const transcript: Transcript = JSON.parse(await readFile(join(c.dir, `${c.base}_transcription.json`), 'utf-8'));
  const decisionsPath = join(c.dir, `${c.base}_decisions.json`);
  const old: OldDecisions = JSON.parse(await readFile(decisionsPath, 'utf-8'));

  // Production-like audio: 16 kHz mono 64 kbps MP3, same as the browser extraction.
  const mp3 = join(SCRATCH, `${basename(c.base)}-regression.mp3`);
  execSync(`/opt/homebrew/bin/ffmpeg -y -v error -i "${video}" -vn -ac 1 -ar 16000 -b:a 64k "${mp3}"`);
  const silences = await detectSilences(mp3);
  const probe = JSON.parse(execSync(`/opt/homebrew/bin/ffprobe -v error -select_streams v:0 -show_entries stream=width,height:format=duration -of json "${video}"`).toString());
  const meta = { fileName: basename(video), duration: +probe.format.duration, frameRate: 30, width: probe.streams[0].width, height: probe.streams[0].height };

  // OLD engine
  const oldAnalyze = await import(`${CLI}/analyze.ts`);
  const oldXmlGen = await import(`${CLI}/generate-xml.ts`);
  const edOld = await oldAnalyze.analyzeTranscript(transcript, null, 30, 0.3, 'unused', decisionsPath, silences);
  const xmlOld: string = oldXmlGen.generateFCPXML({ ...meta, filePath: video, videoCodec: '', audioCodec: '' }, edOld);

  // NEW engine
  const edNew = buildEditDecision(transcript, convert(transcript, old), 29.97, silences);
  const xmlNew = generateFCPXML(meta, edNew);
  await writeFile(join(SCRATCH, `${basename(c.base)}-new.xml`), xmlNew);

  const a = clips(xmlOld), b = clips(xmlNew);
  const near = (x: { inF: number; outF: number }, list: typeof a) => list.some((y) => Math.abs(y.inF - x.inF) <= 2 && Math.abs(y.outF - x.outF) <= 2);
  const onlyOld = a.filter((x) => !near(x, b));
  const onlyNew = b.filter((x) => !near(x, a));
  const durOld = a.reduce((s, x) => s + x.outF - x.inF, 0) / 29.97;
  const durNew = b.reduce((s, x) => s + x.outF - x.inF, 0) / 29.97;
  console.log(`\n=== ${c.name} ===  silences: ${silences.length}`);
  console.log(`clips old ${a.length} / new ${b.length}   output old ${fmt(durOld)} / new ${fmt(durNew)}   same cut points (±2 frames): ${a.length - onlyOld.length}`);
  const words = (from: number, to: number) => transcript.words.filter((w) => w.end > from && w.start < to).map((w) => w.word).join(' ');
  for (const x of onlyOld) console.log(`  OLD only ${fmt(x.inF / 29.97)}-${fmt(x.outF / 29.97)}  "${words(x.inF / 29.97, x.inF / 29.97 + 2).slice(0, 70)}" … "${words(x.outF / 29.97 - 2, x.outF / 29.97).slice(-60)}"`);
  for (const x of onlyNew) console.log(`  NEW only ${fmt(x.inF / 29.97)}-${fmt(x.outF / 29.97)}  "${words(x.inF / 29.97, x.inF / 29.97 + 2).slice(0, 70)}" … "${words(x.outF / 29.97 - 2, x.outF / 29.97).slice(-60)}"`);
}
