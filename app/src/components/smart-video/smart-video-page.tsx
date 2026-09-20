'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileVideo,
  Ghost,
  Loader2,
  Pencil,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  ScrollText,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { VideoFormat } from '@/lib/smart-video/types';
import type { SmartVideoJob, SmartVideoJobStatus } from '@/types/smart-video';
import { cleanLink } from '@/lib/smart-video/link';
import { PHANTOM_REVISION_CREDITS } from '@/lib/smart-video/pricing';
import { useSmartVideo } from './hooks/use-smart-video';
import { PhantomMark } from './phantom-mark';

// The tool's persona: an unseen genius who does the work and leaves you the credit.
const NAME = 'The Phantom';
const PHANTOM = 'the Phantom';

const STAGES: { status: SmartVideoJobStatus; label: string }[] = [
  { status: 'reading', label: `${NAME} is going through your files` },
  { status: 'directing', label: `${NAME} is writing the script. Don't look.` },
  {
    status: 'producing',
    label: `${NAME} is in the booth: voice, music, sound`,
  },
  { status: 'rendering', label: `${NAME} is cutting the film` },
  { status: 'finishing', label: `${NAME} is covering its tracks` },
];

const FORMATS: { value: VideoFormat; label: string; hint: string; Icon: typeof RectangleVertical }[] = [
  { value: 'vertical', label: 'Vertical', hint: 'TikTok, Reels, Shorts', Icon: RectangleVertical },
  { value: 'horizontal', label: 'Horizontal', hint: 'YouTube, websites', Icon: RectangleHorizontal },
];

/**
 * Smart Video (admin-only trial): text + files, or a Zillow/Amazon link, in;
 * a finished vertical ad out. Input on the left, progress and result on the right.
 */
export function SmartVideoPage() {
  const smart = useSmartVideo();
  const { job } = smart;
  const groups = groupVersions(smart.history);
  const versions = job ? (groups.find((group) => group.versions.some((v) => v.id === job.id))?.versions ?? []) : [];

  // On narrow windows the result sits under the form: bring it into view when a job starts or a video is opened.
  const resultRef = useRef<HTMLDivElement>(null);
  const shownJob = job?.id;
  const uploadingNow = Boolean(smart.uploading);
  useEffect(() => {
    if (shownJob || uploadingNow) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [shownJob, uploadingNow]);

  // The browser tab tells the news when the user is somewhere else.
  useEffect(() => {
    const base = 'The Phantom';
    document.title = !job
      ? base
      : job.status === 'done'
        ? `Your video is ready · ${base}`
        : job.status === 'failed'
          ? `Video failed · ${base}`
          : `Working… · ${base}`;
    return () => {
      document.title = base;
    };
  }, [job]);

  // Toast only when a job finishes while it is being watched, not when an old one is reopened.
  const watched = useRef<string | null>(null);
  useEffect(() => {
    if (!job) return;
    const running = job.status !== 'done' && job.status !== 'failed';
    if (running) watched.current = job.id;
    else if (watched.current === job.id) {
      watched.current = null;
      if (job.status === 'done') toast.success(`${NAME} was here. Your video is ready.`);
      else toast.error(`${NAME} vanished mid-job: ${job.error || 'unknown reason'}`);
    }
  }, [job]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-start gap-3">
        <PhantomMark className="w-12 h-12 flex-shrink-0" active={smart.isBusy} />
        <div>
          <h1 className="text-xl font-semibold">{NAME}</h1>
          <p className="text-sm text-muted-foreground">
            Hand {PHANTOM} your text and your files. It writes the script, picks the look, records the voice, scores the music and cuts the
            film, unseen. You take the credit. Admin-only test.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InputPanel smart={smart} />
        <div ref={resultRef} className="scroll-mt-4">
          <OutputPanel
            job={job}
            uploading={smart.uploading}
            onReset={smart.reset}
            onRevise={smart.revise}
            revising={smart.revising}
            onOpen={smart.openJob}
            versions={versions}
          />
        </div>
      </div>

      <VideoLibrary groups={groups} currentId={job?.id} onOpen={smart.openJob} />
    </div>
  );
}

function InputPanel({ smart }: { smart: ReturnType<typeof useSmartVideo> }) {
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="smart-brief">What should {PHANTOM} make?</Label>
        <Textarea
          id="smart-brief"
          value={smart.brief}
          onChange={(e) => smart.setBrief(e.target.value)}
          placeholder={`Paste anything: the job ad, the offer, the listing, your messy notes. Any language. ${NAME} figures out the rest. Include the phone, email or website people should use.`}
          className="min-h-[220px]"
          disabled={smart.isBusy}
        />
      </div>

      <div className="space-y-2">
        <Label>Shape</Label>
        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map(({ value, label, hint, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => smart.setFormat(value)}
              disabled={smart.isBusy}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50',
                smart.format === value ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-1">
          <Label htmlFor="smart-exact">Say exactly what I wrote</Label>
          <p className="text-xs text-muted-foreground">
            {smart.exactWords
              ? `${NAME} narrates your words as written, nothing cut. Long scripts make long videos: 3 minutes of text takes 15 to 25 minutes to render.`
              : `Off: ${NAME} rewrites your text into the strongest ad it can and decides how long it should be. Recommended.`}
          </p>
        </div>
        <Switch id="smart-exact" checked={smart.exactWords} onCheckedChange={smart.setExactWords} disabled={smart.isBusy} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="smart-link">Zillow or Amazon link (optional)</Label>
        <Input
          id="smart-link"
          value={smart.link}
          onChange={(e) => smart.setLink(e.target.value)}
          onBlur={(e) => smart.setLink(cleanLink(e.target.value))}
          placeholder="https://www.zillow.com/homedetails/... or https://www.amazon.com/dp/..."
          disabled={smart.isBusy}
        />
        <p className="text-xs text-muted-foreground">
          With a link, the photos and facts come from the page. Use the text box for what the page does not know: your contact, your price
          or discount code, who the ad is for.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Photos, clips, logo, poster</Label>
        <button
          type="button"
          onClick={() => picker.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            smart.addFiles(Array.from(e.dataTransfer.files));
          }}
          disabled={smart.isBusy}
          className={cn(
            'w-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50 disabled:opacity-50',
            dragging && 'border-primary bg-primary/10 text-foreground',
          )}
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
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {smart.files.map((file, i) => (
              <FileThumb key={`${file.name}-${file.size}-${i}`} file={file} disabled={smart.isBusy} onRemove={() => smart.removeFile(i)} />
            ))}
          </div>
        )}
      </div>

      <Button onClick={smart.start} disabled={smart.isBusy} className="w-full">
        {smart.isBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ghost className="w-4 h-4 mr-2" />}
        Summon {PHANTOM} · {smart.credits} credits
      </Button>
    </Card>
  );
}

