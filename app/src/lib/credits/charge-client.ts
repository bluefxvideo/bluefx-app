import { createAdminClient, createClient } from '@/app/supabase/server'

/**
 * The Supabase client a charge (deduct_user_credits) runs with.
 *
 * From 20261102000001_credit_rpc_guard.sql on, the function refuses the anon key and lets a
 * signed-in session charge only its own account. So:
 *   - a signed-in session charging someone else: refused here, before the database;
 *   - a signed-in session charging itself: its own client (the database checks it again);
 *   - no session at all (webhooks, after() work, crons): the service role, which those paths
 *     used to reach as anon. Without this, every background charge would fail after the guard.
 */
export async function chargeClientFor(
  userId: string,
): Promise<{ client: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>; error?: undefined } | { client?: undefined; error: string }> {
  let session: Awaited<ReturnType<typeof createClient>> | null = null
  let sessionUserId: string | null = null
  try {
    session = await createClient()
    const { data } = await session.auth.getUser()
    sessionUserId = data.user?.id ?? null
  } catch {
    // No request scope (background work): no session.
  }
  if (sessionUserId && sessionUserId !== userId) {
    console.error(`❌ Refused a charge to ${userId} from the session of ${sessionUserId}`)
    return { error: 'Credits can only be taken from your own account' }
  }
  if (sessionUserId && session) return { client: session }
  return { client: createAdminClient() }
}
