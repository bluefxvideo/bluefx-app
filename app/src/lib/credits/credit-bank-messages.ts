/**
 * Words for the credit bank (new lifetime buyers: 5,000 credits once, at most 1,500 of them
 * per rolling 30 days, credit pack credits never limited). Pure, so the server checks and the
 * page notices say exactly the same thing. Plain English, numbers as digits, no dashes.
 * The database function deduct_user_credits builds the same sentences for its refusals.
 */

export interface CreditBankStatus {
  is_bank: true;
  /** Size of the bank at purchase (5,000). */
  bank_credits: number;
  /** Bank credits not spent yet. */
  bank_left: number;
  /** Credit pack (and admin-added) credits not spent yet. Never limited. */
  pack_left: number;
  window_limit: number;
  window_days: number;
  /** Bank credits spent in the last window_days, refunds taken off. */
  window_used: number;
  window_left: number;
  /** What a generation may take right now: pack credits plus the bank credits the window allows. */
  spendable_now: number;
  /** When the oldest credits in the window count no more (null when nothing is counted). */
  next_free_at: string | null;
  /** From this window usage on, the balance shows a small note. */
  notice_from: number;
}

const n = (value: number) => Math.max(0, Math.round(value)).toLocaleString('en-US');

/** "Dec 4" (UTC, like the database's own sentence). */
export function bankDate(iso: string | null): string {
  if (!iso) return 'soon';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'soon';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Bank credits the window holds back right now. */
export function lockedBankCredits(status: CreditBankStatus): number {
  return Math.max(status.bank_left - status.window_left, 0);
}

/** The small note near the balance, or null while usage is under the notice line. */
export function bankUsageNote(status: CreditBankStatus): string | null {
  if (status.window_used < status.notice_from || status.window_left <= 0) return null;
  return `You've used ${n(status.window_used)} of your ${n(status.window_limit)} credits for this ${status.window_days}-day window. Resets on ${bankDate(status.next_free_at)}.`;
}

/** True when the window (not an empty balance) is what stops a generation of `needed` credits. */
export function isHeldByWindow(status: CreditBankStatus, needed: number): boolean {
  return needed > status.spendable_now && lockedBankCredits(status) > 0;
}

/** The clear message where they generate, when the window holds their bank credits back. */
export function bankLimitMessage(status: CreditBankStatus, needed?: number): string {
  const date = bankDate(status.next_free_at);
  const tail = 'Need more now? Buy a credit pack, pack credits work right away.';
  if (status.window_left <= 0 || needed === undefined) {
    return `You've reached your ${n(status.window_limit)} credits for this ${status.window_days}-day window. Your remaining ${n(status.bank_left)} credits are safe and unlock again on ${date}. ${tail}`;
  }
  return `This needs ${n(needed)} credits and you have ${n(status.spendable_now)} left in this ${status.window_days}-day window. Your other ${n(lockedBankCredits(status))} credits are safe and unlock again on ${date}. ${tail}`;
}

/** Recognises the limit refusal however a tool passes the error text along. */
export function isBankLimitError(message: string | null | undefined): boolean {
  return !!message && /credits for this \d+-day window|left in this \d+-day window/.test(message);
}
