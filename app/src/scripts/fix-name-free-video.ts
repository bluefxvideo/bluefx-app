/**
 * Fixes how the voice-over says a name in a finished free video ad (owner 2026-10-27, Jim Carlough: "My last name was
 * not pronounced correctly. It's pronounced Car Low."). The narrator records every line it says again with the name
 * spelled the way it sounds (SAY), the captions keep the real spelling (a caption span, the way numbers show as digits),
 * the free version is rendered (SAMPLE stamp, 720p) and the job and the lead point at it. The old files stay in storage.
 *
 * Run from app/:  FIX_NAME_OK=1 npx tsx src/scripts/fix-name-free-video.ts <view token> <written name> <spoken spelling>
 */
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

async function main(): Promise<void> {
  const [token, written, say] = process.argv.slice(2);
  if (process.env.FIX_NAME_OK !== '1') throw new Error('Records a new voice (paid), renders and changes the lead: set FIX_NAME_OK=1.');
  if (!token || !written || !say) throw new Error('Usage: <view token> <written name> <spoken spelling>');
  const { getLeadByToken, leadsTable } = await import('@/lib/free-video/leads');
  const { freeRender } = await import('@/lib/free-video/runner');
  const { FREE_RENDER_SCALE } = await import('@/lib/free-video/config');
  const { jobDir, jobsTable, upload } = await import('@/lib/smart-video/jobs');
  const { buildProps, recordVoice } = await import('@/lib/smart-video/pipeline');
  const { measureLufs } = await import('@/lib/smart-video/prepare-assets');
  const { scriptWords } = await import('@/lib/smart-video/timing');
  const { levelLoudness, renderSmartVideo } = await import('@/lib/smart-video/render');

  const lead = await getLeadByToken(token);
  if (!lead?.job_id || lead.status !== 'done') throw new Error('No finished lead with this token');
  const { data, error } = await jobsTable().select('user_id, job, plan').eq('id', lead.job_id).maybeSingle();
  if (error || !data?.plan) throw new Error(`No saved plan: ${error?.message}`);
  const dir = jobDir(data.user_id, lead.job_id);
  const { plan, media, brief } = data.plan;

  // Each line with the name: the voice reads SAY, the caption shows the written word (with its punctuation).
  const digits = { ...(media.digits ?? {}) };
  let changed = 0;
  for (const scene of plan.scenes) {
    const before = scene.narration.trim();
    if (!before.includes(written)) continue;
    const after = before.split(written).join(say);
    const spans = [...(digits[before] ?? [])];
    scriptWords(after).forEach((word, i) => {
      if (word.raw.includes(say)) spans.push({ from: i, to: i, text: word.raw.split(say).join(written) });
    });
    digits[after] = spans.sort((a, b) => a.from - b.from);
    scene.narration = after;
    changed++;
    console.log(`✏️ "${after}"`);
  }
  if (!changed) throw new Error(`"${written}" is not in the script`);
  media.digits = digits;

  // The narrator says every scene nobody in a clip says (the presenter's own scene keeps its clip).
  const clipWords = media.clipWords || {};
  const needed = plan.scenes.map((_: unknown, i: number) => i).filter((i: number) => !(plan.scenes[i].speaker && clipWords[plan.scenes[i].speaker.asset]));
  const stamp = Date.now();
  const store = (buf: Buffer, name: string, type: string) => upload(`${dir}/${name.replace(/(\.[a-z0-9]+)$/i, `-${stamp}$1`)}`, buf, type);
  const recorded = await recordVoice(needed.map((i: number) => plan.scenes[i].narration), 'English', plan, store);
  media.voice = { ...recorded, scenes: needed, lufs: await measureLufs(recorded.url) };

  const props = buildProps(plan, media);
  const marked = freeRender({ props, plan, media, durationSeconds: (props as { duration: number }).duration, usage: [], warnings: [] } as never);
  console.log(`🔄 Rendering ${lead.website_domain} with the name said as "${say}"...`);
  const rendered = await renderSmartVideo(marked.props, (p) => p % 25 === 0 && console.log(`   ${p}%`), FREE_RENDER_SCALE);
  const videoUrl = await upload(`${dir}/video-name-${stamp}.mp4`, await levelLoudness(rendered), 'video/mp4');

  const job = { ...data.job, videoUrl, durationSeconds: marked.durationSeconds, updatedAt: new Date().toISOString() };
  const saved = await jobsTable().update({ plan: { plan, props: marked.props, media, brief }, job }).eq('id', lead.job_id);
  if (saved.error) throw new Error(`Job not saved: ${saved.error.message}`);
  const leadSaved = await leadsTable().update({ video_url: videoUrl, duration_seconds: Math.round(marked.durationSeconds * 10) / 10 }).eq('id', lead.id);
  if (leadSaved.error) throw new Error(`Lead not saved: ${leadSaved.error.message}`);
  console.log(JSON.stringify({ lead: lead.website_domain, videoUrl, seconds: marked.durationSeconds, voice: recorded.url }, null, 2));
}

main().catch((error) => {
  console.error('❌ fix-name failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
