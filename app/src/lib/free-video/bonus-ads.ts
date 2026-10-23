/**
 * The 3 bonus video ads (owner 2026-10-19; since 2026-10-23 for every account a free video ad lands in, whenever the
 * purchase): the account gets the next 3 video ads the result page showed (next-ads.ts), each made at no credits when the buyer clicks it (owner: "They click on it, and I think that's simple as it
 * gets"; nothing is written or made before that click).
 *
 * - The sweep hands the lead's 3 to the account (offerBonusAds: next_ads.buyerId) once the purchase is paired with the
 *   lead and the account exists (claim.ts copyLeadsToAccounts).
 * - Make a Video Ad lists them (bonusVideoAdsOf) and a click makes one (makeBonusVideoAd): a normal Phantom job with an
 *   AI presenter, written by the director from the website's text and the card's title and teaser. The presenter is
 *   the person on the card (the card's picture made vertical), so the video ad opens the way its card did. The
 *   website's text and photos come from the free job (no second read of the website); a free job whose working files
 *   are gone reads the website again.
 * - The job's id comes from the lead, the account and the number: a second click opens the same video ad. One that
 *   failed (or died with its server) is made again on the next click, at no credits, up to MAX_ATTEMPTS; the owner
 *   gets an alert from the second failure on.
 *
 * Server only. NEVER re-export anything from here in a server-action file (actions/tools/bonus-video-ads.ts wraps it).
 */
import { createHash } from 'node:crypto';
import { alertOwner } from '@/lib/free-video/alerts';
import { FREE_DIRECTOR, freeNote } from '@/lib/free-video/config';
import { checkFreeScript } from '@/lib/free-video/script-checks';
import { getLead, leadsTable } from '@/lib/free-video/leads';
import { websiteTextOf } from '@/lib/free-video/next-ads';
import { inBackground } from '@/lib/free-video/unlock';
import { displayDomain } from '@/lib/free-video/website';
import { libraryTrackUrl } from '@/lib/smart-video/music-library';
import { createJob, jobsTable, runSmartVideoJob, type SavedPlan, STALE_AFTER_MS } from '@/lib/smart-video/jobs';
import type { ClientFile } from '@/lib/smart-video/prepare-assets';
import { usage } from '@/lib/smart-video/usage';
import type { BonusVideoAd, FreeVideoLead, FreeVideoNextAd, FreeVideoNextAdKind } from '@/types/free-video';
import type { SmartVideoJob } from '@/types/smart-video';

/** A bonus video ad is made at most this many times (a failure or a death, then again on the next click). */
const MAX_ATTEMPTS = 3;

const PRESENTER_MODEL = 'openai/gpt-image-2.5/flare/edit';

