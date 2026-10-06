/**
 * Makes the free video funnel's music library (lib/smart-video/music-library.ts): every track that is not in storage
 * yet, with the same music model and rules as The Phantom's own music ($0.08 a track). Each take is listened to by
 * a small model (listenToMusic, the check The Phantom's own music uses) and made again (up to 3 takes) when it has
 * singing or speech, then uploaded as
 * smart-video/music-library/<id>.mp3. --force makes every track again; --only id1,id2 makes just those again.
 *
 * Run from app/:  FREE_MUSIC_ALLOW_PAID=1 npx tsx src/scripts/generate-music-library-free.ts [--force]
 */
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

const FORCE = process.argv.includes('--force');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const TAKES = 4;
const PARALLEL = 4;
function secondsOf(mp3: Buffer): number {
  const file = path.join(os.tmpdir(), `music-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  fs.writeFileSync(file, mp3);
  try {
    return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
  } finally {
    fs.rmSync(file, { force: true });
  }
}

async function main(): Promise<void> {
  if (process.env.FREE_MUSIC_ALLOW_PAID !== '1') throw new Error('This spends about $0.08 a track. Tell the owner, then run it with FREE_MUSIC_ALLOW_PAID=1.');
  const { MUSIC_LIBRARY, libraryUrl } = await import('@/lib/smart-video/music-library');
  const { hasVoices, listenToMusic, MUSIC_RULES, musicTake, NO_VOICES } = await import('@/lib/smart-video/audio');
  const { trackUsage } = await import('@/lib/smart-video/usage');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed');

  const exists = async (id: string) => (await fetch(libraryUrl(id), { method: 'HEAD' })).ok;
  const todo: typeof MUSIC_LIBRARY = [];
  for (const track of MUSIC_LIBRARY) if (ONLY ? ONLY.includes(track.id) : FORCE || !(await exists(track.id))) todo.push(track);
  console.log(`🎵 ${todo.length} of ${MUSIC_LIBRARY.length} tracks to make`);

  const report: Record<string, unknown>[] = [];
  const { usage } = await trackUsage(async () => {
    for (let i = 0; i < todo.length; i += PARALLEL) {
      await Promise.all(
        todo.slice(i, i + PARALLEL).map(async (track) => {
          for (let take = 1; take <= TAKES; take++) {
            try {
              const mp3 = await musicTake(`${track.prompt}${MUSIC_RULES} ${NO_VOICES}`);
              const seconds = secondsOf(mp3);
              // The same strict check as The Phantom's music: two listens, and a voice named in a description counts.
              const voiced = await hasVoices(mp3);
              if (voiced !== false || seconds < 20) {
                console.log(`⚠️ ${track.id} take ${take}: ${voiced ? 'a voice' : voiced === null ? 'check failed' : ''} ${seconds.toFixed(0)} s, making it again`);
                continue;
              }
              const heard = await listenToMusic(mp3);
              const up = await fetch(`${url}/storage/v1/object/script-videos/smart-video/music-library/${track.id}.mp3`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'audio/mpeg', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
                body: new Uint8Array(mp3),
              });
              if (!up.ok) throw new Error(`upload failed (${up.status}): ${(await up.text()).slice(0, 200)}`);
              console.log(`✅ ${track.id} (${track.bpm} BPM) ${seconds.toFixed(0)} s, take ${take}: ${heard.description}`);
              report.push({ id: track.id, seconds: Math.round(seconds), take, heard: heard.description });
              return;
            } catch (error) {
              console.log(`❌ ${track.id} take ${take}: ${String(error).slice(0, 160)}`);
            }
          }
          report.push({ id: track.id, failed: true });
        })
      );
    }
  });
  const spent = usage.reduce((sum, entry) => sum + entry.usd, 0);
  const failed = report.filter((r) => r.failed).map((r) => r.id);
  console.log(`💵 ${usage.length} music takes, $${spent.toFixed(2)}${failed.length ? ` | ❌ not made: ${failed.join(', ')}` : ' | all made'}`);
  fs.writeFileSync(path.resolve(__dirname, '../../../remotion/test-plans/music-library-report.json'), JSON.stringify(report, null, 1));
}

main().catch((error) => {
  console.error('❌ generate-music-library-free failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
