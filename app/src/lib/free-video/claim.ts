/**
 * A free video ad moves into its buyer's AI Media Machine (owner 2026-10-07: "the client makes the video, but how will
 * he access it in the AI MM?"). The free job stays where it is, owned by the system user, so the $99 clean render and
 * the 30-day cleanup of its files work as before. The buyer gets a copy of it in their own Phantom videos:
 *
 * 1. Every file of the free job is copied (storage copy, nothing downloaded) from smart-video/<system user>/<job>/ to
 *    smart-video/<buyer>/<copy>/, except the finished video files.
 * 2. A job row for the buyer, status 'rendering', with every URL pointing at the copied files and the plan without the
 *    watermark, so "Edit this video" works on it like on any Phantom video. The copy id comes from the lead and the
 *    account, so a second claim (the sweep and a click at the same moment) finds the same row and copies nothing twice.
 * 3. In the background: the saved plan is rendered again without the watermark (as the $99 clean version is), levelled,
 *    checked and stored as video.mp4, and the row is done. A lead that has its $99 clean version gets that file instead;
 *    a lead whose working files are already gone (cleanup.ts, after 30 days) gets the free file, which is all there is,
 *    and so does a buyer who bought after the 3-day bonus (offer.ts cleanCopyEarned): one edit makes that copy clean.
 *
 * Callers: the sweep, for a lead whose email bought the AI Media Machine or already has it, and for the owner's own
 * free video ads (copyLeadsToAccounts), and /go/claim?t=<token> for a signed-in customer (the button on the video ad page).
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createAdminClient } from '@/app/supabase/server';
import { claimsTestLeads, fakeMode, OWNER_TEST_EMAILS, renderTargetAllowed } from '@/lib/free-video/config';
import { bonusEarned, startBonusAds } from '@/lib/free-video/bonus-ads';
import { asLead, customerIdByEmail, getLead, leadsTable, ownerAccountIdByEmail, readSettings, RETIRED_OWNER_TEST } from '@/lib/free-video/leads';
import { cleanCopyEarned } from '@/lib/free-video/offer';
import { checkCleanFile, cleanProps, inBackground } from '@/lib/free-video/unlock';
import { BUCKET, jobDir, jobsTable, publicUrl, readJob, STALE_AFTER_MS, touchJob, upload, withRetry, writeJob } from '@/lib/smart-video/jobs';
import { levelLoudness, renderSmartVideo } from '@/lib/smart-video/render';
import type { FreeVideoLead } from '@/types/free-video';
import type { SmartVideoJob } from '@/types/smart-video';

/** The finished video files of a job folder: never copied, the copy gets its own video.mp4. */
const FINISHED_FILE = /^(video\.mp4|clean-.+\.mp4)$/;

/** The line a copy carries when the free (marked) file stood in for its clean render. */
const MARKED_COPY = 'This copy still shows the BlueFX mark. Edit it once to make a version without the mark.';

