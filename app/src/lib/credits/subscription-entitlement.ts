/**
 * Subscription entitlement + FastSpring reconciliation.
 *
 * Single source of truth for "how many monthly credits is this account entitled
 * to, and is its status accurate vs the payment processor". Used by:
 *   - the per-tool auto top-up (ensureCreditsForUsage) — gates credit grants on paying status
 *   - the daily reconcile cron (reconcileSubscription) — heals stale status from FastSpring
 *
 * Credit policy (decided 2026-06-03):
 *   active   -> 600/mo (credits_per_month), renewed monthly
 *   trial    -> initial 100 at signup, NOT auto-renewed (kept until used or converted)
 *   cancelled/none -> no new grants (existing/bonus balance still spendable)
 */

import { createAdminClient } from '@/app/supabase/server'

export const FULL_CREDITS = 600
export const TRIAL_CREDITS = 100

type AdminClient = ReturnType<typeof createAdminClient>

/** FastSpring subscription state mapped to our subscription status. */
export type ReconciledStatus = 'active' | 'trial' | 'cancelled' | 'unknown'

/**
 * Read a FastSpring subscription via the API. Returns null on missing creds or
 * not-found so callers can fail safe (never block a user on a transient error).
 */
export async function fetchFastSpringSubscription(
  subscriptionId: string,
): Promise<{ state: string; active: boolean } | null> {
  const username = process.env.FASTSPRING_USERNAME
  const apiKey = process.env.FASTSPRING_API_KEY
  if (!username || !apiKey) {
    console.warn('[entitlement] FastSpring API creds not configured — cannot reconcile')
    return null
  }

  try {
    const auth = Buffer.from(`${username}:${apiKey}`).toString('base64')
    const res = await fetch(`https://api.fastspring.com/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000), // 8s per request — prevents stalling the cron
    })
    if (!res.ok) {
      if (res.status !== 404) console.error(`[entitlement] FastSpring API ${res.status} for ${subscriptionId}`)
      return null
    }
    const json = await res.json()
    return { state: String(json.state || '').toLowerCase(), active: json.active === true }
  } catch (err) {
    console.error('[entitlement] FastSpring API error:', err)
    return null
  }
}

type EntitlementAdmin = ReturnType<typeof createAdminClient>

/**
 * Check whether a user has an ACTIVE ClickBank subscription, by resolving their
 * SALE receipt(s) from webhook_events and querying the ClickBank order API.
 * Returns true (active), false (confirmed not active), or null (can't determine).
 */
export async function fetchClickBankActive(admin: EntitlementAdmin, userId: string): Promise<boolean | null> {
  const clerkKey = process.env.CLICKBANK_CLERK_KEY || process.env.APP_CLICKBANK_CLERK_KEY
  if (!clerkKey) return null

  const { data: prof } = await admin.from('profiles').select('email').eq('id', userId).maybeSingle()
  const email = (prof?.email || '').toLowerCase()
  if (!email) return null

  const { data: events } = await admin
    .from('webhook_events')
    .select('event_id, payload')
    .eq('processor', 'clickbank')
    .eq('event_type', 'SALE')

  const receipts: string[] = []
  for (const e of events || []) {
    const p = (e.payload || {}) as Record<string, unknown>
    const customer = p.customer as Record<string, unknown> | undefined
    const em = ((customer?.email || p.customer_email || p.email || '') as string).toLowerCase()
    if (em === email) receipts.push(e.event_id)
  }
  if (!receipts.length) return null

  let resolvedAny = false
  for (const rc of receipts) {
    try {
      const r = await fetch(`https://api.clickbank.com/rest/1.3/orders2/${rc}`, {
        headers: { Authorization: clerkKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) continue
      resolvedAny = true
      const j = await r.json() as Record<string, unknown>
      const orderData = (j.orderData || {}) as Record<string, unknown>
      const li = orderData.lineItemData
      const item = Array.isArray(li)
        ? ((li as Record<string, unknown>[]).find(x => x.recurring === 'true') || (li as Record<string, unknown>[])[0])
        : li as Record<string, unknown>
      if (item?.status === 'ACTIVE') return true
    } catch { /* timeout/network — skip this receipt */ }
  }
  return resolvedAny ? false : null
}

