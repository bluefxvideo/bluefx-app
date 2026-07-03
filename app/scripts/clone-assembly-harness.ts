/**
 * Verification harness for the Clone Studio assembly lib — run with:
 *   node_modules/.bin/tsx scripts/clone-assembly-harness.ts <clipsDir> <outFile> [musicFile]
 * Uses the R&D remake clips (anim01..anim15) + original cut durations.
 */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { assembleClips } from '../src/lib/clone-studio/assembly';

// Original Pringles cut durations (seconds) from the verified hand-run remake
const DURATIONS = [6.8, 2.4, 1.0, 1.8, 2.1, 1.7, 1.7, 1.2, 1.4, 1.7, 0.9, 2.3, 1.7, 1.0, 2.3];

async function main() {
  const [clipsDir, outFile, musicFile] = process.argv.slice(2);
  if (!clipsDir || !outFile) throw new Error('usage: harness <clipsDir> <outFile> [musicFile]');

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clone-assembly-'));
  const clips = [];
  for (let i = 1; i <= DURATIONS.length; i++) {
    const filePath = path.join(clipsDir, `anim${String(i).padStart(2, '0')}.mp4`);
    await fs.access(filePath);
    clips.push({ filePath, durationSeconds: DURATIONS[i - 1] });
  }

  const t0 = Date.now();
  await assembleClips({
    workDir,
    clips,
    width: 1920,
    height: 1080,
    musicFilePath: musicFile,
    outPath: outFile,
  });
  console.log(`assembled ${clips.length} clips in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outFile}`);
  await fs.rm(workDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('ASSEMBLY HARNESS FAILED:', err);
  process.exit(1);
});
