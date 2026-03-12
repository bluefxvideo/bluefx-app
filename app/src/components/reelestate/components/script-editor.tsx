'use client';

import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { ScriptSegment } from '@/types/reelestate';

interface ScriptEditorProps {
  segments: ScriptSegment[];
  photos: string[];
  onUpdateSegment: (index: number, voiceover: string) => void;
  disabled?: boolean;
}

export function ScriptEditor({ segments, photos, onUpdateSegment, disabled }: ScriptEditorProps) {
  const totalDuration = segments.reduce((acc, s) => acc + s.duration_seconds, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {segments.length} segments
        </span>
        <Badge variant="outline">{totalDuration}s total</Badge>
      </div>

      <div className="space-y-2">
        {segments.map((segment) => (
          <div
            key={segment.index}
            className="flex gap-2 p-2 rounded-lg border border-border/50 bg-muted/20"
          >
            {/* Thumbnail */}
            <div className="shrink-0 w-16 h-12 rounded overflow-hidden">
              <img
                src={photos[segment.image_index]}
                alt={`Segment ${segment.index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  #{segment.index + 1}
                </span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {segment.duration_seconds}s
                </Badge>
              </div>
              <Textarea
                value={segment.voiceover}
                onChange={(e) => onUpdateSegment(segment.index, e.target.value)}
                className="min-h-[48px] text-sm resize-none"
                disabled={disabled}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
