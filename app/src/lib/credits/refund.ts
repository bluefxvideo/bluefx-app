import { createAdminClient } from '@/app/supabase/server';

/**
 * Refund credits for a FAILED generation — called from webhook failure handlers.
 *
 * Safety properties:
 * - Exact-match only: refunds happen only when we can trace exactly one original
 *   debit by reference id (never guesses an amount).
 * - Idempotent: a refund for the same reference id is recorded and never repeated,
 *   so webhook retries are safe.
 * - Two ledgers: most tools log debits in `credit_transactions` (metadata.batch_id /
 *   job_id / prediction_id); voice-over and music log in `credit_usage` (reference_id).
 */
/** Flatten whatever the provider sent (string, {message}, {detail:[...]}) into one line. */
export function normalizeProviderError(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw.trim() || undefined;
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const m = o.message ?? o.detail ?? o.error ?? o.msg;
    if (typeof m === 'string') return m.trim() || undefined;
    if (Array.isArray(m)) {
      return m.map(x => (typeof x === 'string' ? x : (x as { msg?: string })?.msg || JSON.stringify(x))).join('; ');
    }
    try { return JSON.stringify(raw).slice(0, 300); } catch { return undefined; }
  }
  return String(raw);
}

/**
 * Turn a provider failure into a message the user can act on: what went
 * wrong with THIS render, and what came back to their balance. Moderation
 * rejections get the explicit treatment because users otherwise re-roll the
 * same blocked prompt and pay every time. Never claims a refund that did not
 * happen: the amount comes from the ledger write, not from hope.
 */
export function describeGenerationFailure(raw: unknown, refundedCredits?: number): string {
  const detail = normalizeProviderError(raw);
  const s = (detail || '').toLowerCase();
  let why: string;
  if (/content|policy|moderat|nsfw|safety|flag|prohibit|inappropriate/.test(s)) {
    why = `Blocked by the AI provider's content filter${detail ? ` (provider said: "${detail.slice(0, 160)}")` : ''}. Close-ups of skin or body parts, medical themes, and real brand products often trigger it. Reword the scene (wider shot, no brand names) and try again.`;
  } else if (detail) {
    why = `The provider could not generate this video: ${detail.slice(0, 220)}`;
  } else {
    why = 'The provider could not generate this video and gave no reason. Trying again usually works.';
  }
  const refund = refundedCredits && refundedCredits > 0
    ? ` ${refundedCredits} credits have been returned to your balance.`
    : '';
  return why + refund;
}

export async function refundFailedGeneration(opts: {
  userId: string;
  /** Every id we know for this job (prediction id, batch id, record id, …). */
  referenceIds: (string | null | undefined)[];
  /** For the ledger description, e.g. 'voice over generation'. */
  operation: string;
}): Promise<{ refunded: boolean; amount?: number; reason?: string }> {
  const refs = [...new Set(opts.referenceIds.filter((r): r is string => !!r))];
  if (!opts.userId || refs.length === 0) return { refunded: false, reason: 'no reference ids' };

  try {
    const supabase = createAdminClient();

    // 1) Idempotency — has any of these references already been refunded?
    const { data: prior } = await supabase
      .from('credit_transactions')
      .select('id, metadata')
      .eq('user_id', opts.userId)
      .eq('operation_type', 'refund')
      .order('created_at', { ascending: false })
      .limit(100);
    if ((prior || []).some(p => refs.includes((p.metadata as Record<string, string>)?.refund_reference))) {
      return { refunded: false, reason: 'already refunded' };
    }

    // 2) Locate the original debit — credit_transactions first (shared deductCredits path)
    let amount = 0;
    let matchedRef: string | undefined;
    const orFilter = refs
      .flatMap(r => [`metadata->>batch_id.eq.${r}`, `metadata->>job_id.eq.${r}`, `metadata->>prediction_id.eq.${r}`])
      .join(',');
    const { data: debits } = await supabase
      .from('credit_transactions')
      .select('id, amount, metadata')
      .eq('user_id', opts.userId)
      .eq('transaction_type', 'debit')
      .or(orFilter)
      .limit(2);

    if (debits && debits.length === 1) {
      amount = Math.abs(debits[0].amount || 0);
      const m = (debits[0].metadata || {}) as Record<string, string>;
      matchedRef = m.batch_id || m.job_id || m.prediction_id;
    } else if (!debits || debits.length === 0) {
      // 2b) voice-over / music ledger
      const { data: usage } = await supabase
        .from('credit_usage')
        .select('id, credits_used, reference_id')
        .eq('user_id', opts.userId)
        .in('reference_id', refs)
        .limit(2);
      if (usage && usage.length === 1) {
        amount = Math.abs(usage[0].credits_used || 0);
        matchedRef = usage[0].reference_id;
      } else {
        return { refunded: false, reason: `no traceable debit (usage matches: ${usage?.length ?? 0})` };
      }
    } else {
      return { refunded: false, reason: 'multiple debits matched — ambiguous, not refunding' };
    }

    if (amount <= 0) return { refunded: false, reason: 'zero amount' };

    // 3) Apply the refund to the balance
    const { data: credits } = await supabase
      .from('user_credits')
      .select('available_credits, used_credits')
      .eq('user_id', opts.userId)
      .single();
    if (!credits) return { refunded: false, reason: 'no user_credits row' };

    // available_credits is a GENERATED column (total - used): writing it makes
    // Postgres reject the whole update, which silently killed every refund
    // since this shipped. Only used_credits may be written; available follows.
    const applied = Math.min(amount, credits.used_credits || 0);
    if (applied <= 0) return { refunded: false, reason: 'nothing to reclaim: used_credits already 0' };
    const newAvailable = (credits.available_credits || 0) + applied;
    const { error: updErr } = await supabase
      .from('user_credits')
      .update({
        used_credits: (credits.used_credits || 0) - applied,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', opts.userId);
    if (updErr) return { refunded: false, reason: `balance update failed: ${updErr.message}` };
    amount = applied;

    // 4) Ledger entry (also serves as the idempotency marker)
    await supabase.from('credit_transactions').insert({
      user_id: opts.userId,
      transaction_type: 'credit',
      amount,
      balance_after: newAvailable,
      operation_type: 'refund',
      description: `Refund: failed ${opts.operation}`,
      metadata: { refund_reference: matchedRef || refs[0], operation: opts.operation },
    });

    console.log(`💸 Refunded ${amount} credits to ${opts.userId} for failed ${opts.operation} (ref ${matchedRef || refs[0]})`);
    return { refunded: true, amount };
  } catch (error) {
    console.error('refundFailedGeneration error:', error);
    return { refunded: false, reason: error instanceof Error ? error.message : 'refund failed' };
  }
}
