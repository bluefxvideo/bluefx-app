'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { RoughcutRemoval } from '@/actions/database/video-roughcut-database';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface RemovalListProps {
  removals: RoughcutRemoval[];
}

// TODO: Phase 2 — add per-row toggles so users can keep individual cuts and regenerate the XML.
export function RemovalList({ removals }: RemovalListProps) {
  if (!removals || removals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-2 py-4">
        No cuts — the take was clean.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-3">
      <ul className="space-y-3">
        {removals.map((r, i) => {
          const duration = Math.max(0, Math.round(r.end - r.start));
          return (
            <li
              key={i}
              className="rounded-md border bg-card px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">
                  {formatTime(r.start)} – {formatTime(r.end)}
                </span>
                <span className="font-mono">({duration}s)</span>
                <Badge variant="secondary" className="ml-auto">
                  Removed
                </Badge>
              </div>
              <p className="mt-1 text-foreground">&ldquo;{r.text}&rdquo;</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reason: {r.reason}
              </p>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
