'use client';

import { containerStyles } from '@/lib/container-styles';
import { ClipProgress } from '../components/clip-progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Video, ImageIcon, FileText, Loader2, Download, Film, RefreshCw, Mic } from 'lucide-react';
import type { ReelEstateProject } from '@/types/reelestate';

interface VideoMakerOutputProps {
  project: ReelEstateProject;
  isWorking: boolean;
  onPollClips: () => void;
  onRegenerateClip?: (clipIndex: number) => void;
  onRegenerateScript?: () => void;
  onRegenerateVoiceover?: () => void;
  onUpdateScriptSegment?: (index: number, voiceover: string) => void;
}

export function VideoMakerOutput({ project, isWorking, onRegenerateClip, onRegenerateScript, onRegenerateVoiceover, onUpdateScriptSegment }: VideoMakerOutputProps) {
  const hasClips = project.clips.length > 0;
  const hasPhotos = project.photos.length > 0;
  const hasAnalyses = project.analyses.length > 0;
  const isRendering = project.status === 'rendering';

  // Empty state
  if (!hasPhotos && !hasClips) {
    return (
      <div className={`h-full flex flex-col items-center justify-center text-center ${containerStyles.panel} p-8`}>
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Video className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Your Listing Video</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Paste a Zillow URL or upload photos to get started. The AI will analyze your photos, write a voiceover script, and render a listing video.
        </p>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto space-y-4 ${containerStyles.panel} p-4`}>
      {/* Status summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline">
          <ImageIcon className="w-3 h-3 mr-1" />
          {project.photos.length} photos
        </Badge>
        {hasAnalyses && (
          <Badge variant="outline">
            {project.selectedIndices.length} selected
          </Badge>
        )}
        {project.script && (
          <Badge variant="outline">
            <FileText className="w-3 h-3 mr-1" />
            {project.script.segments.length} segments · {project.script.total_duration_seconds}s
          </Badge>
        )}
        {isWorking && (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {project.status.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>

      {/* Script & Voiceover preview */}
      {project.voiceoverEnabled && project.script && !isRendering && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Script Preview
            </h4>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={onRegenerateScript}
              disabled={isWorking}
            >
              <RefreshCw className="w-3 h-3" />
              Regenerate (1 credit)
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {project.script.segments.map((segment) => (
              <div key={segment.index} className="flex gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                {project.photos[segment.image_index] && (
                  <img
                    src={project.photos[segment.image_index]}
                    alt={`Photo ${segment.image_index + 1}`}
                    className="w-14 h-10 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">#{segment.index + 1}</span>
                    <span className="text-[10px] text-muted-foreground">{segment.duration_seconds}s</span>
                  </div>
                  <textarea
                    className="text-xs leading-relaxed w-full bg-transparent resize-none border-0 p-0 focus:outline-none focus:ring-0 min-h-[2rem]"
                    value={segment.voiceover}
                    onChange={(e) => onUpdateScriptSegment?.(segment.index, e.target.value)}
                    rows={2}
                    disabled={isWorking}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Total: {project.script.total_duration_seconds}s · {project.script.segments.length} segments
          </p>

          {/* Voiceover audio */}
          {project.voiceover && (
            <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <Mic className="w-3 h-3" />
                  Voiceover
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] gap-1 px-2"
                  onClick={onRegenerateVoiceover}
                  disabled={isWorking}
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Regenerate (2 credits)
                </Button>
              </div>
              <audio
                key={project.voiceover.url}
                controls
                src={project.voiceover.url}
                className="w-full h-8"
              />
            </div>
          )}

          {/* Voiceover generating */}
          {project.status === 'generating_voiceover' && !project.voiceover && (
            <div className="flex items-center justify-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating voiceover...
            </div>
          )}
        </div>
      )}

      {/* Final video — show prominently at top when available */}
      {project.finalVideoUrl && (
        <div>
          <h4 className="text-sm font-medium mb-2">Final Video</h4>
          <video
            src={project.finalVideoUrl}
            controls
            className="w-full rounded-lg bg-black"
          />
          <a
            href={project.finalVideoUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2"
          >
            <Button size="sm" variant="outline" className="w-full">
              <Download className="w-3 h-3 mr-1" />
              Download Video
            </Button>
          </a>
        </div>
      )}

      {/* Render progress */}
      {isRendering && (
        <div className="p-4 rounded-lg border bg-muted/20">
          <div className="flex items-center gap-2 mb-3">
            <Film className="w-4 h-4 text-primary animate-pulse" />
            <h4 className="text-sm font-medium">Rendering Video</h4>
          </div>
          <Progress
            value={(project.renderProgress || 0) * 100}
            className="h-2 mb-2"
          />
          <p className="text-xs text-muted-foreground text-center">
            {Math.round((project.renderProgress || 0) * 100)}% complete
          </p>
        </div>
      )}

      {/* Photo preview grid */}
      {hasPhotos && !project.finalVideoUrl && !isRendering && (
        <div>
          <h4 className="text-sm font-medium mb-2">
            {hasAnalyses ? 'Selected Photos' : 'Listing Photos'}
          </h4>
          <div className="grid grid-cols-3 gap-1.5">
            {(hasAnalyses
              ? project.selectedIndices.map(i => ({ url: project.photos[i], index: i }))
              : project.photos.slice(0, 12).map((url, i) => ({ url, index: i }))
            ).map(({ url, index }) => (
              <div key={index} className="aspect-video rounded-md overflow-hidden relative group">
                <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                {project.script && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                    <span className="text-[10px] text-white/80">
                      #{index + 1}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {!hasAnalyses && project.photos.length > 12 && (
              <div className="aspect-video rounded-md bg-muted flex items-center justify-center">
                <span className="text-sm text-muted-foreground">
                  +{project.photos.length - 12} more
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legacy: Clip generation progress (for projects that have clips) */}
      {hasClips && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Video Clips</h4>
            {project.clips.some(c => c.status === 'succeeded' && c.video_url) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={async () => {
                  const completed = project.clips.filter(c => c.status === 'succeeded' && c.video_url);
                  for (let i = 0; i < completed.length; i++) {
                    const clip = completed[i];
                    const res = await fetch(clip.video_url!);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `clip-${clip.index + 1}.mp4`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
              >
                <Download className="w-3 h-3 mr-1" />
                Download All
              </Button>
            )}
          </div>
          <ClipProgress clips={project.clips} photos={project.photos} onRegenerateClip={onRegenerateClip} />
        </div>
      )}
    </div>
  );
}
