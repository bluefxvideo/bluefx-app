'use client';

import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { ScriptSegment } from '@/types/reelestate';

interface ScriptEditorProps {
  segments: ScriptSegment[];
  photos: string[];
  onUpdateSegment: (index: number, voiceover: string) => void;
  onDeleteSegment?: (index: number) => void;
  onMoveSegment?: (index: number, direction: 'up' | 'down') => void;
  disabled?: boolean;
}

export function ScriptEditor({ segments, photos, onUpdateSegment, onDeleteSegment, onMoveSegment, disabled }: ScriptEditorProps) {
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
        {segments.map((segment, idx) => (
          <div
            key={segment.index}
            className="flex gap-2 p-2 rounded-lg border border-border/50 bg-muted/20"
          >
            {/* Reorder + Delete controls */}
            <div className="shrink-0 flex flex-col items-center justify-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={disabled || idx === 0}
                onClick={() => onMoveSegment?.(segment.index, 'up')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                disabled={disabled || segments.length <= 1}
                onClick={() => onDeleteSegment?.(segment.index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={disabled || idx === segments.length - 1}
                onClick={() => onMoveSegment?.(segment.index, 'down')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Thumbnail */}
            <div className="shrink-0 w-16 h-12 rounded overflow-hidden">
              <img
                src={photos[segment.image_index]}
                alt={`Segment ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  #{idx + 1}
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
