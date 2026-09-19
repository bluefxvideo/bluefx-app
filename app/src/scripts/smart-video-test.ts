/**
 * Smart Video end-to-end test: a folder of client files + a brief → finished MP4.
 *
 * Run from app/:  npx tsx src/scripts/smart-video-test.ts <job-name> <files-folder | zillow/amazon link> <brief.txt>
 *                  With a link, the brief file is the client's own note (offer, contact) added to the scraped facts.
 * Output:         remotion/out/smart-<job-name>.mp4 (+ the plan in remotion/test-plans/)
 */
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSmartVideo } from '../lib/smart-video/pipeline';
import { prepareAssets } from '../lib/smart-video/prepare-assets';
import { fromLink } from '../lib/smart-video/sources';
import type { SmartAsset } from '../lib/smart-video/types';

config({ path: path.resolve(__dirname, '../../.env.local') });

const [job, source, briefFile] = process.argv.slice(2);
let folder = source;
if (!job || !source || !briefFile) throw new Error('Usage: smart-video-test.ts <job-name> <files-folder> <brief.txt>');

const REMOTION = path.resolve(__dirname, '../../../remotion');
const PUBLIC_DIR = path.join(REMOTION, 'public/smart-video/_test', job);
const PUBLIC_URL = `smart-video/_test/${job}`;

async function prepareFolder(): Promise<SmartAsset[]> {
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const files = fs.readdirSync(folder).sort().map((filename) => ({ filename, data: fs.readFileSync(path.join(folder, filename)) }));
  return prepareAssets(files, storeLocal);
}

const storeLocal = async (data: Buffer, name: string) => {
  fs.writeFileSync(path.join(PUBLIC_DIR, name), data);
  return `${PUBLIC_URL}/${name}`;
};

async function main() {
  const started = Date.now();
  let brief = fs.readFileSync(briefFile, 'utf-8');
  if (/^https?:/.test(source)) {
    console.log('🔗 Reading the link...');
    const link = await fromLink(source);
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-video-'));
    for (const [i, url] of link.imageUrls.entries()) {
      const res = await fetch(url);
      fs.writeFileSync(path.join(folder, `${String(i + 1).padStart(2, '0')}.jpg`), Buffer.from(await res.arrayBuffer()));
    }
    brief = `${link.brief}\n\nNOTE FROM THE CLIENT:\n${brief}`;
    console.log(`✅ Link read: ${link.imageUrls.length} photos, ${link.brief.length} characters of facts`);
  }
  const assets = await prepareFolder();
  const { props, plan, usage } = await createSmartVideo(brief, assets, storeLocal, async (url) => fs.readFileSync(path.join(PUBLIC_DIR, path.basename(url))));

  fs.mkdirSync(path.join(REMOTION, 'test-plans'), { recursive: true });
  const propsFile = path.join(REMOTION, 'test-plans', `${job}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));
  fs.writeFileSync(path.join(REMOTION, 'test-plans', `${job}.director.json`), JSON.stringify(plan, null, 2));
  const total = usage.reduce((sum, u) => sum + u.usd, 0);
  fs.writeFileSync(path.join(REMOTION, 'test-plans', `${job}.usage.json`), JSON.stringify({ totalUsd: total, usage }, null, 2));
  console.log(`💵 API cost: $${total.toFixed(3)}  (${usage.map((u) => `${u.step} $${u.usd.toFixed(3)}`).join(', ')})`);
  console.log(`🧠 Planned in ${((Date.now() - started) / 1000).toFixed(0)} s → ${propsFile}`);

  const output = path.join(REMOTION, 'out', `smart-${job}.mp4`);
  console.log('🔄 Rendering...');
  execFileSync('npx', ['remotion', 'render', 'src/Root.jsx', 'SmartVideo', output, `--props=${propsFile}`, '--codec=h264', '--crf=20', '--concurrency=10', '--log=error'], { cwd: REMOTION, stdio: 'inherit' });
  // Level the mix to the social-media standard (-14 LUFS); calm voices otherwise come out quiet.
  const raw = output.replace(/\.mp4$/, '.raw.mp4');
  fs.renameSync(output, raw);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
  fs.rmSync(raw);
  console.log(`✅ Done in ${((Date.now() - started) / 1000).toFixed(0)} s → ${output}`);
}

main().catch((error) => {
  console.error('❌ Smart Video test failed:', error);
  process.exit(1);
});
