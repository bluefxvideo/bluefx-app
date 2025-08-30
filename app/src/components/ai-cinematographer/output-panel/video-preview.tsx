'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Clock, Loader2, Video } from 'lucide-react';

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
  const handleDownload = async () => {
    if (!video.video_url) return;
    
    try {
      // Fetch the video blob
      const response = await fetch(video.video_url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Create blob URL and download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `cinematographer-${batchId}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to opening in new tab
      window.open(video.video_url, '_blank');
    }
  };

  return (
    <div className="w-full h-auto">
      {/* Auto-height Video Card */}
      <Card className="overflow-hidden h-auto">
        {/* Video Player - Natural aspect ratio */}
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
          // Processing Card using aspect-video without footer
          <div className="relative aspect-video bg-muted flex items-center justify-center p-8">
            <Card className="p-8 max-w-sm text-center space-y-4 border-dashed bg-transparent dark:bg-card-content border-input">
              {/* Blue Square with Spinning Icon */}
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              
              {/* Processing Text */}
              <div>
                <h3 className="font-medium mb-2">Processing...</h3>
                <p className="text-sm text-muted-foreground">
                  {video.prompt}
                </p>
                <p className="text-xs text-yellow-500 mt-2">
                  ~{video.duration === 5 ? '2-3' : video.duration === 10 ? '3-4' : '2-4'} minutes
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Compact Footer - always visible */}
        <div className="p-4 bg-card border-t">
          <div className="flex items-center justify-between text-sm">
            {video.video_url ? (
              // Completed state - show prompt
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-muted-foreground truncate">{video.prompt}</p>
              </div>
            ) : (
              // Processing state - show less info to match compact design
              <div className="flex-1 min-w-0 mr-2">
                <p className="text-xs text-muted-foreground truncate">Processing video...</p>
              </div>
            )}
            <div className="flex gap-1 items-center shrink-0">
              <span className="text-muted-foreground">{video.duration}s</span>
              <span className="text-muted-foreground">•</span>
              <span className="font-mono text-muted-foreground">{video.id.slice(-8)}</span>
              <span className={video.video_url ? 'text-green-500' : 'text-yellow-500'}>
                {video.video_url ? '✓' : '⋯'}
              </span>
              {video.video_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="h-4 w-4 p-0 ml-1"
                >
                  <Download className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}