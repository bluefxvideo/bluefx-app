'use client';

import { Download, RefreshCw, Share2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoSwapJob } from '../store/video-swap-store';
import { toast } from 'sonner';

interface ResultStepProps {
  job: VideoSwapJob | null;
  onCreateAnother: () => void;
}

export function ResultStep({
  job,
  onCreateAnother,
}: ResultStepProps) {
  const handleDownload = async () => {
    if (!job?.result_video_url) return;

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

  const handleShare = async () => {
    if (!job?.result_video_url) return;

    try {
      await navigator.clipboard.writeText(job.result_video_url);
      toast.success('Video URL copied to clipboard!');
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to copy URL');
    }
  };

  if (!job || !job.result_video_url) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No result available</p>
        <Button onClick={onCreateAnother} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center rounded-full bg-green-500/10 p-3 mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold">Video Swap Complete!</h2>
        <p className="text-muted-foreground mt-2">
          Your video has been successfully generated
        </p>
      </div>

      {/* Video Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Your Swapped Video</CardTitle>
          <CardDescription>
            Preview and download your generated video
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
            <video
              src={job.result_video_url}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          </div>
        </CardContent>
      </Card>

      {/* Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Before & After</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {/* Original Video */}
            <div className="space-y-2">
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <video
                  src={job.source_video_url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">Original Video</p>
            </div>

            {/* Character Image */}
            <div className="space-y-2">
              <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={job.character_image_url}
                  alt="Character"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">New Character</p>
            </div>

            {/* Result */}
            <div className="space-y-2">
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <video
                  src={job.result_video_url}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">Result</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={handleDownload} size="lg">
          <Download className="h-4 w-4 mr-2" />
          Download Video
        </Button>
        <Button variant="outline" onClick={handleShare} size="lg">
          <Share2 className="h-4 w-4 mr-2" />
          Copy Link
        </Button>
        <Button variant="outline" onClick={onCreateAnother} size="lg">
          <RefreshCw className="h-4 w-4 mr-2" />
          Create Another
        </Button>
      </div>
    </div>
  );
}
