/**
 * Offline checks for the free video ad cleanup (cleanup.ts): which files go, which stay, and when the $99 unlock
 * closes. With --list-real it also lists one real free video ad's job folder (read only, nothing is deleted) and
 * prints what the cleanup would delete there.
 *
 * Run from app/:  npx tsx src/scripts/free-video-cleanup-checks.ts [--list-real]
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}

const DAY = 86_400_000;
const USER = '2e988feb-78ca-4f9f-b3eb-b09e4483ef3d';
const JOB_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const JOB_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const BASE = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos';

async function main(): Promise<void> {
  const { unlockOpen, storagePathOf, jobFolders, workingFiles, UNLOCK_DAYS, FILES_KEEP_DAYS } = await import('@/lib/free-video/cleanup');
  const { unlockViewOf } = await import('@/lib/free-video/leads');

  console.log('== unlock window');
  const now = Date.now();
  const done = (daysAgo: number) => ({ status: 'done', video_url: `${BASE}/smart-video/${USER}/${JOB_B}/video.mp4`, finished_at: new Date(now - daysAgo * DAY).toISOString() });
  check(`open ${UNLOCK_DAYS - 1} days after the video ad`, unlockOpen(done(UNLOCK_DAYS - 1), now));
  check(`closed after ${UNLOCK_DAYS} days`, !unlockOpen(done(UNLOCK_DAYS + 0.01), now));
  check('closed when the video ad is not done', !unlockOpen({ ...done(1), status: 'held' }, now));
  check('open without a finish time (nothing says it is old)', unlockOpen({ ...done(1), finished_at: null }, now));
  check('the files outlive the unlock by a day', FILES_KEEP_DAYS === UNLOCK_DAYS + 1);
  const { CLEAN_COPY_HOURS } = await import('@/lib/free-video/offer');
  check('the files outlive the 3-day bonus (a last-minute sale still gets them)', FILES_KEEP_DAYS * 24 > CLEAN_COPY_HOURS);
  check('the unlock closes with the bonus', UNLOCK_DAYS * 24 === CLEAN_COPY_HOURS);

  const lead = (daysAgo: number, unlock_status = 'none') =>
    ({ ...done(daysAgo), unlock_status, view_token: 'gHAMS8DxumgdZBxF6Evflg', website_domain: 'example.com', clean_video_url: null }) as never;
  const fresh = unlockViewOf(lead(2));
  check('the page offers the unlock 2 days after', fresh.state === 'available' && 'checkoutPath' in fresh && Boolean(fresh.checkoutPath));
  const old = unlockViewOf(lead(FILES_KEEP_DAYS));
  check(`the page hides the unlock after ${FILES_KEEP_DAYS} days (no checkout link)`, old.state === 'unavailable' && !('checkoutPath' in old && old.checkoutPath));
  check(`a paid unlock still shows as paid after ${FILES_KEEP_DAYS} days`, unlockViewOf(lead(FILES_KEEP_DAYS, 'paid')).state === 'paid');

  console.log('== which files go');
  const video = `${BASE}/smart-video/${USER}/${JOB_B}/video.mp4`;
  check('storagePathOf reads the object path', storagePathOf(video) === `smart-video/${USER}/${JOB_B}/video.mp4`);
  check('storagePathOf drops ?download=', storagePathOf(`${video}?download=x.mp4`) === `smart-video/${USER}/${JOB_B}/video.mp4`);
  check('storagePathOf refuses another bucket', storagePathOf('https://x.supabase.co/storage/v1/object/public/images/a.png') === null);
  check('storagePathOf(null) is null', storagePathOf(null) === null);

  const folders = jobFolders({ job_ids: [JOB_A, JOB_B, 'not-a-job-id'], job_id: JOB_B, video_url: video }, null);
  check('every attempt is a job folder, a bad id is not', JSON.stringify(folders) === JSON.stringify([`smart-video/${USER}/${JOB_A}`, `smart-video/${USER}/${JOB_B}`]), folders.join(', '));
  const noVideo = jobFolders({ job_ids: [JOB_A], job_id: JOB_A, video_url: null }, USER);
  check('without a video the system user gives the folder', noVideo[0] === `smart-video/${USER}/${JOB_A}`);
  check('without a video or a system user nothing is touched', jobFolders({ job_ids: [JOB_A], job_id: JOB_A, video_url: null }, null).length === 0);

  const listing = [
    { folder: `smart-video/${USER}/${JOB_A}`, files: ['video.mp4', 'voice.wav'] },
    { folder: `smart-video/${USER}/${JOB_B}`, files: ['video.mp4', 'a1.jpg', 'presenter.mp4', 'd1-1791.png'] },
  ];
  const doomed = workingFiles(listing, storagePathOf(video));
  check('the video the page plays stays', !doomed.includes(`smart-video/${USER}/${JOB_B}/video.mp4`));
  check("an earlier attempt's video goes", doomed.includes(`smart-video/${USER}/${JOB_A}/video.mp4`));
  check('photos, presenter clip, drawings and voice go', doomed.length === 5, doomed.join(', '));
  check('a lead with no video to keep loses every file', workingFiles(listing, null).length === 6);

  if (process.argv.includes('--list-real')) {
    console.log('== one real job folder (read only)');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const realJob = 'ff23d724-fe8a-40e0-b39f-1a6e6d02ed2a';
    const folder = `smart-video/${USER}/${realJob}`;
    const res = await fetch(`${url}/storage/v1/object/list/script-videos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: `${folder}/`, limit: 1000 }),
    });
    const entries = (await res.json()) as { name: string; id: string | null; metadata?: { size?: number } }[];
    const files = entries.filter((entry) => entry.id);
    const wouldGo = workingFiles([{ folder, files: files.map((entry) => entry.name) }], storagePathOf(`${BASE}/${folder}/video.mp4`));
    const bytes = files.filter((entry) => wouldGo.includes(`${folder}/${entry.name}`)).reduce((sum, entry) => sum + (entry.metadata?.size ?? 0), 0);
    console.log(`${files.length} files; the cleanup would delete ${wouldGo.length} (${(bytes / 1e6).toFixed(1)} MB) and keep video.mp4`);
    console.log(wouldGo.map((p) => p.split('/').pop()).join(', '));
    check('the real folder keeps exactly its video', files.length - wouldGo.length === 1 && files.some((entry) => entry.name === 'video.mp4'));
  }

  console.log(failures ? `\n${failures} FAIL` : '\nall PASS');
  if (failures) process.exit(1);
}

main().catch((error) => {
  console.error('❌ free-video-cleanup-checks failed:', error);
  process.exit(1);
});
