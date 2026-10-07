/**
 * Free video ad funnel: the PAID end-to-end helper (build plan T6). Runs the EXACT free path on one website
 * with local storage and a local render, and prints what it cost. Zero credits, no database, no email.
 *
 * It spends real API money (about $1-1.30 per run: the director, voice, music, drawings or animated photos),
 * so it refuses to run unless FREE_VIDEO_ALLOW_PAID=1 is set. Say the spend to the owner first.
 *
 * Run from app/:
 *   FREE_VIDEO_ALLOW_PAID=1 REMOTION_SERVER_URL=http://localhost:3011 \
 *     npx tsx src/scripts/free-video-test.ts <job-name> <website> [--clean]
 *
 * The render is LOCAL only: the worktree's own remotion folder renders the NEW composition with the Remotion
 * CLI, and the script refuses to start while the Remotion server this shell points at is not on localhost
 * (.env.local points REMOTION_SERVER_URL at PROD Remotion; shell exports beat .env.local).
 *
 * Steps: normalizeWebsite → precheckSite → readBusinessSite (all through safeFetch) → prepareAssets into
 * remotion/public/smart-video/_test/<job> → createSmartVideo with freeOptions (prints the photo count, the
 * look, the animated photos and their still-camera prompts) → freeRender (presenter subtitles, watermark) → remotion/test-plans/<job>.json
 * (+ .director.json, .media.json, .usage.json) → render + loudness → qualityGate (PASS or HOLD with the
 * reasons) → frames every 0.5 s in remotion/out/frames-free-<job>/ for the full watch.
 * --clean also renders the $29 clean version (the same props without the watermark: render cost only).
 */
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

const [job, website] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const WITH_CLEAN = process.argv.includes('--clean');

const REMOTION = path.resolve(__dirname, '../../../remotion');
const PUBLIC_DIR = path.join(REMOTION, 'public/smart-video/_test', job || 'x');
const PUBLIC_URL = `smart-video/_test/${job}`;
const PLANS = path.join(REMOTION, 'test-plans');
const OUT = path.join(REMOTION, 'out');

const storeLocal = async (data: Buffer, name: string) => {
  fs.writeFileSync(path.join(PUBLIC_DIR, name), data);
  return `${PUBLIC_URL}/${name}`;
};

/** The worktree's composition, rendered by the Remotion CLI, then levelled to -14 LUFS exactly like levelLoudness. */
function renderLocal(propsFile: string, output: string, scale = 2 / 3): void {
  const raw = output.replace(/\.mp4$/, '.raw.mp4');
  execFileSync('npx', ['remotion', 'render', 'src/Root.jsx', 'SmartVideo', raw, `--props=${propsFile}`, '--codec=h264', '--crf=20', '--concurrency=10', `--scale=${scale}`, '--log=error'], {
    cwd: REMOTION,
    stdio: 'inherit',
  });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
  fs.rmSync(raw, { force: true });
}

