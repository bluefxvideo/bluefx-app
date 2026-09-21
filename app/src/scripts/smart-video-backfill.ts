/**
 * One-time move of The Phantom's jobs from job.json / plan.json files in the public
 * script-videos bucket into the private smart_video_jobs table.
 *
 * Run from app/ AFTER the migration:  node --env-file=.env.local --import tsx src/scripts/smart-video-backfill.ts
 * It only copies. The old json files are removed separately, once the table is confirmed.
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'script-videos';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function readJson(path: string): Promise<unknown | null> {
  const { data } = await supabase.storage.from(BUCKET).download(path);
  return data ? JSON.parse(Buffer.from(await data.arrayBuffer()).toString('utf-8')) : null;
}

async function main() {
  const { data: users } = await supabase.storage.from(BUCKET).list('smart-video', { limit: 1000 });
  let copied = 0;
  for (const user of users || []) {
    const { data: jobs } = await supabase.storage.from(BUCKET).list(`smart-video/${user.name}`, { limit: 1000 });
    for (const entry of jobs || []) {
      const dir = `smart-video/${user.name}/${entry.name}`;
      const job = (await readJson(`${dir}/job.json`)) as { id: string; userId: string; parentId?: string; status: string; createdAt: string; updatedAt: string } | null;
      if (!job) continue;
      const plan = await readJson(`${dir}/plan.json`);
      const { error } = await supabase.from('smart_video_jobs').upsert({
        id: job.id,
        user_id: job.userId,
        parent_id: job.parentId ?? null,
        status: job.status,
        job,
        plan,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      });
      if (error) throw new Error(`${dir}: ${error.message}`);
      copied++;
      console.log(`✅ ${dir} (${job.status}${plan ? ', with plan' : ''})`);
    }
  }
  console.log(`Done: ${copied} jobs copied.`);
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
