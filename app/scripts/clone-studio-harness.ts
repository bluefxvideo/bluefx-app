/**
 * Verification harness for Clone Studio stage 1 — run with:
 *   node_modules/.bin/tsx --env-file=<env> scripts/clone-studio-harness.ts <video file> [youtube url]
 * Exercises probe → segmentation (+ real storage uploads) → structured
 * analysis via the shared video-analyzer (inline path; if a YouTube URL is
 * given, ALSO runs the native Gemini-URL path and reports both).
 * Kept for pipeline debugging.
 */
import { promises as fs } from 'fs';
import path from 'path';
import {
  makeWorkDir,
  probeVideo,
  segmentVideo,
  fitForInlineAnalysis,
  cleanupWorkDir,
  buildAnalysisKeyframes,
  extractSceneClips,
} from '../src/lib/clone-studio/segmentation';
import { analyzeCloneScenes, type AnalyzeCloneScenesResult } from '../src/actions/tools/video-analyzer';

function report(label: string, result: AnalyzeCloneScenesResult, sceneCount: number) {
  console.log(`--- ${label} ---`);
  if (!result.success || !result.scenes || !result.summary) {
    console.log('FAILED:', result.error);
    return;
  }
  console.log('summary:', JSON.stringify(result.summary, null, 2).slice(0, 1200));
  const missing: number[] = [];
  for (let n = 1; n <= sceneCount; n++) {
    const a = result.scenes[n];
    if (!a || !a.action_arc.start_state) missing.push(n);
  }
  console.log(`scenes with empty analysis: ${missing.length ? missing.join(', ') : 'none'}`);
  const withNewFields = Object.values(result.scenes).filter((s) => s.subject && s.lighting && s.purpose).length;
  console.log(`scenes with S-E-A-L-Ca fields populated: ${withNewFields}/${sceneCount}`);
}

async function main() {
  const [src, youtubeUrl] = process.argv.slice(2);
  if (!src) throw new Error('usage: harness.ts <video file> [youtube url]');

  const workDir = await makeWorkDir('clone-studio-harness-');
  const filePath = path.join(workDir, 'source.mp4');
  await fs.copyFile(src, filePath);

  console.log('=== probe ===');
  const probe = await probeVideo(filePath);
  console.log(probe);

  console.log('=== segmentation ===');
  const t0 = Date.now();
  const scenes = await segmentVideo(filePath, 'harness-test', probe);
  console.log(`${scenes.length} scenes in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const s of scenes) {
    console.log(`  scene ${s.n}: ${s.start.toFixed(2)}–${s.end.toFixed(2)} (${(s.end - s.start).toFixed(2)}s)`);
  }

  const t05 = Date.now();
  const sceneClips = await extractSceneClips(filePath, scenes);
  console.log(`scene clips: ${sceneClips.length} in ${((Date.now() - t05) / 1000).toFixed(1)}s (${Math.round(sceneClips.reduce((s, c) => s + c.clipBase64.length, 0) / 1024)}KB base64 total)`);

  console.log('=== analysis (per-scene clips) ===');
  const fitted = await fitForInlineAnalysis(filePath);
  const videoBase64 = (await fs.readFile(fitted)).toString('base64');
  const t1 = Date.now();
  const result = await analyzeCloneScenes({ videoBase64, sceneRanges: scenes, sceneClips });
  console.log(`analysis in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  report('clips', result, scenes.length);

  if (result.success && result.scenes) {
    console.log('--- per-scene action sync check ---');
    for (const s2 of scenes) {
      const a = result.scenes[s2.n];
      console.log(`scene ${s2.n} (${(s2.end - s2.start).toFixed(1)}s): ${a?.action_arc.action.slice(0, 110)}`);
      if (a?.dialog) console.log(`   dialog: "${a.dialog}"`);
    }
  }

  await cleanupWorkDir(workDir);
  console.log('=== DONE ===');
}

main().catch((err) => {
  console.error('HARNESS FAILED:', err);
  process.exit(1);
});
