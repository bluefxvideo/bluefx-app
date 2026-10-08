'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFreeVideoBeacon } from '@/hooks/use-free-video-beacon';
import { DOWNLOAD, LAYOUT, LIVE, PLAYER, STATUS, SUPPORT_EMAIL, UNLOCK_COPY } from '@/lib/free-video/copy';
import { unlockGoUrl, type PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import { cn } from '@/lib/utils';
import type { FreeVideoUnlockState, FreeVideoUnlockView, FreeVideoView } from '@/types/free-video';
import type { SmartVideoJobStatus } from '@/types/smart-video';
import { LifetimeOffer } from './lifetime-offer';
import { LifetimeSalesPage } from './lifetime-sales-page';
import { LiveMaking } from './live-making';
import { SaveToPhotos } from './save-to-photos';
import { UnlockOffer } from './unlock-offer';
import { VideoAdPlayer } from './video-ad-player';
import styles from './free-video.module.css';

/** queued or making: every 4 s. */
const POLL_MAKING_MS = 4_000;
/** After the unlock click, and while the clean version is made: every 5 s. */
const POLL_UNLOCK_MS = 5_000;
/** Held for the owner's final check: every 30 s. */
const POLL_CHECKING_MS = 30_000;
/** A page left open stops checking after 90 minutes (the tab coming back into view starts a new 90). */
const SESSION_MS = 90 * 60_000;
/** The unlock click keeps the page checking for 30 minutes, even past the 90. */
const UNLOCK_WINDOW_MS = 30 * 60_000;

/** FREE_VIDEO_STEP_OF (types/free-video.ts), repeated here so the page bundle does not load zod. */
const STEP_OF: Record<SmartVideoJobStatus, number> = { reading: 1, directing: 2, producing: 3, rendering: 4, finishing: 5, done: 5, failed: 5 };

type PagePlacement = (typeof PAGE_PLACEMENTS)[number];
type UnlockInfo = FreeVideoUnlockView & { checkoutPath: string };

/** The lead is gone (404): stop asking. */
class LeadGoneError extends Error {}

async function fetchView(token: string): Promise<FreeVideoView> {
  const res = await fetch(`/api/free-video/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (res.status === 404) throw new LeadGoneError('This video ad page no longer exists');
  const answer = await res.json().catch(() => null);
  if (!res.ok || answer?.success !== true || !answer.data) throw new Error(`The status check answered ${res.status}`);
  return answer.data as FreeVideoView;
}

/** The unlock part of a view, with the checkout link filled in (and a safe default for an answer without it). */
function unlockOf(view: FreeVideoView, token: string): UnlockInfo {
  const unlock: FreeVideoUnlockView = view.unlock ?? { state: view.state === 'ready' ? 'available' : 'unavailable' };
  return { ...unlock, checkoutPath: unlock.checkoutPath ?? unlockGoUrl(token) };
}

const unlockWorking = (state: FreeVideoUnlockState) => state === 'paid' || state === 'rendering';

/** Which kind of checking this view needs, before the time limits. */
function pollKind(view: FreeVideoView, unlock: FreeVideoUnlockState): 'making' | 'checking' | 'unlock' | null {
  if (view.state === 'queued' || view.state === 'making') return 'making';
  if (view.state === 'checking') return 'checking';
  if (view.state === 'ready' && unlockWorking(unlock)) return 'unlock';
  return null;
}

function tabTitleOf(view: FreeVideoView): string | null {
  switch (view.state) {
    case 'queued':
      return STATUS.tabTitles.queued;
    case 'making':
      return STATUS.tabTitles.making(STEP_OF[view.step ?? 'reading']);
    case 'checking':
      return STATUS.tabTitles.checking;
    case 'ready':
      return STATUS.tabTitles.ready;
    default:
      return null;
  }
}

/** Dev preview only: freeze the page and force a look. */
export interface FreeVideoStatusDemo {
  /** Show the "stopped checking" notice. */
  stale?: boolean;
  /** Show the note under the unlock button that appears after the click. */
  unlockClicked?: boolean;
  /** Show the iPhone help under the download button on any device. */
  iphone?: boolean;
}

interface FreeVideoStatusProps {
  token: string;
  /** The view the server rendered with, so the first paint already has the name and the domain. */
  initial: FreeVideoView;
  /** The ClickBank tid of Offer 2: fvthank on the thank-you page, fvpage on /v/<token>. */
  placement: PagePlacement;
  /** Dev preview only: no polling, no events, no tab titles. */
  demo?: FreeVideoStatusDemo;
}

/**
 * The live status page of one free video ad: /free-video-ad/thanks/<token> and /v/<token>.
 * It asks GET /api/free-video/<token> every 4 s while the video ad is queued or being made, every
 * 30 s while it gets a final check, and every 5 s for 30 minutes after the unlock click or while the
 * clean version is made. It pauses while the tab is hidden, checks at once when the tab comes back,
 * and stops after 90 minutes with a "Check again" button.
 */
export function FreeVideoStatus({ token, initial, placement, demo }: FreeVideoStatusProps) {
  const isDemo = demo !== undefined;
  const beacon = useFreeVideoBeacon(token, { disabled: isDemo });
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const [sessionOver, setSessionOver] = useState(Boolean(demo?.stale));
  const [unlockClickedAt, setUnlockClickedAt] = useState<number | null>(() => (demo?.unlockClicked ? Date.now() : null));

  const query = useQuery({
    queryKey: ['free-video', token],
    queryFn: () => fetchView(token),
    initialData: initial,
    enabled: !isDemo,
    // Fresh until a poll replaces it: the server rendered the first view a moment ago.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // Also while the visitor is on another tab: the tab's title turns to "ready" and brings them back (owner 2026-10-07:
    // "keep the person on the page ... so they see the finished video"). Browsers slow hidden tabs down, which is fine.
    refetchIntervalInBackground: true,
    retry: (failures, error) => !(error instanceof LeadGoneError) && failures < 2,
    refetchInterval: (current) => {
      if (current.state.error instanceof LeadGoneError || !current.state.data) return false;
      const data = current.state.data;
      const unlockState = unlockOf(data, token).state;
      const now = Date.now();
      const sessionLive = now - sessionStart < SESSION_MS;
      const unlockLive = unlockClickedAt !== null && now - unlockClickedAt < UNLOCK_WINDOW_MS;
      switch (pollKind(data, unlockState)) {
        case 'making':
          return sessionLive ? POLL_MAKING_MS : false;
        case 'checking':
          return sessionLive ? POLL_CHECKING_MS : false;
        case 'unlock':
          return sessionLive || unlockLive ? POLL_UNLOCK_MS : false;
        default:
          // Ready, unlock not paid yet: wait for the payment only after the click.
          return data.state === 'ready' && unlockState === 'available' && unlockLive ? POLL_UNLOCK_MS : false;
      }
    },
  });

  const view = isDemo ? initial : query.data;
  const unlock = unlockOf(view, token);
  const kind = pollKind(view, unlock.state);
  const settled = view.state === 'unreadable' || view.state === 'failed' || (view.state === 'ready' && (unlock.state === 'ready' || unlock.state === 'failed'));
  const stale = isDemo ? Boolean(demo?.stale) : sessionOver && kind !== null;
  const { refetch } = query;

  // The 90-minute limit; a new session (tab back in view, "Check again", the unlock click) moves it.
  useEffect(() => {
    if (isDemo) return;
    const timer = window.setTimeout(() => setSessionOver(true), Math.max(0, SESSION_MS - (Date.now() - sessionStart)));
    return () => window.clearTimeout(timer);
  }, [isDemo, sessionStart]);

  const restart = useCallback(() => {
    setSessionStart(Date.now());
    setSessionOver(false);
    void refetch();
  }, [refetch]);

  // Back in view (for example after paying in the other tab): check at once and start a new 90 minutes.
  useEffect(() => {
    if (isDemo || settled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') restart();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isDemo, settled, restart]);

  const tabTitle = tabTitleOf(view);
  useEffect(() => {
    if (!isDemo && tabTitle) document.title = tabTitle;
  }, [isDemo, tabTitle]);

  // A soft two-note chime the moment the video ad turns ready on this page (the browser may keep it silent until the
  // visitor has tapped something on the page; then nothing plays).
  const lastState = useRef(view.state);
  useEffect(() => {
    const before = lastState.current;
    lastState.current = view.state;
    if (isDemo || view.state !== 'ready' || (before !== 'making' && before !== 'queued' && before !== 'checking')) return;
    chime();
  }, [isDemo, view.state]);

  const onCheckout = useCallback(() => {
    setUnlockClickedAt(Date.now());
    setSessionStart(Date.now());
    setSessionOver(false);
  }, []);

  const staleNotice = stale ? <StaleNotice onCheck={restart} /> : null;
  const domain = view.domain;

  if (view.state === 'ready' && view.videoUrl) {
    const cleanReady = unlock.state === 'ready' && Boolean(unlock.cleanVideoUrl);
    const videoUrl = cleanReady && unlock.cleanVideoUrl ? unlock.cleanVideoUrl : view.videoUrl;
    const freeDownload = view.downloadUrl ?? view.videoUrl;
    // Paid, being made, ready or stuck: the clean version is theirs and leads the column.
    const purchased = unlock.state !== 'available' && unlock.state !== 'unavailable';
    const unlockOffer = (
      <UnlockOffer
        unlock={unlock}
        domain={domain}
        checkoutPath={unlock.checkoutPath}
        clicked={unlockClickedAt !== null}
        onCheckout={onCheckout}
        onDownload={() => beacon('download')}
      />
    );
    return (
      <>
        <section className={styles.liveTop} aria-labelledby="fv-ready-title">
          <div className={styles.liveCard}>
            <p className={cn(styles.livePill, styles.livePillReady)}>
              <span aria-hidden="true">✓</span>
              {LIVE.readyPill}
            </p>
            <h1 id="fv-ready-title" className={styles.liveTitle}>
              {STATUS.readyTitle(domain)}
            </h1>
          </div>
        </section>
        <section className={cn(styles.sectionLight, styles.readySection)}>
          <div className={styles.wrap}>
            <div className={styles.readyGrid}>
              <div>
                {/* A new key swaps in the clean version as a fresh player. */}
                <VideoAdPlayer
                  key={videoUrl}
                  src={videoUrl}
                  label={PLAYER.label(domain)}
                  onPlayWithSound={() => beacon('video_play')}
                  onComplete={() => beacon('video_complete')}
                />
              </div>
              <div>
                <p className={styles.note}>{placement === 'fvpage' ? STATUS.readyNoteEmail : STATUS.readyNoteThanks}</p>
                {/* A clean version that was paid for comes first; otherwise the $99 offer comes after the AI Media Machine. */}
                {purchased && unlockOffer}
                {!cleanReady && (
                  <a
                    className={cn(styles.btn, styles.btnGhost, purchased && styles.btnGap)}
                    href={freeDownload}
                    onClick={() => beacon('download')}
                  >
                    {DOWNLOAD.free}
                  </a>
                )}
                <SaveToPhotos
                  url={videoUrl}
                  fileName={cleanReady ? DOWNLOAD.cleanFileName(domain) : DOWNLOAD.fileName(domain)}
                  forceIphone={demo?.iphone}
                  onSaved={() => beacon('download')}
                />
                {staleNotice}
                <LifetimeOffer placement={placement} token={token} isCustomer={view.isCustomer} variant="ready" />
                {/* A customer gets this video ad in the AI Media Machine without the watermark: no $99 offer. */}
                {!purchased && !view.isCustomer && unlockOffer}
              </div>
            </div>
          </div>
        </section>
        {/* The whole AI Media Machine sales page under the finished video ad, never while it is made (owner 2026-10-08).
            Not for customers: they already have it. */}
        {!view.isCustomer && <LifetimeSalesPage placement={placement} token={token} />}
      </>
    );
  }

  if (view.state === 'unreadable') {
    return (
      <>
        <Band narrow title={STATUS.unreadableTitle(domain)} />
        <section className={styles.sectionLight}>
          <div className={cn(styles.wrap, styles.narrow)}>
            <div className={styles.box}>
              <p className={styles.boxText}>{STATUS.unreadable}</p>
              <p className={styles.boxText}>{STATUS.unreadableNote}</p>
              <a className={cn(styles.btn, styles.boxAction)} href="/free-video-ad">
                {STATUS.retryButton}
              </a>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (view.state === 'failed') {
    return (
      <>
        <Band narrow title={STATUS.failedTitle(domain)} />
        <section className={styles.sectionLight}>
          <div className={cn(styles.wrap, styles.narrow)}>
            <div className={styles.box}>
              <p className={styles.boxText}>{STATUS.failed(domain)}</p>
              <p className={styles.boxText}>
                {LAYOUT.questions}{' '}
                <a className={styles.link} href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  // queued, making, checking (and 'ready' without a file, which the server never sends): the live page
  return (
    <LiveMaking
      view={view.state === 'ready' ? { ...view, state: 'checking' } : view}
      staleNotice={staleNotice}
      paidEarly={
        unlockWorking(unlock.state) ? (
          <p className={cn(styles.note, styles.noteBelow)} role="status">
            {UNLOCK_COPY.paidEarly}
          </p>
        ) : (
          <p className={styles.liveTeaser}>{STATUS.teaser}</p>
        )
      }
      onPromoSound={() => beacon('video_play')}
    />
  );
}

interface BandProps {
  title: string;
  /** The waiting and end pages use the 640 px column. */
  narrow?: boolean;
}

function Band({ title, narrow = false }: BandProps) {
  return (
    <div className={styles.band}>
      <div className={cn(styles.wrap, narrow && styles.narrow)}>
        <h1 className={styles.bandTitle}>{title}</h1>
      </div>
    </div>
  );
}

interface StaleNoticeProps {
  onCheck: () => void;
}

function StaleNotice({ onCheck }: StaleNoticeProps) {
  return (
    <div className={styles.staleBox} role="status">
      <p>{STATUS.stale}</p>
      <button type="button" className={cn(styles.btn, styles.btnGhost)} onClick={onCheck}>
        {STATUS.staleButton}
      </button>
    </div>
  );
}

/** Two short soft notes through Web Audio; silent when the browser does not allow sound yet. */
function chime(): void {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const audio = new Context();
    [660, 880].forEach((frequency, index) => {
      const at = audio.currentTime + index * 0.18;
      const tone = audio.createOscillator();
      const level = audio.createGain();
      tone.frequency.value = frequency;
      level.gain.setValueAtTime(0.0001, at);
      level.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      level.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
      tone.connect(level).connect(audio.destination);
      tone.start(at);
      tone.stop(at + 0.4);
    });
    window.setTimeout(() => void audio.close(), 1500);
  } catch {
    /* no sound on this page */
  }
}