/**
 * Cancel a FastSpring subscription (DELETE = cancel at end of current billing period,
 * so a trial finishes without the $37 rebill). Used when a yearly upsell supersedes the
 * monthly. Returns true on success (or if already gone).
 */
export async function cancelFastSpringSubscription(subscriptionId: string): Promise<boolean> {
  const username = process.env.FASTSPRING_USERNAME
  const apiKey = process.env.FASTSPRING_API_KEY
  if (!username || !apiKey) {
    console.warn('[entitlement] FastSpring API creds not configured — cannot cancel', subscriptionId)
    return false
  }
  try {
    const auth = Buffer.from(`${username}:${apiKey}`).toString('base64')
    const res = await fetch(`https://api.fastspring.com/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    })
    if (res.ok || res.status === 404) return true
    console.error(`[entitlement] FastSpring cancel ${res.status} for ${subscriptionId}:`, (await res.text()).slice(0, 200))
    return false
  } catch (err) {
    console.error('[entitlement] FastSpring cancel error:', err)
    return false
  }
}

/** Map a FastSpring (state, active) pair to our canonical status. */
export function classifyFastSpring(fs: { state: string; active: boolean }): ReconciledStatus {
  if (fs.state === 'trial') return 'trial'
  if (fs.active && (fs.state === 'active' || fs.state === 'overdue')) return 'active'
  // canceled-but-still-active (paid through period end) — treat as active for entitlement,
  // it will flip to cancelled once FastSpring deactivates it at period end.
  if (fs.state === 'canceled' && fs.active) return 'active'
  if (fs.state === 'canceled' || fs.state === 'deactivated' || !fs.active) return 'cancelled'
  return 'unknown'
}

/**
 * Top up a user to `target` credits via the topup RPC (preserves bonus_credits,
 * resets the 30-day period). Returns true on success.
 */
async function topup(admin: AdminClient, userId: string, target: number): Promise<boolean> {
  const { data, error } = await admin.rpc('topup_user_credits', {
    p_user_id: userId,
    p_target_credits: target,
  })
  if (error || !data?.success) {
    console.error(`[entitlement] topup failed for ${userId}:`, error?.message || data?.error)
    return false
  }
  return true
}

interface SubRow {
  id: string
  user_id: string
  status: string
  plan_type: string
  credits_per_month: number | null
  fastspring_subscription_id: string | null
  current_period_end: string | null
}

/**
 * Reconcile one subscription against FastSpring and heal our DB to match.
 * Returns a short outcome for cron logging. Does nothing destructive (never
 * deletes accounts; only flips status and grants/withholds credits).
 */
export async function reconcileSubscription(
  admin: AdminClient,
  sub: SubRow,
  opts: { dryRun?: boolean } = {},
): Promise<{ outcome: string; changed: boolean }> {
  if (sub.plan_type === 'lifetime') {
    // Paid in full — there is no processor-side subscription that models it.
    // Reconciling would flip these to 'cancelled' (the split-pay sub deactivates
    // itself after the final installment). Credits refresh via ensureCreditsForUsage.
    return { outcome: 'skipped_lifetime', changed: false }
  }
  if (!sub.fastspring_subscription_id) {
    return { outcome: 'skipped_no_fs_id', changed: false }
  }

  const fs = await fetchFastSpringSubscription(sub.fastspring_subscription_id)
  if (!fs) return { outcome: 'fs_unavailable', changed: false }

  const target = classifyFastSpring(fs)
  if (target === 'unknown') return { outcome: `unknown_state:${fs.state}`, changed: false }

  const monthly = sub.credits_per_month || FULL_CREDITS
  const now = new Date()
  const periodExpired = !sub.current_period_end || new Date(sub.current_period_end) < now
  const justConverted = sub.status !== 'active' && target === 'active'

  if (opts.dryRun) {
    const willTopup = target === 'active' && (justConverted || periodExpired)
    return {
      outcome: `DRY ${sub.status}->${target}${willTopup ? ' +topup' : ''}`,
      changed: sub.status !== target,
    }
  }

  let changed = false

  // 1) Sync status if drifted
  if (sub.status !== target) {
    const { error } = await admin
      .from('user_subscriptions')
      .update({ status: target, updated_at: now.toISOString() })
      .eq('id', sub.id)
    if (error) return { outcome: `status_update_failed:${error.message}`, changed: false }
    changed = true
  }

  // 2) Grant credits for active subs: on conversion (immediately) or when the
  //    monthly period has lapsed. Trial/cancelled get no automatic grant here.
  if (target === 'active' && (justConverted || periodExpired)) {
    const ok = await topup(admin, sub.user_id, monthly)
    if (ok) changed = true
  }

  return { outcome: `${sub.status}->${target}${changed ? ' (healed)' : ''}`, changed }
}

/**
 * Ensure a user is allowed to spend `amount` credits before a tool run, granting
 * the monthly allotment only if they're a paying (active) subscriber.
 *
 * Replaces the old hardcoded "topup everyone to 600" block. Returns { ok:false }
 * with a user-facing message when a non-paying account is out of credits.
 *
 * Safety: a user who APPEARS trial but has actually converted (missed webhook)
 * is healed just-in-time via a live FastSpring check, so paying users are never
 * wrongly blocked.
 */
export async function ensureCreditsForUsage(
  userId: string,
  amount: number,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('user_subscriptions')
    .select('id, user_id, status, plan_type, credits_per_month, fastspring_subscription_id, current_period_end')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: credits } = await admin
    .from('user_credits')
    .select('available_credits, period_end')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date()
  const available = credits?.available_credits ?? 0
  const periodExpired = !credits?.period_end || new Date(credits.period_end) < now
  const monthly = sub?.credits_per_month || FULL_CREDITS
  const status = sub?.status ?? null

  // 1) Active subscriber: monthly renewal grant when the period has lapsed.
  if (status === 'active') {
    if (periodExpired) await topup(admin, userId, monthly)
    return { ok: true }
  }

  // 2) Enough existing balance (leftover trial or purchased bonus) — always spendable.
  if (available >= amount) return { ok: true }

  // 3) Looks like a trial but out of credits: a real trial->paid conversion may have
  //    been missed by webhooks. Verify against FastSpring before blocking.
  if (status === 'trial' && sub?.fastspring_subscription_id) {
    const fs = await fetchFastSpringSubscription(sub.fastspring_subscription_id)
    if (fs && classifyFastSpring(fs) === 'active') {
      await admin
        .from('user_subscriptions')
        .update({ status: 'active', updated_at: now.toISOString() })
        .eq('id', sub.id)
      await topup(admin, userId, monthly)
      console.log(`[entitlement] self-healed converted user ${userId} at point of use`)
      return { ok: true }
    }
    return { ok: false, error: 'Your trial credits are used up. Upgrade to a paid plan to keep creating.' }
  }

  // 4) Trial without a FastSpring id (ClickBank/manual): verify against ClickBank.
  //    A missed rebill webhook can leave a converted payer stuck on trial — self-heal
  //    them at point of use; only deny when ClickBank confirms they aren't active.
  if (status === 'trial') {
    const cbActive = await fetchClickBankActive(admin, userId)
    if (cbActive === true) {
      await admin
        .from('user_subscriptions')
        .update({ status: 'active', updated_at: now.toISOString() })
        .eq('id', sub!.id)
      await topup(admin, userId, monthly)
      console.log(`[entitlement] self-healed converted ClickBank user ${userId} at point of use`)
      return { ok: true }
    }
    // cbActive === false (confirmed not paying) or null (no receipt / key) — trial is spent.
    return { ok: false, error: 'Your trial credits are used up. Upgrade to a paid plan to keep creating.' }
  }

  // 5) Cancelled / no subscription and out of credits — block new grants.
  return { ok: false, error: 'No active subscription. Subscribe to continue using the AI tools.' }
}
