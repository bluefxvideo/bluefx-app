'use client';

import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { VideoSwapJob } from '../store/video-swap-store';

interface ProcessingStepProps {
  job: VideoSwapJob | null;
  onCancel: () => void;
}

export function ProcessingStep({
  job,
  onCancel,
}: ProcessingStepProps) {
  const progress = job?.progress_percentage || 0;

  // Estimate remaining time based on progress
  const getStatusMessage = () => {
    if (progress < 10) return 'Initializing video processing...';
    if (progress < 30) return 'Analyzing source video...';
    if (progress < 50) return 'Extracting motion and expressions...';
    if (progress < 70) return 'Applying character swap...';
    if (progress < 90) return 'Rendering final video...';
    return 'Finalizing...';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Generating Your Video</h2>
        <p className="text-muted-foreground mt-2">
          This typically takes <strong>8-12 minutes</strong> for short videos. You can safely close this page and check the History tab later.
        </p>
      </div>

      {/* Processing Animation */}
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center">
            {/* Animated Loader */}
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative rounded-full bg-primary/10 p-6">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md space-y-2">
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{getStatusMessage()}</span>
                <span>{progress}%</span>
              </div>
            </div>

            {/* Preview Cards */}
            {job && (
              <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-lg">
                {/* Source Video Thumbnail */}
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <video
                    src={job.source_video_url}
                    className="w-full h-full object-cover opacity-50"
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs bg-black/50 px-2 py-1 rounded">Source</span>
                  </div>
                </div>

                {/* Character Image Thumbnail */}
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={job.character_image_url}
                    alt="Character"
                    className="w-full h-full object-cover opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs bg-black/50 px-2 py-1 rounded">Character</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="text-sm text-center text-muted-foreground">
            <p>
              <strong>Why does this take so long?</strong> Video swap uses advanced AI to analyze every frame,
              preserve motion, expressions, and lip sync while seamlessly replacing the character.
            </p>
            <p className="mt-2">
              Average processing time: ~2 minutes per second of video.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={onCancel}
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel Processing
        </Button>
      </div>
    </div>
  );
}
