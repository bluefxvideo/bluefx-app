'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Download, ExternalLink, Clock } from 'lucide-react';

interface VideoPreviewProps {
  video: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    duration: number;
    aspect_ratio: string;
    prompt: string;
    created_at: string;
  };
  batchId: string;
}

/**
 * Video preview component with playback controls
 */
export function VideoPreview({ video, batchId }: VideoPreviewProps) {
  const handleDownload = () => {
    if (video.video_url) {
      const a = document.createElement('a');
      a.href = video.video_url;
      a.download = `cinematographer-${batchId}.mp4`;
      a.click();
    }
  };

  const handleOpenInNewTab = () => {
    if (video.video_url) {
      window.open(video.video_url, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <Card className="overflow-hidden">
        {video.video_url ? (
          <div className="relative aspect-video bg-black">
            <video
              src={video.video_url}
              className="w-full h-full object-contain"
              controls
              preload="metadata"
              poster={video.thumbnail_url}
            />
          </div>
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center">
            <div className="text-center space-y-2">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Video processing...
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Video Info */}
      <Card className="p-4">
        <div className="space-y-3">
          {/* Video Details */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium mb-1">Generated Video</h4>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {video.prompt}
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <Badge variant="outline">
                {video.duration}s
              </Badge>
              <Badge variant="outline">
                {video.aspect_ratio}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          {video.video_url && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
            <div className="flex justify-between">
              <span>Video ID:</span>
              <span className="font-mono">{video.id.slice(-8)}</span>
            </div>
            <div className="flex justify-between">
              <span>Generated:</span>
              <span>{new Date(video.created_at).toLocaleString()}</span>
            </div>
            {video.thumbnail_url && (
              <div className="flex justify-between">
                <span>Thumbnail:</span>
                <span>Available</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}