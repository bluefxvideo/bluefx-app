/**
 * Model check: run the production decision step (fal, Fable 5.1 at low effort) on past videos
 * and compare it with the edit that was approved by hand. Spends real money, about $0.20 per video.
 *
 *   FAL_KEY=... FFMPEG_PATH=/opt/homebrew/bin/ffmpeg npx tsx scripts/model-check.ts [google|chatgpt|hubspot]
 *   ROUGHCUT_MODEL=anthropic/claude-opus-5 ROUGHCUT_EFFORT=medium ... npx tsx scripts/model-check.ts
 *
 * Writes each XML next to this script's output folder so it can be imported into Premiere.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import { join, basename } from 'path';
import { getModelDecisions, buildEditDecision } from '../src/analyze.js';
import { generateFCPXML } from '../src/generate-xml.js';
import { detectSilences } from '../src/transcribe.js';
import type { Transcript } from '../src/types.js';

const NEWS = '/Users/gyorfiszilard/Dropbox/00_Work In Progress/Social media videos/News Videos';
const CASES = [
  { name: 'Google 61%', dir: `${NEWS}/Google Just Lost 61 Percent Of Your Website Traffic - 2026-06-11`, base: 'Ecamm Recording on 2026-06-14 at 19.35.03', ext: '.mov' },
  { name: 'ChatGPT competitor', dir: `${NEWS}/ChatGPT Just Started Sending Buyers Straight To Your Competitor's Website`, base: 'raw-footage', ext: '.mp4' },
  { name: 'HubSpot 70%', dir: `${NEWS}/HubSpot Just Lost 70 Percent Of Their Google Traffic - 2026-06-11`, base: 'Ecamm Recording on 2026-06-14 at 20.06.13', ext: '.mov' },
];
const OUT = process.env.OUT_DIR || '/tmp/roughcut-model-check';
const only = process.argv[2];

type Approved = { keep: number[]; trim?: { id: number }[] };
const dur = (t: Transcript, ids: Iterable<number>) =>
  [...ids].reduce((sum, id) => {
    const s = t.segments.find((x) => x.id === id);
    return sum + (s ? s.end - s.start : 0);
  }, 0);

await mkdir(OUT, { recursive: true });
for (const c of CASES.filter((x) => !only || x.name.toLowerCase().includes(only.toLowerCase()))) {
  const video = join(c.dir, c.base + c.ext);
  const transcript: Transcript = JSON.parse(await readFile(join(c.dir, `${c.base}_transcription.json`), 'utf-8'));
  const approved: Approved = JSON.parse(await readFile(join(c.dir, `${c.base}_decisions.json`), 'utf-8'));
  const approvedKept = new Set([...approved.keep, ...(approved.trim ?? []).map((x) => x.id)]);
  const approvedRemoved = new Set(transcript.segments.filter((s) => !approvedKept.has(s.id)).map((s) => s.id));

  const decisions = await getModelDecisions(transcript);
  const modelRemoved = new Set(decisions.remove.flatMap((g) => g.ids));

  const both = [...modelRemoved].filter((id) => approvedRemoved.has(id));
  const overCut = [...modelRemoved].filter((id) => !approvedRemoved.has(id));
  const missed = [...approvedRemoved].filter((id) => !modelRemoved.has(id));

  console.log(`\n=== ${c.name} (${process.env.ROUGHCUT_MODEL || 'anthropic/claude-fable-5.1'}) ===`);
  console.log(`agreed cuts: ${both.length} segments, ${dur(transcript, both).toFixed(0)}s`);
  console.log(`model cut, approved kept (possible lost content): ${overCut.length} segments, ${dur(transcript, overCut).toFixed(0)}s`);
  for (const id of overCut) console.log(`   [${id}] ${transcript.segments.find((s) => s.id === id)?.text}`);
  console.log(`approved cut, model kept (missed retakes): ${missed.length} segments, ${dur(transcript, missed).toFixed(0)}s`);
  console.log(`model trims: ${decisions.trim.length}`);

  const mp3 = join(OUT, `${basename(c.base)}.mp3`);
  execSync(`${process.env.FFMPEG_PATH || 'ffmpeg'} -y -v error -i "${video}" -vn -ac 1 -ar 16000 -b:a 64k "${mp3}"`);
  const silences = await detectSilences(mp3);
  const ed = buildEditDecision(transcript, decisions, 29.97, silences);
  const probe = JSON.parse(execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height:format=duration -of json "${video}"`).toString());
  const xml = generateFCPXML(
    { fileName: basename(video), duration: +probe.format.duration, frameRate: 30, width: probe.streams[0].width, height: probe.streams[0].height },
    ed,
  );
  const xmlPath = join(OUT, `${c.name.replace(/[^a-z0-9]+/gi, '-')} - model Roughcut.xml`);
  await writeFile(xmlPath, xml);
  console.log(`output ${(ed.totalOutputDuration / 60).toFixed(1)} min of ${(transcript.duration / 60).toFixed(1)} min → ${xmlPath}`);
}
