import { NextResponse } from 'next/server'
import { createClient } from '@/app/supabase/server'
import { ensureCreditsForUsage } from '@/lib/credits/subscription-entitlement'

/**
 * Lazily heal the caller's monthly credit allotment.
 *
 * The dashboard calls this before reading user_credits so that an active or
 * lifetime user whose 30-day credit period lapsed while they were away sees a
 * fresh 600 instead of a stale zero. This is the same lazy top-up the tool
 * routes run at point of use (ensureCreditsForUsage with amount 0 never blocks
 * and never grants to trial/cancelled accounts) — crucial for lifetime plans,
 * which have no billing webhooks and no working cron to renew them.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await ensureCreditsForUsage(user.id, 0)
  return NextResponse.json({ ok: result.ok })
}
