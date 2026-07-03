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
} from '../src/lib/clone-studio/segmentation';
import { analyzeCloneScenes, type AnalyzeCloneScenesResult } from '../src/actions/tools/video-analyzer';

function report(label: string, result: AnalyzeCloneScenesResult, sceneCount: number) {
  console.log(`--- ${label} ---`);
  if (!result.success || !result.scenes || !result.summary) {
    console.log('FAILED:', result.error);
    return;
  }
  console.log('summary:', JSON.stringify(result.summary, null, 2).slice(0, 1200));
  console.log('scene 1:', JSON.stringify(result.scenes[1], null, 2));
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

  console.log('=== analysis (inline) ===');
  const fitted = await fitForInlineAnalysis(filePath);
  const videoBase64 = (await fs.readFile(fitted)).toString('base64');
  const t1 = Date.now();
  const inline = await analyzeCloneScenes({ videoBase64, sceneRanges: scenes });
  console.log(`inline analysis in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  report('inline', inline, scenes.length);

  if (youtubeUrl) {
    console.log('=== analysis (native YouTube URL) ===');
    const t2 = Date.now();
    const native = await analyzeCloneScenes({ youtubeUrl, sceneRanges: scenes });
    console.log(`native analysis in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
    report('native', native, scenes.length);
  }

  await cleanupWorkDir(workDir);
  console.log('=== DONE ===');
}

main().catch((err) => {
  console.error('HARNESS FAILED:', err);
  process.exit(1);
});
