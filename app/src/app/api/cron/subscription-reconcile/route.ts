import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
import { reconcileSubscription, FULL_CREDITS } from '@/lib/credits/subscription-entitlement'

export const maxDuration = 300 // up to 5 min

/**
 * Subscription Reconciliation Cron
 *
 * Daily self-healing job that treats FastSpring and ClickBank as the source of truth.
 *
 * FastSpring: GET /subscriptions/{id} -> flip status, grant monthly credits
 * ClickBank:  GET /orders2/{receipt}  -> flip status based on lineItemData.status
 *
 * Run via Coolify scheduled tasks:
 *   GET /api/cron/subscription-reconcile          -> apply fixes
 *   GET /api/cron/subscription-reconcile?dryRun=1 -> report only, no writes
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'

  // Auth — accept plain or Coolify-prefixed (APP_) env var name.
  const expectedToken = process.env.CRON_SECRET_TOKEN || process.env.APP_CRON_SECRET_TOKEN
  const authHeader = request.headers.get('authorization')
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const fsStats: Record<string, number> = {}
  const cbStats: Record<string, number> = {}
  let fsChanged = 0, cbChanged = 0
  const healed: string[] = []

  // ── FastSpring reconciliation ──────────────────────────────────────────────
  const { data: fsSubs, error: fsError } = await supabase
    .from('user_subscriptions')
    .select('id, user_id, status, plan_type, credits_per_month, fastspring_subscription_id, current_period_end')
    .not('fastspring_subscription_id', 'is', null)

  if (fsError) {
    return NextResponse.json({ success: false, error: fsError.message }, { status: 500 })
  }

  const CONCURRENCY = 5
  let fsCursor = 0
  async function fsWorker() {
    while (fsCursor < fsSubs!.length) {
      const sub = fsSubs![fsCursor++]
      try {
        const r = await reconcileSubscription(supabase, sub, { dryRun })
        const key = r.outcome.split(' ')[0]
        fsStats[key] = (fsStats[key] || 0) + 1
        if (r.changed) {
          fsChanged++
          if (healed.length < 200) healed.push(`FS ${sub.user_id}: ${r.outcome}`)
        }
      } catch (err) {
        fsStats['error'] = (fsStats['error'] || 0) + 1
        console.error(`[reconcile/fs] error for sub ${sub.id}:`, err)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, fsWorker))

  // ── ClickBank reconciliation ───────────────────────────────────────────────
  const clerkKey = process.env.CLICKBANK_CLERK_KEY || process.env.APP_CLICKBANK_CLERK_KEY

  if (clerkKey) {
    // Pull all subs with no FastSpring id (ClickBank / manual)
    const { data: cbSubs } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, status, credits_per_month, current_period_end')
      .is('fastspring_subscription_id', null)

    // Build email -> receipts map from webhook_events
    const { data: cbEvents } = await supabase
      .from('webhook_events')
      .select('event_id, payload')
      .eq('processor', 'clickbank')
      .eq('event_type', 'SALE')

    const receiptsByUser = new Map<string, string[]>()
    const { data: profiles } = await supabase.from('profiles').select('id, email')
    const emailById = new Map(profiles?.map(p => [p.id, (p.email || '').toLowerCase()]) || [])
    const userByEmail = new Map(profiles?.map(p => [(p.email || '').toLowerCase(), p.id]) || [])

    for (const e of cbEvents || []) {
      const p = (e.payload || {}) as Record<string, unknown>
      const customer = p.customer as Record<string, unknown> | undefined
      const email = ((customer?.email || p.customer_email || p.email || '') as string).toLowerCase()
      const uid = email ? userByEmail.get(email) : undefined
      if (!uid) continue
      if (!receiptsByUser.has(uid)) receiptsByUser.set(uid, [])
      receiptsByUser.get(uid)!.push(e.event_id)
    }

    async function cbLookup(receipt: string): Promise<Record<string, unknown> | null | undefined> {
      for (let t = 0; t < 3; t++) { // max 3 tries, short backoff
        const r = await fetch(`https://api.clickbank.com/rest/1.3/orders2/${receipt}`, {
          headers: { Authorization: clerkKey!, Accept: 'application/json' },
          signal: AbortSignal.timeout(8000), // 8s per request
        })
        if (r.ok) return await r.json() as Record<string, unknown>
        if (r.status === 404) return null
        if (t < 2) await new Promise(res => setTimeout(res, 500 * (t + 1))) // 0.5s, 1s
      }
      return undefined // unresolved
    }

    for (const sub of cbSubs || []) {
      const receipts = receiptsByUser.get(sub.user_id) || []
      if (!receipts.length) { cbStats['no_receipt'] = (cbStats['no_receipt'] || 0) + 1; continue }

      let anyActive = false, anyResolved = false, anyUnres = false
      for (const rc of receipts) {
        const o = await cbLookup(rc)
        await new Promise(res => setTimeout(res, 150))
        if (o === undefined) { anyUnres = true; continue }
        if (o === null) { anyResolved = true; continue }
        anyResolved = true
        const orderData = (o.orderData || {}) as Record<string, unknown>
        const li = orderData.lineItemData
        const item = Array.isArray(li)
          ? ((li as Record<string, unknown>[]).find(x => x.recurring === 'true') || (li as Record<string, unknown>[])[0])
          : li as Record<string, unknown>
        if (item?.status === 'ACTIVE') anyActive = true
      }

      if (anyUnres && !anyActive) { cbStats['unresolved'] = (cbStats['unresolved'] || 0) + 1; continue }

      const targetStatus = anyActive ? 'active' : 'cancelled'
      const needsTopup = anyActive && (
        sub.status !== 'active' ||
        !sub.current_period_end ||
        new Date(sub.current_period_end) < new Date()
      )
      const outcome = `${sub.status}->${targetStatus}${needsTopup ? ' +topup' : ''}`
      cbStats[outcome] = (cbStats[outcome] || 0) + 1

      if (sub.status === targetStatus && !needsTopup) continue

      if (!dryRun) {
        if (sub.status !== targetStatus) {
          await supabase
            .from('user_subscriptions')
            .update({ status: targetStatus, updated_at: new Date().toISOString() })
            .eq('id', sub.id)
        }
        if (needsTopup) {
          const monthly = sub.credits_per_month || FULL_CREDITS
          await supabase.rpc('topup_user_credits', { p_user_id: sub.user_id, p_target_credits: monthly })
        }
      }
      cbChanged++
      if (healed.length < 200) healed.push(`CB ${sub.user_id}: ${outcome}`)
    }
  } else {
    cbStats['skipped'] = 1
    console.warn('[reconcile/cb] CLICKBANK_CLERK_KEY not set — skipping ClickBank reconciliation')
  }

  const processingTime = Date.now() - startTime
  console.log(`[reconcile] ${dryRun ? 'DRY RUN ' : ''}done in ${processingTime}ms — FS: ${fsChanged} changed, CB: ${cbChanged} changed`)

  return NextResponse.json({
    success: true,
    dryRun,
    fastspring: {
      subscriptions_checked: fsSubs?.length || 0,
      changed: fsChanged,
      outcomes: fsStats,
    },
    clickbank: {
      subscriptions_checked: (cbSubs?.length || 0),
      changed: cbChanged,
      outcomes: cbStats,
    },
    stats: {
      total_changed: fsChanged + cbChanged,
      processing_time_ms: processingTime,
    },
    healed: healed.length ? healed : undefined,
    timestamp: new Date().toISOString(),
  })
}
