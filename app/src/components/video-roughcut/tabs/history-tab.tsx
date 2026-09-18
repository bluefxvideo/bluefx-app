'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Film, Loader2, RefreshCw } from 'lucide-react';
import { useRoughcutHistory } from '../hooks/use-roughcut-history';
import { DownloadXmlButton } from '../output-panel/download-xml-button';
import type {
  RoughcutJob,
  RoughcutJobStatus,
} from '@/actions/database/video-roughcut-database';

const STATUS_VARIANT: Record<
  RoughcutJobStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  uploading: 'secondary',
  validating: 'secondary',
  queued: 'secondary',
  transcribing: 'secondary',
  analyzing: 'secondary',
  generating: 'secondary',
  done: 'default',
  failed: 'destructive',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function JobRow({ job }: { job: RoughcutJob }) {
  const isInFlight = job.status !== 'done' && job.status !== 'failed';

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Film className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{job.video_filename}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(job.created_at)}
            {job.status === 'done' && job.credits_used > 0 ? ` · ${job.credits_used} credits` : ''}
            {job.status === 'failed' && job.credits_used > 0 ? ' · credits returned' : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant={STATUS_VARIANT[job.status]}>
          {isInFlight ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : null}
          {job.status}
        </Badge>
        {job.status === 'done' && job.xml_url && (
          <>
            <DownloadXmlButton jobId={job.id} label="Premiere" size="sm" variant="outline" />
            <DownloadXmlButton jobId={job.id} editor="resolve" label="Resolve" size="sm" variant="outline" />
          </>
        )}
      </div>
    </div>
  );
}

export function HistoryTab() {
  const { jobs, refresh, loading } = useRoughcutHistory();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>History</CardTitle>
            <CardDescription>
              Your past rough cuts. Download the XML again for Premiere Pro or DaVinci Resolve.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && jobs.length === 0 ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : jobs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Film className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No jobs yet. Upload a video to get started.</p>
          </div>
        ) : (
          jobs.map((job) => <JobRow key={job.id} job={job} />)
        )}
      </CardContent>
    </Card>
  );
}
