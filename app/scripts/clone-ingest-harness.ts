/**
 * Verification harness for Clone Studio YouTube ingest — run with:
 *   node_modules/.bin/tsx --env-file=<env> scripts/clone-ingest-harness.ts <youtube url> <out.mp4> [--no-ytdlp]
 * --no-ytdlp strips PATH so yt-dlp is unavailable, forcing the Apify fallback
 * (simulates production, where YouTube's bot wall blocks datacenter IPs).
 */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const [url, outFile, flag] = process.argv.slice(2);
  if (!url || !outFile) throw new Error('usage: harness <youtube url> <out.mp4> [--no-ytdlp]');

  if (flag === '--no-ytdlp') {
    process.env.PATH = '/usr/bin:/bin'; // yt-dlp lives in /opt/homebrew/bin
    console.log('PATH stripped — yt-dlp unavailable, fallback must fire');
  }

  const { ingestSourceVideo } = await import('../src/lib/clone-studio/ingest');
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'clone-ingest-'));
  const t0 = Date.now();
  const result = await ingestSourceVideo(workDir, { source_url: url });
  console.log(`ingested via platform=${result.platform} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await fs.copyFile(result.filePath, outFile);
  const stat = await fs.stat(outFile);
  console.log(`saved ${(stat.size / 1024 / 1024).toFixed(1)}MB → ${outFile}`);
  await fs.rm(workDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('INGEST HARNESS FAILED:', err);
  process.exit(1);
});
