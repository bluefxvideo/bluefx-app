'use client';

import { Download, Play, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VideoSwapJob } from '../store/video-swap-store';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface HistorySectionProps {
  jobs: VideoSwapJob[];
  onRefresh: () => void;
}

export function HistorySection({ jobs, onRefresh }: HistorySectionProps) {
  const handleDownload = async (job: VideoSwapJob) => {
    if (!job.result_video_url) return;

    try {
      const response = await fetch(job.result_video_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `video-swap-${job.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Download started!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video');
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center rounded-full bg-muted p-4 mb-4">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No history yet</h3>
        <p className="text-muted-foreground">
          Your video swap history will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Recent Video Swaps</h3>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {jobs.map((job) => (
          <Card key={job.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row">
                {/* Video Preview */}
                <div className="relative w-full sm:w-48 h-32 bg-muted flex-shrink-0">
                  {job.result_video_url ? (
                    <video
                      src={job.result_video_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseOut={(e) => {
                        const video = e.target as HTMLVideoElement;
                        video.pause();
                        video.currentTime = 0;
                      }}
                    />
                  ) : job.source_video_url ? (
                    <video
                      src={job.source_video_url}
                      className="w-full h-full object-cover opacity-50"
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${
                    job.status === 'completed'
                      ? 'bg-green-500/90 text-white'
                      : job.status === 'failed'
                      ? 'bg-red-500/90 text-white'
                      : job.status === 'processing'
                      ? 'bg-blue-500/90 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {job.status}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {job.error_message && (
                      <p className="text-sm text-red-500 line-clamp-2">
                        {job.error_message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {job.status === 'completed' && job.result_video_url && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(job)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(job.result_video_url!);
                          toast.success('URL copied!');
                        }}
                      >
                        Copy Link
                      </Button>
                    </div>
                  )}
                </div>

                {/* Character Image Thumbnail */}
                {job.character_image_url && (
                  <div className="hidden sm:block w-16 h-16 m-4 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={job.character_image_url}
                      alt="Character"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
