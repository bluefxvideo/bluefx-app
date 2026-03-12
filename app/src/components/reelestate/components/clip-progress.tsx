'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, Clock, Download, RefreshCw } from 'lucide-react';
import type { ClipStatus } from '@/types/reelestate';

interface ClipProgressProps {
  clips: ClipStatus[];
  photos: string[];
  onRegenerateClip?: (clipIndex: number) => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  pending: { icon: <Clock className="w-3 h-3" />, label: 'Queued', color: 'bg-muted' },
  starting: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Starting', color: 'bg-blue-500/20' },
  processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Generating', color: 'bg-blue-500/20' },
  succeeded: { icon: <Check className="w-3 h-3" />, label: 'Done', color: 'bg-green-500/20' },
  failed: { icon: <X className="w-3 h-3" />, label: 'Failed', color: 'bg-destructive/20' },
};

export function ClipProgress({ clips, photos, onRegenerateClip }: ClipProgressProps) {
  const succeeded = clips.filter(c => c.status === 'succeeded').length;
  const failed = clips.filter(c => c.status === 'failed').length;
  const processing = clips.filter(c => c.status === 'starting' || c.status === 'processing').length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{clips.length} clips</span>
        {succeeded > 0 && <Badge variant="default" className="bg-green-600">{succeeded} done</Badge>}
        {processing > 0 && <Badge variant="secondary">{processing} generating</Badge>}
        {failed > 0 && <Badge variant="destructive">{failed} failed</Badge>}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${clips.length > 0 ? (succeeded / clips.length) * 100 : 0}%` }}
        />
      </div>

      {/* Clip grid */}
      <div className="grid grid-cols-3 gap-2">
        {clips.map((clip) => {
          const config = STATUS_CONFIG[clip.status] || STATUS_CONFIG.pending;
          const canRegenerate = clip.status === 'succeeded' || clip.status === 'failed';

          return (
            <div
              key={clip.index}
              className={`relative rounded-lg overflow-hidden border border-border/50 ${config.color}`}
            >
              {clip.status === 'succeeded' && clip.video_url ? (
                <div className="relative group">
                  <video
                    src={clip.video_url}
                    className="w-full aspect-video object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onRegenerateClip && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-6 w-6"
                        title="Regenerate clip"
                        onClick={() => onRegenerateClip(clip.index)}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6"
                      title="Download clip"
                      onClick={async () => {
                        const res = await fetch(clip.video_url!);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `clip-${clip.index + 1}.mp4`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-video relative">
                  <img
                    src={photos[clip.index] || ''}
                    alt={`Clip ${clip.index + 1}`}
                    className="w-full h-full object-cover opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {clip.status === 'failed' && onRegenerateClip ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() => onRegenerateClip(clip.index)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    ) : (
                      config.icon
                    )}
                  </div>
                </div>
              )}

              <div className="absolute bottom-1 left-1">
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  #{clip.index + 1} — {config.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
