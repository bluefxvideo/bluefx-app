import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/supabase/server'
import { reconcileSubscription, FULL_CREDITS } from '@/lib/credits/subscription-entitlement'

export const maxDuration = 300 // up to 5 min

/**
 * Subscription Reconciliation Cron
 *
 * Daily self-healing job that treats FastSpring and ClickBank as the source of truth.
 *   FastSpring: GET /subscriptions/{id} -> flip status, grant monthly credits
 *   ClickBank:  GET /orders2/{receipt}  -> flip status based on lineItemData.status
 *
 * Run via a Coolify scheduled task hitting http://localhost:3000/... (bypasses the
 * external proxy timeout, so the full run completes inside maxDuration).
 *
 *   ?dryRun=1   -> report only, no writes
 *   ?limit=N    -> only process the first N subs of each processor (for quick checks)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '0', 10) || Infinity

  // Auth — accept plain or Coolify-prefixed (APP_) env var name.
  const expectedToken = process.env.CRON_SECRET_TOKEN || process.env.APP_CRON_SECRET_TOKEN
  const authHeader = request.headers.get('authorization')
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Hard deadline — always return before maxDuration. Unprocessed subs are picked
  // up on the next run.
  const DEADLINE = startTime + 4 * 60 * 1000
  const overDeadline = () => Date.now() > DEADLINE

  const supabase = createAdminClient()
  const fsStats: Record<string, number> = {}
  const cbStats: Record<string, number> = {}
  let fsChanged = 0, cbChanged = 0
  let fsChecked = 0, cbChecked = 0
  const healed: string[] = []

  try {
    // ── FastSpring ───────────────────────────────────────────────────────────
    const { data: fsAll, error: fsError } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, status, plan_type, credits_per_month, fastspring_subscription_id, current_period_end')
      .not('fastspring_subscription_id', 'is', null)
    if (fsError) throw new Error(`fs query: ${fsError.message}`)

    const fsSubs = (fsAll || []).slice(0, limit)
    fsChecked = fsSubs.length

    const CONCURRENCY = 5
    let fsCursor = 0
    async function fsWorker() {
      while (fsCursor < fsSubs.length && !overDeadline()) {
        const sub = fsSubs[fsCursor++]
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
          console.error(`[reconcile/fs] ${sub.id}:`, err)
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, fsWorker))

    // ── ClickBank ────────────────────────────────────────────────────────────
    const clerkKey = process.env.CLICKBANK_CLERK_KEY || process.env.APP_CLICKBANK_CLERK_KEY
    if (!clerkKey) {
      cbStats['skipped_no_key'] = 1
    } else {
      const { data: cbAll } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, status, credits_per_month, current_period_end')
        .is('fastspring_subscription_id', null)
        // Lifetime rows also have a NULL fs id — they are paid in full and must
        // never be flipped by a stale ClickBank receipt from a previous purchase.
        .neq('plan_type', 'lifetime')
      const cbSubs = (cbAll || []).slice(0, limit)
      cbChecked = cbSubs.length

      const { data: cbEvents } = await supabase
        .from('webhook_events')
        .select('event_id, payload')
        .eq('processor', 'clickbank')
        .eq('event_type', 'SALE')

      const { data: profiles } = await supabase.from('profiles').select('id, email')
      const userByEmail = new Map(profiles?.map(p => [(p.email || '').toLowerCase(), p.id]) || [])
      const receiptsByUser = new Map<string, string[]>()
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
        for (let t = 0; t < 3; t++) {
          try {
            const r = await fetch(`https://api.clickbank.com/rest/1.3/orders2/${receipt}`, {
              headers: { Authorization: clerkKey!, Accept: 'application/json' },
              signal: AbortSignal.timeout(8000),
            })
            if (r.ok) return await r.json() as Record<string, unknown>
            if (r.status === 404) return null
          } catch { /* timeout/network — fall through to retry */ }
          if (t < 2) await new Promise(res => setTimeout(res, 500 * (t + 1)))
        }
        return undefined // unresolved
      }

      for (const sub of cbSubs) {
        if (overDeadline()) { cbStats['deadline_skip'] = (cbStats['deadline_skip'] || 0) + 1; continue }
        const receipts = receiptsByUser.get(sub.user_id) || []
        if (!receipts.length) { cbStats['no_receipt'] = (cbStats['no_receipt'] || 0) + 1; continue }

        let anyActive = false, anyResolved = false, anyUnres = false
        for (const rc of receipts) {
          const o = await cbLookup(rc)
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
        if (!anyResolved && !anyActive) { cbStats['unresolved'] = (cbStats['unresolved'] || 0) + 1; continue }

        const targetStatus = anyActive ? 'active' : 'cancelled'
        const needsTopup = anyActive && (
          sub.status !== 'active' || !sub.current_period_end || new Date(sub.current_period_end) < new Date()
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
            await supabase.rpc('topup_user_credits', { p_user_id: sub.user_id, p_target_credits: sub.credits_per_month || FULL_CREDITS })
          }
        }
        cbChanged++
        if (healed.length < 200) healed.push(`CB ${sub.user_id}: ${outcome}`)
      }
    }

    const processingTime = Date.now() - startTime
    console.log(`[reconcile] ${dryRun ? 'DRY ' : ''}done in ${processingTime}ms — FS ${fsChanged} / CB ${cbChanged} changed`)

    return NextResponse.json({
      success: true,
      dryRun,
      fastspring: { subscriptions_checked: fsChecked, changed: fsChanged, outcomes: fsStats },
      clickbank: { subscriptions_checked: cbChecked, changed: cbChanged, outcomes: cbStats },
      stats: { total_changed: fsChanged + cbChanged, processing_time_ms: processingTime },
      healed: healed.length ? healed : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[reconcile] fatal:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'reconcile failed',
      partial: { fsChecked, fsChanged, cbChecked, cbChanged, fsStats, cbStats },
    }, { status: 500 })
  }
}
