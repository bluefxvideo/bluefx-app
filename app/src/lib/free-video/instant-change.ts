import { randomUUID } from 'node:crypto';
import { alertOwner } from '@/lib/free-video/alerts';
import { SITE_URL } from '@/lib/free-video/config';
import { eventsTable, readSettings, recordEvent } from '@/lib/free-video/leads';
import { unlockPagePath } from '@/lib/free-video/offer';
import { displayDomain } from '@/lib/free-video/website';
import { BUCKET, createJob, download, finish, isDead, jobDir, readJob, readPlan, safeName, touchJob, upload, writeJob } from '@/lib/smart-video/jobs';
import { prepareAssets } from '@/lib/smart-video/prepare-assets';
import { createAdminClient } from '@/app/supabase/server';
import { reviseSmartVideo, withSubtitleLook } from '@/lib/smart-video/pipeline';
import type { FreeVideoLead } from '@/types/free-video';
import type { SmartVideoJob } from '@/types/smart-video';

/**
 * Instant changes (owner 2026-10-27: "Instant: our AI engine makes your updates right here (around 5 min); Need human
 * help: a team member makes the changes (up to 24h)", then "3 tries with the AI"): a paid lead types a change and the
 * Phantom's change engine (reviseSmartVideo, the same one the app's edits use) applies it to the lead's video ad as a
 * new job of the free-video system user, without the watermark, rendered at full size. Each change builds on the
 * newest finished version. A full style switch is not an instant change (hit or miss in the engine): the page sends
 * those to the team. Each change is an 'ai_change' event on the lead (meta: the job id, the text, the round).
 */
export const AI_CHANGES = 5;
/** The files a buyer may add to one change: the app's own edit limits (types/smart-video.ts). */
export const CHANGE_MAX_FILES = 5;
export const CHANGE_MAX_FILE_MB = 100;

export interface ChangeUpload {
  name: string;
  path: string;
}

/**
 * Step 1 of a change with files: a job id and one signed upload URL per file, under that job's src folder of the
 * free-video system user (the browser sends each file straight to storage, never through this server).
 */
