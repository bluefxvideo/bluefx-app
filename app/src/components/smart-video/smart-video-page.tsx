'use client';

import { useEffect, useRef } from 'react';
import { Check, Download, FileImage, FileVideo, Loader2, RotateCcw, Sparkles, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { SmartVideoJob, SmartVideoJobStatus } from '@/types/smart-video';
import { useSmartVideo } from './hooks/use-smart-video';

const STAGES: { status: SmartVideoJobStatus; label: string }[] = [
  { status: 'reading', label: 'Reading your text and files' },
  { status: 'directing', label: 'Planning the video: script, look, scenes' },
  { status: 'producing', label: 'Recording the voice, making the music' },
  { status: 'rendering', label: 'Rendering the video' },
  { status: 'finishing', label: 'Levelling the sound' },
];

/**
 * Smart Video (admin-only trial): text + files, or a Zillow/Amazon link, in;
 * a finished vertical ad out. Input on the left, progress and result on the right.
 */
export function SmartVideoPage() {
  const smart = useSmartVideo();
  const { job } = smart;

  // Toast only when a job finishes while it is being watched, not when an old one is reopened.
  const watched = useRef<string | null>(null);
  useEffect(() => {
    if (!job) return;
    const running = job.status !== 'done' && job.status !== 'failed';
    if (running) watched.current = job.id;
    else if (watched.current === job.id) {
      watched.current = null;
      if (job.status === 'done') toast.success('Your video is ready');
      else toast.error(job.error || 'The video failed');
    }
  }, [job]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Smart Video</h1>
          <p className="text-sm text-muted-foreground">
            Paste what the video is about and add your photos or clips. The script, voice, music, look and
            editing are done for you. Admin-only test.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InputPanel smart={smart} />
        <OutputPanel job={job} uploading={smart.uploading} onReset={smart.reset} />
      </div>

      {smart.history.length > 0 && (
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-medium">Earlier videos</h2>
          <div className="divide-y">
            {smart.history.map((past) => (
              <button
                key={past.id}
                type="button"
                onClick={() => smart.openJob(past.id)}
                className="w-full flex items-center justify-between gap-3 py-2 text-left text-sm hover:bg-muted/50 rounded px-2"
              >
                <span className="truncate">{past.brief.trim().split('\n')[0] || past.link || 'Untitled'}</span>
                <span className="flex-shrink-0 text-xs text-muted-foreground">
                  {past.status} · {new Date(past.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function InputPanel({ smart }: { smart: ReturnType<typeof useSmartVideo> }) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="smart-brief">What is the video about?</Label>
        <Textarea
          id="smart-brief"
          value={smart.brief}
          onChange={(e) => smart.setBrief(e.target.value)}
          placeholder="Paste the job ad, the offer, the event details, the listing... Any language. Include the contact details people should use."
          className="min-h-[220px]"
          disabled={smart.isBusy}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="smart-link">Zillow or Amazon link (optional)</Label>
        <Input
          id="smart-link"
          value={smart.link}
          onChange={(e) => smart.setLink(e.target.value)}
          placeholder="https://www.zillow.com/homedetails/... or https://www.amazon.com/dp/..."
          disabled={smart.isBusy}
        />
        <p className="text-xs text-muted-foreground">
          With a link, the photos and facts come from the page. Use the text box for what the page does not know:
          your contact, your price or discount code, who the ad is for.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Photos, clips, logo, poster</Label>
        <button
          type="button"
          onClick={() => picker.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            smart.addFiles(Array.from(e.dataTransfer.files));
          }}
          disabled={smart.isBusy}
          className="w-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          <Upload className="w-5 h-5 mx-auto mb-2" />
          Drop files here or click to choose. Images and videos, up to 15.
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          accept="image/*,video/mp4,video/quicktime,video/webm,.tif,.tiff,.heic"
          className="hidden"
          onChange={(e) => {
            smart.addFiles(Array.from(e.target.files || []));
            e.target.value = '';
          }}
        />
        {smart.files.length > 0 && (
          <ul className="space-y-1">
            {smart.files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-sm rounded bg-muted/50 px-2 py-1">
                {file.type.startsWith('video') ? <FileVideo className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                <button type="button" onClick={() => smart.removeFile(i)} disabled={smart.isBusy} aria-label={`Remove ${file.name}`}>
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button onClick={smart.start} disabled={smart.isBusy} className="w-full">
        {smart.isBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Make my video
      </Button>
    </Card>
  );
}

function OutputPanel({
  job,
  uploading,
  onReset,
}: {
  job: SmartVideoJob | null;
  uploading: { done: number; total: number } | null;
  onReset: () => void;
}) {
  if (uploading) {
    return (
      <Card className="p-4 space-y-3">
        <p className="text-sm">Uploading {uploading.done} of {uploading.total} files...</p>
        <Progress value={uploading.total ? (uploading.done / uploading.total) * 100 : 100} />
      </Card>
    );
  }
  if (!job) {
    return (
      <Card className="p-8 flex items-center justify-center text-sm text-muted-foreground text-center">
        Your video appears here. It takes 2 to 4 minutes.
      </Card>
    );
  }

  const current = STAGES.findIndex((stage) => stage.status === job.status);
  const total = job.usage?.reduce((sum, entry) => sum + entry.usd, 0) ?? 0;

  return (
    <Card className="p-4 space-y-4">
      {job.status === 'done' && job.videoUrl ? (
        <>
          <video src={job.videoUrl} controls playsInline className="mx-auto rounded-lg bg-black max-h-[640px] aspect-[9/16]" />
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <a href={job.videoUrl} download="smart-video.mp4" target="_blank" rel="noreferrer">
                <Download className="w-4 h-4 mr-2" />
                Download
              </a>
            </Button>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              New video
            </Button>
          </div>
        </>
      ) : job.status === 'failed' ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{job.error || 'The video failed.'}</p>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Start over
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {STAGES.map((stage, i) => (
            <li key={stage.status} className={cn('flex items-center gap-3 text-sm', i > current && 'text-muted-foreground')}>
              {i < current ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : i === current ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="w-4 h-4 rounded-full border" />
              )}
              <span className="flex-1">{stage.label}</span>
              {stage.status === 'rendering' && i === current && (
                <span className="text-xs text-muted-foreground">{job.renderProgress ?? 0}%</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {job.summary && (
        <div className="text-sm space-y-1 border-t pt-3">
          <p>
            <span className="font-medium capitalize">{job.summary.format}</span> · {job.summary.style} look ·{' '}
            {job.summary.scenes} scenes · {Math.round(job.durationSeconds || 0)} s · {job.summary.language.toUpperCase()}
            {job.summary.captions ? ' · captions' : ''}
          </p>
          <p className="text-muted-foreground">{job.summary.styleReason}</p>
        </div>
      )}

      {job.usage && job.usage.length > 0 && (
        <details className="text-sm border-t pt-3">
          <summary className="cursor-pointer">API cost: ${total.toFixed(2)}</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {job.usage.map((entry, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{entry.step} ({entry.detail})</span>
                <span>${entry.usd.toFixed(3)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
