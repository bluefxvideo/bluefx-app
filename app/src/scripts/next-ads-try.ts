/**
 * Writes the next 3 video ads for one finished free video lead, without saving anything: the ideas, the checks and the
 * first frames go to a local folder (about $0.20: 1 Gemini call, 3 GPT Image 2.5 frames).
 *
 * Run from app/:  npx tsx src/scripts/next-ads-try.ts <website domain> <output folder>
 */
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });

async function main() {
  const [domain, out] = process.argv.slice(2);
  if (!domain || !out) throw new Error('usage: next-ads-try.ts <website domain> <output folder>');
  // Imported after dotenv: the clients read the environment when they load.
  const { createAdminClient } = await import('@/app/supabase/server');
  const { makeNextAds } = await import('@/lib/free-video/next-ads');
  const admin = createAdminClient() as any;
  const { data: lead, error } = await admin
    .from('free_video_leads')
    .select('id, job_id, website_domain')
    .eq('website_domain', domain)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !lead?.job_id) throw new Error(error?.message || `No finished free video ad for ${domain}`);
  const { data: job, error: jobError } = await admin.from('smart_video_jobs').select('plan').eq('id', lead.job_id).maybeSingle();
  if (jobError || !job?.plan) throw new Error(jobError?.message || 'The job has no saved plan');

  const started = Date.now();
  const { result, frames } = await makeNextAds(domain, job.plan, null);
  fs.mkdirSync(out, { recursive: true });
  frames.forEach((frame, index) => frame && fs.writeFileSync(path.join(out, `n${index + 2}.jpg`), frame));
  fs.writeFileSync(path.join(out, 'next-ads.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.log(`✅ ${result.ads.length} video ads written in ${Math.round((Date.now() - started) / 1000)} s, about $${result.costUsd}`);
}

main().catch((error) => {
  console.error('❌', error);
  process.exit(1);
});
