/**
 * Remakes one lead's free video ad as a real job (owner 2026-10-25, Rick at cbdhealthcollection.com: "remake his
 * video properly, make it really good, even if we spend a little more, keep the sample on"). Same as the live free
 * job (system user, saved plan, the SAMPLE stamp, 720p, presenter), with: the client's photos given as files (the
 * site's age gate kept the link reader from them), a note of our own, and the photo look instead of the whiteboard.
 * The lead is NOT changed here: the script prints the new job's video, presenter photo and plan for the owner to check.
 *
 * Run from app/ (spends real API money; the render goes to the Remotion server .env.local points at):
 *   REMAKE_ALLOW_PAID=1 npx tsx src/scripts/remake-free-video.ts <view token> <look> <note file> <photo url>...
 */
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

async function main(): Promise<void> {
  const [token, look, noteFile, ...photoUrls] = process.argv.slice(2);
  if (process.env.REMAKE_ALLOW_PAID !== '1') throw new Error('Spends real API money: set REMAKE_ALLOW_PAID=1 after telling the owner.');
  const { getLeadByToken, readSettings } = await import('@/lib/free-video/leads');
  const { readBusinessSite, displayDomain } = await import('@/lib/free-video/website');
  const { freeOptions, freeRender } = await import('@/lib/free-video/runner');
  const { FREE_RENDER_SCALE } = await import('@/lib/free-video/config');
  const { createJob, runSmartVideoJob, upload, jobDir, jobsTable } = await import('@/lib/smart-video/jobs');
  const { adFacts, whyItWorks } = await import('@/lib/free-video/why-it-works');

  const lead = await getLeadByToken(token);
  if (!lead) throw new Error('No lead with this token');
  const settings = await readSettings(true);
  if (!settings?.system_user_id) throw new Error('No system user');
  const userId = settings.system_user_id;
  const id = randomUUID();
  const dir = jobDir(userId, id);

  const uploads: { name: string; path: string }[] = [];
  for (const [i, url] of photoUrls.entries()) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Photo ${url}: ${res.status}`);
    const ext = /\.png($|\?)/i.test(url) ? 'png' : 'jpg';
    const name = `client-${String(i + 1).padStart(2, '0')}.${ext}`;
    await upload(`${dir}/uploads/${name}`, Buffer.from(await res.arrayBuffer()), ext === 'png' ? 'image/png' : 'image/jpeg');
    uploads.push({ name, path: `${dir}/uploads/${name}` });
  }
  console.log(`📎 ${uploads.length} client photos uploaded`);

  const now = new Date().toISOString();
  const job = { id, userId, status: 'reading', brief: fs.readFileSync(noteFile, 'utf8').trim(), link: lead.website_url, length: 'auto', format: 'vertical', look, voiceOver: true, music: true, createdAt: now, updatedAt: now } as const;
  await createJob(job as never);
  console.log(`🎬 Job ${id} for ${lead.website_domain}`);

  let siteText = '';
  let kept: unknown[] = [];
  let why: string[] = [];
  await runSmartVideoJob(job as never, uploads, {
    readLink: async (link) => {
      const read = await readBusinessSite(link);
      siteText = read.brief;
      console.log(`🔗 Site read: ${read.files.length} photos, ${read.brief.length} characters`);
      return read;
    },
    options: (base, assets) => {
      kept = assets;
      const free = freeOptions(base, undefined, undefined, undefined, siteText);
      // Quality over cost (owner): the client's look, the full director, the photos moving.
      return { ...free, look: look as never, director: undefined, stillCamera: false };
    },
    beforeRender: (result) => {
      void whyItWorks(result.plan, adFacts(result, kept as never, siteText, displayDomain(lead.website_domain))).then((lines) => (why = lines)).catch(() => undefined);
      return freeRender(result);
    },
    renderScale: FREE_RENDER_SCALE,
  });

  const { data } = await jobsTable().select('status, job, plan').eq('id', id).maybeSingle();
  const done = data?.job;
  const usd = (done?.usage ?? []).reduce((sum: number, entry: { usd: number }) => sum + entry.usd, 0);
  console.log(JSON.stringify({ id, status: data?.status, videoUrl: done?.videoUrl, durationSeconds: done?.durationSeconds, error: done?.error, usd: Math.round(usd * 1000) / 1000, presenterSpeaks: data?.plan?.plan?.scenes?.[0]?.speaker?.asset === 'presenter', style: data?.plan?.plan?.style, script: (data?.plan?.plan?.scenes ?? []).map((s: { narration: string }) => s.narration), why, warnings: done?.warnings }, null, 2));
}

main().catch((error) => {
  console.error('❌ remake failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
