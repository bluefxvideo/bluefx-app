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

    const newAvailable = (credits.available_credits || 0) + amount;
    const { error: updErr } = await supabase
      .from('user_credits')
      .update({
        available_credits: newAvailable,
        used_credits: Math.max(0, (credits.used_credits || 0) - amount),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', opts.userId);
    if (updErr) return { refunded: false, reason: `balance update failed: ${updErr.message}` };

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