export async function changeUploadSlots(files: { name: string; size: number }[]): Promise<{ uploadJobId: string; slots: (ChangeUpload & { uploadUrl: string })[] }> {
  const settings = await readSettings(true);
  const userId = settings?.system_user_id;
  if (!userId) throw new Error('No system user');
  const uploadJobId = randomUUID();
  const storage = createAdminClient().storage.from(BUCKET);
  const slots: (ChangeUpload & { uploadUrl: string })[] = [];
  for (const [i, file] of files.entries()) {
    const path = `${jobDir(userId, uploadJobId)}/src/${String(i + 1).padStart(2, '0')}-${safeName(file.name)}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data?.signedUrl) throw new Error(`no upload URL for ${file.name}`);
    slots.push({ name: file.name, path, uploadUrl: data.signedUrl });
  }
  return { uploadJobId, slots };
}

/** Uploads that really belong to that upload job's src folder (a browser could send any path). */
export async function ownUploads(uploadJobId: string | undefined, uploads: ChangeUpload[]): Promise<ChangeUpload[]> {
  if (!uploadJobId || !uploads.length) return [];
  const settings = await readSettings(true);
  const prefix = settings?.system_user_id ? `${jobDir(settings.system_user_id, uploadJobId)}/src/` : null;
  return prefix ? uploads.filter((u) => u.path.startsWith(prefix) && !u.path.includes('..')).slice(0, CHANGE_MAX_FILES) : [];
}
const PAID = ['paid', 'rendering', 'ready', 'failed'];
/** Lines of a change that ask for another person on camera ("a different person", "a man in his 50s instead of the woman"). */
const PERSON_WORDS = /\b(person|presenter|spokes(?:man|woman|person)|on camera|man|woman|guy|lady|girl|boy|actor|actress|face|avatar|host)\b/i;
const VOICE_ONLY = /\b(voice|narrat|voice-?over|accent)\b/i;
export function presenterWords(text: string): string | null {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((l) => PERSON_WORDS.test(l) && !(VOICE_ONLY.test(l) && !/\bon camera\b/i.test(l)));
  return lines.length ? lines.join('. ').slice(0, 300) : null;
}

/** The 8 looks of the style gallery: a change that asks for one of them goes to the team. */
// Only a request to SWITCH to a look counts, not a mention ("music that fits a whiteboard video", owner test 2026-11-01).
const LOOKS = '(?:hand-?drawn|whiteboard|vintage(?: tv)?|news(?: studio)?|cartoon|comic(?: book)?|chalkboard|scrapbook|clay|claymation)';
const STYLE_WORDS = new RegExp(
  `\\b(?:(?:in|into|to|as|make it|turn it into|switch to|change it to|redo it as|remake it as)\\s+(?:a\\s+|the\\s+)?${LOOKS}\\b(?!\\s+(?:music|sound|song|voice))|${LOOKS}\\s+(?:style|version|look)\\b|(?:new|different|another|other)\\s+(?:video\\s+)?style\\b)`,
  'i'
);

/** A line about the music, voice or text never asks for a new style ("Music to match a whiteboard style"). */
const NOT_STYLE = /\b(music|song|sound|soundtrack|voice|narrat\w*|font|text|captions?|subtitles?)\b/i;
export const wantsNewStyle = (text: string) =>
  text
    .split(/\n+/)
    .some((line) => !NOT_STYLE.test(line) && STYLE_WORDS.test(line));

export interface AiChange {
  round: number;
  text: string;
  jobId: string;
  status: 'working' | 'done' | 'failed';
  /** 0-100 while it renders. */
  progress: number;
  videoUrl: string | null;
  at: string;
}

/** A lead's instant changes, oldest first, with each job's state. Throws on a database error. */
export async function aiChangesOf(lead: FreeVideoLead): Promise<AiChange[]> {
  const { data, error } = await eventsTable().select('meta, at').eq('lead_id', lead.id).eq('event', 'ai_change').order('at', { ascending: true });
  if (error) throw new Error(`ai changes not read: ${error.message}`);
  const settings = await readSettings(true);
  const userId = settings?.system_user_id;
  const out: AiChange[] = [];
  for (const row of (data ?? []) as ChangeRow[]) {
    const change = await changeOfRow(userId, row, out.length + 1);
    if (change) out.push(change);
  }
  return out;
}

type ChangeRow = { meta: { jobId?: string; text?: string; round?: number }; at: string };

async function changeOfRow(userId: string | null | undefined, row: ChangeRow, round: number): Promise<AiChange | null> {
  const jobId = row.meta?.jobId;
  if (!jobId || !userId) return null;
  const job = await readJob(userId, jobId).catch(() => null);
  const failed = !job || job.status === 'failed' || isDead(job);
  return {
    round: row.meta.round ?? round,
    text: row.meta.text ?? '',
    jobId,
    status: job?.status === 'done' ? 'done' : failed ? 'failed' : 'working',
    progress: job?.status === 'rendering' ? job.renderProgress ?? 0 : job?.status === 'finishing' || job?.status === 'done' ? 100 : 0,
    videoUrl: job?.status === 'done' ? job.videoUrl ?? null : null,
    at: row.at,
  };
}

// ---------------------------------------------------------------------------------------------
// The free change (owner 2026-10-31/11-01): before paying, a visitor sees ONE change of their list made by the same
// engine, with the SAMPLE watermark kept ("Need a change? Try one for free"). It is an 'ai_preview' event, not an
// 'ai_change', so it never counts against the paid instant changes. Anything may change except a whole new style
// (hit or miss in the engine: those go to the team after payment). Paying after it: the clean version is the
// changed ad without the watermark (unlock.ts renderAndStore), and later changes build on it.
// ---------------------------------------------------------------------------------------------

/** The lead's free change (the newest one that did not fail, else the newest), or null. Throws on a database error. */
export async function freeChangeOf(lead: FreeVideoLead): Promise<AiChange | null> {
  const { data, error } = await eventsTable().select('meta, at').eq('lead_id', lead.id).eq('event', 'ai_preview').order('at', { ascending: false }).limit(5);
  if (error) throw new Error(`free change not read: ${error.message}`);
  const settings = await readSettings(true);
  const all: AiChange[] = [];
  for (const row of (data ?? []) as ChangeRow[]) {
    const change = await changeOfRow(settings?.system_user_id, row, 0);
    if (change) all.push(change);
  }
  return all.find((c) => c.status !== 'failed') ?? all[0] ?? null;
}

export type FreeChangeRefusal = 'paid' | 'used' | 'style' | 'notReady' | 'noList';

/** Why this lead may not start its free change now, or null. A failed free change may be tried again. */
export function freeChangeRefusal(lead: FreeVideoLead, free: AiChange | null, text: string): FreeChangeRefusal | null {
  if (lead.unlock_status !== 'none') return 'paid';
  if (lead.status !== 'done' || !lead.job_id) return 'notReady';
  if (!text.trim()) return 'noList';
  if (free && free.status !== 'failed') return 'used';
  if (wantsNewStyle(text)) return 'style';
  return null;
}

/** Starts the free change from the lead's saved change list; `run` goes to the caller's after(). */
export async function startFreeChange(lead: FreeVideoLead, text: string): Promise<{ jobId: string; run: () => Promise<void> }> {
  const settings = await readSettings(true);
  const userId = settings?.system_user_id;
  if (!userId || !lead.job_id) throw new Error('No system user or job for the free change');
  const now = new Date().toISOString();
  const job: SmartVideoJob = { id: randomUUID(), userId, status: 'directing', brief: '', parentId: lead.job_id, note: text, createdAt: now, updatedAt: now, freeLeadId: lead.id };
  await createJob(job);
  await recordEvent({ event: 'ai_preview', leadId: lead.id, ref: lead.ref, meta: { jobId: job.id, text } });
  return { jobId: job.id, run: () => runAiChange(job, lead.job_id as string, lead, text, 0, [], true) };
}

/** After the free change: the "ready" email, and a clean render that waited for it (the visitor paid meanwhile). */
async function afterFreeChange(leadId: string): Promise<void> {
  const { getLead } = await import('@/lib/free-video/leads');
  const lead = await getLead(leadId);
  if (!lead) return;
  if (lead.unlock_status === 'paid') {
    const { startCleanRender } = await import('@/lib/free-video/unlock');
    startCleanRender(lead.id);
    return;
  }
  const { sendFreeChangeReady } = await import('@/lib/free-video/notify');
  await sendFreeChangeReady(lead);
}

export type AiChangeRefusal = 'notPaid' | 'noneLeft' | 'busy' | 'style';

/** Why this lead may not start an instant change now, or null. A failed change does not count against the 3. */
export function aiChangeRefusal(lead: FreeVideoLead, changes: AiChange[], text: string): AiChangeRefusal | null {
  if (!PAID.includes(lead.unlock_status)) return 'notPaid';
  if (wantsNewStyle(text)) return 'style';
  if (changes.some((c) => c.status === 'working')) return 'busy';
  if (changes.filter((c) => c.status !== 'failed').length >= AI_CHANGES) return 'noneLeft';
  return null;
}

/**
 * Starts one instant change and returns at once; `run` is handed to the caller's after() so the work outlives the
 * request. Builds on the newest finished version (else the lead's free video ad). Throws on a database error.
 */
export async function startAiChange(
  lead: FreeVideoLead,
  text: string,
  changes: AiChange[],
  files: { uploadJobId?: string; uploads: ChangeUpload[] } = { uploads: [] }
): Promise<{ jobId: string; run: () => Promise<void> }> {
  const settings = await readSettings(true);
  const userId = settings?.system_user_id;
  if (!userId || !lead.job_id) throw new Error('No system user or job for the change');
  const free = await freeChangeOf(lead).catch(() => null);
  const base = [...changes].reverse().find((c) => c.status === 'done')?.jobId ?? (free?.status === 'done' ? free.jobId : null) ?? lead.job_id;
  const now = new Date().toISOString();
  const id = files.uploads.length && files.uploadJobId ? files.uploadJobId : randomUUID();
  const job: SmartVideoJob = { id, userId, status: 'directing', brief: '', parentId: base, note: text, createdAt: now, updatedAt: now, freeLeadId: lead.id };
  await createJob(job);
  const round = changes.filter((c) => c.status !== 'failed').length + 1;
  await recordEvent({ event: 'ai_change', leadId: lead.id, ref: lead.ref, meta: { jobId: job.id, text, round, files: files.uploads.map((u) => u.name) } });
  return { jobId: job.id, run: () => runAiChange(job, base, lead, text, round, files.uploads) };
}

async function runAiChange(start: SmartVideoJob, baseId: string, lead: FreeVideoLead, text: string, round: number, uploads: ChangeUpload[], free = false): Promise<void> {
  let job = start;
  const heartbeat = setInterval(() => touchJob(job.id).catch(() => undefined), 45_000);
  try {
    const saved = await readPlan(job.userId, baseId);
    if (!saved.media) throw new Error('The video ad has no saved media to change');
    const dir = jobDir(job.userId, job.id);
    const store = (data: Buffer, name: string, contentType: string) => upload(`${dir}/${name}`, data, contentType);
    // The buyer's files continue the numbering of the video ad's own files (a1, a2, ... then a7, a8), as in the app.
    const taken = Object.keys(saved.media.assets).map((assetId) => Number(/^a(\d+)/.exec(assetId)?.[1] || 0));
    const files = await Promise.all(uploads.map(async (u) => ({ filename: u.name, data: await download(u.path) })));
    const added = files.length ? await prepareAssets(files, store, Math.max(0, ...taken) + 1) : [];
    const revised = await reviseSmartVideo(
      { plan: saved.plan, media: saved.media },
      text,
      saved.brief || '',
      store,
      (stage) => {
        job = { ...job, status: stage };
        writeJob(job).catch(() => undefined);
      },
      added,
      undefined,
      // A different person on camera is cast only through the presenter option, never from the note (owner rule
      // 2026-10-13); a buyer's change that asks for one passes those lines as "who should be on camera".
      { presenter: presenterWords(text) || undefined }
    );
    const result = withSubtitleLook(revised, saved, text);
    // The buyer paid for the clean version: never the SAMPLE watermark or the end card. The free change keeps it.
    const props = { ...result.props };
    delete (props as Record<string, unknown>).watermark;
    // The free change renders exactly like a free video ad: presenter-only subtitles, the SAMPLE watermark, the end
    // card, at the free size (runner.ts freeRender). Without this it came out clean and in HD (test 2026-11-01).
    const { freeRender } = await import('@/lib/free-video/runner');
    const { FREE_RENDER_SCALE } = await import('@/lib/free-video/config');
    const out = free ? freeRender({ ...result, props }) : { ...result, props };
    await finish(job, out, saved.brief || '', (next) => {
      job = next;
    }, free ? FREE_RENDER_SCALE : 1);
    console.log(`✅ [free-video] ${free ? 'Free change' : `Instant change ${round}`} for lead ${lead.id} (${lead.website_domain}) done`);
    if (free) await afterFreeChange(lead.id);
  } catch (error) {
    console.error(`❌ [free-video] ${free ? 'Free change' : `Instant change ${round}`} for lead ${lead.id} failed:`, error);
    await writeJob(job, { status: 'failed', warnings: [String(error).slice(0, 300)] }).catch(() => undefined);
    if (free) {
      await alertOwner(
        [{ key: `free-change-failed:${job.id}`, line: `The free change for ${displayDomain(lead.website_domain)} failed (${lead.first_name}, ${lead.email}): "${text}". The page lets them try again. Their page: ${SITE_URL}${unlockPagePath(lead.view_token)}?internal=1` }],
        'a free change failed'
      ).catch(() => undefined);
      return;
    }
    await alertOwner(
      [
        {
          key: `ai-change-failed:${job.id}`,
          line: `An instant change for ${displayDomain(lead.website_domain)} failed (${lead.first_name}, ${lead.email}): "${text}". It does not count against their ${AI_CHANGES}. Make it by hand if they ask. Their page: ${SITE_URL}${unlockPagePath(lead.view_token)}?internal=1`,
        },
      ],
      'an instant change failed'
    ).catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
}
