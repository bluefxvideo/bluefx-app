/**
 * Finish or fail a Video Swap job by its fal request id. Shared by the fal
 * webhook route and the status poller, so a missed webhook still completes
 * the job the next time the user's page asks about it.
 */
import { createAdminClient } from '@/app/supabase/server';
import { downloadAndUploadVideo } from '@/actions/supabase-storage';
import { refundFailedGeneration } from '@/lib/credits/refund';

async function findJobByRequestId(requestId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('video_swap_jobs')
    .select('id, user_id, status, credits_used')
    .eq('external_job_id', requestId)
    .limit(1);
  return data && data.length > 0 ? data[0] : null;
}

/** Store the finished video and mark the job completed. `handled` is false when no job owns this request id. */
export async function finalizeVideoSwap(
  requestId: string,
  falVideoUrl: string
): Promise<{ handled: boolean; jobId?: string; userId?: string; resultUrl?: string }> {
  const job = await findJobByRequestId(requestId);
  if (!job) return { handled: false };
  if (job.status === 'completed') return { handled: true, jobId: job.id, userId: job.user_id };

  const upload = await downloadAndUploadVideo(falVideoUrl, 'video-swap', `video_swap_${requestId}`);
  const resultUrl = upload.success && upload.url ? upload.url : falVideoUrl;

  const supabase = createAdminClient();
  await supabase
    .from('video_swap_jobs')
    .update({
      status: 'completed',
      result_video_url: resultUrl,
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  console.log(`✅ Video Swap complete: job ${job.id} (${requestId})`);
  return { handled: true, jobId: job.id, userId: job.user_id, resultUrl };
}

/** Mark the job failed and give the credits back. */
export async function failVideoSwap(
  requestId: string,
  error?: string
): Promise<{ handled: boolean; jobId?: string; refunded?: boolean }> {
  const job = await findJobByRequestId(requestId);
  if (!job) return { handled: false };
  if (job.status === 'failed' || job.status === 'completed') return { handled: true, jobId: job.id };

  const refund = await refundFailedGeneration({
    userId: job.user_id,
    referenceIds: [requestId, job.id],
    operation: 'video swap',
  });
  const message = `${error || 'The video swap did not complete'}${refund.refunded ? ` — ${refund.amount} credits were refunded.` : ''}`;

  const supabase = createAdminClient();
  await supabase
    .from('video_swap_jobs')
    .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', job.id);

  console.log(`❌ Video Swap failed: job ${job.id} (${requestId}) refunded=${refund.refunded}`);
  return { handled: true, jobId: job.id, refunded: refund.refunded };
}
