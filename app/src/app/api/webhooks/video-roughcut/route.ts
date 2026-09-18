import { NextRequest, NextResponse } from 'next/server';
import {
  getRoughcutJob,
  updateRoughcutJob,
  refundRoughcutCredits,
  type RoughcutJobStatus,
  type RoughcutRemoval,
} from '@/actions/database/video-roughcut-database';
import { createAdminClient } from '@/app/supabase/server';
import { refundSentence } from '@/lib/credits/refund';

/**
 * Video Rough-Cut worker callback.
 *
 * The worker service (`video-roughcut-worker`, port 3003) POSTs progress and
 * final-result updates here. Auth is a shared secret in the `X-Internal-Api-Key`
 * header — both sides read `INTERNAL_API_KEY` from env.
 *
 * Flow:
 *   - Intermediate statuses (transcribing / analyzing / generating) just bump
 *     status + progress on the DB row. Supabase realtime pushes to the UI.
 *   - `done` stores xml_url, transcript_json_url, removals, and the "what was
 *     cut" stats for the results panel.
 *   - `failed` refunds the credits that were deducted in startRoughcutJob.
 */

type WorkerStatus =
  | 'queued'
  | 'transcribing'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'failed';

interface CallbackPayload {
  jobId: string;
  status: WorkerStatus;
  progress: number;
  /** Storage paths in the private video-roughcut bucket */
  xmlPath?: string;
  transcriptPath?: string;
  removals?: RoughcutRemoval[];
  segmentsRemoved?: number;
  timeSavedSeconds?: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Auth ---
  const expectedKey = process.env.INTERNAL_API_KEY || '';
  if (!expectedKey) {
    console.error('[video-roughcut webhook] INTERNAL_API_KEY is not configured');
    return NextResponse.json(
      { success: false, error: 'Webhook not configured' },
      { status: 500 },
    );
  }

  const providedKeyHeader = request.headers.get('x-internal-api-key');
  const providedKey = Array.isArray(providedKeyHeader)
    ? providedKeyHeader[0]
    : providedKeyHeader;

  if (providedKey !== expectedKey) {
    console.warn('[video-roughcut webhook] Rejected: bad or missing internal api key');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // --- Parse payload ---
  let payload: CallbackPayload;
  try {
    payload = (await request.json()) as CallbackPayload;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Invalid JSON: ${err?.message || 'parse error'}` },
      { status: 400 },
    );
  }

  if (!payload?.jobId || !payload?.status) {
    return NextResponse.json(
      { success: false, error: 'Missing jobId or status' },
      { status: 400 },
    );
  }

  // --- Look up job (admin client; webhook has no user session) ---
  const job = await getRoughcutJob(payload.jobId);
  if (!job) {
    console.warn(`[video-roughcut webhook] Unknown jobId=${payload.jobId}`);
    // 200 so the worker doesn't retry — nothing we can do about a missing row.
    return NextResponse.json({ success: false, error: 'Job not found' });
  }

  // A finished job stays finished. A late update after a timeout (the job was already
  // failed and refunded) must not flip it back or refund twice.
  if (job.status === 'done' || job.status === 'failed') {
    console.warn(`[video-roughcut webhook] Ignoring ${payload.status} for finished job ${job.id} (${job.status})`);
    return NextResponse.json({ success: true, ignored: true });
  }

  // --- Build update ---
  const status = payload.status as RoughcutJobStatus;
  const update: Record<string, unknown> = {
    status,
    progress: clamp(payload.progress ?? job.progress, 0, 100),
  };

  if (status === 'done') {
    // The *_url columns hold storage paths; the app signs download links on demand.
    if (payload.xmlPath) update.xml_url = payload.xmlPath;
    if (payload.transcriptPath) update.transcript_json_url = payload.transcriptPath;
    if (payload.removals) update.removals = payload.removals;
    if (typeof payload.segmentsRemoved === 'number') {
      update.segments_removed = payload.segmentsRemoved;
    }
    if (typeof payload.timeSavedSeconds === 'number') {
      update.time_saved_seconds = payload.timeSavedSeconds;
    }
    update.progress = 100;
  }

  if (status === 'failed') {
    update.status_reason = payload.error || 'Worker reported failure without details';
  }

  try {
    await updateRoughcutJob(payload.jobId, update);
  } catch (err: any) {
    console.error(`[video-roughcut webhook] DB update failed for ${payload.jobId}:`, err);
    return NextResponse.json(
      { success: false, error: `DB update failed: ${err?.message || 'unknown'}` },
      { status: 500 },
    );
  }

  // --- Side effects for terminal states ---
  if (status === 'failed' && (job.credits_used ?? 0) > 0) {
    // Worker accepted the job, we deducted credits in startRoughcutJob,
    // but processing failed downstream. The shared refund path is idempotent.
    try {
      const refunded = await refundRoughcutCredits(job.id, job.user_id);
      if (refunded > 0) {
        await updateRoughcutJob(job.id, {
          status_reason: `${update.status_reason} ${refundSentence(refunded)}`,
        });
      }
    } catch (err: any) {
      // Don't 500 the webhook — the DB row is updated; refund can be handled manually.
      console.error(`[video-roughcut webhook] Refund failed for job ${job.id}:`, err?.message || err);
    }
  }

  // --- Optional: broadcast for clients not on postgres-changes subscription ---
  // Supabase realtime on the jobs table is the primary push mechanism;
  // this broadcast is a cheap belt-and-braces for UIs listening on a channel.
  if (status === 'done' || status === 'failed' || status === 'transcribing' ||
      status === 'analyzing' || status === 'generating') {
    try {
      const supabase = createAdminClient();
      await supabase.channel(`user_${job.user_id}_updates`).send({
        type: 'broadcast',
        event: 'video_roughcut_update',
        payload: {
          jobId: job.id,
          status,
          progress: update.progress,
          error: payload.error,
        },
      });
    } catch (err) {
      // Broadcast failure is non-fatal — the DB update is the source of truth.
      console.warn('[video-roughcut webhook] broadcast failed:', err);
    }
  }

  return NextResponse.json({ success: true });
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
