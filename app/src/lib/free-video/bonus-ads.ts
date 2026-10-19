/**
 * The 3 bonus video ads (owner 2026-10-19: "made when / after they buy"): a lead who buys the AI Media Machine while
 * the 2 free bonuses run (CLEAN_COPY_HOURS after the free video ad was ready) gets the next 3 video ads the result page
 * showed (next-ads.ts) made in the new account, at no credits, "ready to post within an hour" as the page promises.
 *
 * - The 3 rows show in Your video ads at once; they are made one after the other (3 renders at once would slow every
 *   paying user's video down), and the ones whose turn has not come say so (job.bonus.waiting, kept alive by a
 *   heartbeat so they never look dead).
 * - Each is a normal Phantom job with an AI presenter: the director writes the script from the website's text and
 *   the written ad's brief, and the presenter is the person on the card the buyer saw (the card's first frame, made
 *   vertical), so the video ad opens the way its card did.
 * - The website's text and photos come from the free job (no second read of the website); a free job whose working
 *   files are gone reads the website again.
 * - The ids come from the lead, the account and the number, so a second start (the sweep runs every few minutes) finds
 *   the same rows. One that died with its server (a deploy) or failed is made again once; one that fails twice stays
 *   failed with a plain line, and the owner gets an alert.
 *
 * Server only. The sweep calls startBonusAds from copyLeadsToAccounts (claim.ts) for every lead that bought.
 */
import { createHash } from 'node:crypto';
import { alertOwner } from '@/lib/free-video/alerts';
import { CLEAN_COPY_HOURS } from '@/lib/free-video/offer';
import { websiteTextOf } from '@/lib/free-video/next-ads';
import { inBackground } from '@/lib/free-video/unlock';
import { displayDomain } from '@/lib/free-video/website';
import { createJob, jobsTable, runSmartVideoJob, type SavedPlan, STALE_AFTER_MS, touchJob, writeJob } from '@/lib/smart-video/jobs';
import type { ClientFile } from '@/lib/smart-video/prepare-assets';
import { usage } from '@/lib/smart-video/usage';
import type { FreeVideoLead, FreeVideoNextAd } from '@/types/free-video';
import type { SmartVideoJob } from '@/types/smart-video';

const HOUR_MS = 3_600_000;
/** A bonus video ad is made at most twice (a death or a failure, then once more). */
const MAX_ATTEMPTS = 2;
/** What the buyer reads on a bonus video ad that could not be made, twice. */
export const BONUS_FAILED = 'This bonus video ad could not be made. We are on it: it shows up here as soon as it is made, at no credits.';

const PRESENTER_MODEL = 'openai/gpt-image-2.5/flare/edit';

