/**
 * MailerLite list sync (new API: https://connect.mailerlite.com/api).
 *
 * `POST /subscribers` is an upsert: an existing subscriber is updated and
 * added to the given groups without losing anything (201 new / 200 existing).
 * Callers are webhooks that must never fail because the list is down, so this
 * returns a result instead of throwing, and is a logged no-op when the API
 * key is not configured.
 *
 * Env (declared in docker-compose.yml, filled in Coolify):
 *   MAILERLITE_API_KEY      API token from MailerLite → Integrations → API
 *   MAILERLITE_GROUP_JVZOO  group id every JVZoo buyer joins
 *   MAILERLITE_GROUPS_JSON  optional {"<jvzoo product id>": "<group id>"} for per-product groups
 */

const API_BASE = 'https://connect.mailerlite.com/api'

export interface MailerLiteSubscribeInput {
  email: string
  /** Full name as the processor sent it; split into name / last_name for MailerLite. */
  fullName?: string
  groups?: (string | undefined | null)[]
  fields?: Record<string, string | number | null>
}

export async function subscribeToMailerLite(input: MailerLiteSubscribeInput): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const apiKey = process.env.MAILERLITE_API_KEY
  if (!apiKey) {
    console.warn('MailerLite: MAILERLITE_API_KEY not set, skipping list sync for', input.email)
    return { ok: false, reason: 'not configured' }
  }
  const email = input.email.trim().toLowerCase()
  if (!email.includes('@')) return { ok: false, reason: 'invalid email' }

  const [name, ...rest] = (input.fullName || '').trim().split(/\s+/).filter(Boolean)
  const groups = [...new Set((input.groups || []).filter((g): g is string => !!g))]

  const body: Record<string, unknown> = {
    email,
    status: 'active',
    fields: {
      ...(name ? { name } : {}),
      ...(rest.length ? { last_name: rest.join(' ') } : {}),
      ...(input.fields || {}),
    },
    ...(groups.length ? { groups } : {}),
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(`${API_BASE}/subscribers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      const text = await res.text()
      console.error(`MailerLite: subscribe failed for ${email} (${res.status}): ${text.slice(0, 200)}`)
      return { ok: false, status: res.status, reason: text.slice(0, 200) }
    }
    console.log(`📧 MailerLite: ${res.status === 201 ? 'added' : 'updated'} ${email}${groups.length ? ` → groups ${groups.join(',')}` : ''}`)
    return { ok: true, status: res.status }
  } catch (error) {
    console.error('MailerLite: request error for', email, error)
    return { ok: false, reason: error instanceof Error ? error.message : 'request error' }
  }
}

/** Groups for a JVZoo buyer: the shared JVZoo group plus the product's own group, if configured. */
export function mailerLiteGroupsForJvzooProduct(productId: string): string[] {
  const groups: string[] = []
  if (process.env.MAILERLITE_GROUP_JVZOO) groups.push(process.env.MAILERLITE_GROUP_JVZOO)
  try {
    const map = JSON.parse(process.env.MAILERLITE_GROUPS_JSON || '{}') as Record<string, string>
    if (map[productId]) groups.push(map[productId])
  } catch {
    console.warn('MailerLite: MAILERLITE_GROUPS_JSON is not valid JSON, ignoring')
  }
  return groups
}
