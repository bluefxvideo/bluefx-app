import { randomUUID } from 'node:crypto';
import { alertOwner } from '@/lib/free-video/alerts';
import { SITE_URL } from '@/lib/free-video/config';
import { eventsTable, readSettings, recordEvent } from '@/lib/free-video/leads';
import { unlockPagePath } from '@/lib/free-video/offer';
import { displayDomain } from '@/lib/free-video/website';
import { createJob, finish, isDead, jobDir, readJob, readPlan, touchJob, upload, writeJob } from '@/lib/smart-video/jobs';
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
export const AI_CHANGES = 3;
const PAID = ['paid', 'rendering', 'ready', 'failed'];
/** The 8 looks of the style gallery: a change that asks for one of them goes to the team. */
const STYLE_WORDS = /\b(hand-?drawn|whiteboard|vintage|news studio|cartoon|comic|chalkboard|scrapbook|clay|claymation|style)\b/i;

export const wantsNewStyle = (text: string) => STYLE_WORDS.test(text);

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
  for (const row of (data ?? []) as Array<{ meta: { jobId?: string; text?: string; round?: number }; at: string }>) {
    const jobId = row.meta?.jobId;
    if (!jobId || !userId) continue;
    const job = await readJob(userId, jobId).catch(() => null);
    const failed = !job || job.status === 'failed' || isDead(job);
    out.push({
      round: row.meta.round ?? out.length + 1,
      text: row.meta.text ?? '',
      jobId,
      status: job?.status === 'done' ? 'done' : failed ? 'failed' : 'working',
      progress: job?.status === 'rendering' ? job.renderProgress ?? 0 : job?.status === 'finishing' || job?.status === 'done' ? 100 : 0,
      videoUrl: job?.status === 'done' ? job.videoUrl ?? null : null,
      at: row.at,
    });
  }
  return out;
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
export async function startAiChange(lead: FreeVideoLead, text: string, changes: AiChange[]): Promise<{ jobId: string; run: () => Promise<void> }> {
  const settings = await readSettings(true);
  const userId = settings?.system_user_id;
  if (!userId || !lead.job_id) throw new Error('No system user or job for the change');
  const base = [...changes].reverse().find((c) => c.status === 'done')?.jobId ?? lead.job_id;
  const now = new Date().toISOString();
  const job: SmartVideoJob = { id: randomUUID(), userId, status: 'directing', brief: '', parentId: base, note: text, createdAt: now, updatedAt: now, freeLeadId: lead.id };
  await createJob(job);
  const round = changes.filter((c) => c.status !== 'failed').length + 1;
  await recordEvent({ event: 'ai_change', leadId: lead.id, ref: lead.ref, meta: { jobId: job.id, text, round } });
  return { jobId: job.id, run: () => runAiChange(job, base, lead, text, round) };
}

async function runAiChange(start: SmartVideoJob, baseId: string, lead: FreeVideoLead, text: string, round: number): Promise<void> {
  let job = start;
  const heartbeat = setInterval(() => touchJob(job.id).catch(() => undefined), 45_000);
  try {
    const saved = await readPlan(job.userId, baseId);
    if (!saved.media) throw new Error('The video ad has no saved media to change');
    const dir = jobDir(job.userId, job.id);
    const store = (data: Buffer, name: string, contentType: string) => upload(`${dir}/${name}`, data, contentType);
    const revised = await reviseSmartVideo({ plan: saved.plan, media: saved.media }, text, saved.brief || '', store, (stage) => {
      job = { ...job, status: stage };
      writeJob(job).catch(() => undefined);
    });
    const result = withSubtitleLook(revised, saved, text);
    // The buyer paid for the clean version: never the SAMPLE watermark or the end card.
    const props = { ...result.props };
    delete (props as Record<string, unknown>).watermark;
    await finish(job, { ...result, props }, saved.brief || '', (next) => {
      job = next;
    });
    console.log(`✅ [free-video] Instant change ${round} for lead ${lead.id} (${lead.website_domain}) done`);
  } catch (error) {
    console.error(`❌ [free-video] Instant change ${round} for lead ${lead.id} failed:`, error);
    await writeJob(job, { status: 'failed', warnings: [String(error).slice(0, 300)] }).catch(() => undefined);
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