/** The job id of bonus video ad n of a lead in an account: the same every time. */
export function bonusIdOf(leadId: string, userId: string, n: number): string {
  const h = createHash('sha256').update(`free-video-bonus:${leadId}:${userId}:${n}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Whether a lead's purchase earns the 3 bonus video ads: bought while the bonus ran, with its 3 written. A customer who already had the AI Media Machine never bought through the page. */
export function bonusEarned(lead: Pick<FreeVideoLead, 'status' | 'is_customer' | 'bought_at' | 'finished_at' | 'next_ads'>): boolean {
  if (lead.status !== 'done' || lead.is_customer || !lead.bought_at || !lead.finished_at) return false;
  if ((lead.next_ads?.ads?.length ?? 0) !== 3) return false;
  const bought = Date.parse(lead.bought_at);
  const finished = Date.parse(lead.finished_at);
  return Number.isFinite(bought) && Number.isFinite(finished) && bought <= finished + CLEAN_COPY_HOURS * HOUR_MS;
}

/** The note the director reads beside the website's text; its first line is the video ad's name in Your video ads. */
function noteOf(ad: FreeVideoNextAd, domain: string): string {
  return [
    ad.title,
    `Make this video ad for ${domain}: ${ad.brief}`,
    `Open the video ad with this line, word for word: "${ad.hook}"`,
    'A presenter says that first line on camera.',
  ].join('\n');
}

/** Leads whose bonus video ads this process is making: a second start does nothing. */
const making = new Set<string>();

type Row = { id: string; status: string; job: SmartVideoJob; updated_at: string };

/**
 * Starts (or picks up) the 3 bonus video ads of a lead in its buyer's account. Returns at once; the 3 are made in the
 * background. Safe to call again: rows that exist are not made twice, and a run another server is doing is left alone.
 */
export async function startBonusAds(lead: FreeVideoLead, userId: string): Promise<void> {
  if (making.has(lead.id) || !bonusEarned(lead) || !lead.next_ads) return;
  const ads = lead.next_ads.ads;
  const ids = ads.map((ad) => bonusIdOf(lead.id, userId, ad.n));
  const { data, error } = await jobsTable().select('id, status, job, updated_at').in('id', ids).eq('user_id', userId);
  if (error) throw new Error(`The bonus video ads could not be read: ${error.message}`);
  const rows = new Map(((data ?? []) as Row[]).map((row) => [row.id, row]));
  const alive = (row: Row) => row.status !== 'done' && row.status !== 'failed' && Date.now() - Date.parse(row.updated_at) < STALE_AFTER_MS;
  // Another server is making them (its heartbeat is fresh): leave it alone.
  if ([...rows.values()].some(alive)) return;
  const todo = ads.filter((ad, index) => {
    const row = rows.get(ids[index]);
    if (!row) return true;
    if (row.status === 'done') return false;
    return (row.job.bonus?.attempt ?? 1) < MAX_ATTEMPTS;
  });
  if (!todo.length) return;

  const domain = displayDomain(lead.website_domain);
  const now = new Date().toISOString();
  // Every row that is not there yet shows at once, waiting for its turn.
  for (const [index, ad] of ads.entries()) {
    if (rows.has(ids[index])) continue;
    const job: SmartVideoJob = {
      id: ids[index],
      userId,
      status: 'reading',
      brief: noteOf(ad, domain),
      link: lead.website_url,
      length: 'auto',
      format: 'vertical',
      look: 'auto',
      voiceOver: true,
      music: true,
      presenter: true,
      creditsUsed: 0,
      bonus: { leadId: lead.id, n: ad.n, site: domain, waiting: true, attempt: 1 },
      createdAt: now,
      updatedAt: now,
    };
    try {
      await createJob(job);
      rows.set(job.id, { id: job.id, status: job.status, job, updated_at: now });
    } catch (failure) {
      // Written a moment ago by another start: that one makes it.
      if (!/duplicate|unique/i.test(String(failure))) throw failure;
      return;
    }
  }

  making.add(lead.id);
  console.log(`🔄 [free-video] Lead ${lead.id}: making ${todo.length} bonus video ads in account ${userId}`);
  inBackground(`The bonus video ads of lead ${lead.id}`, () =>
    makeInTurn(lead, userId, todo.map((ad) => ({ ad, row: rows.get(bonusIdOf(lead.id, userId, ad.n)) as Row }))).finally(() => making.delete(lead.id))
  );
}

/** Makes the bonus video ads one after the other; the waiting ones keep a heartbeat. */
async function makeInTurn(lead: FreeVideoLead, userId: string, queue: { ad: FreeVideoNextAd; row: Row }[]): Promise<void> {
  const waiting = new Set(queue.map(({ row }) => row.id));
  const heartbeat = setInterval(() => waiting.forEach((id) => void touchJob(id).catch(() => undefined)), 45_000);
  const material = await materialOf(lead).catch((error) => {
    console.warn(`⚠️ [free-video] Lead ${lead.id}: the free job's text and photos could not be read, the website is read again:`, String(error).slice(0, 160));
    return null;
  });
  const failed: number[] = [];
  try {
    for (const { ad, row } of queue) {
      waiting.delete(row.id);
      const attempt = row.status === 'reading' && row.job.bonus?.waiting && !row.job.error ? (row.job.bonus?.attempt ?? 1) : (row.job.bonus?.attempt ?? 1) + 1;
      const start: SmartVideoJob = {
        ...row.job,
        status: 'reading',
        error: undefined,
        videoUrl: undefined,
        renderProgress: undefined,
        bonus: { ...(row.job.bonus as NonNullable<SmartVideoJob['bonus']>), waiting: false, attempt },
        updatedAt: new Date().toISOString(),
      };
      // A direct save: a failed row goes back to work (writeJob never revives a final one).
      const { error } = await jobsTable().update({ status: start.status, job: start, updated_at: start.updatedAt }).eq('id', start.id).eq('user_id', userId);
      if (error) {
        console.error(`❌ [free-video] Bonus video ad ${start.id} could not start:`, error.message);
        failed.push(ad.n);
        continue;
      }
      await runSmartVideoJob(start, [], {
        ...(material ? { readLink: async () => material } : {}),
        options: (base) => ({ ...base, presenter: true, presenterCast: ad.imageUrl ? () => presenterFromCard(ad, ad.imageUrl as string) : undefined }),
      });
      const { data: after } = await jobsTable().select('status, job').eq('id', start.id).maybeSingle();
      if (after?.status === 'done') {
        console.log(`✅ [free-video] Bonus video ad #${ad.n} of lead ${lead.id} is ready in account ${userId}`);
        continue;
      }
      failed.push(ad.n);
      // The second failure stays: one plain line for the buyer, and the owner hears about it.
      if (attempt >= MAX_ATTEMPTS && after?.job) {
        await writeJob({ ...(after.job as SmartVideoJob), id: start.id }, { status: 'failed', error: BONUS_FAILED }).catch(() => undefined);
      }
    }
  } finally {
    clearInterval(heartbeat);
  }
  if (failed.length) {
    await alertOwner(
      [
        {
          key: `bonus:${lead.id}:${failed.join('-')}:${queue.length}`,
          line: `Bonus video ads ${failed.map((n) => `#${n}`).join(', ')} of ${lead.website_domain} (lead ${lead.id}) failed in the buyer's account ${userId}. The sweep tries a failed one once more; after that it needs a person.`,
        },
      ],
      'a bonus video ad failed'
    ).catch(() => undefined);
  }
}

