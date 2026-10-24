'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  Download,
  ImagePlus,
  Info,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { listBonusVideoAds, makeBonusVideoAd } from '@/actions/tools/bonus-video-ads';
import { cn } from '@/lib/utils';
import { describeLink } from '@/lib/smart-video/link';
import { PHANTOM_EXAMPLES } from '@/lib/smart-video/examples';
import { PHANTOM_PRESENTER_CHANGE_CREDITS, PHANTOM_PRESENTER_CREDITS, PHANTOM_REVISION_CREDITS } from '@/lib/smart-video/pricing';
import type { VideoLook } from '@/lib/smart-video/types';
import { SMART_VIDEO_MAX_EDIT_FILES, SMART_VIDEO_MAX_FILE_MB, type SmartVideoJob } from '@/types/smart-video';
import type { BonusVideoAd } from '@/types/free-video';
import { InsufficientCreditsNotice } from '@/components/ui/insufficient-credits-notice';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { useSmartVideo } from './hooks/use-smart-video';
import { FileThumb, SoundSwitches, plainError } from './shared';

/**
 * Make a Video Ad (the Phantom's page, rebuilt 2026-10 for small business owners who come from the free video ad):
 * one big box, one green button, the options folded away; then the video ad, Download and one "Type a change" box.
 * Customer text names the AI Media Machine; the colours come from the theme tokens (light = the bluefx.net look).
 */

export type SmartVideo = ReturnType<typeof useSmartVideo>;

const ROBOT = { poster: '/free-video/robot-poster.webp', hevc: '/free-video/robot.mov', webm: '/free-video/robot.webm' };

/** About 3 minutes is the promise; past this many minutes the wait says so instead of standing still. */
const LONGER_THAN_USUAL_MINUTES = 6;
// The tool's name (owner 2026-10-21). "Ad Maker" stays together, so a phone breaks it as Phantom / Ad Maker.
const TITLE = 'Phantom Ad\u00a0Maker';

/** Words in a change that ask for a different person on camera: the change then asks about the presenter's own price. */
const PERSON_WORDS =
  /\b(presenter|presenters|person|woman|women|man|men|girl|guy|lady|gentleman|actor|actress|spokesperson|spokesman|spokeswoman|influencer|host|avatar|face|on[- ]camera|myself)\b/i;
/** A change about the narrator's voice is an ordinary change (the voice-over is re-recorded): no presenter question... */
const VOICE_WORDS = /\b(voice|voices|voice-over|voiceover|narrator|narration)\b/i;
/** ...unless it also names the person on camera ("a woman presenter with a soft voice"). */
const ON_CAMERA_WORDS = /\b(presenter|presenters|actor|actress|spokesperson|spokesman|spokeswoman|avatar|face|on[- ]camera)\b/i;

/**
 * The styles in the "Change style" gallery, first = the default: Hand-drawn with a presenter, exactly the free video ad
 * (owner 2026-10-24), since buyers come from their free video ad; Hand-drawn alone is its own card. The two Hand-drawn
 * cards also set the presenter switch; the other styles keep it as it is (More options). `preview` is a 7-second silent
 * cut of a real Phantom video ad in that style (public/smart-video/looks); a style without one shows a still frame
 * until its test ads are made.
 */
interface StyleCard {
  id: string;
  value: VideoLook;
  presenter?: boolean;
  label: string;
  hint: string;
  preview?: string;
  poster: string;
  badge?: string;
}
const STYLES: StyleCard[] = [
  { id: 'whiteboard-presenter', value: 'whiteboard', presenter: true, label: 'Hand-drawn + presenter', hint: 'A presenter opens, then a hand draws your story on a whiteboard', preview: '/smart-video/looks/whiteboard.mp4', poster: '/smart-video/looks/whiteboard-poster.jpg', badge: 'Your free ad' },
  { id: 'whiteboard', value: 'whiteboard', presenter: false, label: 'Hand-drawn', hint: 'A hand draws your story on a whiteboard, no presenter', preview: '/smart-video/looks/whiteboard-only.mp4', poster: '/smart-video/looks/whiteboard-only-poster.jpg' },
  { id: 'cartoon', value: 'cartoon', label: 'Cartoon', hint: 'Friendly cartoon pictures and speech bubbles. Insurance, finance, dental, apps', preview: '/smart-video/looks/cartoon.mp4', poster: '/smart-video/looks/cartoon-poster.jpg', badge: 'New' },
  { id: 'comic', value: 'comic', label: 'Comic book', hint: 'Comic panels, halftone dots and speech bubbles. Auto repair, gyms, food, local deals', preview: '/smart-video/looks/comic.mp4', poster: '/smart-video/looks/comic-poster.jpg', badge: 'New' },
  { id: 'news', value: 'news', presenter: true, label: 'News studio', hint: 'A news anchor opens, your photos tell the story. Restaurants, openings, events', preview: '/smart-video/looks/news.mp4', poster: '/smart-video/looks/news-poster.jpg', badge: 'New' },
  { id: 'vintage', value: 'vintage', label: 'Vintage', hint: 'A 1950s black-and-white TV ad. Barbers, bakeries, family businesses', preview: '/smart-video/looks/vintage.mp4', poster: '/smart-video/looks/vintage-poster.jpg', badge: 'New' },
  { id: 'bold', value: 'bold', label: 'Bold', hint: 'Gyms, sales, events, food', preview: '/smart-video/looks/bold.mp4', poster: '/smart-video/looks/bold-poster.jpg' },
  { id: 'clean', value: 'clean', label: 'Clean', hint: 'Clinics, services, offices', preview: '/smart-video/looks/clean.mp4', poster: '/smart-video/looks/clean-poster.jpg' },
  { id: 'elegant', value: 'elegant', label: 'Elegant', hint: 'Luxury, real estate, spas', preview: '/smart-video/looks/elegant.mp4', poster: '/smart-video/looks/elegant-poster.jpg' },
  { id: 'playful', value: 'playful', label: 'Playful', hint: 'Kids, parties, casual food', poster: '/smart-video/looks/playful.jpg' },
  { id: 'auto', value: 'auto', label: 'AI picks', hint: 'The best fit for your business', preview: '/smart-video/looks/auto.mp4', poster: '/smart-video/looks/auto-poster.jpg' },
];
const cardById = (id: string) => STYLES.find((s) => s.id === id) ?? STYLES[0];
/** The card the page's choice matches: Hand-drawn splits on the presenter switch. */
const cardIdOf = (look: VideoLook, presenter: boolean) => (look === 'whiteboard' ? (presenter ? 'whiteboard-presenter' : 'whiteboard') : look);

const isRunning = (job: SmartVideoJob) => job.status !== 'done' && job.status !== 'failed';

export interface VideoGroup {
  /** The first version: its text names the video ad. */
  root: SmartVideoJob;
  /** Original first, then every change in the order it was made. */
  versions: SmartVideoJob[];
}

