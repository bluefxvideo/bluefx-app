import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Find an auth user, paging through every account.
 *
 * `listUsers()` with no arguments returns only the newest 50 accounts. Callers
 * that searched that result treated any older customer as a stranger: webhooks
 * tried to create an account that already existed, the create failed on the
 * duplicate email, and the buyer was never provisioned. Always page.
 *
 * Errors throw rather than resolve to null, so a webhook returns 500 and the
 * processor retries instead of silently recording a missing user.
 */
export async function findAuthUser(
  supabase: SupabaseClient,
  match: (user: User) => boolean
): Promise<User | null> {
  const perPage = 1000

  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Failed to list auth users: ${error.message}`)

    const users = data?.users ?? []
    const hit = users.find(match)
    if (hit) return hit
    if (users.length < perPage) return null
  }

  return null
}

/**
 * Find an auth user by email. Compared case-insensitively: GoTrue stores
 * addresses lowercased, while processors send whatever the buyer typed.
 */
export async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined
): Promise<User | null> {
  const target = (email || '').trim().toLowerCase()
  if (!target) return null

  return findAuthUser(supabase, user => (user.email || '').toLowerCase() === target)
}
