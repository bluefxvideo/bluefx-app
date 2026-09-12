'use client';

import { useCallback, useRef, useState } from 'react';
import { VIDEO_SWAP_CREDITS_PER_SECOND, VIDEO_SWAP_MAX_SECONDS } from '@/lib/video-swap/pricing';
import { Upload, Video, X, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// fal's ceiling when the character follows the video; the settings step warns
// that following the image allows 10 s.
const MAX_VIDEO_DURATION = VIDEO_SWAP_MAX_SECONDS.video;

interface UploadStepProps {
  sourceVideo: File | null;
  sourceVideoPreview: string | null;
  onVideoSelect: (file: File | null, durationSeconds?: number | null) => void;
  onNext: () => void;
}

export function UploadStep({
  sourceVideo,
  sourceVideoPreview,
  onVideoSelect,
  onNext,
}: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };

      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Could not load video metadata'));
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - only MP4 recommended for best compatibility
    const validTypes = ['video/mp4', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload an MP4 or WebM video file. MOV files are not supported.');
      return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video file is too large. Maximum size is 100MB.');
      return;
    }

    // Validate video duration
    setIsValidating(true);
    try {
      const duration = await validateVideoDuration(file);
      setVideoDuration(duration);

      if (duration > MAX_VIDEO_DURATION) {
        toast.error(`Video is too long (${duration.toFixed(1)}s). Maximum duration is ${MAX_VIDEO_DURATION} seconds.`);
        setIsValidating(false);
        return;
      }

      onVideoSelect(file, duration);
    } catch {
      toast.error('Could not read video duration. Please try a different file.');
    }
    setIsValidating(false);
  }, [onVideoSelect]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      // Trigger the same validation as file select
      const fakeEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleRemove = useCallback(() => {
    onVideoSelect(null);
    setVideoDuration(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onVideoSelect]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Upload Your Video</h2>
        <p className="text-muted-foreground mt-2">
          Upload the video containing the person you want to replace
        </p>
      </div>

      {/* Duration Limit Alert */}
      <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
        <Clock className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-600">Up to 30 seconds</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Up to <strong>30 seconds</strong> when the character follows the video's motion, <strong>10 seconds</strong> when it follows the image. Processing takes about 2 minutes per second of video, and each second costs {VIDEO_SWAP_CREDITS_PER_SECOND} credits.
        </AlertDescription>
      </Alert>

      {/* Upload Area */}
      {!sourceVideo ? (
        <Card
          className={cn(
            "border-2 border-dashed cursor-pointer transition-colors",
            "hover:border-primary hover:bg-muted/50",
            isValidating && "pointer-events-none opacity-50"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-medium">
              {isValidating ? 'Validating video...' : 'Drag and drop your video here'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            <p className="text-xs text-muted-foreground mt-4">
              <strong>MP4 or WebM</strong> only • Max 100MB • Up to 30 seconds
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{sourceVideo.name}</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="flex items-center gap-3">
              <span>{(sourceVideo.size / 1024 / 1024).toFixed(1)} MB</span>
              {videoDuration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {videoDuration.toFixed(1)}s
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sourceVideoPreview && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                <video
                  src={sourceVideoPreview}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Tips for best results:</p>
            <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
              <li>One real person, whole body or upper body in frame, head visible</li>
              <li>Nothing covering the person: no props across the body, no cut-off limbs</li>
              <li>Use <strong>MP4 format</strong> (MOV not supported)</li>
              <li>Avoid videos with multiple people</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={!sourceVideo || isValidating}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
