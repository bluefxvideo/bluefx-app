/**
 * Runs an edit of a finished Phantom video on this machine: the saved plan of a live video (read only), the note, the
 * edit pipeline (reviseSmartVideo, with its paid AI calls, but no credits charged and nothing written to the
 * database), then a local Remotion render. New files go to remotion/public/smart-video/_test/<name>; the live
 * video's own files are read from storage as they are.
 *
 *   npx tsx --env-file=.env.local src/scripts/smart-video-revise-test.ts <name> <job id> "<note>" ["<who should be on camera>"]
 *
 * The last argument is the edit form's "Change the presenter" box ticked with those words; PRESENTER_PHOTO=<file> ticks it
 * with the client's own photo of the person. NO_RENDER=1 skips the render.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { reviseSmartVideo, withSubtitleLook } from '@/lib/smart-video/pipeline';
import { jobsTable, type SavedPlan } from '@/lib/smart-video/jobs';
import { presenterPhotoFromUpload } from '@/lib/smart-video/prepare-assets';

// PRESENTER_PHOTO=<file>: the "Change the presenter" box ticked with the client's own photo of the person.
const [name, jobId, note = '', presenterWords] = process.argv.slice(2);
const presenter = presenterWords || undefined;
if (!name || !jobId || (!note && !presenter && !process.env.PRESENTER_PHOTO)) throw new Error('Usage: smart-video-revise-test.ts <name> <job id> "<note>" ["<who should be on camera>"]');

const REMOTION = path.resolve(__dirname, '../../../remotion');
const PUBLIC_DIR = path.join(REMOTION, 'public/smart-video/_test', name);
const PUBLIC_URL = `smart-video/_test/${name}`;

const storeLocal = async (data: Buffer, file: string) => {
  fs.writeFileSync(path.join(PUBLIC_DIR, file), data);
  return `${PUBLIC_URL}/${file}`;
};

async function main() {
  const started = Date.now();
  const { data, error } = await jobsTable().select('plan, job').eq('id', jobId).maybeSingle();
  if (error || !data?.plan) throw new Error(`No saved plan for ${jobId}: ${error?.message ?? 'no row'}`);
  const saved = data.plan as SavedPlan;
  if (!saved.media) throw new Error('This video has no saved media');
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const photoFile = process.env.PRESENTER_PHOTO;
  const presenterPhoto = photoFile ? await presenterPhotoFromUpload({ filename: path.basename(photoFile), data: fs.readFileSync(photoFile) }) : undefined;
  if (presenterPhoto) fs.writeFileSync(path.join(PUBLIC_DIR, 'client-photo-cropped.jpg'), presenterPhoto);
  const revised = await reviseSmartVideo(
    { plan: saved.plan, media: saved.media },
    note,
    saved.brief || data.job.brief,
    storeLocal,
    (stage) => console.log(`🔄 ${stage}`),
    [],
    undefined,
    { presenter, presenterPhoto }
  );
  // As runRevision does: the edit keeps the video's subtitle look.
  const result = withSubtitleLook(revised, saved, note);
  const shown = result.props as { scenes?: { start: number; end: number; speaker?: boolean }[]; captions?: { words: { start: number }[] } };
  const outside = (shown.captions?.words ?? []).filter((w) => !(shown.scenes ?? []).some((sc) => sc.speaker && w.start >= sc.start - 0.05 && w.start < sc.end));
  console.log(`💬 Subtitles: ${shown.captions?.words.length ?? 0} words, ${outside.length} outside a talking scene`);
  for (const warning of result.warnings) console.log(`⚠️ For the client: ${warning}`);
  console.log(`🎭 New presenter: ${result.newPresenter ? JSON.stringify(result.newPresenter) : 'not asked for'}`);
  console.log(`🎬 Scene 1: ${JSON.stringify(result.plan.scenes[0])}`);
  console.log(`🎤 Voice: ${result.plan.voice.gender}, ${result.plan.voice.direction}`);

  fs.mkdirSync(path.join(REMOTION, 'test-plans'), { recursive: true });
  const propsFile = path.join(REMOTION, 'test-plans', `${name}.json`);
  fs.writeFileSync(propsFile, JSON.stringify(result.props, null, 2));
  fs.writeFileSync(path.join(REMOTION, 'test-plans', `${name}.director.json`), JSON.stringify(result.plan, null, 2));
  const total = result.usage.reduce((sum, u) => sum + u.usd, 0);
  console.log(`💵 API cost: $${total.toFixed(3)}  (${result.usage.map((u) => `${u.step} $${u.usd.toFixed(3)}`).join(', ')})`);
  console.log(`🧠 Edited in ${((Date.now() - started) / 1000).toFixed(0)} s`);

  // NO_RENDER=1: the plan and the files only.
  if (process.env.NO_RENDER === '1') return;
  const output = path.join(REMOTION, 'out', `edit-${name}.mp4`);
  console.log('🔄 Rendering...');
  execFileSync('npx', ['remotion', 'render', 'src/Root.jsx', 'SmartVideo', output, `--props=${propsFile}`, '--codec=h264', '--crf=20', '--concurrency=10', '--log=error'], { cwd: REMOTION, stdio: 'inherit' });
  const raw = output.replace(/\.mp4$/, '.raw.mp4');
  fs.renameSync(output, raw);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
  fs.rmSync(raw);
  console.log(`✅ Done in ${((Date.now() - started) / 1000).toFixed(0)} s → ${output}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error('❌ Edit test failed:', error);
    process.exit(1);
  }
);
