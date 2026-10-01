import { createAdminClient } from '@/app/supabase/server';
import { ensureCreditsForUsage } from '@/lib/credits/subscription-entitlement';
import { refundFailedGeneration } from '@/lib/credits/refund';

/**
 * Credits for work that runs after the click: a "Do it for me" run makes its pictures and
 * clips minutes later, in the background, where no signed-in session exists. Every charge
 * names one thing (a picture, a clip) with a reference of its own, so a thing that fails
 * gets exactly its own credits back.
 */

export interface CloneCredits {
  /** Charges `amount` for the thing named by `reference`. Returns the reason when the charge did not happen. */
  charge(amount: number, operation: string, reference: string, detail?: Record<string, unknown>): Promise<string | null>;
  /** Gives back what was charged for `reference`. Safe to call twice. */
  refund(reference: string, operation: string): Promise<number>;
}

/** The real ledger, for one client. */
export function creditsOf(userId: string): CloneCredits {
  return {
    async charge(amount, operation, reference, detail = {}) {
      const entitlement = await ensureCreditsForUsage(userId, amount);
      if (!entitlement.ok) return entitlement.error || 'Insufficient credits';
      const { data, error } = await createAdminClient().rpc('deduct_user_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_operation: operation,
        p_metadata: { batch_id: reference, ...detail } as never,
      });
      const result = data as { success?: boolean; error?: string } | null;
      if (error || !result?.success) return result?.error || error?.message || 'Insufficient credits';
      return null;
    },
    async refund(reference, operation) {
      const refund = await refundFailedGeneration({ userId, referenceIds: [reference], operation });
      return refund.refunded ? refund.amount || 0 : 0;
    },
  };
}

/** The client's balance right now. */
export async function balanceOf(userId: string): Promise<number> {
  const { data } = await createAdminClient().from('user_credits').select('available_credits').eq('user_id', userId).maybeSingle();
  return data?.available_credits || 0;
}
