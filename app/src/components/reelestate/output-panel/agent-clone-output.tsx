'use client';

import { useState } from 'react';
import { containerStyles } from '@/lib/container-styles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Download, Loader2, Mic } from 'lucide-react';
import type { AgentCloneShot } from '@/types/reelestate';

interface AgentCloneOutputProps {
  shot: AgentCloneShot | null;
}

export function AgentCloneOutput({ shot }: AgentCloneOutputProps) {
  // Which audio track to show once a voice switch exists (hook must run before any early return)
  const [view, setView] = useState<'voice' | 'original'>('voice');

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
  const showVoice = view === 'voice' && !!shot.voiceVideoUrl;
  const shownVideoUrl = showVoice ? shot.voiceVideoUrl : shot.videoUrl;

  return (
    <div className={`h-full flex flex-col ${containerStyles.panel}`}>
      {/* Main media area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
        {shot.voiceVideoUrl && shot.status === 'ready' && (
          <div className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setView('voice')}
              className={`px-2.5 py-1 rounded ${showVoice ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              <Mic className="w-3 h-3 inline mr-1" />
              Your voice
            </button>
            <button
              type="button"
              onClick={() => setView('original')}
              className={`px-2.5 py-1 rounded ${!showVoice ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              Original
            </button>
          </div>
        )}
        <div className="relative w-full max-w-lg aspect-video rounded-lg overflow-hidden bg-black">
          {/* Video (top priority) */}
          {shot.videoUrl && shot.status === 'ready' ? (
            <>
              <video
                key={shownVideoUrl || 'video'}
                src={shownVideoUrl || shot.videoUrl}
                controls
                className="w-full h-full object-contain"
              />
              {shot.isSwitchingVoice && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <span className="text-sm text-white font-medium">Switching voice...</span>
                </div>
              )}
            </>
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
          {shot.voiceVideoUrl && shot.status === 'ready' && (
            <Badge className="bg-purple-500/20 text-purple-300 text-xs">Voice switched</Badge>
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
            <a
              href={shownVideoUrl || shot.videoUrl}
              download={showVoice ? 'agent-clone-video-your-voice.mp4' : 'agent-clone-video.mp4'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm" className="text-xs">
                <Download className="w-3.5 h-3.5 mr-1" />
                {showVoice ? 'Video (your voice)' : 'Video'}
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
