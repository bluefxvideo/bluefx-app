'use client';

import { useEffect, useState } from 'react';

/**
 * Live elapsed counter for long-running generations. Mount it alongside the
 * spinner — it starts at 0:00 on mount. Pass `typical` (e.g. "1–3 minutes")
 * so users can calibrate expectations instead of staring at a bare spinner.
 */
export function ElapsedTimer({ typical, className }: { typical?: string; className?: string }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <span className={className ?? 'text-xs text-zinc-400 tabular-nums'}>
      {mm}:{ss} elapsed{typical ? ` · usually ${typical}` : ''}
    </span>
  );
}
