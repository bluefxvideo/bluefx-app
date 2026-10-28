/**
 * Creates the profile row for a buyer the payment webhooks just signed up (ClickBank, FastSpring, JVZoo).
 *
 * The username comes from the start of the email, and usernames are unique. Before 2026-10-28 a taken name
 * ("info" for info@strawberrytreefarms.com, already used by info@digiprogress.com) made the insert fail with
 * nobody noticing, so the buyer got a login and a plan but no profile. Now a taken name gets the domain, then
 * a random number added, and any other failure is logged.
 */
import { createAdminClient } from '@/app/supabase/server'

type AdminClient = ReturnType<typeof createAdminClient>

const clean = (text: string) => text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

export async function insertBuyerProfile(
  admin: AdminClient,
  buyer: { userId: string; email: string; fullName: string | null }
): Promise<void> {
  const [local, domain = ''] = buyer.email.split('@')
  const base = clean(local) || 'user'
  const candidates = [
    base,
    clean(`${local}${domain.replace(/\.[a-z]+$/i, '')}`) || base,
    `${base}${Math.floor(1000 + Math.random() * 9000)}`,
    `${base}${buyer.userId.replace(/-/g, '').slice(0, 8)}`,
  ]
  const now = new Date().toISOString()

  for (const username of [...new Set(candidates)]) {
    const { error } = await admin.from('profiles').insert({
      id: buyer.userId,
      email: buyer.email,
      username,
      full_name: buyer.fullName?.trim() || null,
      bio: null,
      avatar_url: null,
      created_at: now,
      updated_at: now,
    })
    if (!error) return
    // 23505 = unique violation: the username is taken (or the profile already exists).
    if (error.code !== '23505') {
      console.error(`Profile insert failed for ${buyer.email}:`, error)
      return
    }
    const { data: existing } = await admin.from('profiles').select('id').eq('id', buyer.userId).maybeSingle()
    if (existing) return
  }
  console.error(`Profile insert failed for ${buyer.email}: every username was taken`)
}
