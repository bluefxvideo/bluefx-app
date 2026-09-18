// Server-side helpers that run with the service role. Deliberately not 'use server':
// these must never become client-callable actions. Client components import only types.

import { createClient, createAdminClient } from '@/app/supabase/server';
import { refundFailedGeneration, refundSentence } from '@/lib/credits/refund';

/**
 * A removal record — what was cut and why.
 * Shown in the UI "What was cut" list.
 */
export interface RoughcutRemoval {
  start: number;  // seconds
  end: number;    // seconds
  text: string;
  reason: string;
}

export type RoughcutJobStatus =
  | 'uploading'
  | 'validating'
  | 'queued'
  | 'transcribing'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'failed';

export interface RoughcutJob {
  id: string;
  user_id: string;
  video_filename: string;
  audio_url: string | null;
  audio_hash: string | null;
  video_width: number | null;
  video_height: number | null;
  video_duration_seconds: number | null;
  video_frame_rate: number | null;
  status: RoughcutJobStatus;
  status_reason: string | null;
  progress: number;
  xml_url: string | null;
  transcript_json_url: string | null;
  removals: RoughcutRemoval[] | null;
  segments_removed: number | null;
  time_saved_seconds: number | null;
  credits_used: number;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
}

export interface CreateRoughcutJobInput {
  userId: string;
  videoFilename: string;
  audioHash?: string;
  videoWidth?: number;
  videoHeight?: number;
  videoDurationSeconds?: number;
  videoFrameRate?: number;
}

/**
 * Create a new job in 'uploading' status.
 * Called when the user first requests an upload URL.
 */
export async function createRoughcutJob(input: CreateRoughcutJobInput): Promise<RoughcutJob> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('video_roughcut_jobs')
    .insert({
      user_id: input.userId,
      video_filename: input.videoFilename,
      audio_hash: input.audioHash ?? null,
      video_width: input.videoWidth ?? null,
      video_height: input.videoHeight ?? null,
      video_duration_seconds: input.videoDurationSeconds ?? null,
      video_frame_rate: input.videoFrameRate ?? null,
      status: 'uploading',
      progress: 0,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create roughcut job: ${error?.message || 'unknown'}`);
  }

  return data as RoughcutJob;
}

/**
 * Fetch a job by id, optionally scoped to a user.
 */
export async function getRoughcutJob(jobId: string, userId?: string): Promise<RoughcutJob | null> {
  const supabase = userId ? await createClient() : createAdminClient();

  const query = supabase.from('video_roughcut_jobs').select('*').eq('id', jobId);
  if (userId) query.eq('user_id', userId);

  const { data, error } = await query.maybeSingle();
  if (error) return null;
  return (data as RoughcutJob) || null;
}

/**
 * List a user's jobs (history view).
 */
export async function listRoughcutJobs(
  userId: string,
  limit: number = 50,
): Promise<RoughcutJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('video_roughcut_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as RoughcutJob[]) || [];
}

/**
 * Update a job record. Used by server actions and the worker webhook.
 * Always uses the admin client (service role).
 */
export async function updateRoughcutJob(
  jobId: string,
  update: Partial<Omit<RoughcutJob, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = { ...update };

  if (update.status === 'done' || update.status === 'failed') {
    payload.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('video_roughcut_jobs')
    .update(payload)
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update roughcut job ${jobId}: ${error.message}`);
  }
}

/**
 * Refund a failed job through the shared refund path, which finds the job's debit
 * by job_id and never refunds the same job twice. Returns the credits returned (0 if none).
 */
export async function refundRoughcutCredits(jobId: string, userId: string): Promise<number> {
  const refund = await refundFailedGeneration({ userId, referenceIds: [jobId], operation: 'rough cut' });
  if (!refund.refunded) {
    console.warn(`⚠️ No refund for rough cut job ${jobId}: ${refund.reason}`);
    return 0;
  }
  return refund.amount ?? 0;
}

const IN_FLIGHT: RoughcutJobStatus[] = ['queued', 'transcribing', 'analyzing', 'generating'];
/** Worker jobs take 1-3 minutes. Anything silent for 20 minutes is dead (e.g. worker restart). */
const STALE_AFTER_MS = 20 * 60 * 1000;
/** Uploads that never started a job. */
const ABANDONED_UPLOAD_AFTER_MS = 60 * 60 * 1000;

/**
 * Fail a user's jobs that stopped reporting progress, refunding their credits,
 * so the UI never spins forever and nobody pays for a lost job.
 */
export async function failStaleRoughcutJobs(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const now = Date.now();

  const { data: stale } = await supabase
    .from('video_roughcut_jobs')
    .select('id, user_id, credits_used')
    .eq('user_id', userId)
    .in('status', IN_FLIGHT)
    .lt('updated_at', new Date(now - STALE_AFTER_MS).toISOString());

  for (const job of stale ?? []) {
    // Claim the job first: only the request that flips it to failed refunds it, and a
    // late worker callback can no longer bring it back.
    const { data: claimed } = await supabase
      .from('video_roughcut_jobs')
      .update({ status: 'failed', status_reason: 'Processing timed out.', completed_at: new Date().toISOString() })
      .eq('id', job.id)
      .in('status', IN_FLIGHT)
      .select('id');
    if (!claimed?.length || (job.credits_used ?? 0) <= 0) continue;

    const refunded = await refundRoughcutCredits(job.id, job.user_id);
    if (refunded > 0) {
      await updateRoughcutJob(job.id, { status_reason: `Processing timed out. ${refundSentence(refunded)}` });
    }
  }

  await supabase
    .from('video_roughcut_jobs')
    .update({ status: 'failed', status_reason: 'The upload was not completed', completed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['uploading', 'validating'])
    .lt('updated_at', new Date(now - ABANDONED_UPLOAD_AFTER_MS).toISOString());
}