function OutputPanel({
  job,
  uploading,
  onReset,
  onRevise,
  revising,
  onOpen,
  versions,
}: {
  job: SmartVideoJob | null;
  uploading: { done: number; total: number } | null;
  onReset: () => void;
  onRevise: (note: string) => Promise<boolean>;
  revising: boolean;
  onOpen: (jobId: string) => void;
  versions: SmartVideoJob[];
}) {
  const [note, setNote] = useState('');
  if (uploading) {
    return (
      <Card className="p-4 space-y-3">
        <p className="text-sm">
          Uploading {uploading.done} of {uploading.total} files...
        </p>
        <Progress value={uploading.total ? (uploading.done / uploading.total) * 100 : 100} />
      </Card>
    );
  }
  if (!job) {
    return (
      <Card className="p-8 flex flex-col items-center justify-center gap-5 text-sm text-muted-foreground text-center">
        <PhantomMark className="w-40 h-40" />
        <p>
          {NAME}&apos;s work appears here in about 3 minutes. {NAME} works alone.
        </p>
      </Card>
    );
  }

  const current = STAGES.findIndex((stage) => stage.status === job.status);

  return (
    <Card className="p-4 space-y-4">
      {job.status === 'done' && job.videoUrl ? (
        <>
          <video
            src={job.videoUrl}
            controls
            playsInline
            className={cn(
              'mx-auto rounded-lg bg-black',
              job.format === 'horizontal' ? 'w-full aspect-video' : 'max-h-[640px] aspect-[9/16]',
            )}
          />
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <a href={job.videoUrl} download="smart-video.mp4" target="_blank" rel="noreferrer">
                <Download className="w-4 h-4 mr-2" />
                Download
              </a>
            </Button>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Summon again
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="smart-note">Edit this video</Label>
            <Textarea
              id="smart-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                'Tell the Phantom what to change, in your own words: "Open with the price." "Use the photo of the torch in the second scene." "The phone number is 555-0199." "Shorter and more serious."'
              }
              className="min-h-[90px]"
              disabled={revising}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Only what you ask for changes; the rest stays. The current version is kept.</p>
              <Button
                size="sm"
                className="flex-shrink-0"
                disabled={revising || note.trim().length < 3}
                onClick={async () => {
                  if (await onRevise(note)) setNote('');
                }}
              >
                {revising ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                Make the edit · {PHANTOM_REVISION_CREDITS} credits
              </Button>
            </div>
          </div>
        </>
      ) : job.status === 'failed' ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">
            {NAME} vanished mid-job: {job.error || 'unknown reason'}
          </p>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Start over
          </Button>
        </div>
      ) : (
        <>
          <PhantomMark className="w-28 h-28 mx-auto" active />
          <WaitNote since={job.createdAt} />
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
        </>
      )}

      {job.status === 'done' && job.script && job.script.length > 0 && (
        <details className="border-t pt-3 text-sm" open>
          <summary className="cursor-pointer font-medium">What it says, scene by scene</summary>
          <ol className="mt-3 space-y-3">
            {job.script.map((scene, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                  {i + 1}
                </span>
                <div className="space-y-1">
                  <p>
                    {scene.speaker && (
                      <span className="mr-1 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] text-primary">their own voice</span>
                    )}
                    {scene.say}
                  </p>
                  {scene.show.length > 0 && <p className="text-xs text-muted-foreground">On screen: {scene.show.join(' · ')}</p>}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {versions.length > 1 && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            {versions.map((version, i) => (
              <button
                key={version.id}
                type="button"
                onClick={() => onOpen(version.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  version.id === job.id ? 'border-primary bg-primary/10 font-medium' : 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                {i === 0 ? 'Original' : `Edit ${i}`}
              </button>
            ))}
          </div>
          {job.note && <p className="text-sm text-muted-foreground">Your edit: &ldquo;{job.note}&rdquo;</p>}
        </div>
      )}

      {job.warnings && job.warnings.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <ScrollText className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <ul className="space-y-1">
            <li className="font-medium">{NAME} left a note:</li>
            {job.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {job.summary && (
        <div className="text-sm space-y-1 border-t pt-3">
          <p>
            <span className="font-medium capitalize">{job.summary.format}</span> · {job.summary.style} look · {job.summary.scenes} scenes ·{' '}
            {Math.round(job.durationSeconds || 0)} s · {job.summary.language.toUpperCase()}
            {job.summary.captions ? ' · captions' : ''}
          </p>
          <p className="text-muted-foreground">{job.summary.styleReason}</p>
        </div>
      )}
    </Card>
  );
}

interface VideoGroup {
  /** The first version: its text names the video. */
  root: SmartVideoJob;
  /** Original first, then every change in the order it was made. */
  versions: SmartVideoJob[];
}

// A change is its own job that points at the video it changed; the library shows one card per video.
function groupVersions(jobs: SmartVideoJob[]): VideoGroup[] {
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const rootOf = (job: SmartVideoJob): SmartVideoJob => {
    let current = job;
    while (current.parentId && byId.has(current.parentId)) current = byId.get(current.parentId) as SmartVideoJob;
    return current;
  };
  const groups = new Map<string, VideoGroup>();
  for (const job of jobs) {
    const root = rootOf(job);
    const group = groups.get(root.id) ?? { root, versions: [] };
    group.versions.push(job);
    groups.set(root.id, group);
  }
  const newest = (group: VideoGroup) => group.versions[group.versions.length - 1].createdAt;
  return [...groups.values()]
    .map((group) => ({ ...group, versions: group.versions.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
    .sort((a, b) => newest(b).localeCompare(newest(a)));
}

function videoTitle(job: SmartVideoJob): string {
  const firstLine = job.brief.trim().split('\n')[0];
  if (firstLine) return firstLine;
  if (job.link) return /zillow/i.test(job.link) ? 'Zillow listing' : /amazon|amzn/i.test(job.link) ? 'Amazon product' : job.link;
  return 'Untitled video';
}

function VideoLibrary({ groups, currentId, onOpen }: { groups: VideoGroup[]; currentId?: string; onOpen: (jobId: string) => void }) {
  if (!groups.length) return null;
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">Your videos</h2>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {groups.map(({ root, versions }) => {
          const latest = versions[versions.length - 1];
          const shown = [...versions].reverse().find((v) => v.status === 'done' && v.videoUrl);
          const running = latest.status !== 'done' && latest.status !== 'failed';
          return (
            <button
              key={root.id}
              type="button"
              onClick={() => onOpen(latest.id)}
              className={cn(
                'overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/60',
                versions.some((v) => v.id === currentId) && 'border-primary',
              )}
            >
              <div className="relative aspect-[9/16] bg-black">
                {shown?.videoUrl ? (
                  // The first second of the video is its thumbnail; only the file's header is fetched.
                  <video
                    src={`${shown.videoUrl}#t=1`}
                    preload="metadata"
                    muted
                    playsInline
                    className={cn('h-full w-full', shown.format === 'horizontal' ? 'object-contain' : 'object-cover')}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <PhantomMark className="w-16 h-16" active={running} />
                  </div>
                )}
                {running && (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">
                    Working
                  </span>
                )}
                {latest.status === 'failed' && (
                  <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[11px] text-destructive-foreground">
                    Failed
                  </span>
                )}
                {versions.length > 1 && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
                    {versions.length} versions
                  </span>
                )}
              </div>
              <div className="space-y-0.5 p-2">
                <p className="truncate text-sm font-medium">{videoTitle(root)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(latest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {shown?.durationSeconds ? ` · ${Math.round(shown.durationSeconds)} s` : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A picked file as a picture, so a wrong upload is caught before it costs credits.
function FileThumb({ file, disabled, onRemove }: { file: File; disabled: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const isVideo = file.type.startsWith('video');
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border bg-muted" title={file.name}>
      {url && isVideo && <video src={`${url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for next/image to optimise */}
      {url && !isVideo && <img src={url} alt={file.name} className="h-full w-full object-cover" />}
      {isVideo && (
        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1 py-0.5 text-[10px] text-white">
          <FileVideo className="h-3 w-3" />
          clip
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${file.name}`}
        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// The wait is 2 to 7 minutes: show that time is passing, and that the page can be left.
function WaitNote({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return (
    <p className="text-center text-xs text-muted-foreground">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} · Most videos take 2 to 4 minutes. You can leave this page, {NAME}{' '}
      keeps working; the video will be in Your videos.
    </p>
  );
}
