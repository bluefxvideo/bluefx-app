'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Short rules for a strong result, above a tool's form. Open until the user
 * closes it once; `storageKey` remembers that per tool.
 */
export function ToolTips({ storageKey, tips }: { storageKey: string; tips: ReactNode[] }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === '1') setOpen(false);
    } catch {
      // storage blocked: the tips simply stay open
    }
  }, [storageKey]);
  const toggle = () => {
    setOpen((was) => {
      try {
        localStorage.setItem(storageKey, was ? '1' : '0');
      } catch {
        // storage blocked: nothing to remember
      }
      return !was;
    });
  };

  return (
    <div className="rounded-lg border bg-muted/30">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium">
        <span className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          How to get a great result
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ol className="list-decimal space-y-1.5 px-3 pb-3 pl-7 text-xs leading-relaxed text-muted-foreground">
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
