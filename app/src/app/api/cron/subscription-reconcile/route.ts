import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
import { reconcileSubscription } from '@/lib/credits/subscription-entitlement'

export const maxDuration = 300 // up to 5 min — reconciles every FastSpring subscription

/**
 * Subscription Reconciliation Cron
 *
 * Daily self-healing job that treats FastSpring as the source of truth. For each
 * subscription with a fastspring_subscription_id it:
 *   - flips status to match FastSpring (trial->active on conversion, ->cancelled on deactivation)
 *   - grants the monthly credit allotment to active subscribers (on conversion, or when the period lapsed)
 *
 * This is the safety net that makes the system robust to missed/disabled webhooks.
 * Run via a Coolify scheduled task hitting this endpoint with the CRON_SECRET_TOKEN.
 *
 *   GET /api/cron/subscription-reconcile            -> apply fixes
 *   GET /api/cron/subscription-reconcile?dryRun=1   -> report only, no writes (use for the first run)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'

  // Auth — accept either the plain or Coolify-prefixed (APP_) env var name.
  const expectedToken = process.env.CRON_SECRET_TOKEN || process.env.APP_CRON_SECRET_TOKEN
  const authHeader = request.headers.get('authorization')
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: subs, error } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, status, plan_type, credits_per_month, fastspring_subscription_id, current_period_end')
    .not('fastspring_subscription_id', 'is', null)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const stats: Record<string, number> = {}
  let changed = 0
  const healed: string[] = []

  // Bounded concurrency to stay friendly to the FastSpring API.
  const CONCURRENCY = 5
  let cursor = 0
  async function worker() {
    while (cursor < subs!.length) {
      const sub = subs![cursor++]
      try {
        const r = await reconcileSubscription(supabase, sub, { dryRun })
        const key = r.outcome.split(' ')[0]
        stats[key] = (stats[key] || 0) + 1
        if (r.changed) {
          changed++
          if (healed.length < 200) healed.push(`${sub.user_id}: ${r.outcome}`)
        }
      } catch (err) {
        stats['error'] = (stats['error'] || 0) + 1
        console.error(`[reconcile] error for sub ${sub.id}:`, err)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const processingTime = Date.now() - startTime
  console.log(`[reconcile] ${dryRun ? 'DRY RUN ' : ''}done in ${processingTime}ms — ${changed} changed of ${subs.length}`)

  return NextResponse.json({
    success: true,
    dryRun,
    stats: {
      subscriptions_checked: subs.length,
      changed,
      outcomes: stats,
      processing_time_ms: processingTime,
    },
    healed: healed.length ? healed : undefined,
    timestamp: new Date().toISOString(),
  })
}
