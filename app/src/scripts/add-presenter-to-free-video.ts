/**
 * Puts the presenter clip a free video ad already paid for into its video (owner 2026-10-25, m8core.com: the LTX clip
 * came back 19 s after the video stopped waiting, so the narrator said scene 1; "if we already made it, add that in").
 * Reads the job's saved plan and its presenter.mp4, makes scene 1 the presenter's (addPresenter, as a live job does),
 * rebuilds the props, renders the free version (SAMPLE stamp, 720p) as video-presenter.mp4, and points the job and the
 * lead at it. The old video.mp4 stays in storage.
 *
 * Run from app/:  ADD_PRESENTER_OK=1 npx tsx src/scripts/add-presenter-to-free-video.ts <view token>
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

async function main(): Promise<void> {
  const [token] = process.argv.slice(2);
  if (process.env.ADD_PRESENTER_OK !== '1') throw new Error('Renders on the Remotion server and changes the lead: set ADD_PRESENTER_OK=1.');
  const { getLeadByToken, leadsTable } = await import('@/lib/free-video/leads');
  const { freeRender } = await import('@/lib/free-video/runner');
  const { FREE_RENDER_SCALE } = await import('@/lib/free-video/config');
  const { download, jobDir, jobsTable, publicUrl, upload } = await import('@/lib/smart-video/jobs');
  const { addPresenter, buildProps } = await import('@/lib/smart-video/pipeline');
  const { levelLoudness, renderSmartVideo } = await import('@/lib/smart-video/render');

  const lead = await getLeadByToken(token);
  if (!lead?.job_id || lead.status !== 'done') throw new Error('No finished lead with this token');
  const { data, error } = await jobsTable().select('user_id, job, plan').eq('id', lead.job_id).maybeSingle();
  if (error || !data?.plan) throw new Error(`No saved plan: ${error?.message}`);
  const dir = jobDir(data.user_id, lead.job_id);
  const { plan, media, brief } = data.plan;
  if (plan.scenes[0]?.speaker) throw new Error('Scene 1 already has a speaker');

  const clip = await download(`${dir}/presenter.mp4`);
  await addPresenter(plan, media, Promise.resolve({ clip, url: publicUrl(`${dir}/presenter.mp4`) }));
  if (plan.scenes[0]?.speaker?.asset !== 'presenter') throw new Error('The presenter clip could not be used (see the warning above)');

  const props = buildProps(plan, media);
  const marked = freeRender({ props, plan, media, durationSeconds: (props as { duration: number }).duration, usage: [], warnings: [] } as never);
  console.log(`🔄 Rendering ${lead.website_domain} with its presenter...`);
  const rendered = await renderSmartVideo(marked.props, (p) => p % 25 === 0 && console.log(`   ${p}%`), FREE_RENDER_SCALE);
  const videoUrl = await upload(`${dir}/video-presenter.mp4`, await levelLoudness(rendered), 'video/mp4');

  const job = { ...data.job, videoUrl, durationSeconds: marked.durationSeconds, updatedAt: new Date().toISOString() };
  const saved = await jobsTable().update({ plan: { plan, props: marked.props, media, brief }, job }).eq('id', lead.job_id);
  if (saved.error) throw new Error(`Job not saved: ${saved.error.message}`);
  const live = { ...(lead.live ?? {}), presenterPhoto: publicUrl(`${dir}/presenter.jpg`) };
  const leadSaved = await leadsTable().update({ video_url: videoUrl, duration_seconds: Math.round(marked.durationSeconds * 10) / 10, live }).eq('id', lead.id);
  if (leadSaved.error) throw new Error(`Lead not saved: ${leadSaved.error.message}`);
  console.log(JSON.stringify({ lead: lead.website_domain, videoUrl, seconds: marked.durationSeconds, firstLine: plan.scenes[0].narration }, null, 2));
}

main().catch((error) => {
  console.error('❌ add-presenter failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
