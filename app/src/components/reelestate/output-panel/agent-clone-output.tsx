'use client';

import { containerStyles } from '@/lib/container-styles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Download, Loader2 } from 'lucide-react';
import type { AgentCloneShot } from '@/types/reelestate';

interface AgentCloneOutputProps {
  shot: AgentCloneShot | null;
}

export function AgentCloneOutput({ shot }: AgentCloneOutputProps) {
  // Empty state
  if (!shot || shot.status === 'idle') {
    return (
      <div className={`h-full flex flex-col items-center justify-center text-center ${containerStyles.panel} p-8`}>
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <UserCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Agent Clone</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Upload your photo and a background to create an AI presenter shot for your listing videos.
        </p>
      </div>
    );
  }

  const isProcessing = shot.status === 'compositing' || shot.status === 'animating';

  return (
    <div className={`h-full flex flex-col ${containerStyles.panel}`}>
      {/* Main media area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg aspect-video rounded-lg overflow-hidden bg-black">
          {/* Video (top priority) */}
          {shot.videoUrl && shot.status === 'ready' ? (
            <video
              src={shot.videoUrl}
              controls
              className="w-full h-full object-contain"
            />
          ) : shot.compositeUrl ? (
            <>
              <img
                src={shot.compositeUrl}
                alt="Composite"
                className={`w-full h-full object-contain ${shot.status === 'animating' ? 'opacity-60' : ''}`}
              />
              {shot.status === 'animating' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <span className="text-sm text-white font-medium">Animating video...</span>
                </div>
              )}
            </>
          ) : (
            <>
              <img
                src={shot.backgroundUrl}
                alt="Background"
                className={`w-full h-full object-contain ${isProcessing ? 'opacity-40' : 'opacity-60'}`}
              />
              {shot.status === 'compositing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <span className="text-sm text-white font-medium">Generating composite...</span>
                </div>
              )}
            </>
          )}

          {/* Failed overlay */}
          {shot.status === 'failed' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Badge className="bg-red-500/20 text-red-400">Generation Failed</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="p-4 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {shot.status === 'compositing' && (
            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />Compositing
            </Badge>
          )}
          {shot.status === 'composite_ready' && (
            <Badge className="bg-blue-500/20 text-blue-400 text-xs">Composite Ready</Badge>
          )}
          {shot.status === 'animating' && (
            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />Animating
            </Badge>
          )}
          {shot.status === 'ready' && (
            <Badge className="bg-green-500/20 text-green-400 text-xs">Video Ready</Badge>
          )}
          {shot.status === 'failed' && (
            <Badge className="bg-red-500/20 text-red-400 text-xs">Failed</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {shot.compositeUrl && shot.status !== 'ready' && (
            <a href={shot.compositeUrl} download="agent-clone-composite.jpg" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-xs">
                <Download className="w-3.5 h-3.5 mr-1" />
                Image
              </Button>
            </a>
          )}
          {shot.videoUrl && shot.status === 'ready' && (
            <a href={shot.videoUrl} download="agent-clone-video.mp4" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-xs">
                <Download className="w-3.5 h-3.5 mr-1" />
                Video
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
