/**
 * Free video ads keep only their video (owner 2026-10-06: "free ads delete their working files after 30 days
 * unless someone paid for the clean version"; 2026-10-08: "we dont actully delete the working fies only after 30
 * days", while the page and E3 say that after the 3-day bonus the working files can be deleted any time).
 *
 * The $99 clean version is rendered from the working files (the presenter clip, the photos, the drawings, the
 * voice-over, the music), so the unlock closes UNLOCK_DAYS after the video ad was finished (unlockOpen: the offer
 * leaves the page and /go/fvunlock no longer opens the checkout), and the files go FILES_KEEP_DAYS after it, one
 * day later, so a checkout opened on the last day still renders (and a sale in the last minute is copied, files and
 * all, before they go). The video the lead's page plays stays, so the emailed link keeps working. A lead whose clean
 * version was paid for, or who bought the AI Media Machine, keeps everything.
 *
 * The sweep runs this once an hour (the sweep at minute 0 to 2), CLEANUP_BATCH leads at a time. A lead is marked
 * with files_cleaned_at, a column the owner adds with the SQL line in the free video migration; until then the
 * read fails, is logged, and nothing is deleted.
 */
import { createAdminClient } from '@/app/supabase/server';
import type { FreeVideoLeadStatus, FreeVideoUnlockStatus } from '@/types/free-video';

export const UNLOCK_DAYS = 30;
export const FILES_KEEP_DAYS = 31;
const CLEANUP_BATCH = 20;
const DAY_MS = 86_400_000;
const BUCKET = 'script-videos';
/** Unlock states that mean nobody paid for a clean version (a refund gave the money back). */
export const UNPAID: FreeVideoUnlockStatus[] = ['none', 'refunded'];
/** Lead states that end a lead: nothing works on its files any more. */
const FINISHED: FreeVideoLeadStatus[] = ['done', 'held', 'failed', 'rejected'];

/**
 * Whether the $99 clean version can still be bought: the video ad is done and not known to be UNLOCK_DAYS old. A done
 * lead without a finish time stays open; the cleanup never deletes its files either (it needs finished_at).
 */
export function unlockOpen(lead: { status: string; video_url: string | null; finished_at: string | null }, now = Date.now()): boolean {
  if (lead.status !== 'done' || !lead.video_url) return false;
  return !lead.finished_at || now - Date.parse(lead.finished_at) < UNLOCK_DAYS * DAY_MS;
}

/** The object path inside the bucket of a public storage URL ('smart-video/<user>/<job>/video.mp4'), or null. */
export function storagePathOf(url: string | null): string | null {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  return decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
}

/** The job folders of a lead (every attempt), next to its video when the video says where they are. */
export function jobFolders(lead: { job_ids: string[] | null; job_id: string | null; video_url: string | null }, systemUserId: string | null): string[] {
  const video = storagePathOf(lead.video_url);
  // smart-video/<user>/<job>/video.mp4 → smart-video/<user>
  const userFolder = video ? video.split('/').slice(0, -2).join('/') : systemUserId ? `smart-video/${systemUserId}` : null;
  if (!userFolder) return [];
  const ids = [...new Set([...(lead.job_ids ?? []), ...(lead.job_id ? [lead.job_id] : [])])];
  return ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).map((id) => `${userFolder}/${id}`);
}

/** The files to delete: every file in the lead's job folders except the video its page plays. Pure. */
export function workingFiles(folders: { folder: string; files: string[] }[], keep: string | null): string[] {
  return folders.flatMap(({ folder, files }) => files.map((name) => `${folder}/${name}`)).filter((path) => path !== keep);
}

interface CleanupLead {
  id: string;
  status: FreeVideoLeadStatus;
  job_id: string | null;
  job_ids: string[] | null;
  video_url: string | null;
}

export interface CleanupReport {
  leads: number;
  files: number;
}

/**
 * Deletes the working files of up to CLEANUP_BATCH finished leads whose video ad is FILES_KEEP_DAYS old and whose
 * clean version nobody paid for. `own` limits the leads to this server's kind (live or test), as everywhere in the
 * sweep. Never throws: a lead whose files could not be listed or deleted is tried again at the next run.
 */
export async function cleanWorkingFiles(own: (query: any) => any, systemUserId: string | null): Promise<CleanupReport> {
  const report: CleanupReport = { leads: 0, files: 0 };
  const admin = createAdminClient() as any;
  const leads = admin.from('free_video_leads');
  const { data, error } = await own(
    leads
      .select('id, status, job_id, job_ids, video_url')
      .is('files_cleaned_at', null)
      .in('status', FINISHED)
      .in('unlock_status', UNPAID)
      .is('bought_at', null)
      .lt('finished_at', new Date(Date.now() - FILES_KEEP_DAYS * DAY_MS).toISOString())
  )
    .order('finished_at', { ascending: true })
    .limit(CLEANUP_BATCH);
  if (error) {
    console.error('❌ [free-video] Cleanup: leads not read (has the files_cleaned_at column been added?):', error.message);
    return report;
  }
  const storage = admin.storage.from(BUCKET);
  for (const lead of (data ?? []) as CleanupLead[]) {
    try {
      const folders: { folder: string; files: string[] }[] = [];
      for (const folder of jobFolders(lead, systemUserId)) {
        const { data: entries, error: listError } = await storage.list(folder, { limit: 1000 });
        if (listError) throw new Error(`${folder} not listed: ${listError.message}`);
        // Files only: an entry without an id is a folder (none are expected in a job folder).
        folders.push({ folder, files: ((entries ?? []) as { name: string; id: string | null }[]).filter((entry) => entry.id).map((entry) => entry.name) });
      }
      const doomed = workingFiles(folders, lead.status === 'done' ? storagePathOf(lead.video_url) : null);
      for (let i = 0; i < doomed.length; i += 500) {
        const { error: removeError } = await storage.remove(doomed.slice(i, i + 500));
        if (removeError) throw new Error(`files not deleted: ${removeError.message}`);
      }
      // The status page shows no deleted file: the photos and the live record point at the working files.
      const { error: markError } = await admin
        .from('free_video_leads')
        .update({ files_cleaned_at: new Date().toISOString(), photos: [], live: null })
        .eq('id', lead.id)
        .is('files_cleaned_at', null)
        .in('unlock_status', UNPAID)
        .is('bought_at', null);
      if (markError) throw new Error(`lead not marked: ${markError.message}`);
      report.leads++;
      report.files += doomed.length;
    } catch (cause) {
      console.error(`❌ [free-video] Cleanup of lead ${lead.id} failed (tried again next hour):`, String(cause).slice(0, 200));
    }
  }
  if (report.leads) console.log(`🧹 [free-video] Cleanup: ${report.files} working files of ${report.leads} free video ads deleted`);
  return report;
}
