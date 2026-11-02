import { createAdminClient } from '@/app/supabase/server'
import { bankLimitMessage, isHeldByWindow, type CreditBankStatus } from '@/lib/credits/credit-bank-messages'

/**
 * Credit bank (owner decision 2026-11-02): people who buy lifetime after the launch time get
 * 5,000 credits once that never expire, with at most 1,500 bank credits spent per rolling 30
 * days. Credit pack credits are never limited. Existing lifetime buyers and the $37 monthly
 * plan keep 600 credits every 30 days.
 *
 * The rules live in the database (migration 20261102000000_credit_bank.sql): the launch switch
 * (credit_bank_settings.starts_at), who is on the bank (credit_bank_accounts), the window and
 * the bucket split (deduct_user_credits). This file only reads them. Until that migration is
 * applied every call here answers "not a bank account", so all accounts keep today's behaviour.
 */

type AdminClient = ReturnType<typeof createAdminClient>

/** PostgREST / Postgres codes for "this table or function is not installed yet". */
function notInstalled(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code || '') ||
    /does not exist|could not find the (function|table)/i.test(error.message || '')
}

export type BankLookup =
  | { kind: 'bank'; status: CreditBankStatus }
  | { kind: 'legacy' }
  /** The database could not answer (a passing error). Callers must not top up or grant then. */
  | { kind: 'unknown' }

/** Is this account on the credit bank, and where does it stand? */
export async function lookupCreditBank(userId: string, admin: AdminClient = createAdminClient()): Promise<BankLookup> {
  try {
    const { data, error } = await admin.rpc('credit_bank_status', { p_user_id: userId })
    if (error) {
      if (notInstalled(error)) return { kind: 'legacy' }
      console.error(`⚠️ credit bank status of ${userId} unavailable:`, error.message)
      return { kind: 'unknown' }
    }
    const status = data as unknown as CreditBankStatus | { is_bank: false } | null
    if (status && status.is_bank) return { kind: 'bank', status }
    return { kind: 'legacy' }
  } catch (err) {
    console.error(`⚠️ credit bank status of ${userId} failed:`, err)
    return { kind: 'unknown' }
  }
}

/** The status for pages, or null for every account that is not on the bank. */
export async function getCreditBankStatus(userId: string): Promise<CreditBankStatus | null> {
  const lookup = await lookupCreditBank(userId)
  return lookup.kind === 'bank' ? lookup.status : null
}

/**
 * Credits a tool may plan to spend right now. Equals the balance for every account that is
 * not on the bank; for a bank account the bank credits the 30-day window holds back are left
 * out, so a tool that checks before it generates refuses up front instead of making a result
 * it cannot charge for.
 */
export async function spendableCredits(userId: string, available: number): Promise<number> {
  const lookup = await lookupCreditBank(userId)
  if (lookup.kind !== 'bank') return available
  return Math.min(available, lookup.status.spendable_now)
}

/**
 * Pre-flight for a bank account: may it spend `amount` now? Null when it is not a bank account.
 * The database enforces the same rule again, atomically, at the moment of the charge.
 */
export function checkBankSpend(status: CreditBankStatus, amount: number): { ok: boolean; error?: string } {
  if (amount <= status.spendable_now) return { ok: true }
  if (isHeldByWindow(status, amount)) return { ok: false, error: bankLimitMessage(status, amount) }
  return { ok: false, error: 'Insufficient credits' }
}

/**
 * Put a lifetime buyer on the bank when the launch switch says so. Call it after the purchase
 * has been provisioned the usual way (subscription row + 600 credits), and only for a buyer
 * who did not own lifetime before this purchase. Never throws: the purchase is already
 * recorded, and while the switch is off (or the migration is missing) the buyer simply stays
 * on 600 credits every 30 days.
 */
export async function grantCreditBankIfLaunched(
  admin: AdminClient,
  userId: string,
  source: string,
): Promise<{ granted: boolean; reason?: string }> {
  try {
    const { data, error } = await admin.rpc('grant_credit_bank', {
      p_user_id: userId,
      p_source: source,
    })
    if (error) {
      if (notInstalled(error)) return { granted: false, reason: 'not installed' }
      console.error(`❌ ${source}: could not put ${userId} on the credit bank, the buyer stays on 600 credits every 30 days: ${error.message}`)
      return { granted: false, reason: error.message }
    }
    const result = (data || {}) as { granted?: boolean; reason?: string; bank_credits?: number; pack_credits?: number }
    if (result.granted) {
      console.log(`✅ ${source}: ${userId} is on the credit bank (${result.bank_credits} credits, ${result.pack_credits} pack credits kept)`)
      return { granted: true }
    }
    return { granted: false, reason: result.reason }
  } catch (err) {
    console.error(`❌ ${source}: credit bank grant for ${userId} failed:`, err)
    return { granted: false, reason: err instanceof Error ? err.message : 'failed' }
  }
}
