import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/app/supabase/server';
import { refundFailedGeneration } from '@/lib/credits/refund';

export const maxDuration = 120;

/**
 * Stale Generation Sweeper
 *
 * Async generations are charged upfront; webhooks normally complete or fail them
 * (and failures auto-refund). But if a provider never sends ANY webhook, the job
 * stays "processing" forever — the user paid and got nothing. This cron finds
 * those, marks them failed, and refunds via the exact-match idempotent helper.
 *
 * Deliberately conservative:
 * - Only genuinely-running statuses (starting/processing/pending). 'planning'
 *   records are excluded — historically they are often left un-updated even when
 *   the generation succeeded, so sweeping them would mis-refund.
 * - Only jobs 3h–7d old: 3h grace for slow renders; the 7-day floor keeps the
 *   historical backlog (pre-sweeper records) from being mass-refunded.
 * - Refund only happens when the original debit is uniquely traceable
 *   (refundFailedGeneration is exact-match + idempotent).
 *
 * Run hourly via a Coolify scheduled task:
 *   curl -fsS -H "Authorization: Bearer $APP_CRON_SECRET_TOKEN" https://app.bluefx.net/api/cron/stale-generations
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  const expectedToken = process.env.CRON_SECRET_TOKEN || process.env.APP_CRON_SECRET_TOKEN;
  const authHeader = request.headers.get('authorization');
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const newerThan = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  const olderThan = new Date(now - 3 * 3600 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from('ai_predictions')
    .select('prediction_id, external_id, user_id, tool_id, status, created_at')
    .in('status', ['starting', 'processing', 'pending'])
    .gt('created_at', newerThan)
    .lt('created_at', olderThan)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let swept = 0;
  let refunded = 0;
  const details: string[] = [];

  for (const job of stale || []) {
    // Mark failed so the UI/history stops treating it as in-flight
    const { error: updErr } = await supabase
      .from('ai_predictions')
      .update({
        status: 'failed',
        output_data: { error: 'Generation timed out (no completion received). Credits refunded if charged.', swept_at: new Date().toISOString() },
        completed_at: new Date().toISOString(),
      })
      .eq('prediction_id', job.prediction_id)
      .in('status', ['starting', 'processing', 'pending']); // don't clobber a webhook that just landed
    if (updErr) {
      details.push(`${job.prediction_id}: update failed ${updErr.message}`);
      continue;
    }
    swept++;

    if (job.user_id) {
      const refund = await refundFailedGeneration({
        userId: job.user_id,
        referenceIds: [job.prediction_id, job.external_id],
        operation: `${job.tool_id || 'generation'} (stale sweep)`,
      });
      if (refund.refunded) refunded++;
      if (details.length < 50) details.push(`${job.prediction_id} (${job.tool_id}): swept, refund=${refund.refunded ? refund.amount : refund.reason}`);
    }
  }

  const processingTime = Date.now() - startTime;
  console.log(`[stale-sweep] ${swept} swept, ${refunded} refunded in ${processingTime}ms`);

  return NextResponse.json({
    success: true,
    stats: { candidates: stale?.length || 0, swept, refunded, processing_time_ms: processingTime },
    details: details.length ? details : undefined,
    timestamp: new Date().toISOString(),
  });
}
