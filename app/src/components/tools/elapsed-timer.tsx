'use client';

import { useEffect, useState } from 'react';

/**
 * Live elapsed counter for long-running generations. Mount it alongside the
 * spinner. Without `since` it starts at 0:00 on mount. With `since` (a timestamp
 * in ms or an ISO string of when the job started) it shows the real elapsed
 * time, so it survives a remount, a reload and a background tab. Pass `typical`
 * (e.g. "1 to 3 minutes") so users can calibrate expectations instead of
 * staring at a bare spinner.
 */
export function ElapsedTimer({
  typical,
  className,
  since,
}: {
  typical?: string;
  className?: string;
  since?: number | string | null;
}) {
  const [start] = useState(() => {
    const parsed = typeof since === 'number' ? since : since ? new Date(since).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : Date.now();
  });
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((Date.now() - start) / 1000)));

  useEffect(() => {
    // Computed from the clock on every tick: a counter of ticks runs slow in background tabs
    const t = setInterval(() => setSecs(Math.max(0, Math.floor((Date.now() - start) / 1000))), 1000);
    return () => clearInterval(t);
  }, [start]);

  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <span className={className ?? 'text-xs text-zinc-400 tabular-nums'}>
      {mm}:{ss} elapsed{typical ? ` · usually ${typical}` : ''}
    </span>
  );
}