async function main(): Promise<void> {
  if (!job || !website || !/^[\w-]{1,60}$/.test(job)) throw new Error('Usage: FREE_VIDEO_ALLOW_PAID=1 npx tsx src/scripts/free-video-test.ts <job-name> <website> [--clean]');
  if (process.env.FREE_VIDEO_ALLOW_PAID !== '1') {
    throw new Error('This run spends real API money (about $1-1.30). Tell the owner the spend, then run it again with FREE_VIDEO_ALLOW_PAID=1.');
  }
  // Imported after dotenv: config.ts reads the environment when it loads.
  const { freeNote, isLive, remotionServerUrl, rendersLocally } = await import('@/lib/free-video/config');
  const { qualityGate } = await import('@/lib/free-video/gate');
  const { freeOptions, freeRender, realPhotoCount } = await import('@/lib/free-video/runner');
  const { cleanProps } = await import('@/lib/free-video/unlock');
  const { displayDomain, normalizeWebsite, precheckSite, readBusinessSite } = await import('@/lib/free-video/website');
  const { stillCameraPrompt } = await import('@/lib/smart-video/audio');
  const { createSmartVideo } = await import('@/lib/smart-video/pipeline');
  const { prepareAssets } = await import('@/lib/smart-video/prepare-assets');
  const { liveRecorder } = await import('@/lib/free-video/live');

  if (isLive()) throw new Error('This helper never runs as the live server.');
  if (!rendersLocally()) {
    throw new Error(`Renders are LOCAL only, but this shell points at ${remotionServerUrl()}. Export REMOTION_SERVER_URL=http://localhost:3011 (and unset APP_REMOTION_SERVICE_URL).`);
  }

  const started = Date.now();
  const site = normalizeWebsite(website);
  if (!site.ok) throw new Error(`${website}: ${site.code} (${site.message})`);
  const domain = site.domain;
  console.log(`🔗 ${site.url} (domain ${displayDomain(domain)})`);

  const precheck = await precheckSite(site.url, domain, site.schemeTyped);
  if (!precheck.ok) throw new Error(`Pre-check: ${precheck.code} (${precheck.message}). Nothing was spent.`);
  console.log(`✅ Pre-check passed: ${precheck.url}`);

  const read = await readBusinessSite(precheck.url);
  console.log(`✅ Read: ${read.files.length} photos, ${read.brief.length} characters of page text`);

  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  // The live status page's record, exactly as the runner keeps it, with the second each version appeared at:
  // test-plans/free-<job>.live.json (the dev preview replays it).
  fs.mkdirSync(PLANS, { recursive: true });
  const liveFile = path.join(PLANS, `free-${job}.live.json`);
  const liveLog: { t: number; stage?: string; live?: unknown }[] = [];
  const at = () => Math.round((Date.now() - started) / 100) / 10;
  const keep = (entry: { stage?: string; live?: unknown }) => {
    liveLog.push({ t: at(), ...entry });
    fs.writeFileSync(liveFile, JSON.stringify(liveLog, null, 1));
  };
  const live = liveRecorder(async (version) => keep({ live: version }));
  const storeLive = async (data: Buffer, name: string) => {
    const url = await storeLocal(data, name);
    live.stored(name, url);
    return url;
  };
  keep({ stage: 'reading' });
  const assets = await prepareAssets(read.files, storeLive);
  live.assets(assets);
  const options = freeOptions(
    { length: 'auto', format: 'vertical', look: null, sound: { voiceOver: true, music: true }, onStage: (stage) => keep({ stage }) },
    undefined,
    (plan) => live.plan(plan, assets),
    (url) => live.stored('music.mp3', url),
    read.brief
  );
  console.log(`🖼️ ${realPhotoCount(assets)} real photos of ${assets.length} files → look: ${options.look}, presenter: ${options.presenter ? 'yes' : 'no'}`);

  const brief = `${read.brief}\n\nNOTE FROM THE CLIENT:\n${freeNote(displayDomain(domain))}`;
  const result = await createSmartVideo(brief, assets, storeLive, async (url) => fs.readFileSync(path.join(PUBLIC_DIR, path.basename(url))), options);
  await live.flush();
  keep({ stage: 'rendering' });
  const marked = freeRender(result);
  const words = result.plan.scenes.reduce((n, scene) => n + scene.narration.split(/\s+/).filter(Boolean).length, 0);
  console.log(`🎬 Plan: style ${result.plan.style}, language ${result.plan.language}, ${result.plan.scenes.length} scenes, ${words} words, ${result.durationSeconds.toFixed(1)} s + 1 s card`);
  for (const shot of result.plan.animate ?? []) console.log(`🎞️ Animated ${shot.asset}: ${stillCameraPrompt(shot.prompt)}`);
  if (!result.plan.animate?.length) console.log('🎞️ No animated photos');
  for (const warning of result.warnings) console.log(`⚠️ For the client: ${warning}`);

  fs.mkdirSync(PLANS, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const propsFile = path.join(PLANS, `free-${job}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(marked.props, null, 2));
  fs.writeFileSync(path.join(PLANS, `free-${job}.director.json`), JSON.stringify(result.plan, null, 2));
  fs.writeFileSync(path.join(PLANS, `free-${job}.media.json`), JSON.stringify(result.media, null, 2));
  const cost = result.usage.reduce((sum, entry) => sum + entry.usd, 0);
  fs.writeFileSync(path.join(PLANS, `free-${job}.usage.json`), JSON.stringify({ totalUsd: cost, usage: result.usage }, null, 2));
  console.log(`💵 API cost: $${cost.toFixed(3)}  (${result.usage.map((u) => `${u.step} $${u.usd.toFixed(3)}`).join(', ')})`);

  const output = path.join(OUT, `free-${job}.mp4`);
  console.log('🔄 Rendering the free version (watermark + end card)...');
  renderLocal(propsFile, output);
  keep({ stage: 'done' });
  console.log(`📺 Live status record: ${liveFile}`);

  const gate = await qualityGate(
    { videoUrl: output, durationSeconds: marked.durationSeconds, warnings: result.warnings, usage: result.usage },
    { plan: result.plan, props: marked.props, media: result.media, brief },
    { domain }
  );
  console.log(gate.pass ? '✅ Gate: PASS' : `⚠️ Gate: HOLD (${gate.reasons.join('; ')})`);
  console.log(`   facts: ${JSON.stringify(gate.facts)}`);

  const frames = path.join(OUT, `frames-free-${job}`);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', output, '-vf', 'fps=2', path.join(frames, 'f%03d.jpg')]);
  console.log(`🖼️ Frames every 0.5 s: ${frames}`);

  if (WITH_CLEAN) {
    const cleanFile = path.join(PLANS, `free-${job}.clean.json`);
    fs.writeFileSync(cleanFile, JSON.stringify(cleanProps(marked.props), null, 2));
    const cleanOutput = path.join(OUT, `free-${job}-clean.mp4`);
    console.log('🔄 Rendering the $29 clean version (no watermark, no end card)...');
    renderLocal(cleanFile, cleanOutput, 1);
    const cleanGate = await qualityGate({ videoUrl: cleanOutput, durationSeconds: result.durationSeconds }, { plan: result.plan, props: cleanProps(marked.props), media: result.media }, { domain });
    const fileReasons = cleanGate.reasons.filter((reason) => /mismatch|audio|not 1080|too quiet|file/.test(reason));
    console.log(fileReasons.length ? `⚠️ Clean file: ${fileReasons.join('; ')}` : `✅ Clean file: ${cleanGate.facts.probeSeconds} s → ${cleanOutput}`);
  }

  console.log(`✅ Done in ${((Date.now() - started) / 1000).toFixed(0)} s → ${output}  (API cost $${cost.toFixed(3)})`);
}

main().catch((error) => {
  console.error('❌ free-video-test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
