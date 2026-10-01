'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2, Pencil, RotateCcw, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { containerStyles } from '@/lib/container-styles';
import { cn } from '@/lib/utils';
import { LISTING_CLIP_CREDITS, LISTING_CREDITS, PHANTOM_REVISION_CREDITS } from '@/lib/smart-video/pricing';
import type { useSmartVideo } from '@/components/smart-video/hooks/use-smart-video';
import { SoundSwitches, plainError, soundLabel } from '@/components/smart-video/shared';
import type { SmartVideoJob, SmartVideoJobStatus } from '@/types/smart-video';
import type { AutomaticVideoExample } from '../examples';
import { AutomaticVideoExamples } from '../reelestate-examples';

const STAGES: { status: SmartVideoJobStatus; label: string }[] = [
  { status: 'reading', label: 'Reading the listing and the photos' },
  { status: 'directing', label: 'Writing the script' },
  { status: 'producing', label: 'Recording the voice, making the music, animating the photos' },
  { status: 'rendering', label: 'Putting the video together' },
  { status: 'finishing', label: 'Leveling the sound' },
];

/** What a finished listing video cost: its own price plus the photos that were animated. */
function costLine(job: SmartVideoJob): string | null {
  if (!job.creditsUsed) return null;
  if (job.parentId) return `This change cost ${job.creditsUsed} credits.`;
  const clips = job.clipCharges?.length ?? 0;
  return clips
    ? `This video cost ${job.creditsUsed} credits: ${LISTING_CREDITS} for the video and ${LISTING_CLIP_CREDITS} for each of ${clips} animated photos.`
    : `This video cost ${job.creditsUsed} credits.`;
}

/**
 * The result side of ReelEstate's automatic listing video: examples while
 * nothing is being made, then the progress, then the video with a box to change it.
 */
