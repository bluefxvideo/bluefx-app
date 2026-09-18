'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertTriangle,
  ChevronDown,
  FileVideo,
  RefreshCw,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { isStalePageError } from '@/lib/stale-page';
import type { RoughcutStage } from '../hooks/use-video-roughcut';

const STAGE_LABEL: Record<RoughcutStage, string> = {
  idle: '',
  reading: 'Reading video…',
  extracting: 'Extracting audio…',
  uploading: 'Uploading…',
  processing: 'Processing…',
};

const LARGE_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const TEN_GB = 10 * 1024 * 1024 * 1024;

interface UploadTabProps {
  stage: RoughcutStage;
  progress: number;
  error: string | null;
  isProcessing: boolean;
  onStart: (file: File) => void;
  onReset: () => void;
}

export function UploadTab({
  stage,
  progress,
  error,
  isProcessing,
  onStart,
  onReset,
}: UploadTabProps) {
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);
  // A tab left open across a deploy: the action never ran, only a reload helps
  const stalePage = isStalePageError(error);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        toast.error(
          rejections[0].errors[0]?.message || 'File type not supported',
        );
        return;
      }
      const file = accepted[0];
      if (!file) return;

      if (file.size > LARGE_FILE_BYTES) {
        setSizeWarning(
          `Heads up: ${(file.size / 1024 ** 3).toFixed(1)} GB is a large file. Pulling the audio out in your browser can take a few minutes.`,
        );
      } else {
        setSizeWarning(null);
      }

      onStart(file);
    },
    [onStart],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': [],
      'audio/*': [],
    },
    maxFiles: 1,
    maxSize: TEN_GB,
    disabled: isProcessing,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Drop your video</CardTitle>
          <CardDescription>
            We&apos;ll cut the false starts, repeated takes and stumbles, then
            give you an XML to open in Premiere. 1 credit per minute of video,
            10 credits minimum.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input {...getInputProps()} />
            <FileVideo className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">
              {isDragActive
                ? 'Drop it here…'
                : 'Drop a video or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              MP4, MOV, MKV, WebM or MP3 · 30 seconds to 60 minutes
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your video stays on your computer. Only the audio is uploaded.
            </p>
          </div>

          {sizeWarning && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{sizeWarning}</span>
            </div>
          )}

          {isProcessing && stage !== 'idle' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{STAGE_LABEL[stage]}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {error && !isProcessing && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">
                    {stalePage ? 'This page is out of date' : 'Something went wrong'}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {stalePage
                      ? 'The app was updated while this page was open. Reload the page and try again. Nothing was charged.'
                      : error}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={stalePage ? () => window.location.reload() : onReset}
                className="w-full"
              >
                {stalePage ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                )}
                {stalePage ? 'Reload page' : 'Try again'}
              </Button>
            </div>
          )}

          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground"
              >
                <span className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  Having trouble with large videos?
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 py-2 text-sm text-muted-foreground">
              Export audio from Premiere (File → Export → Media → MP3) and
              drop it here instead. We&apos;ll skip the in-browser extraction
              step.
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}
