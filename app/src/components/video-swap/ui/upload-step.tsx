'use client';

import { useCallback, useRef } from 'react';
import { Upload, Video, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface UploadStepProps {
  sourceVideo: File | null;
  sourceVideoPreview: string | null;
  onVideoSelect: (file: File | null) => void;
  onNext: () => void;
}

export function UploadStep({
  sourceVideo,
  sourceVideoPreview,
  onVideoSelect,
  onNext,
}: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
      if (!validTypes.includes(file.type)) {
        alert('Please upload a valid video file (MP4, MOV, or WebM)');
        return;
      }

      // Validate file size (100MB max)
      if (file.size > 100 * 1024 * 1024) {
        alert('Video file is too large. Maximum size is 100MB.');
        return;
      }

      onVideoSelect(file);
    }
  }, [onVideoSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      onVideoSelect(file);
    }
  }, [onVideoSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleRemove = useCallback(() => {
    onVideoSelect(null);
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

      {/* Upload Area */}
      {!sourceVideo ? (
        <Card
          className={cn(
            "border-2 border-dashed cursor-pointer transition-colors",
            "hover:border-primary hover:bg-muted/50"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-medium">Drag and drop your video here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            <p className="text-xs text-muted-foreground mt-4">
              Supported formats: MP4, MOV, WebM (max 100MB, 30 seconds)
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
            <CardDescription>
              {(sourceVideo.size / 1024 / 1024).toFixed(1)} MB
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
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
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
              <li>Use videos with clear, well-lit faces</li>
              <li>Front-facing shots work best</li>
              <li>Keep videos under 30 seconds for optimal processing</li>
              <li>Avoid videos with multiple people</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={!sourceVideo}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