/** The job id of bonus video ad n of a lead in an account: the same every time. */
export function bonusIdOf(leadId: string, userId: string, n: number): string {
  const h = createHash('sha256').update(`free-video-bonus:${leadId}:${userId}:${n}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * The sweep's share: the lead's 3 become the account's (once), for every account a free video ad is copied into:
 * a buyer whenever they bought, an existing customer, the owner (owner 2026-10-23: "Let them have it. It doesn't
 * matter if they buy, even if they buy it later on ... Every time I make a new ad, I should get that plus the three
 * unfinished ads"). Only the cards move; each video ad is made on its click. Cards already handed to another account
 * stay there. Throws on a failed write, so the next sweep tries again.
 */
export async function offerBonusAds(lead: FreeVideoLead, userId: string): Promise<void> {
  if (lead.status !== 'done' || !lead.next_ads || (lead.next_ads.ads?.length ?? 0) !== 3) return;
  if (lead.next_ads.buyerId) return;
  const { error } = await leadsTable()
    .update({ next_ads: { ...lead.next_ads, buyerId: userId } })
    .eq('id', lead.id);
  if (error) throw new Error(`The bonus video ads of lead ${lead.id} could not be handed to the account: ${error.message}`);
  console.log(`✅ [free-video] Lead ${lead.id}: its 3 bonus video ads wait in account ${userId}`);
}

/** What the director is told beside the website's text, by kind; the card only promised a teaser. */
const KIND_NOTE: Record<FreeVideoNextAdKind, (ad: FreeVideoNextAd) => string> = {
  'happy-customer': (ad) =>
    `A presenter tells the story of a real customer review on the website${ad.customer ? `, the one from ${ad.customer}` : ''}, as that customer, in the review's own words, with nothing the review does not say. Then one line about the business and its offer, and the call to action.`,
  // No list of fact kinds here: the director warned the buyer that "years, licenses, guarantees or awards" were missing (2026-10-19 test).
  'why-us': () => 'Show why customers choose this business: what makes it different, from facts on the website only.',
  'problem-fixer': () => "Open with the problem the business's main service fixes, the one most of its customers have, in their own everyday words. Then show how this business solves it, with its real services and details.",
  'act-now': () => "Lead with the business's best real offer from the website, and end with exactly how to get it: call, book, order or visit the website.",
};

/**
 * The note the director reads beside the website's text; its first line is the video ad's name in Your video ads. The
 * presenter comes from the job's options: a line about it here made the director warn the buyer that "no video clip
 * was provided for the presenter" while the presenter was in the video (2026-10-19 test).
 */
function noteOf(ad: FreeVideoNextAd, domain: string): string {
  return [ad.title, `Make this video ad for ${domain}: ${ad.teaser}`, KIND_NOTE[ad.kind](ad)].join('\n');
}

type Row = { id: string; status: string; job: SmartVideoJob; updated_at: string };

const working = (row: Row) => row.status !== 'done' && row.status !== 'failed' && Date.now() - Date.parse(row.updated_at) < STALE_AFTER_MS;

/** The bonus video ads waiting in an account, with how far each one is. Throws on a failed read. */
export async function bonusVideoAdsOf(userId: string): Promise<BonusVideoAd[]> {
  // Newest website first: each free video ad brings its own 3 (Make a Video Ad shows them by website).
  const { data, error } = await leadsTable()
    .select('id, website_domain, next_ads')
    .eq('next_ads->>buyerId', userId)
    .order('finished_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const leads = (data ?? []) as Pick<FreeVideoLead, 'id' | 'website_domain' | 'next_ads'>[];
  const cards = leads.flatMap((lead) => (lead.next_ads?.ads ?? []).map((ad) => ({ lead, ad, jobId: bonusIdOf(lead.id, userId, ad.n) })));
  if (!cards.length) return [];
  const { data: jobs, error: jobsError } = await jobsTable()
    .select('id, status, job, updated_at')
    .in(
      'id',
      cards.map((card) => card.jobId)
    )
    .eq('user_id', userId);
  if (jobsError) throw new Error(jobsError.message);
  const rows = new Map(((jobs ?? []) as Row[]).map((row) => [row.id, row]));
  return cards.map(({ lead, ad, jobId }) => {
    const row = rows.get(jobId);
    const state: BonusVideoAd['state'] = !row ? 'new' : row.status === 'done' ? 'done' : working(row) ? 'making' : 'failed';
    return { leadId: lead.id, n: ad.n, site: displayDomain(lead.website_domain), title: ad.title, teaser: ad.teaser, imageUrl: ad.imageUrl, jobId, state };
  });
}

/**
 * Makes bonus video ad n of a lead in the account (a click on Make a Video Ad), at no credits, and returns its job id.
 * A video ad already made or being made returns its id; one that failed or died is made again. Throws a plain message
 * when the lead's bonus is not this account's.
 */
export async function makeBonusVideoAd(userId: string, leadId: string, n: number, viaAfter = false): Promise<string> {
  const lead = await getLead(leadId);
  const ad = lead?.next_ads?.ads.find((item) => item.n === n);
  if (!lead || !ad || lead.next_ads?.buyerId !== userId) throw new Error('This bonus video ad is not in your account.');
  const jobId = bonusIdOf(lead.id, userId, n);
  const domain = displayDomain(lead.website_domain);
  const { data, error } = await jobsTable().select('id, status, job, updated_at').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Your bonus video ad could not be read: ${error.message}`);
  const row = data as Row | null;
  if (row && (row.status === 'done' || working(row))) return jobId;

  const now = new Date().toISOString();
  const attempt = row ? (row.job.bonus?.attempt ?? 1) + 1 : 1;
  if (attempt > MAX_ATTEMPTS) return jobId;
  const job: SmartVideoJob = {
    id: jobId,
    userId,
    status: 'reading',
    // The card's note first (its first line names the video ad), then the free video ad's own note: the same length,
    // hand-drawn look and drawing rules as the free video ad (owner 2026-10-23: "exactly the same way").
    brief: `${noteOf(ad, domain)}\n\n${freeNote(domain)}`,
    link: lead.website_url,
    length: 'auto',
    format: 'vertical',
    look: 'whiteboard',
    voiceOver: true,
    music: true,
    presenter: true,
    creditsUsed: 0,
    bonus: { leadId: lead.id, n: ad.n, site: domain, attempt },
    createdAt: row?.job.createdAt ?? now,
    updatedAt: now,
  };
  if (row) {
    // A direct save: a failed row goes back to work (writeJob never revives a final one).
    const { error: saveError } = await jobsTable().update({ status: job.status, job, updated_at: now }).eq('id', jobId).eq('user_id', userId);
    if (saveError) throw new Error(`Your bonus video ad could not start: ${saveError.message}`);
  } else {
    try {
      await createJob(job);
    } catch (failure) {
      // Two clicks at the same moment: the first one makes it.
      if (/duplicate|unique/i.test(String(failure))) return jobId;
      throw failure;
    }
  }
  console.log(`🔄 [free-video] Bonus video ad #${n} of lead ${lead.id} starts in account ${userId} (attempt ${attempt})`);
  inBackground(`Bonus video ad #${n} of lead ${lead.id}`, () => makeIt(lead, ad, job), viaAfter);
  return jobId;
}

/** One bonus video ad, made like any Phantom job, with the free job's material and the card's presenter. */
async function makeIt(lead: FreeVideoLead, ad: FreeVideoNextAd, job: SmartVideoJob): Promise<void> {
  const material = await materialOf(lead).catch((error) => {
    console.warn(`⚠️ [free-video] Lead ${lead.id}: the free job's text and photos could not be read, the website is read again:`, String(error).slice(0, 160));
    return null;
  });
  await runSmartVideoJob(job, [], {
    ...(material ? { readLink: async () => material } : {}),
    // The same script writer as the free video ad (owner 2026-10-23: "if you were able to make an initial ad, why are
    // you not able to exactly the same way make also the three other ads?"): Flash with the looser rules. The strict
    // director rejected bonus plans over block counts until its tries ran out, or timed out.
    // Like the free video ad too: a checked track from the music library (a new song took 3 tries and minutes, then fell
    // back to the library anyway: 9-minute bonus ads, 2026-10-23) and a still camera on animated photos.
    options: (base) => ({
      ...base,
      director: FREE_DIRECTOR,
      stillCamera: true,
      pickMusic: (musicPrompt, _style, script) => libraryTrackUrl(musicPrompt, script),
      checkScript: (plan) => checkFreeScript(plan, material?.brief ?? ''),
      presenter: true,
      presenterCast: ad.imageUrl ? () => presenterFromCard(ad, ad.imageUrl as string) : undefined,
    }),
  });
  const { data } = await jobsTable().select('status').eq('id', job.id).maybeSingle();
  if (data?.status === 'done') {
    console.log(`✅ [free-video] Bonus video ad #${ad.n} of lead ${lead.id} is ready in account ${job.userId}`);
    return;
  }
  if ((job.bonus?.attempt ?? 1) < 2) return;
  await alertOwner(
    [
      {
        key: `bonus:${lead.id}:${ad.n}:${job.bonus?.attempt}`,
        line: `Bonus video ad #${ad.n} of ${lead.website_domain} (lead ${lead.id}) failed again in the buyer's account ${job.userId} (attempt ${job.bonus?.attempt} of ${MAX_ATTEMPTS}). The buyer can click it once more; after that it needs a person.`,
      },
    ],
    'a bonus video ad failed'
  ).catch(() => undefined);
}

/** The free job's website text and the website's own pictures (photos, products, the logo), as the bonus job reads them instead of the website. */
async function materialOf(lead: FreeVideoLead): Promise<{ brief: string; files: ClientFile[] } | null> {
  if (!lead.job_id || lead.files_cleaned_at) return null;
  const { data, error } = await jobsTable().select('plan').eq('id', lead.job_id).maybeSingle();
  if (error || !data?.plan) return null;
  const saved = data.plan as SavedPlan;
  const brief = websiteTextOf(saved).trim();
  if (brief.length < 200) return null;
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

/** The person on the card as the video's presenter: the card's 4:5 picture made vertical, the same person and place (about $0.07). */
export async function presenterFromCard(ad: Pick<FreeVideoNextAd, 'action'>, frameUrl: string): Promise<{ photo: Buffer; action: string }> {
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
