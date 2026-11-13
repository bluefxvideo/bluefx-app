/**
 * Fixes how the voices say names in a finished free video ad (owner 2026-10-27, Jim Carlough: "It's pronounced Car
 * Low."; 2026-11-13, Red N. Asyl: his name, his company and his website). The words go on the plan's pronunciation
 * list (audio.ts sayAs): the narrator records its lines again and, when the presenter's line has one of the words,
 * the presenter is filmed again from the same photo. The captions and the text on screen keep the real spelling.
 *
 * Two steps, so the new video is watched before the lead changes:
 *   1. make + render to a local folder:  FIX_NAME_OK=1 npx tsx --env-file=.env.local --tsconfig tsconfig.json \
 *        src/scripts/fix-name-free-video.ts <view token> <out dir> "Written=SAY-it" ["Written 2=SAY-it"...]
 *      (PRESENTER_ACTION="..." = what the presenter does in the first second; REMOTION_SERVER_URL for a local render)
 *   2. save it to the job and the lead:  FIX_NAME_OK=1 npx tsx ... src/scripts/fix-name-free-video.ts --save <view token> <out dir>
 * The old files stay in storage.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function main(): Promise<void> {
  if (process.env.FIX_NAME_OK !== '1') throw new Error('Records a new voice and presenter (paid), renders and changes the lead: set FIX_NAME_OK=1.');
  const args = process.argv.slice(2);
  const save = args[0] === '--save';
  const [token, outDir, ...pairs] = save ? args.slice(1) : args;
  if (!token || !outDir || (!save && !pairs.length)) throw new Error('Usage: <view token> <out dir> "Written=SAY-it"... | --save <view token> <out dir>');
  const { getLeadByToken, leadsTable } = await import('@/lib/free-video/leads');
  const { jobDir, jobsTable, upload } = await import('@/lib/smart-video/jobs');

  const lead = await getLeadByToken(token);
  if (!lead?.job_id || lead.status !== 'done') throw new Error('No finished lead with this token');
  const { data, error } = await jobsTable().select('user_id, job, plan').eq('id', lead.job_id).maybeSingle();
  if (error || !data?.plan) throw new Error(`No saved plan: ${error?.message}`);
  const dir = jobDir(data.user_id, lead.job_id);
  const stamp = Date.now();

  if (save) {
    const made = JSON.parse(await fs.readFile(path.join(outDir, 'made.json'), 'utf8'));
    const videoUrl = await upload(`${dir}/video-name-${stamp}.mp4`, await fs.readFile(path.join(outDir, 'video.mp4')), 'video/mp4');
    const job = { ...data.job, videoUrl, durationSeconds: made.durationSeconds, updatedAt: new Date().toISOString() };
    const saved = await jobsTable().update({ plan: { plan: made.plan, props: made.props, media: made.media, brief: data.plan.brief }, job }).eq('id', lead.job_id);
    if (saved.error) throw new Error(`Job not saved: ${saved.error.message}`);
    const leadSaved = await leadsTable().update({ video_url: videoUrl, duration_seconds: Math.round(made.durationSeconds * 10) / 10 }).eq('id', lead.id);
    if (leadSaved.error) throw new Error(`Lead not saved: ${leadSaved.error.message}`);
    console.log(JSON.stringify({ lead: lead.website_domain, videoUrl }, null, 2));
    return;
  }

  const { freeRender } = await import('@/lib/free-video/runner');
  const { FREE_RENDER_SCALE } = await import('@/lib/free-video/config');
  const { addPresenter, buildProps, recordVoice } = await import('@/lib/smart-video/pipeline');
  const { measureLufs } = await import('@/lib/smart-video/prepare-assets');
  const { sayAs } = await import('@/lib/smart-video/audio');
  const { talkingPresenter } = await import('@/lib/smart-video/presenter');
  const { levelLoudness, renderSmartVideo } = await import('@/lib/smart-video/render');

  const { plan, media } = data.plan;
  plan.pronounce = pairs.map((pair) => {
    const [written, say] = pair.split('=').map((s) => s.trim());
    if (!written || !say) throw new Error(`Not "Written=SAY-it": ${pair}`);
    return { written, say };
  });
  const store = (buf: Buffer, name: string, type: string) => upload(`${dir}/${name.replace(/(\.[a-z0-9]+)$/i, `-${stamp}$1`)}`, buf, type);

  // The presenter says a name: filmed again from the same photo, saying it the new way.
  const opening = plan.scenes[0];
  const presenterClip = media.assets.presenter?.url as string | undefined;
  if (opening?.speaker?.asset === 'presenter' && presenterClip && sayAs(opening.narration, plan.pronounce) !== opening.narration) {
    const photoUrl = presenterClip.replace(/presenter(-\d+)?\.mp4(\?.*)?$/, 'presenter.jpg');
    const res = await fetch(photoUrl);
    if (!res.ok) throw new Error(`No presenter photo at ${photoUrl}`);
    const photo = Buffer.from(await res.arrayBuffer());
    console.log(`🎭 Presenter says: "${sayAs(opening.narration, plan.pronounce)}"`);
    const clip = await talkingPresenter(photo, opening.narration, process.env.PRESENTER_ACTION || '', plan.style, media.format === 'horizontal', plan.pronounce);
    const url = await store(clip, 'presenter.mp4', 'video/mp4');
    const before = media.assets.presenter.url;
    await addPresenter(plan, media, Promise.resolve({ clip, url }));
    if (media.assets.presenter.url === before) throw new Error('The new presenter clip was not usable');
  }

  // The narrator says every scene nobody in a clip says.
  const clipWords = media.clipWords || {};
  const needed = plan.scenes.map((_: unknown, i: number) => i).filter((i: number) => !(plan.scenes[i].speaker && clipWords[plan.scenes[i].speaker.asset]));
  const lines = needed.map((i: number) => plan.scenes[i].narration);
  if (lines.some((line: string) => sayAs(line, plan.pronounce) !== line)) {
    const recorded = await recordVoice(lines, 'English', plan, store);
    media.voice = { ...recorded, scenes: needed, lufs: await measureLufs(recorded.url) };
  }

  const props = buildProps(plan, media);
  const marked = freeRender({ props, plan, media, durationSeconds: (props as { duration: number }).duration, usage: [], warnings: [] } as never);
  console.log(`🔄 Rendering ${lead.website_domain}...`);
  const rendered = await renderSmartVideo(marked.props, (p) => p % 25 === 0 && console.log(`   ${p}%`), FREE_RENDER_SCALE);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'video.mp4'), await levelLoudness(rendered));
  await fs.writeFile(path.join(outDir, 'made.json'), JSON.stringify({ plan, props: marked.props, media, durationSeconds: marked.durationSeconds }));
  console.log(JSON.stringify({ lead: lead.website_domain, out: outDir, seconds: marked.durationSeconds, voice: media.voice?.url, presenter: media.assets.presenter?.url }, null, 2));
}

main().catch((error) => {
  console.error('❌ fix-name failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