/** The copy's job id: a UUID made from the lead and the account, the same every time. */
export function copyIdOf(leadId: string, userId: string): string {
  const h = createHash('sha256').update(`free-video-copy:${leadId}:${userId}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Copies one file inside the bucket. A file that is already there (a claim run again) counts as copied. */
async function copyFile(from: string, to: string): Promise<void> {
  await withRetry(`Copying ${path.basename(from)}`, async () => {
    const { error } = await createAdminClient().storage.from(BUCKET).copy(from, to);
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  });
}

/** The files of a job folder (the folder has no subfolders: storage lists those with a null id). */
async function filesIn(dir: string): Promise<string[]> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).list(dir, { limit: 1000 });
  if (error) throw new Error(`Could not list ${dir}: ${error.message}`);
  return (data ?? []).filter((entry) => entry.id !== null).map((entry) => entry.name);
}

/** How far back the owner's own finished free video ads are copied to his account. */
const OWNER_COPY_DAYS = 30;

/** Copies running in this process: the sweep must not start a second render of a copy that is still rendering. */
const finishing = new Set<string>();

/**
 * Puts a copy of this finished free video ad in the account's Phantom videos and returns the copy's job id. The row
 * shows at once; the clean render finishes it in the background. Safe to call again: the existing copy is returned,
 * and a copy whose render died (a deploy) is rendered again.
 */
export async function claimFreeVideo(lead: FreeVideoLead, userId: string, viaAfter = false): Promise<string> {
  if (lead.status !== 'done' || !lead.job_id || !lead.video_url) throw new Error('The free video ad is not finished');
  const copyId = copyIdOf(lead.id, userId);
  const existing = await readJob(userId, copyId);
  if (existing) {
    const dead = existing.status === 'failed' || (existing.status !== 'done' && Date.parse(existing.updatedAt) < Date.now() - STALE_AFTER_MS);
    // A copy that got the marked free file is rendered clean again on the next click, while the working files exist
    // (2026-10-07: every clean render failed its frame check for a day, so the owner's copy kept the mark).
    // Never for a buyer after the 3-day bonus: that copy keeps the mark until its owner edits it.
    const marked = existing.status === 'done' && Boolean(existing.warnings?.includes(MARKED_COPY)) && !lead.files_cleaned_at && cleanCopyEarned(lead);
    if ((dead || marked) && !finishing.has(copyId)) startFinish(lead, existing, viaAfter);
    return copyId;
  }

  const settings = await readSettings(true);
  const systemUserId = settings?.system_user_id;
  if (!systemUserId) throw new Error('No system user for free video ads');
  const { data: source, error } = await jobsTable().select('job, plan').eq('id', lead.job_id).eq('user_id', systemUserId).maybeSingle();
  if (error || !source?.job || !source?.plan) throw new Error(`The free job ${lead.job_id} could not be read: ${error?.message || 'no row'}`);

  // 1. The files.
  const fromDir = jobDir(systemUserId, lead.job_id);
  const toDir = jobDir(userId, copyId);
  for (const name of await filesIn(fromDir)) {
    if (!FINISHED_FILE.test(name)) await copyFile(`${fromDir}/${name}`, `${toDir}/${name}`);
  }

  // 2. The row. Every saved URL of the free job sits in its own folder, so the folder swap moves them all.
  const swap = <T,>(value: T): T => JSON.parse(JSON.stringify(value).split(`${fromDir}/`).join(`${toDir}/`)) as T;
  const freeJob = source.job as SmartVideoJob;
  const plan = swap(source.plan as { props: Record<string, unknown>; brief?: string });
  plan.props = cleanProps(plan.props);
  // The free job's brief is the funnel's instruction to the director: edits keep reading it from the plan.
  plan.brief = plan.brief ?? freeJob.brief;
  const now = new Date().toISOString();
  const job: SmartVideoJob = {
    ...swap(freeJob),
    id: copyId,
    userId,
    status: 'rendering',
    renderProgress: 0,
    // The first line is the card's title in the Phantom's video list.
    brief: `Your free video ad for ${lead.website_domain}`,
    parentId: undefined,
    note: undefined,
    creditsUsed: 0,
    usage: undefined,
    videoUrl: undefined,
    error: undefined,
    freeLeadId: lead.id,
    // The Phantom plays the free file with one line while the mark comes off (owner 2026-10-07: the making steps looked
    // like the video ad being made again).
    freePreviewUrl: lead.video_url ?? undefined,
    freeSite: lead.website_domain,
    createdAt: now,
    updatedAt: now,
  };
  const { error: insertError } = await jobsTable().insert({
    id: copyId,
    user_id: userId,
    parent_id: null,
    status: job.status,
    job,
    plan,
    created_at: now,
    updated_at: now,
  });
  // A claim at the same moment wrote the same row first: that one renders.
  if (insertError) {
    if (/duplicate|unique/i.test(insertError.message)) return copyId;
    throw new Error(`The copy could not be saved: ${insertError.message}`);
  }
  console.log(`✅ [free-video] Lead ${lead.id} (${lead.website_domain}) copied to account ${userId} as job ${copyId}`);

  // 3.
  startFinish(lead, job, viaAfter);
  return copyId;
}

function startFinish(lead: FreeVideoLead, job: SmartVideoJob, viaAfter: boolean): void {
  finishing.add(job.id);
  inBackground(`Finishing the free video ad copy ${job.id}`, () => finishCopy(lead, job).finally(() => finishing.delete(job.id)), viaAfter);
}

/** Step 3: the copy's own video.mp4, without the watermark when the files allow it, then the row is done. */
async function finishCopy(lead: FreeVideoLead, initial: SmartVideoJob): Promise<void> {
  let job = initial;
  const heartbeat = setInterval(() => touchJob(job.id).catch(() => undefined), 45_000);
  const settings = await readSettings(true);
  const freeDir = jobDir(settings?.system_user_id ?? '', lead.job_id ?? '');
  const toDir = jobDir(job.userId, job.id);
  // A finished copy rendered again (it had the marked file) saves under a new name: the CDN may still hold video.mp4.
  const target = initial.status === 'done' ? `clean-${Date.now().toString(36)}.mp4` : 'video.mp4';
  const copyFree = async () => {
    await copyFile(`${freeDir}/video.mp4`, `${toDir}/video.mp4`);
    return publicUrl(`${toDir}/video.mp4`);
  };
  try {
    let videoUrl: string;
    // The free file's length includes the 2 s end card; a clean version is the plan's own length.
    let durationSeconds = lead.duration_seconds ?? job.durationSeconds;
    const warnings: string[] = [];
    if (lead.clean_video_url) {
      // The $99 clean version exists.
      await copyFile(`${freeDir}/${path.basename(new URL(lead.clean_video_url).pathname)}`, `${toDir}/${target}`);
      videoUrl = publicUrl(`${toDir}/${target}`);
    } else if (lead.files_cleaned_at || fakeMode() || !renderTargetAllowed() || !cleanCopyEarned(lead)) {
      // The working files are gone (or this server may not render), or the sale came after the 3-day bonus: the free
      // file it is.
      videoUrl = await copyFree();
      warnings.push(MARKED_COPY);
    } else {
      const { data: row } = await jobsTable().select('plan').eq('id', job.id).eq('user_id', job.userId).maybeSingle();
      const props = (row?.plan as { props?: Record<string, unknown> } | undefined)?.props;
      try {
        if (!props) throw new Error('no saved plan');
        let lastSave = 0;
        const rendered = await renderSmartVideo(props, (percent) => {
          if (Date.now() - lastSave < 10_000) return;
          lastSave = Date.now();
          writeJob(job, { renderProgress: Math.round(percent) }).then((saved) => (job = saved), () => undefined);
        });
        const data = await levelLoudness(rendered);
        await checkCleanFile(data, props);
        videoUrl = await upload(`${toDir}/${target}`, data, 'video/mp4');
        durationSeconds = Number(props.duration) || durationSeconds;
      } catch (error) {
        console.error(`❌ [free-video] Clean render of copy ${job.id} failed, the free file stands in:`, error);
        videoUrl = await copyFree();
        warnings.push(MARKED_COPY);
      }
    }
    // warnings is always written, so a clean render again clears the "still shows the BlueFX mark" line.
    job = await writeJob(job, { status: 'done', videoUrl, renderProgress: 100, durationSeconds, warnings: warnings.length ? warnings : undefined });
    console.log(`✅ [free-video] Copy ${job.id} of lead ${lead.id} is ready in account ${job.userId}`);
  } catch (error) {
    console.error(`❌ [free-video] Copy ${job.id} of lead ${lead.id} failed:`, error);
    await writeJob(job, { status: 'failed', error: 'The free video ad could not be copied. Open the link in our email to try again.' }).catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * The sweep's share: every finished lead whose email bought the AI Media Machine in the last 3 days (attributeSales set
 * bought_at), and every lead of an existing customer that finished in the last 3 days (owner 2026-10-07: "if I have
 * the same email address I should have it all in my dashboard"), gets its copy in that account, once the account
 * exists. So does every free video ad of the owner's own addresses (OWNER_TEST_EMAILS) from the last 30 days, in his
 * own account (owner 2026-10-13: "I want my own ads to appear in my own account", for demos): his leads are never
 * customers, because he tests what a visitor sees. Returns how many copies were started.
 */
export async function copyLeadsToAccounts(own: (query: any) => any): Promise<number> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
  const ownerSince = new Date(Date.now() - OWNER_COPY_DAYS * 24 * 60 * 60_000).toISOString();
  const [bought, customers, owner] = await Promise.all([
    own(leadsTable().select('*').eq('status', 'done').not('bought_at', 'is', null).gt('bought_at', since)).limit(50),
    own(leadsTable().select('*').eq('status', 'done').eq('is_customer', true).gt('finished_at', since)).limit(50),
    own(leadsTable().select('*').eq('status', 'done').in('email', [...OWNER_TEST_EMAILS]).gt('finished_at', ownerSince)).limit(50),
  ]);
  const error = bought.error ?? customers.error ?? owner.error;
  if (error) {
    console.error('❌ [free-video] Sweep: leads to copy not read:', error.message);
    return 0;
  }
  const leads = new Map<string, FreeVideoLead>();
  for (const row of [...(bought.data ?? []), ...(customers.data ?? []), ...(owner.data ?? [])] as Record<string, unknown>[]) {
    const lead = asLead(row);
    leads.set(lead.id, lead);
  }
  let started = 0;
  for (const lead of leads.values()) {
    try {
      const userId = await buyerAccountOf(lead);
      if (!userId) continue;
      const copy = await readJob(userId, copyIdOf(lead.id, userId));
      if (copy?.status !== 'done' && !(copy && finishing.has(copy.id))) {
        await claimFreeVideo(lead, userId);
        started++;
      }
      // A purchase while the bonus ran: the 3 written video ads are made in the account (bonus-ads.ts).
      if (bonusEarned(lead)) await startBonusAds(lead, userId);
    } catch (failure) {
      console.error(`❌ [free-video] Sweep: copying lead ${lead.id} to its account failed:`, failure);
    }
  }
  return started;
}

/**
 * The account a lead's purchase went to: the lead's own email's (accountOfLead), else, for a sale paid with another
 * email and paired with the lead by its tracking id (sweep.ts attributeSales, sale_ref "clickbank:<event id>"), the
 * account of the email the buyer paid with. null when there is none yet.
 */
async function buyerAccountOf(lead: FreeVideoLead): Promise<string | null> {
  const own = await accountOfLead(lead);
  if (own || !lead.sale_ref) return own;
  const [processor, ...rest] = lead.sale_ref.split(':');
  const eventId = rest.join(':');
  if (!processor || !eventId) return null;
  const { data, error } = await (createAdminClient() as any)
    .from('webhook_events')
    .select('cb_email:payload->customer->>email, fs_email:payload->>customerEmail')
    .eq('processor', processor)
    .eq('event_id', eventId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`The sale ${lead.sale_ref} could not be read: ${error.message}`);
  const email = String(data?.cb_email || data?.fs_email || '').trim().toLowerCase();
  return email.includes('@') && email !== lead.email ? customerIdByEmail(email) : null;
}

/** The AI Media Machine account a lead's free video ad is copied into: the owner's own for his addresses, else the email's account with an active plan; null when there is none. Throws on a failed read. */
export async function accountOfLead(lead: Pick<FreeVideoLead, 'email'>): Promise<string | null> {
  return OWNER_TEST_EMAILS.includes(lead.email) ? ownerAccountIdByEmail(lead.email) : customerIdByEmail(lead.email);
}

/** Right after a free video ad is done: its copy in the account starts at once, not at the next sweep (owner 2026-10-14: "instantly"). Never throws. */
export async function copyToAccountNow(leadId: string): Promise<void> {
  try {
    const lead = await getLead(leadId);
    if (!lead || lead.status !== 'done') return;
    const userId = await accountOfLead(lead);
    if (userId) await claimFreeVideo(lead, userId);
  } catch (error) {
    console.warn(`⚠️ [free-video] Lead ${leadId}: the copy into the account did not start now (the sweep starts it):`, String(error).slice(0, 160));
  }
}

/** What Your videos says of a free video ad that could not be made. */
export const NOT_MADE = 'We could not make this free video ad. You can make a video ad from the same website on this page.';

/** How long a free video ad asked for with an account's email shows in that account's videos before it has a copy there. */
const WAITING_HOURS = 24;
/** A finished free video ad whose copy is not there yet (it starts the moment the ad is done; the sweep tries again within minutes) still shows as being made for this long. */
const COPY_GRACE_MINUTES = 15;

type WaitingLead = Pick<
  FreeVideoLead,
  'id' | 'email' | 'status' | 'website_domain' | 'created_at' | 'updated_at' | 'finished_at' | 'job_id' | 'reason' | 'is_customer' | 'bought_at'
>;

/** How Your videos shows a free video ad that has no copy in the account yet; null shows nothing. Pure (the checks run it). */
export function waitingJobOf(lead: WaitingLead, userId: string, now = Date.now()): SmartVideoJob | null {
  if (!(now - Date.parse(lead.created_at) < WAITING_HOURS * 60 * 60_000)) return null;
  const shown = {
    id: copyIdOf(lead.id, userId),
    userId,
    // The same title as the copy that takes its place (claimFreeVideo).
    brief: `Your free video ad for ${lead.website_domain}`,
    format: 'vertical' as const,
    voiceOver: true,
    music: true,
    creditsUsed: 0,
    freeLeadId: lead.id,
    freeSite: lead.website_domain,
    createdAt: lead.created_at,
    updatedAt: lead.created_at,
  };
  switch (lead.status) {
    case 'queued':
    case 'running':
      return { ...shown, status: 'producing', freeStage: 'making' };
    case 'held':
      return { ...shown, status: 'producing', freeStage: 'checking' };
    case 'done': {
      // Only one whose copy the sweep makes too (copyLeadsToAccounts), so a copy that did not start at once still comes.
      if (!lead.is_customer && !lead.bought_at && !OWNER_TEST_EMAILS.includes(lead.email)) return null;
      // Done at finished_at, or later when the owner released a held one (updated_at): its copy is on the way.
      const doneAt = Math.max(...[lead.finished_at, lead.updated_at].map((at) => Date.parse(at ?? '')).filter(Number.isFinite));
      return now - doneAt < COPY_GRACE_MINUTES * 60_000 ? { ...shown, status: 'producing', freeStage: 'making' } : null;
    }
    case 'failed':
    case 'rejected':
      // Only one that was being made (a website the form refused never was), and never an owner test he asked for again.
      return lead.job_id && lead.reason !== RETIRED_OWNER_TEST ? { ...shown, status: 'failed', error: NOT_MADE } : null;
    default:
      return null;
  }
}

/**
 * The free video ads asked for with this account's email that have no copy in it yet, as Your videos shows them (owner
 * 2026-10-14: "i want it to appear for all, instantly, and show that it is under work"). Nothing is stored for them:
 * they are read from the leads on every look, and the copy (claimFreeVideo, the same id) takes their place once the
 * free video ad is done. Only for the account that gets the copy (accountOfLead), and only this server's leads (live:
 * the real ones; any other server: its test ones). Never throws: a failed read shows nothing extra.
 */
export async function waitingFreeVideos(userId: string, email: string | null | undefined, stored: ReadonlySet<string>): Promise<SmartVideoJob[]> {
  const key = email?.trim().toLowerCase();
  if (!key) return [];
  try {
    const since = new Date(Date.now() - WAITING_HOURS * 60 * 60_000).toISOString();
    const leads = leadsTable().select('id, email, status, website_domain, created_at, updated_at, finished_at, job_id, reason, is_customer, bought_at').eq('email', key).gt('created_at', since);
    const { data, error } = await (claimsTestLeads() ? leads.eq('source', 'test') : leads.neq('source', 'test')).order('created_at', { ascending: false }).limit(10);
    if (error) throw new Error(error.message);
    const shown = ((data ?? []) as WaitingLead[]).map((lead) => waitingJobOf(lead, userId)).filter((job): job is SmartVideoJob => job !== null && !stored.has(job.id));
    // The account is looked up only when there is something to show (most looks have nothing).
    if (!shown.length || (await accountOfLead({ email: key })) !== userId) return [];
    return shown;
  } catch (error) {
    console.warn('⚠️ [free-video] Free video ads on their way to the account not read:', String(error).slice(0, 160));
    return [];
  }
}
