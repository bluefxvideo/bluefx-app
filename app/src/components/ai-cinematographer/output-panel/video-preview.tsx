'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Clock, Loader2, Video } from 'lucide-react';

interface VideoPreviewProps {
  video: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    duration: number;
    resolution?: string;
    prompt: string;
    created_at: string;
  };
  batchId: string;
}

/**
 * Estimate generation time in seconds based on duration and resolution
 * Based on observed patterns:
 * - 6s @ 1080p: ~37s
 * - 8s @ 1080p: ~45s
 * - Extrapolate linearly: roughly 5s base + 5.3s per second of video
 * - Higher resolutions take longer (2k ~1.5x, 4k ~2.5x)
 */
function getEstimatedTime(duration: number, resolution?: string): number {
  // Base time calculation for 1080p
  const baseTime = 5; // Initial processing
  const perSecondTime = 5.3; // Time per second of video
  let estimatedSeconds = baseTime + (duration * perSecondTime);

  // Adjust for resolution
  if (resolution === '2k') {
    estimatedSeconds *= 1.5;
  } else if (resolution === '4k') {
    estimatedSeconds *= 2.5;
  }

  return Math.round(estimatedSeconds);
}

/**
 * Video preview component with playback controls
 */
export function VideoPreview({ video, batchId }: VideoPreviewProps) {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const isProcessing = !video.video_url;

  // Calculate estimated time
  const estimatedTime = getEstimatedTime(video.duration, video.resolution);

  // Progress animation effect
  useEffect(() => {
    if (!isProcessing) {
      setProgress(100);
      return;
    }

    // Start time tracking
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);

      // Calculate progress - use easing to slow down near the end
      // This creates a more realistic feeling where it slows as it approaches completion
      const linearProgress = (elapsed / estimatedTime) * 100;

      // Ease out - progress slows down as it approaches 95%
      // Never reach 100% until actually complete
      const easedProgress = Math.min(95, linearProgress * (1 - linearProgress / 200));

      setProgress(easedProgress);
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, estimatedTime, video.id]);

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {video.prompt}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 w-full">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(elapsedTime)}
                  </span>
                  <span>
                    ~{formatTime(Math.max(0, estimatedTime - elapsedTime))} remaining
                  </span>
                </div>
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