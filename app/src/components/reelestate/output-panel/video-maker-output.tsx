'use client';

import { containerStyles } from '@/lib/container-styles';
import { ClipProgress } from '../components/clip-progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Video, ImageIcon, FileText, Loader2, Download, Film } from 'lucide-react';
import type { ReelEstateProject } from '@/types/reelestate';

interface VideoMakerOutputProps {
  project: ReelEstateProject;
  isWorking: boolean;
  onPollClips: () => void;
  onRegenerateClip?: (clipIndex: number) => void;
}

export function VideoMakerOutput({ project, isWorking, onRegenerateClip }: VideoMakerOutputProps) {
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