/** The free job's website text and its real photos, as the bonus jobs read them instead of the website. */
async function materialOf(lead: FreeVideoLead): Promise<{ brief: string; files: ClientFile[] } | null> {
  if (!lead.job_id || lead.files_cleaned_at) return null;
  const { data, error } = await jobsTable().select('plan').eq('id', lead.job_id).maybeSingle();
  if (error || !data?.plan) return null;
  const saved = data.plan as SavedPlan;
  const brief = websiteTextOf(saved).trim();
  if (brief.length < 200) return null;
  // The website's own pictures the free job kept (photos, products and the logo), never what it made from them.
  const media = saved.media?.assets ?? {};
  const own = (saved.plan?.assets ?? []).filter((asset) => ['photo', 'product', 'logo'].includes(asset.role) && media[asset.id]?.kind === 'image' && media[asset.id]?.url);
  const files: ClientFile[] = [];
  for (const asset of own.slice(0, 12)) {
    const url = media[asset.id].url;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) continue;
      const name = new URL(url).pathname.split('/').pop() || `${asset.id}.jpg`;
      files.push({ filename: name, data: Buffer.from(await res.arrayBuffer()) });
    } catch {
      /* one picture less */
    }
  }
  return { brief, files };
}

/** The person on the card as the video's presenter: the card's 4:5 first frame made vertical, the same person and place (about $0.07). */
export async function presenterFromCard(ad: FreeVideoNextAd, frameUrl: string): Promise<{ photo: Buffer; action: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not configured');
  const res = await fetch(`https://fal.run/${PRESENTER_MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${key}` },
    body: JSON.stringify({
      prompt:
        'The same photo as a vertical 9:16 smartphone photo: the same person with the same face, hair, skin, clothes and expression, in the same place and light, holding or showing the same thing; a little more of the place shows above and below. Looking into the camera, mouth closed, a slight smile. Photorealistic, natural light, realistic skin texture. Nothing written anywhere: no text, no letters, no logos, no watermark.',
      image_urls: [frameUrl],
      image_size: { width: 1088, height: 1920 },
      quality: 'high',
      output_format: 'jpeg',
      num_images: 1,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`The presenter from the card failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  usage.presenterPhoto();
  const photo = Buffer.from(await (await fetch(json.images[0].url)).arrayBuffer());
  return { photo, action: ad.action || 'They keep doing what they do in the photo while they talk.' };
}
