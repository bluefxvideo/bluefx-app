/**
 * TEMPORARY verification harness for Clone Studio stage 1 — run with:
 *   node_modules/.bin/tsx --env-file=<env> scripts/clone-studio-harness.ts <video file>
 * Exercises probe → segmentation (+ real storage uploads) → analysis (real Gemini).
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
import { analyzeScenes } from '../src/lib/clone-studio/analysis';

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error('usage: harness.ts <video file>');

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
    console.log(`  scene ${s.n}: ${s.start.toFixed(2)}–${s.end.toFixed(2)} (${(s.end - s.start).toFixed(2)}s) ${s.keyframe_url}`);
  }

  console.log('=== analysis ===');
  const t1 = Date.now();
  const fitted = await fitForInlineAnalysis(filePath);
  const stat = await fs.stat(fitted);
  console.log(`analysis input: ${fitted === filePath ? 'original' : 'transcoded'} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
  const analysis = await analyzeScenes(fitted, scenes);
  console.log(`analysis done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
  console.log('--- summary ---');
  console.log(JSON.stringify(analysis.summary, null, 2));
  console.log('--- first 3 scenes ---');
  for (const n of [1, 2, 3]) {
    console.log(`scene ${n}:`, JSON.stringify(analysis.scenes.get(n), null, 2));
  }
  const missing = scenes.filter((s) => {
    const a = analysis.scenes.get(s.n);
    return !a || !a.action_arc.start_state;
  });
  console.log(`scenes with empty analysis: ${missing.length ? missing.map((s) => s.n).join(', ') : 'none'}`);

  await cleanupWorkDir(workDir);
  console.log('=== DONE ===');
}

main().catch((err) => {
  console.error('HARNESS FAILED:', err);
  process.exit(1);
});
