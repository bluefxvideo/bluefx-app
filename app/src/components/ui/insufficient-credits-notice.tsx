'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuyCreditsDialog } from '@/components/ui/buy-credits-dialog';
import { useCredits } from '@/hooks/useCredits';
import { bankLimitMessage, isHeldByWindow } from '@/lib/credits/credit-bank-messages';

/**
 * Inline "out of credits" notice with a Buy Credits CTA.
 * Drop next to any Generate button — self-contained (owns its dialog state),
 * so tools don't each have to wire up BuyCreditsDialog.
 */
export function InsufficientCreditsNotice({
  needed,
  available,
  className,
}: {
  needed?: number;
  available?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { bank } = useCredits();
  const detail =
    typeof needed === 'number' && typeof available === 'number'
      ? ` You need ${needed} credits but have ${available}.`
      : '';
  // A credit bank account (new lifetime buyer) whose 30-day window, not its balance, is what stops it.
  const windowMessage = bank && isHeldByWindow(bank, needed ?? bank.spendable_now + 1)
    ? bankLimitMessage(bank, needed)
    : null;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm ${className || ''}`}
    >
      <span className="text-yellow-700 dark:text-yellow-200">
        {windowMessage ?? <>Not enough credits.{detail}</>}
      </span>
      <Button size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        <Coins className="w-4 h-4 mr-1.5" />
        {windowMessage ? 'Buy a credit pack' : 'Buy Credits'}
      </Button>
      <BuyCreditsDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