/** A change is its own job that points at the video ad it changed; Your video ads shows one card per video ad. */
export function groupVersions(jobs: SmartVideoJob[]): VideoGroup[] {
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

/** The name of a video ad in Your video ads: its first line of notes, else its website. */
export function videoTitle(job: SmartVideoJob): string {
  if (job.freeSite) return job.freeSite;
  const firstLine = job.brief.trim().split('\n')[0];
  if (firstLine) return firstLine;
  if (job.link) return describeLink(job.link);
  return 'Your video ad';
}

/** What a video ad was made from, in a few words: "ascentequipment.com and your notes". */
function madeFrom(job: SmartVideoJob): string {
  if (job.bonus) return `${job.bonus.site}, your bonus video ad #${job.bonus.n}`;
  const parts: string[] = [];
  if (job.link) parts.push(siteOf(job.link));
  if (job.brief.trim() && job.brief.trim() !== job.link) parts.push('your notes');
  return parts.length ? parts.join(' and ') : 'your photos';
}

function siteOf(link: string): string {
  try {
    const url = new URL(link);
    return url.pathname === '/' ? url.hostname.replace(/^www\./, '') : describeLink(link);
  } catch {
    return link;
  }
}

/** A file name for the download: "ascentequipment-com-video-ad.mp4". */
function downloadUrl(job: SmartVideoJob): string {
  const name = `${videoTitle(job)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'your'}-video-ad.mp4`;
  try {
    const url = new URL(job.videoUrl as string);
    url.searchParams.set('download', name);
    return url.href;
  } catch {
    return job.videoUrl as string;
  }
}

/** An error message as a sentence of its own, with the "credits are back" part split off for the green line. */
function splitError(error?: string): { reason: string; refund: string | null } {
  const text = plainError(error);
  const refund = /(\d+) credits have been returned to your balance\./.exec(text);
  const reason = text.replace(/\s*\d+ credits have been returned to your balance\./, '').trim();
  return {
    reason: reason ? reason.charAt(0).toUpperCase() + reason.slice(1) : 'Something went wrong on our side.',
    refund: refund ? `Your ${refund[1]} credits are back in your balance.` : null,
  };
}

/** What a change asked for, for the line under the versions. */
function changeText(job: SmartVideoJob): string {
  const presenter = Boolean(job.presenterRequest || job.presenterPhoto);
  if (job.note) return `“${job.note}”${presenter ? ', with a new presenter' : ''}`;
  if (presenter) return 'a new presenter from your photo';
  return 'the voice-over or the music';
}

/**
 * The AI's notes name the old page's "Change the presenter" / "Add a presenter" tick box; on this page the same
 * choice is the question under the change box.
 */
function plainWarning(warning: string): string {
  if (/tick (Change|Add) (the|a) presenter/i.test(warning)) {
    return `To put a different person on camera, press Change the person on camera under Type a change. A new presenter costs ${PHANTOM_PRESENTER_CHANGE_CREDITS} credits more than other changes.`;
  }
  return warning;
}

// ---------------------------------------------------------------------------------------------------------------
// Small shared pieces

export function RobotLoop({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Set before play(): browsers only autoplay a muted video.
    video.muted = true;
    const play = () => void video.play().catch(() => undefined);
    play();
    // The browser pauses a silent video while the page is in the background; start it again when the page is shown.
    const onShown = () => {
      if (document.visibilityState === 'visible') play();
    };
    document.addEventListener('visibilitychange', onShown);
    return () => document.removeEventListener('visibilitychange', onShown);
  }, []);
  return (
    <video ref={ref} className={className} poster={ROBOT.poster} muted loop playsInline preload="auto" aria-hidden="true">
      <source src={ROBOT.hevc} type='video/quicktime; codecs="hvc1"' />
      <source src={ROBOT.webm} type="video/webm" />
    </video>
  );
}

function RobotStill({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small transparent picture from /public
  return <img src={ROBOT.poster} alt="" aria-hidden="true" className={cn('object-contain', className)} />;
}

function PageHeader({ title, sub, robot = true, action }: { title: string; sub?: ReactNode; robot?: boolean; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-center gap-6">
        {/* Wide screens: the robot beside the title and the text; phones: beside the title only, so the text keeps the width. */}
        {robot && <RobotStill className="hidden h-[104px] w-[104px] flex-shrink-0 sm:block" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-[27px] font-extrabold leading-tight tracking-tight sm:text-[34px]">{title}</h1>
            {robot && <RobotStill className="-my-2 h-16 w-16 flex-shrink-0 sm:hidden" />}
          </div>
          {sub && <p className="mt-2 text-base leading-relaxed text-muted-foreground sm:text-[19px]">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border border-sheet-line bg-sheet p-4 sm:p-8', className)}>{children}</section>;
}

function GreenButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'flex min-h-[64px] w-full items-center justify-center gap-3 rounded-xl bg-cta px-5 py-3 text-[21px] font-extrabold text-cta-foreground shadow-[0_6px_20px_hsl(var(--cta)/0.35)] transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[70px] sm:text-[24px]',
        className,
      )}
    >
      {children}
    </button>
  );
}

function BlueButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'flex min-h-[58px] w-full items-center justify-center gap-2 rounded-xl bg-change px-4 py-2 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:text-xl',
        className,
      )}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 border-field-border bg-field px-5 text-[17px] font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg',
        className,
      )}
    >
      {children}
    </button>
  );
}

function LinkButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-2 self-start text-left text-base font-bold text-brand hover:underline disabled:opacity-60 sm:text-[17px]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A big on/off switch: easy to see and to hit. */
function BigSwitch({ id, checked, onChange, disabled, label }: { id: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative mt-0.5 h-8 w-14 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-cta' : 'bg-field-border',
      )}
    >
      <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-7' : 'left-1')} />
    </button>
  );
}

function SwitchRow({ id, title, text, checked, onChange, disabled }: { id: string; title: string; text: ReactNode; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-sheet-line bg-field p-4 sm:p-5">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[17px] font-bold sm:text-[19px]">
          {title}
        </label>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground sm:text-base">{text}</p>
      </div>
      <BigSwitch id={id} checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return (
    <>
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </>
  );
}

function useMinutesSince(since: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return (now - Date.parse(since)) / 60_000;
}

function InfoLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-sheet-line bg-field p-4 text-base leading-relaxed sm:text-[17px]">
      <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
      <span>{children}</span>
    </div>
  );
}

function GreenLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 rounded-xl bg-cta/15 px-4 py-3 text-[17px] font-semibold text-success-text sm:text-lg">
      <Check className="h-5 w-5 flex-shrink-0" />
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The page

export function MakeVideoAdView({
  smart,
  balance,
  preview,
}: {
  smart: SmartVideo;
  /** The user's credits, when known. */
  balance?: number;
  /** Dev preview only: open a state that otherwise needs clicks, and sample bonus video ads. */
  preview?: { moreOpen?: boolean; changeNote?: string; bonusAds?: BonusVideoAd[] };
}) {
  const { job } = smart;
  const groups = groupVersions(smart.history);
  const versions = job ? (groups.find((group) => group.versions.some((v) => v.id === job.id))?.versions ?? []) : [];
  const lastGood = [...versions].reverse().find((v) => v.status === 'done' && v.videoUrl);

  let main: ReactNode;
  if (smart.uploading) main = <Uploading done={smart.uploading.done} total={smart.uploading.total} />;
  else if (!job && smart.jobId) main = <Loading />;
  else if (!job) main = <StartScreen smart={smart} balance={balance} moreOpen={preview?.moreOpen} />;
  else if (job.freeLeadId && job.freeStage) main = <FreeVideoWaiting job={job} />;
  else if (job.freeLeadId && job.status === 'failed') main = <FreeVideoProblem job={job} />;
  else if (job.freeLeadId && isRunning(job)) main = <FreeVideoArriving job={job} />;
  else if (job.bonus && job.status === 'failed') main = <BonusProblem job={job} />;
  else if (job.status === 'done' && job.videoUrl)
    main = (
      <Ready
        key={job.id}
        job={job}
        versions={versions}
        onOpen={smart.openJob}
        onRevise={smart.revise}
        revising={smart.revising}
        onNew={smart.reset}
        changeNote={preview?.changeNote}
      />
    );
  else if (job.status === 'failed')
    main = (
      <Failed
        job={job}
        onTryAgain={smart.tryAgain}
        onRetryEdit={smart.retryEdit}
        revising={smart.revising}
        onOpen={(id) => smart.openJob(id)}
        backTo={lastGood?.id ?? job.parentId}
      />
    );
  else main = <Making job={job} onStartAnother={smart.reset} />;

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-10 break-words px-4 py-6 text-foreground sm:px-8 sm:py-10">
      {smart.stalePage && <StaleBar />}
      {main}
      <BonusVideoAds onOpen={smart.openJob} sample={preview?.bonusAds} />
      {groups.length > 0 ? (
        <VideoLibrary groups={groups} currentId={job?.id} onOpen={smart.openJob} />
      ) : (
        !job && <Examples />
      )}
    </div>
  );
}

function StaleBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-base">
      <p>
        <span className="font-bold">This page needs a reload.</span> The app was updated while this page was open. A video ad that was being made is
        waiting in Your video ads.
      </p>
      <OutlineButton onClick={() => window.location.reload()}>Reload</OutlineButton>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function Uploading({ done, total }: { done: number; total: number }) {
  return (
    <div className="mx-auto max-w-[760px] space-y-8">
      <PageHeader title={TITLE} robot={false} />
      <Panel className="space-y-4">
        <div className="flex items-center gap-4">
          <RobotLoop className="h-24 w-24 flex-shrink-0" />
          <p className="text-lg font-semibold sm:text-xl">
            {total ? `Sending your photos: ${done} of ${total}` : 'Starting your video ad'}
          </p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-sheet-line">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${total ? (done / total) * 100 : 100}%` }} />
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// First screen: one box, photos, more options, one green button

function StartScreen({ smart, balance, moreOpen }: { smart: SmartVideo; balance?: number; moreOpen?: boolean }) {
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(Boolean(moreOpen));
  const enough = balance === undefined || balance >= smart.credits;

  return (
    <div className="mx-auto max-w-[760px] space-y-8">
      <PageHeader
        title={TITLE}
        sub="Type your website, or a few lines about your business. The AI Media Machine makes the whole video ad for you: the script, a presenter, the voice-over and the music."
      />
      <Panel className={cn('space-y-5', dragging && 'ring-4 ring-primary/40')}>
        <div
          className="space-y-5"
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
        >
          <label htmlFor="mva-text" className="block text-lg font-bold leading-snug sm:text-[21px]">
            Your website, or a few lines about your business
          </label>
          <textarea
            id="mva-text"
            value={smart.brief}
            onChange={(e) => smart.setBrief(e.target.value)}
            disabled={smart.isBusy}
            placeholder={"For example: joespizza.com\nOr: Joe's Pizza in Tampa. Large pizza for $12 every Tuesday. Call 813-555-0142."}
            className="block min-h-[150px] w-full resize-y rounded-xl border-2 border-field-border bg-field px-4 py-3 text-lg leading-normal text-foreground placeholder:text-muted-foreground/80 focus:border-primary focus:outline-none disabled:opacity-60 sm:text-xl"
          />
          {smart.website && (
            <p className="flex items-start gap-3 text-base leading-relaxed text-success-text sm:text-[17px]">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span>
                The AI Media Machine will read <b className="text-foreground">{smart.website.label}</b> for photos and facts about your business
                {smart.website.onlyLink ? '.' : ', and use your other lines too.'}
              </span>
            </p>
          )}

          <input
            ref={picker}
            type="file"
            multiple
            hidden
            accept="image/*,video/mp4,video/quicktime,video/webm,.tif,.tiff,.heic"
            onChange={(e) => {
              smart.addFiles(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            {smart.files.map((file, i) => (
              <div key={`${file.name}-${file.size}-${i}`} className="w-[88px] sm:w-[104px]">
                <FileThumb file={file} disabled={smart.isBusy} onRemove={() => smart.removeFile(i)} />
              </div>
            ))}
            <OutlineButton onClick={() => picker.current?.click()} disabled={smart.isBusy} className="w-full sm:w-auto">
              {smart.files.length ? <Plus className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
              {smart.files.length ? 'Add more photos' : 'Add photos or a video clip'}
            </OutlineButton>
            {!smart.files.length && <span className="text-[17px] text-muted-foreground">Optional</span>}
          </div>
          {!smart.website && (
            <p className="text-base leading-relaxed text-muted-foreground sm:text-[17px]">
              Tip: put your offer and your phone number in the box, and your video ad will show both.
            </p>
          )}

          <StyleRow smart={smart} />

          <MoreOptions smart={smart} open={open} onToggle={() => setOpen((current) => !current)} />

          <GreenButton onClick={smart.start} disabled={smart.isBusy}>
            {smart.isBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
            <span>
              Make my video ad
              <span className="block text-base font-semibold sm:inline sm:text-[19px]">
                <span className="hidden sm:inline"> · </span>
                {smart.credits} credits
              </span>
            </span>
          </GreenButton>
          {enough ? (
            <p className="text-center text-base leading-relaxed text-muted-foreground sm:text-[17px]">
              {balance !== undefined && (
                <>
                  You have <b className="text-foreground">{balance.toLocaleString()} credits</b>: enough for {Math.floor(balance / smart.credits)} video
                  {Math.floor(balance / smart.credits) === 1 ? ' ad' : ' ads'}.
                  <br />
                </>
              )}
              Most video ads are ready in about 3 minutes.
            </p>
          ) : (
            <InsufficientCreditsNotice needed={smart.credits} available={balance} className="text-base" />
          )}
        </div>
      </Panel>
    </div>
  );
}

/** A style's moving preview (or its still frame when it has no preview yet). */
function StylePreview({ card, className }: { card: StyleCard; className?: string }) {
  const style = card;
  return style.preview ? (
    <video key={style.preview} src={style.preview} poster={style.poster} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" className={cn('bg-black object-cover', className)} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- a still frame from /public
    <img src={style.poster} alt="" aria-hidden="true" className={cn('bg-black object-cover object-top', className)} />
  );
}

/** The chosen style on the first screen, with the way into the gallery (owner 2026-10-24: styles back, without a harder page). */
function StyleRow({ smart }: { smart: SmartVideo }) {
  const [open, setOpen] = useState(false);
  const withPresenter = smart.format === 'vertical' && smart.presenter;
  const style = cardById(cardIdOf(smart.look, withPresenter));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={smart.isBusy}
        className="flex w-full items-center gap-4 rounded-xl border-2 border-field-border bg-field p-3 text-left transition-colors hover:border-muted-foreground/50 disabled:opacity-60 sm:p-4"
      >
        <StylePreview card={style} className="h-[86px] w-[48px] flex-shrink-0 rounded-lg sm:h-[100px] sm:w-[56px]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-muted-foreground sm:text-base">Style</span>
          <span className="block text-lg font-bold sm:text-[19px]">{style.label}</span>
          {withPresenter && style.value !== 'whiteboard' && <span className="block text-[15px] leading-snug text-muted-foreground sm:text-base">With a presenter</span>}
          <span className="mt-1 flex items-center gap-1 text-base font-bold text-brand sm:hidden">
            Change style
            <ChevronRight className="h-5 w-5" />
          </span>
        </span>
        <span className="hidden flex-shrink-0 items-center gap-1 text-[17px] font-bold text-brand sm:flex">
          Change
          <ChevronRight className="h-5 w-5" />
        </span>
      </button>
      <StyleGallery smart={smart} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Every style with its preview playing and its price; "Use" sets it (the Hand-drawn cards set the presenter too). */
function StyleGallery({ smart, open, onClose }: { smart: SmartVideo; open: boolean; onClose: () => void }) {
  const tall = smart.format === 'vertical';
  const current = cardIdOf(smart.look, tall && smart.presenter);
  const [picked, setPicked] = useState(current);
  useEffect(() => {
    if (open) setPicked(current);
  }, [open, current]);
  // The price each card would make: the presenter's credits ride on the card for Hand-drawn, on the switch for the rest.
  const base = smart.credits - (tall && smart.presenter ? PHANTOM_PRESENTER_CREDITS : 0);
  const priceOf = (card: StyleCard) => base + (tall && (card.presenter ?? smart.presenter) ? PHANTOM_PRESENTER_CREDITS : 0);
  const chosen = cardById(picked);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-[calc(100%-2rem)] overflow-y-auto p-4 sm:p-6 lg:max-w-[1280px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold">Pick a style</DialogTitle>
          <DialogDescription className="text-base">Each preview is a real video ad made with the Phantom Ad Maker.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {STYLES.map((card) => {
            const on = picked === card.id;
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(card.id)}
                className={cn(
                  'relative flex flex-col overflow-hidden rounded-xl border-2 bg-field text-left',
                  on ? 'border-primary ring-2 ring-primary/30' : 'border-field-border hover:border-muted-foreground/50',
                )}
              >
                <span className="relative block">
                  <StylePreview card={card} className="block aspect-[9/16] w-full" />
                  {card.badge && <span className="absolute bottom-2 left-2 rounded-md bg-white px-2 py-1 text-xs font-bold text-brand shadow">{card.badge}</span>}
                  {on && (
                    <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="flex flex-1 flex-col px-3 py-2.5">
                  <span className="block text-base font-bold leading-snug sm:text-[17px]">{card.label}</span>
                  <span className="mt-0.5 block flex-1 text-sm leading-snug text-muted-foreground sm:text-[15px]">{card.hint}</span>
                  <span className="mt-1.5 block text-sm font-bold text-brand sm:text-[15px]">{priceOf(card)} credits</span>
                </span>
              </button>
            );
          })}
        </div>
        <GreenButton
          className="sticky bottom-0 mt-2"
          onClick={() => {
            smart.setLook(chosen.value);
            if (chosen.presenter !== undefined && tall) smart.setPresenter(chosen.presenter);
            onClose();
          }}
        >
          Use {chosen.label} · {priceOf(chosen)} credits
        </GreenButton>
      </DialogContent>
    </Dialog>
  );
}

function optionsSummary(smart: SmartVideo): string {
  const tall = smart.format === 'vertical';
  const extras = [tall && smart.presenter && 'a presenter', smart.voiceOver && 'voice-over', smart.music && 'music'].filter(Boolean) as string[];
  const withWhat = extras.length ? `, with ${extras.length > 1 ? `${extras.slice(0, -1).join(', ')} and ${extras[extras.length - 1]}` : extras[0]}` : ', without sound';
  return `${tall ? 'Tall video ad for phones' : 'Wide video ad for YouTube and websites'}${withWhat}.${smart.exactWords ? ' Your exact words.' : ''}`;
}

function MoreOptions({ smart, open, onToggle }: { smart: SmartVideo; open: boolean; onToggle: () => void }) {
  const tall = smart.format === 'vertical';
  return (
    <div className="border-t border-sheet-line pt-5">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <ChevronRight className={cn('mt-0.5 h-6 w-6 flex-shrink-0 transition-transform', open && 'rotate-90')} />
        <span className="min-w-0">
          <span className="block text-lg font-bold sm:text-[19px]">More options</span>
          {!open && <span className="mt-1 block text-base leading-relaxed text-muted-foreground sm:text-[17px]">{optionsSummary(smart)}</span>}
        </span>
      </button>

      {open && (
        <div className="mt-6 space-y-7">
          <div>
            <p className="mb-3 text-lg font-bold sm:text-[19px]">Shape of your video ad</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {(
                [
                  { value: 'vertical', label: 'Tall', hint: 'For phones: Facebook, Instagram, TikTok, YouTube Shorts', Icon: Smartphone },
                  { value: 'horizontal', label: 'Wide', hint: 'For YouTube and websites', Icon: Monitor },
                ] as const
              ).map(({ value, label, hint, Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={smart.format === value}
                  onClick={() => smart.setFormat(value)}
                  disabled={smart.isBusy}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border-2 bg-field p-3 text-left sm:flex-row sm:items-center sm:gap-4 sm:p-4',
                    smart.format === value ? 'border-primary ring-2 ring-primary/30' : 'border-field-border hover:border-muted-foreground/50',
                  )}
                >
                  <Icon className="h-8 w-8 flex-shrink-0 text-brand sm:h-10 sm:w-10" strokeWidth={1.6} />
                  <span>
                    <span className="block text-[17px] font-bold sm:text-[19px]">{label}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground sm:text-base">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <SwitchRow
              id="mva-presenter"
              title="Presenter"
              checked={tall && smart.presenter}
              onChange={smart.setPresenter}
              disabled={smart.isBusy || !tall}
              text={
                tall
                  ? `A person opens your video ad and says the first line on camera. ${PHANTOM_PRESENTER_CREDITS} credits, given back if the presenter cannot be made.`
                  : 'For tall video ads only.'
              }
            />
            <SwitchRow id="mva-voice" title="Voice-over" checked={smart.voiceOver} onChange={smart.setVoiceOver} disabled={smart.isBusy} text="A narrator reads the script." />
            <SwitchRow id="mva-music" title="Music" checked={smart.music} onChange={smart.setMusic} disabled={smart.isBusy} text="Music made for your video ad." />
            <SwitchRow
              id="mva-exact"
              title="Use my exact words"
              checked={smart.exactWords}
              onChange={smart.setExactWords}
              disabled={smart.isBusy}
              text={
                smart.exactWords
                  ? 'On: the voice-over reads your text word for word. Long text makes a long video ad, and 3 minutes of text takes 15 to 25 minutes to make.'
                  : 'Off: the AI Media Machine writes the script from your notes. Recommended.'
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Being made

function joinWords(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0] ?? '';
}

function stepsFor(job: SmartVideoJob): { status: SmartVideoJob['status']; label: string }[] {
  const isChange = Boolean(job.parentId);
  const newPresenter = Boolean(job.presenterRequest || job.presenterPhoto);
  // "Filming the presenter, recording the voice-over and music", or the parts of it this video ad has.
  const voice = job.voiceOver !== false;
  const music = job.music !== false;
  const recording = voice ? (music ? 'recording the voice-over and music' : 'recording the voice-over') : music ? 'making the music' : '';
  const making = job.presenter && !isChange ? joinWords(['filming the presenter', recording].filter(Boolean)) : recording;
  return [
    ...(isChange ? [] : [{ status: 'reading' as const, label: job.link ? `Reading ${siteOf(job.link)}` : 'Reading your notes and photos' }]),
    { status: 'directing', label: isChange ? 'Reading your change' : 'Writing the script' },
    {
      status: 'producing',
      label: isChange ? (newPresenter ? 'Filming the new presenter' : 'Making the new parts') : making ? making.charAt(0).toUpperCase() + making.slice(1) : 'Getting the scenes ready',
    },
    { status: 'rendering', label: 'Putting your video ad together' },
    { status: 'finishing', label: 'Final check' },
  ];
}

function percentOf(job: SmartVideoJob): number {
  switch (job.status) {
    case 'reading':
      return 8;
    case 'directing':
      return 25;
    case 'producing':
      return 50;
    case 'rendering':
      return 60 + Math.round((job.renderProgress ?? 0) * 0.35);
    case 'finishing':
      return 97;
    default:
      return 100;
  }
}

function Making({ job, onStartAnother }: { job: SmartVideoJob; onStartAnother: () => void }) {
  const isChange = Boolean(job.parentId);
  const steps = stepsFor(job);
  const current = steps.findIndex((step) => step.status === job.status);
  const minutes = useMinutesSince(job.createdAt);
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <PageHeader
        title={isChange ? 'Your change is being made' : 'Your video ad is being made'}
        sub={isChange ? 'Your current version stays. The new version of your video ad shows up here in a few minutes.' : `From ${madeFrom(job)}.`}
        robot={false}
      />
      <Panel className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="flex flex-shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-sheet-line bg-field px-4 py-5 text-center text-[17px] font-bold text-brand sm:h-[384px] sm:w-[216px]">
          <RobotLoop className="h-[130px] w-[130px] sm:h-[170px] sm:w-[170px]" />
          <span>{isChange ? 'Your new version is on the way' : 'Your video ad is on the way'}</span>
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {isChange && (job.note || job.presenterRequest || job.presenterPhoto) && (
            <div className="rounded-xl border border-sheet-line bg-field p-4">
              <p className="text-[15px] font-semibold text-muted-foreground">Your change</p>
              <p className="mt-1 text-lg">{job.note ? `“${job.note}”` : 'A new presenter from your photo'}</p>
              {(job.presenterRequest || job.presenterPhoto) && (
                <p className="mt-1 text-[15px] font-semibold text-muted-foreground">New presenter · {PHANTOM_REVISION_CREDITS + PHANTOM_PRESENTER_CHANGE_CREDITS} credits</p>
              )}
            </div>
          )}
          <div className="h-3 overflow-hidden rounded-full bg-sheet-line" role="progressbar" aria-valuenow={percentOf(job)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percentOf(job)}%` }} />
          </div>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={step.status} className={cn('flex items-start gap-3 text-lg leading-snug sm:text-[19px]', i > current && 'text-muted-foreground/80', i === current && 'font-bold')}>
                {i < current ? (
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                ) : i === current ? (
                  <Loader2 className="mx-0.5 mt-0.5 h-6 w-6 flex-shrink-0 animate-spin text-brand" />
                ) : (
                  <span className="mx-0.5 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full border-2 border-field-border" />
                )}
                <span>
                  {step.label}
                  {step.status === 'rendering' && i === current ? ` ${job.renderProgress ?? 0}%` : ''}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-base text-muted-foreground sm:text-[17px]">
            <Elapsed since={job.createdAt} /> so far.{' '}
            {minutes > LONGER_THAN_USUAL_MINUTES
              ? `Your ${isChange ? 'change' : 'video ad'} is taking a little longer than usual.`
              : `Most ${isChange ? 'changes' : 'video ads'} are ready in about 3 minutes.`}
          </p>
          <InfoLine>
            You can leave this page. {isChange ? 'The new version' : 'Your video ad'} will be waiting for you under <b>Your video ads</b>.
          </InfoLine>
        </div>
      </Panel>
      {!isChange && (
        <LinkButton onClick={onStartAnother}>
          <Plus className="h-5 w-5" />
          Start another video ad while you wait
        </LinkButton>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Ready: the video ad, Download, and one box for a change

function Ready({
  job,
  versions,
  onOpen,
  onRevise,
  revising,
  onNew,
  changeNote,
}: {
  job: SmartVideoJob;
  versions: SmartVideoJob[];
  onOpen: (jobId: string) => void;
  onRevise: SmartVideo['revise'];
  revising: boolean;
  onNew: () => void;
  changeNote?: string;
}) {
  const wide = job.format === 'horizontal';
  const seconds = Math.round(job.durationSeconds || 0);
  return (
    <div className="space-y-8">
      <PageHeader
        title={job.freeLeadId ? `Your free video ad for ${job.freeSite || 'your business'}` : 'Your video ad is ready'}
        sub={`Made from ${madeFrom(job)}.${seconds ? ` ${seconds} seconds, ${wide ? 'wide' : 'tall'}.` : ''}`}
        action={
          <OutlineButton onClick={onNew} className="w-full flex-shrink-0 sm:w-auto">
            <Plus className="h-5 w-5" />
            Make a new video ad
          </OutlineButton>
        }
      />
      <Panel className={cn('grid gap-6 sm:gap-10', wide ? 'grid-cols-1' : 'md:grid-cols-[360px_minmax(0,1fr)]')}>
        <video
          src={job.videoUrl}
          controls
          playsInline
          preload="metadata"
          className={cn('mx-auto w-full rounded-xl bg-black shadow-lg', wide ? 'aspect-video' : 'aspect-[9/16] max-w-[360px]')}
        />
        <div className="flex min-w-0 flex-col gap-4">
          <a
            href={downloadUrl(job)}
            className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-xl bg-cta px-5 text-[21px] font-extrabold text-cta-foreground shadow-[0_6px_20px_hsl(var(--cta)/0.35)] transition-colors hover:bg-cta-hover sm:min-h-[68px] sm:text-[23px]"
          >
            <Download className="h-6 w-6" strokeWidth={2.4} />
            Download your video ad
          </a>
          <p className="text-base leading-relaxed text-muted-foreground">An MP4 file. Post your video ad on Facebook, Instagram, TikTok or YouTube.</p>
          <div className="my-2 h-px bg-sheet-line" />
          <ChangeBox job={job} onRevise={onRevise} revising={revising} initialNote={changeNote} />
        </div>
      </Panel>

      {versions.length > 1 && <Versions job={job} versions={versions} onOpen={onOpen} />}

      {job.warnings && job.warnings.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-base leading-relaxed sm:p-5 sm:text-[17px]">
          <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-500" />
          <div>
            <p className="text-lg font-bold">Please check before you post</p>
            <ul className="mt-1 space-y-1">
              {job.warnings.map((warning, i) => (
                <li key={i}>{plainWarning(warning)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {job.script && job.script.length > 0 && (
        <details className="group rounded-xl border border-sheet-line bg-sheet">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-lg font-bold sm:p-5">
            <ChevronRight className="h-5 w-5 flex-shrink-0 transition-transform group-open:rotate-90" />
            Read the script of your video ad
            <span className="font-medium text-muted-foreground">{job.script.length} scenes</span>
          </summary>
          <ol className="space-y-4 px-4 pb-5 sm:px-5">
            {job.script.map((scene, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold">{i + 1}</span>
                <div className="space-y-1">
                  <p className="text-[17px] leading-relaxed">
                    {(scene.presenter || scene.speaker) && (
                      <span className="mr-2 rounded bg-primary/15 px-2 py-0.5 text-sm font-semibold text-primary">
                        {scene.presenter ? 'presenter on camera' : 'your own voice'}
                      </span>
                    )}
                    {scene.say}
                  </p>
                  {scene.show.length > 0 && <p className="text-[15px] text-muted-foreground">On screen: {scene.show.join(' · ')}</p>}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function Versions({ job, versions, onOpen }: { job: SmartVideoJob; versions: SmartVideoJob[]; onOpen: (jobId: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[17px] text-muted-foreground">
        <span className="mr-1">Versions:</span>
        {versions.map((version, i) => (
          <button
            key={version.id}
            type="button"
            onClick={() => onOpen(version.id)}
            className={cn(
              'min-h-[44px] rounded-full border-2 px-4 text-base font-semibold',
              version.id === job.id ? 'border-primary bg-primary/10 text-foreground' : 'border-field-border text-foreground hover:bg-accent',
            )}
          >
            {i === 0 ? 'Original' : `Change ${i}`}
            {version.status === 'failed' && ' (did not go through)'}
            {isRunning(version) && ' (being made)'}
          </button>
        ))}
      </div>
      {job.parentId && <p className="text-[17px] text-muted-foreground">Your change: {changeText(job)}</p>}
    </div>
  );
}

function ChangeBox({
  job,
  onRevise,
  revising,
  initialNote,
}: {
  job: SmartVideoJob;
  onRevise: SmartVideo['revise'];
  revising: boolean;
  initialNote?: string;
}) {
  const [note, setNote] = useState(initialNote ?? '');
  const [added, setAdded] = useState<File[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  // With a photo on a video that has a presenter: the client takes the presenter's place unless they tick this.
  const [photoAsIs, setPhotoAsIs] = useState(false);
  const has = { voiceOver: job.voiceOver !== false, music: job.music !== false };
  const [sound, setSound] = useState(has);
  const [soundOpen, setSoundOpen] = useState(false);
  // The client asked for the presenter choice with its own button, whatever the words say.
  const [presenterOpen, setPresenterOpen] = useState(false);
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  // Only tall video ads that are not listing videos have a presenter, and never one that opens with the client's own clip.
  const opener = job.script?.[0];
  const ownOpening = Boolean(opener?.speaker && opener.presenter === false);
  const canHavePresenter = job.format !== 'horizontal' && !job.listing && !ownOpening;
  const hasPresenter = Boolean(opener?.presenter ?? opener?.speaker);
  // The presenter changes only when the client says yes to its own price (owner rules 2026-10-13 and 2026-10-19: a new
  // person on camera always costs more than a plain change), never from the words alone. The words only open the
  // question; the button under the change opens it for any wording.
  const asksForPerson = Boolean(photo) || (PERSON_WORDS.test(note) && (!VOICE_WORDS.test(note) || ON_CAMERA_WORDS.test(note)));
  const showPresenter = canHavePresenter && (asksForPerson || presenterOpen);
  const soundChanged = sound.voiceOver !== has.voiceOver || sound.music !== has.music;
  const canChange = note.trim().length >= 3 || soundChanged;
  const presenterTotal = PHANTOM_REVISION_CREDITS + PHANTOM_PRESENTER_CHANGE_CREDITS;

  const send = async (withPresenter: boolean) => {
    const presenter = withPresenter ? { who: note.trim() || undefined, photo: photo ?? undefined, photoAsIs: Boolean(photo && hasPresenter && photoAsIs) } : undefined;
    if (await onRevise(note.trim(), added, soundChanged ? sound : undefined, presenter)) {
      setNote('');
      setAdded([]);
      setPhoto(null);
      setPhotoAsIs(false);
      setPresenterOpen(false);
    }
  };
  const addFiles = (picked: File[]) => {
    const tooBig = picked.filter((f) => f.size > SMART_VIDEO_MAX_FILE_MB * 1024 * 1024);
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(', ')}: over ${SMART_VIDEO_MAX_FILE_MB} MB`);
    setAdded((current) => [...current, ...picked.filter((f) => !tooBig.includes(f))].slice(0, SMART_VIDEO_MAX_EDIT_FILES));
  };

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="mva-change" className="text-xl font-extrabold sm:text-[22px]">
        Type a change
      </label>
      <p className="-mt-1 text-base text-muted-foreground sm:text-[17px]">Say what to change in your own words.</p>
      <textarea
        ref={noteInput}
        id="mva-change"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={revising}
        placeholder={'For example:\nUse a woman presenter.\nThe phone number is 555-0128.\nMake the video ad shorter.'}
        className="block min-h-[120px] w-full resize-y rounded-xl border-2 border-field-border bg-field px-4 py-3 text-[17px] leading-normal text-foreground placeholder:text-muted-foreground/80 focus:border-primary focus:outline-none sm:min-h-[140px] sm:text-[19px]"
      />
      <input
        ref={addInput}
        type="file"
        multiple
        hidden
        accept="image/*,video/mp4,video/quicktime,video/webm,.tif,.tiff,.heic"
        onChange={(e) => {
          addFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
      {added.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {added.map((file, i) => (
            <div key={`${file.name}-${i}`} className="w-20">
              <FileThumb file={file} disabled={revising} onRemove={() => setAdded((current) => current.filter((_, k) => k !== i))} />
            </div>
          ))}
        </div>
      )}
      {added.length < SMART_VIDEO_MAX_EDIT_FILES && (
        <LinkButton onClick={() => addInput.current?.click()} disabled={revising}>
          <Plus className="h-5 w-5" />
          Add a photo or your logo
        </LinkButton>
      )}

      {showPresenter ? (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4 sm:p-5">
          <p className="text-lg font-bold sm:text-xl">{hasPresenter ? 'A new person on camera?' : 'A person on camera?'}</p>
          <p className="text-base leading-relaxed sm:text-[17px]">
            {asksForPerson
              ? hasPresenter
                ? 'Your change asks for a different presenter.'
                : 'Your change asks for a person on camera.'
              : 'Type who should be on camera in the box above, for example "a woman in her 50s", or add a photo of yourself.'}{' '}
            A{hasPresenter ? ' new' : ''} presenter costs {PHANTOM_PRESENTER_CHANGE_CREDITS} credits more than other changes.
          </p>
          <input
            ref={photoInput}
            type="file"
            hidden
            accept="image/*,.heic,.heif"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > SMART_VIDEO_MAX_FILE_MB * 1024 * 1024) toast.error(`${file.name}: over ${SMART_VIDEO_MAX_FILE_MB} MB`);
              else setPhoto(file);
            }}
          />
          {photo && (
            <div className="flex items-center gap-3">
              <div className="w-20 flex-shrink-0">
                <FileThumb file={photo} disabled={revising} onRemove={() => setPhoto(null)} />
              </div>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {hasPresenter && !photoAsIs
                  ? 'You take the place of the person on camera now: the same place, clothes and pose, with your face. Use a photo of yourself or of someone who agreed to it.'
                  : 'Your photo is filmed as it is: one person, facing the camera. Use a photo of yourself or of someone who agreed to it.'}
              </p>
            </div>
          )}
          {photo && hasPresenter && (
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px] leading-relaxed">
              <input type="checkbox" className="h-5 w-5 flex-shrink-0 accent-[hsl(var(--primary))]" checked={photoAsIs} onChange={(e) => setPhotoAsIs(e.target.checked)} disabled={revising} />
              Film my photo as it is, with its own background
            </label>
          )}
          <BlueButton onClick={() => send(true)} disabled={revising || (!photo && note.trim().length < 3)}>
            {revising && <Loader2 className="h-5 w-5 animate-spin" />}
            {hasPresenter ? 'Yes, a new presenter' : 'Yes, add a presenter'} · {presenterTotal} credits
          </BlueButton>
          {note.trim().length >= 3 && (
            <OutlineButton onClick={() => send(false)} disabled={revising} className="w-full">
              {hasPresenter ? 'No, keep the presenter' : 'No, just make the change'} · {PHANTOM_REVISION_CREDITS} credits
            </OutlineButton>
          )}
          {!photo && (
            <LinkButton onClick={() => photoInput.current?.click()} disabled={revising}>
              <Camera className="h-5 w-5 flex-shrink-0" />
              Or put yourself on camera: add a photo of yourself
            </LinkButton>
          )}
          <p className="text-[15px] text-muted-foreground">If the presenter cannot be made, the {PHANTOM_PRESENTER_CHANGE_CREDITS} credits come back to you.</p>
          {presenterOpen && !asksForPerson && (
            <LinkButton onClick={() => setPresenterOpen(false)} disabled={revising}>
              Back: keep the presenter
            </LinkButton>
          )}
        </div>
      ) : (
        <>
          {asksForPerson && (
            <p className="text-base leading-relaxed text-muted-foreground">
              {ownOpening ? 'Your video ad opens with your own clip, so you stay on camera.' : 'A presenter is only possible in tall video ads.'}
            </p>
          )}
          <BlueButton onClick={() => send(false)} disabled={revising || !canChange}>
            {revising && <Loader2 className="h-5 w-5 animate-spin" />}
            Make the change · {PHANTOM_REVISION_CREDITS} credits
          </BlueButton>
          {canHavePresenter && (
            <OutlineButton
              onClick={() => {
                setPresenterOpen(true);
                noteInput.current?.focus();
              }}
              disabled={revising}
              className="w-full"
            >
              <UserRound className="h-5 w-5 flex-shrink-0" />
              {hasPresenter ? 'Change the person on camera' : 'Add a person on camera'} · {presenterTotal} credits
            </OutlineButton>
          )}
        </>
      )}
      <p className="text-base leading-relaxed text-muted-foreground">
        This version stays. Your change becomes a new version of your video ad in about 3 minutes.
      </p>

      <button
        type="button"
        onClick={() => setSoundOpen((current) => !current)}
        aria-expanded={soundOpen}
        className="flex min-h-[44px] items-center gap-2 self-start text-base font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn('h-5 w-5 transition-transform', soundOpen && 'rotate-90')} />
        Turn the voice-over or the music off or on
      </button>
      {soundOpen && (
        <SoundSwitches
          id="mva-change-sound"
          voiceOver={sound.voiceOver}
          music={sound.music}
          onVoiceOver={(voiceOver) => setSound((current) => ({ ...current, voiceOver }))}
          onMusic={(music) => setSound((current) => ({ ...current, music }))}
          disabled={revising}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// When something does not work

function Failed({
  job,
  onTryAgain,
  onRetryEdit,
  revising,
  onOpen,
  backTo,
}: {
  job: SmartVideoJob;
  onTryAgain: (failed: SmartVideoJob) => void;
  onRetryEdit: (failed: SmartVideoJob) => Promise<boolean>;
  revising: boolean;
  onOpen: (jobId: string) => void;
  backTo?: string;
}) {
  const isChange = Boolean(job.parentId);
  const { reason, refund } = splitError(job.error);
  const retryCredits = PHANTOM_REVISION_CREDITS + (job.presenterRequest || job.presenterPhoto ? PHANTOM_PRESENTER_CHANGE_CREDITS : 0);
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <PageHeader title={TITLE} robot={false} />
      <Panel className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="text-[24px] font-extrabold leading-tight sm:text-[26px]">{isChange ? 'Your change did not go through' : 'Your video ad could not be made'}</h2>
        <p className="text-lg leading-relaxed">{reason}</p>
        {refund && <GreenLine>{isChange ? `Your video ad is unchanged. ${refund}` : refund}</GreenLine>}
        {isChange ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <BlueButton onClick={() => onRetryEdit(job)} disabled={revising} className="sm:flex-1">
              {revising && <Loader2 className="h-5 w-5 animate-spin" />}
              Try the change again · {retryCredits} credits
            </BlueButton>
            {backTo && (
              <OutlineButton onClick={() => onOpen(backTo)} className="sm:flex-1">
                Back to your video ad
              </OutlineButton>
            )}
          </div>
        ) : (
          <>
            <GreenButton onClick={() => onTryAgain(job)}>Try again</GreenButton>
            <p className="text-base text-muted-foreground">Your text goes back into the box. Add your photos again, then press Make my video ad.</p>
          </>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// A buyer's free video ad on its way into the account

function FreeVideoWaiting({ job }: { job: SmartVideoJob }) {
  const minutes = useMinutesSince(job.createdAt);
  const site = job.freeSite ? ` for ${job.freeSite}` : '';
  const text =
    job.freeStage === 'checking'
      ? `Your free video ad${site} is getting a final check. Your video ad shows here without the watermark as soon as the check is done.`
      : minutes > 10
        ? `Your free video ad${site} is taking longer than usual. Your video ad shows here without the watermark as soon as it is done.`
        : `Your free video ad${site} is being made: reading the website, writing the script, filming the presenter. In about 3 minutes your video ad shows here without the watermark.`;
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <PageHeader title={`Your free video ad${site}`} robot={false} />
      <Panel className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <RobotLoop className="h-28 w-28 flex-shrink-0" />
        <p className="text-lg leading-relaxed">{text}</p>
      </Panel>
    </div>
  );
}

function FreeVideoArriving({ job }: { job: SmartVideoJob }) {
  return (
    <div className="space-y-8">
      <PageHeader title={`Your free video ad${job.freeSite ? ` for ${job.freeSite}` : ''}`} sub="Your free video ad is now in your account." />
      <Panel className="grid gap-6 sm:gap-10 md:grid-cols-[360px_minmax(0,1fr)]">
        {job.freePreviewUrl ? (
          <video src={job.freePreviewUrl} controls playsInline preload="metadata" className="mx-auto aspect-[9/16] w-full max-w-[360px] rounded-xl bg-black shadow-lg" />
        ) : (
          <div className="mx-auto flex aspect-[9/16] w-full max-w-[360px] items-center justify-center rounded-xl bg-field">
            <RobotLoop className="h-40 w-40" />
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-4 rounded-xl border border-sheet-line bg-field p-5 text-lg font-bold sm:text-xl">
            <Loader2 className="h-7 w-7 flex-shrink-0 animate-spin text-brand" />
            Taking off the BlueFX watermark. About 2 minutes.
          </div>
          <p className="text-lg leading-relaxed">
            In about 2 minutes your video ad shows here without the watermark. Then you can download your video ad, or type a change.
          </p>
          <GreenButton disabled>
            <Download className="h-6 w-6" />
            Download your video ad
          </GreenButton>
          <p className="text-center text-base text-muted-foreground">Ready to download in about 2 minutes.</p>
        </div>
      </Panel>
    </div>
  );
}

/** A bonus video ad that failed: a click on its card under Your bonus video ads makes it again, at no credits (no paid "try again" here). */
function BonusProblem({ job }: { job: SmartVideoJob }) {
  const bonus = job.bonus as NonNullable<SmartVideoJob['bonus']>;
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <PageHeader title={`Your bonus video ad #${bonus.n} for ${bonus.site}`} robot={false} />
      <Panel className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <RobotLoop className="h-28 w-28 flex-shrink-0" />
        <p className="text-lg leading-relaxed">
          This bonus video ad could not be made this time. Click <b>Make it again</b> on its card under <b>Your bonus video ads</b>. It uses no credits.
        </p>
      </Panel>
    </div>
  );
}

/**
 * The 3 bonus video ads of a free video ad buyer (lib/free-video/bonus-ads.ts): each card is the presenter, a title and
 * a teaser, and one click makes that video ad at no credits. Shown until all 3 are made (they are in Your video ads).
 */
function BonusVideoAds({ onOpen, sample }: { onOpen: (jobId: string) => void; sample?: BonusVideoAd[] }) {
  const queryClient = useQueryClient();
  const { data: loaded = [] } = useQuery({
    queryKey: ['bonus-video-ads'],
    queryFn: () => listBonusVideoAds(),
    enabled: !sample,
    refetchInterval: (query) => (query.state.data?.some((ad) => ad.state === 'making') ? 8000 : false),
  });
  const ads = sample ?? loaded;
  const make = useMutation({
    mutationFn: (ad: BonusVideoAd) => makeBonusVideoAd({ leadId: ad.leadId, n: ad.n }),
    onSuccess: (answer) => {
      void queryClient.invalidateQueries({ queryKey: ['bonus-video-ads'] });
      void queryClient.invalidateQueries({ queryKey: ['smart-video-jobs'] });
      if (answer.success) onOpen(answer.data.jobId);
      else toast.error(answer.error || 'Your bonus video ad could not start. Please try again in a minute.');
    },
    onError: () => toast.error('Your bonus video ad could not start. Please try again in a minute.'),
  });
  // One group per website, newest first (the server's order); a website whose 3 are all made is in Your video ads.
  const groups: BonusVideoAd[][] = [];
  for (const ad of ads) {
    const group = groups.find((items) => items[0].leadId === ad.leadId);
    if (group) group.push(ad);
    else groups.push([ad]);
  }
  const open = groups.filter((items) => items.some((ad) => ad.state !== 'done'));
  if (!open.length) return null;
  return (
    <div className="space-y-8">
      {open.map((items) => (
        <section key={items[0].leadId} className="space-y-4" aria-labelledby={`bonus-video-ads-${items[0].leadId}`}>
          <div className="space-y-1">
            <h2 id={`bonus-video-ads-${items[0].leadId}`} className="text-[22px] font-extrabold sm:text-2xl">
              Your bonus video ads for {items[0].site}
            </h2>
            <p className="text-lg text-muted-foreground">Click one, and it is ready in about 3 minutes. Your bonus video ads use no credits.</p>
          </div>
          <BonusCards ads={items} onOpen={onOpen} make={make} />
        </section>
      ))}
    </div>
  );
}

function BonusCards({
  ads,
  onOpen,
  make,
}: {
  ads: BonusVideoAd[];
  onOpen: (jobId: string) => void;
  make: { isPending: boolean; variables?: BonusVideoAd; mutate: (ad: BonusVideoAd) => void };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
        {ads.map((ad) => {
          const starting = make.isPending && make.variables?.jobId === ad.jobId;
          return (
            <div key={ad.jobId} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="relative aspect-[4/5] bg-sheet">
                {ad.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.imageUrl} alt={`Bonus video ad ${ad.n}: ${ad.title}`} className="h-full w-full object-cover" loading="lazy" />
                )}
                <span className="absolute left-2 top-2 rounded-lg bg-brand px-2.5 py-1 text-sm font-extrabold text-white">#{ad.n}</span>
                {ad.state === 'making' && <span className="absolute right-2 top-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">Being made</span>}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-lg font-bold leading-snug">{ad.title}</p>
                <p className="flex-1 text-base text-muted-foreground">{ad.teaser}</p>
                {ad.state === 'done' || ad.state === 'making' ? (
                  <OutlineButton onClick={() => onOpen(ad.jobId)}>{ad.state === 'done' ? 'Watch your video ad' : 'See it being made'}</OutlineButton>
                ) : (
                  <GreenButton className="min-h-[52px] text-lg sm:min-h-[56px] sm:text-xl" onClick={() => make.mutate(ad)} disabled={make.isPending}>
                    {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                    {ad.state === 'failed' ? 'Make it again' : 'Make this video ad'}
                  </GreenButton>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function FreeVideoProblem({ job }: { job: SmartVideoJob }) {
  const { reason, refund } = splitError(job.error);
  return (
    <div className="mx-auto max-w-[760px] space-y-6">
      <PageHeader title={`Your free video ad${job.freeSite ? ` for ${job.freeSite}` : ''}`} robot={false} />
      <Panel className="space-y-3">
        <p className="text-lg leading-relaxed">{reason}</p>
        {refund && <GreenLine>{refund}</GreenLine>}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Your video ads, and examples for someone who has none yet

function VideoLibrary({ groups, currentId, onOpen }: { groups: VideoGroup[]; currentId?: string; onOpen: (jobId: string) => void }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[22px] font-extrabold sm:text-2xl">Your video ads</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {groups.map(({ root, versions }) => {
          const latest = versions[versions.length - 1];
          const shown = [...versions].reverse().find((v) => v.status === 'done' && v.videoUrl);
          const running = isRunning(latest);
          const failedAll = latest.status === 'failed' && !shown;
          return (
            <button
              key={root.id}
              type="button"
              // A failed change leaves the video ad as it was: the card opens the last good version, not the failure.
              onClick={() => onOpen((latest.status === 'failed' && shown ? shown : latest).id)}
              className={cn(
                'overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/60',
                versions.some((v) => v.id === currentId) ? 'border-primary ring-2 ring-primary' : 'border-border',
              )}
            >
              <div className="relative aspect-[9/16] bg-black">
                {shown?.videoUrl ? (
                  // The first second of the video is its picture; only the file's header is fetched.
                  <video
                    src={`${shown.videoUrl}#t=1`}
                    preload="metadata"
                    muted
                    playsInline
                    className={cn('h-full w-full', shown.format === 'horizontal' ? 'object-contain' : 'object-cover')}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-sheet">
                    <RobotStill className="h-24 w-24 sm:h-28 sm:w-28" />
                  </div>
                )}
                {running && <span className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">Being made</span>}
                {latest.status === 'failed' &&
                  (shown ? (
                    <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-black">Last change did not go through</span>
                  ) : (
                    failedAll && <span className="absolute left-2 top-2 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-white">Could not be made</span>
                  ))}
                {versions.length > 1 && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-xs font-bold text-white">{versions.length} versions</span>
                )}
              </div>
              <div className="space-y-0.5 p-3">
                <p className="truncate text-base font-bold">{videoTitle(root)}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(latest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {shown?.durationSeconds ? ` · ${Math.round(shown.durationSeconds)} seconds` : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Examples() {
  return (
    <section className="mx-auto max-w-[760px] space-y-4">
      <div>
        <h2 className="text-[22px] font-extrabold sm:text-2xl">What the AI Media Machine makes</h2>
        <p className="mt-1 text-base text-muted-foreground sm:text-[17px]">Real video ads for made-up businesses, and what went in.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-5">
        {PHANTOM_EXAMPLES.map((example) => (
          <div key={example.id} className="space-y-2">
            <video
              src={example.videoUrl}
              poster={example.posterUrl}
              controls
              playsInline
              preload="none"
              className={cn('aspect-[9/16] w-full rounded-xl bg-black shadow-md', example.format === 'horizontal' ? 'object-contain' : 'object-cover')}
            />
            <p className="text-lg font-bold">
              {example.label}
              {example.format === 'horizontal' ? ', wide shape' : ''}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">What went in: {example.wentIn}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
