'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Info,
  Loader2,
  Scissors,
  Clock,
} from 'lucide-react';
import type {
  RoughcutJob,
  RoughcutJobStatus,
} from '@/actions/database/video-roughcut-database';
import { RemovalList } from './removal-list';
import { DownloadXmlButton } from './download-xml-button';

const STAGE_LABEL: Record<RoughcutJobStatus, string> = {
  uploading: 'Uploading audio…',
  validating: 'Validating audio…',
  queued: 'Queued for processing…',
  transcribing: 'Transcribing the audio…',
  analyzing: 'AI is finding the mistakes to cut…',
  generating: 'Generating Premiere XML…',
  done: 'Done',
  failed: 'Failed',
};

interface JobOutputProps {
  job: RoughcutJob;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function JobOutput({ job, onDismiss, onRetry }: JobOutputProps) {
  if (job.status === 'failed') {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-destructive">Job failed</CardTitle>
          </div>
          <CardDescription>
            {job.status_reason || 'An unknown error occurred.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              Try again
            </Button>
          )}
          {onDismiss && (
            <Button onClick={onDismiss} variant="outline">
              Dismiss
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (job.status !== 'done') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <CardTitle>{STAGE_LABEL[job.status]}</CardTitle>
          </div>
          <CardDescription>
            This usually takes 1–3 minutes for a 30-minute video.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={job.progress ?? 0} />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // status === 'done'
  const timeSaved = job.time_saved_seconds ?? 0;
  const segments = job.segments_removed ?? 0;
  const duration = job.video_duration_seconds ?? 0;
  const percentRemoved =
    duration > 0 ? Math.round((timeSaved / duration) * 100) : 0;
  const minutesRemoved = Math.round(timeSaved / 60);
  // Rough estimate: each cut is 1–2 min of manual editing
  const editingTimeSaved = Math.max(1, Math.round(segments * 1.5));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rough cut ready</CardTitle>
              <CardDescription className="truncate">
                {job.video_filename}
                {job.credits_used > 0 ? ` · ${job.credits_used} credits` : ''}
              </CardDescription>
            </div>
            <Badge>Done</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.xml_url && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DownloadXmlButton jobId={job.id} size="lg" className="w-full" label="Download for Premiere Pro" />
              <DownloadXmlButton
                jobId={job.id}
                editor="resolve"
                size="lg"
                variant="outline"
                className="w-full"
                label="Download for DaVinci Resolve"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Scissors className="w-3.5 h-3.5" />
                Removed
              </div>
              <div className="mt-1 text-lg font-semibold">
                {minutesRemoved} min
              </div>
              <div className="text-xs text-muted-foreground">
                {segments} cuts · {percentRemoved}% of video
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Clock className="w-3.5 h-3.5" />
                Editing time saved
              </div>
              <div className="mt-1 text-lg font-semibold">
                ~{editingTimeSaved} min
              </div>
              <div className="text-xs text-muted-foreground">
                vs. hand-editing
              </div>
            </div>
          </div>

          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex gap-2 text-sm">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p>
                <b>Premiere Pro:</b> use <b>File → Import</b> and pick the XML. When it
                asks to <b>locate media</b>, point it at your original video and the
                whole timeline reconnects.
              </p>
              <p>
                <b>DaVinci Resolve:</b> add your original video to the Media Pool first,
                then use <b>File → Import → Timeline</b> and pick the Resolve XML. If
                clips show as offline, right-click the video in the Media Pool and
                choose <b>Relink Selected Clips</b>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What was cut</CardTitle>
          <CardDescription>
            Every removal, and why the AI cut it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RemovalList removals={job.removals ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