export function AutomaticOutput({
  video,
  onTryExample,
  loadingExampleId,
}: {
  video: ReturnType<typeof useSmartVideo>;
  onTryExample: (example: AutomaticVideoExample) => void;
  loadingExampleId: string | null;
}) {
  const { job, uploading } = video;
  const [note, setNote] = useState('');
  // The sound of the next version starts as the sound of the video on screen
  const has = { voiceOver: job?.voiceOver !== false, music: job?.music !== false };
  const [sound, setSound] = useState(has);
  const shownJobId = job?.id;
  useEffect(() => {
    setSound({ voiceOver: has.voiceOver, music: has.music });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when another video is opened
  }, [shownJobId]);
  const soundChanged = sound.voiceOver !== has.voiceOver || sound.music !== has.music;

  // Toast only when a video finishes while it is being watched, not when an old one is reopened.
  const watched = useRef<string | null>(null);
  useEffect(() => {
    if (!job) return;
    const running = job.status !== 'done' && job.status !== 'failed';
    if (running) watched.current = job.id;
    else if (watched.current === job.id) {
      watched.current = null;
      if (job.status === 'done') toast.success('Your listing video is ready.');
      else toast.error(`${job.parentId ? 'The change could not be made' : 'The video could not be made'}: ${plainError(job.error)}`);
    }
  }, [job]);

  // The original first, then every change in the order it was made
  const versions = job
    ? video.history.filter((item) => rootOf(item, video.history) === rootOf(job, video.history)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  const current = job ? STAGES.findIndex((stage) => stage.status === job.status) : -1;

  return (
    <div className={`h-full overflow-y-auto ${containerStyles.panel} space-y-4 p-4`}>
      {uploading ? (
        <div className="space-y-3">
          <p className="text-sm">
            Uploading {uploading.done} of {uploading.total} photos...
          </p>
          <Progress value={uploading.total ? (uploading.done / uploading.total) * 100 : 100} />
        </div>
      ) : !job ? (
        <AutomaticVideoExamples onTry={onTryExample} loadingId={loadingExampleId} busy={video.isBusy} />
      ) : job.status === 'done' && job.videoUrl ? (
        <>
          <video
            src={job.videoUrl}
            controls
            playsInline
            className={cn('mx-auto rounded-lg bg-black', job.format === 'horizontal' ? 'aspect-video w-full' : 'aspect-[9/16] max-h-[600px]')}
          />
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <a href={job.videoUrl} download="listing-video.mp4" target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
            <Button variant="outline" onClick={video.reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              New video
            </Button>
          </div>
          {costLine(job) && <p className="text-xs text-muted-foreground">{costLine(job)}</p>}

          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="listing-note">Change this video</Label>
            <Textarea
              id="listing-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={'Say what to change, in your own words: "The price is now $579,000." "Leave the bathroom out." "The open house is Sunday 1 to 4." "My phone number is 208-555-0142."'}
              className="min-h-[80px]"
              disabled={video.revising}
            />
            <SoundSwitches
              id="listing-edit-sound"
              voiceOver={sound.voiceOver}
              music={sound.music}
              onVoiceOver={(voiceOver) => setSound((now) => ({ ...now, voiceOver }))}
              onMusic={(music) => setSound((now) => ({ ...now, music }))}
              disabled={video.revising}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Only what you ask for changes. The current version is kept.</p>
              <Button
                size="sm"
                className="flex-shrink-0"
                disabled={video.revising || (note.trim().length < 3 && !soundChanged)}
                onClick={async () => {
                  if (await video.revise(note, [], soundChanged ? sound : undefined)) setNote('');
                }}
              >
                {video.revising ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                Make the change · {PHANTOM_REVISION_CREDITS} credits
              </Button>
            </div>
          </div>
        </>
      ) : job.status === 'failed' ? (
        <div className="space-y-3">
          <p className="text-sm text-destructive">
            {job.parentId ? 'The change could not be made' : 'The video could not be made'}: {plainError(job.error)}
          </p>
          {job.parentId ? (
            // A failed change: the video is untouched. Run the same change again, or go back to the video.
            <div className="flex flex-wrap gap-2">
              <Button disabled={video.revising} onClick={() => video.retryEdit(job)}>
                {video.revising ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                Try the change again · {PHANTOM_REVISION_CREDITS} credits
              </Button>
              <Button variant="outline" onClick={() => video.openJob(job.parentId as string)}>
                Back to the video
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Your link, photos and facts are still in the form.</p>
              <Button variant="outline" onClick={() => video.tryAgain(job)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <WaitNote since={job.createdAt} change={Boolean(job.parentId)} />
          <ul className="space-y-3">
            {STAGES.map((stage, i) => (
              <li key={stage.status} className={cn('flex items-center gap-3 text-sm', i > current && 'text-muted-foreground')}>
                {i < current ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : i === current ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="h-4 w-4 rounded-full border" />
                )}
                <span className="flex-1">{stage.label}</span>
                {stage.status === 'rendering' && i === current && <span className="text-xs text-muted-foreground">{job.renderProgress ?? 0}%</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {job?.status === 'done' && job.script && job.script.length > 0 && (
        <details className="border-t pt-3 text-sm">
          <summary className="cursor-pointer font-medium">What the video says, photo by photo</summary>
          <ol className="mt-3 space-y-2">
            {job.script.map((scene, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">{i + 1}</span>
                <div className="space-y-0.5">
                  <p>{scene.say}</p>
                  {scene.show.length > 0 && <p className="text-xs text-muted-foreground">On screen: {scene.show.join(' · ')}</p>}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {job && versions.length > 1 && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {versions.map((version, i) => (
            <button
              key={version.id}
              type="button"
              onClick={() => video.openJob(version.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                version.id === job.id ? 'border-primary bg-primary/10 font-medium' : 'text-muted-foreground hover:bg-muted/50',
              )}
            >
              {i === 0 ? 'Original' : `Change ${i}`}
            </button>
          ))}
        </div>
      )}

      {job?.warnings && job.warnings.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <ScrollText className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <ul className="space-y-1">
            <li className="font-medium">A note about this video:</li>
            {job.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {job?.status === 'done' && job.summary && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {job.summary.scenes} photos · {Math.round(job.durationSeconds || 0)} seconds · {soundLabel(job)}
        </p>
      )}

      <ListingLibrary jobs={video.history} currentId={job?.id} onOpen={video.openJob} />
    </div>
  );
}

// A change is its own job that points at the video it changed.
function rootOf(job: SmartVideoJob, all: SmartVideoJob[]): string {
  let current = job;
  const byId = new Map(all.map((item) => [item.id, item]));
  while (current.parentId && byId.has(current.parentId)) current = byId.get(current.parentId) as SmartVideoJob;
  return current.id;
}

/** The user's earlier automatic listing videos, newest first: one card per video, with its versions behind it. */
function ListingLibrary({ jobs, currentId, onOpen }: { jobs: SmartVideoJob[]; currentId?: string; onOpen: (jobId: string) => void }) {
  // Original first, then every change in the order it was made
  const videos = new Map<string, SmartVideoJob[]>();
  for (const job of [...jobs].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    const root = rootOf(job, jobs);
    videos.set(root, [...(videos.get(root) ?? []), job]);
  }
  const cards = [...videos.values()].sort((x, y) => y[y.length - 1].createdAt.localeCompare(x[x.length - 1].createdAt));
  if (!cards.length) return null;
  return (
    <div className="space-y-2 border-t pt-3">
      <h3 className="text-sm font-medium">Your listing videos</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {cards.map((versions) => {
          const latest = versions[versions.length - 1];
          const shown = [...versions].reverse().find((version) => version.status === 'done' && version.videoUrl);
          const running = latest.status !== 'done' && latest.status !== 'failed';
          return (
            <button
              key={versions[0].id}
              type="button"
              // A failed change leaves the video as it was: the card opens the last good version, not the failure.
              onClick={() => onOpen((latest.status === 'failed' && shown ? shown : latest).id)}
              className={cn(
                'overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/60',
                versions.some((version) => version.id === currentId) && 'border-primary',
              )}
            >
              <div className="relative aspect-video bg-black">
                {shown?.videoUrl && (
                  // The first second of the video is its thumbnail; only the file's header is fetched.
                  <video src={`${shown.videoUrl}#t=1`} preload="metadata" muted playsInline className="h-full w-full object-contain" />
                )}
                {running && <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Working</span>}
                {latest.status === 'failed' &&
                  (shown ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-black">Last change failed</span>
                  ) : (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">Failed</span>
                  ))}
              </div>
              <p className="truncate px-2 py-1.5 text-xs">
                {new Date(latest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {(shown ?? latest).durationSeconds ? ` · ${Math.round((shown ?? latest).durationSeconds || 0)} s` : ''}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The wait is several minutes: show that time is passing, and that the page can be left.
function WaitNote({ since, change }: { since: string; change: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return (
    <p className="text-center text-xs text-muted-foreground">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} · {change ? 'A change takes about 2 minutes' : 'A listing video takes about 5 to 8 minutes'}. You can leave this page: the video
      will be under Your listing videos.
    </p>
  );
}
