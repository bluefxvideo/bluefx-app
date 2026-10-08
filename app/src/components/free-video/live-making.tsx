'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EXAMPLE_VIDEOS, LIVE, STATUS, statusSteps } from '@/lib/free-video/copy';
import { cn } from '@/lib/utils';
import type { FreeVideoLive, FreeVideoLiveScene, FreeVideoView } from '@/types/free-video';
import type { SmartVideoJobStatus } from '@/types/smart-video';
import { VideoAdPlayer } from './video-ad-player';
import styles from './free-video.module.css';

/** FREE_VIDEO_STEP_OF (types/free-video.ts), repeated here so the page bundle does not load zod. */
const STEP_OF: Record<SmartVideoJobStatus, number> = { reading: 1, directing: 2, producing: 3, rendering: 4, finishing: 5, done: 5, failed: 5 };
/** About how many minutes are left when each step starts (a job takes about 4: measured 3 min 46 s on 2026-10-07). */
const MINUTES_LEFT: Record<SmartVideoJobStatus, number> = { reading: 4, directing: 4, producing: 3, rendering: 2, finishing: 1, done: 1, failed: 1 };
/** A computed wait above this shows the "busy day" line instead of a time. */
const BUSY_ETA_MINUTES = 90;

interface LiveMakingProps {
  view: FreeVideoView;
  /** "This page stopped checking" with its button, or null. */
  staleNotice: ReactNode;
  /** The $99 unlock is paid while the free video ad is still being made. */
  paidEarly: ReactNode;
  onPromoSound?: () => void;
}

/**
 * The live status page (owner 2026-10-06): instead of a checklist and "you can close this page", the
 * visitor watches The Phantom make the video ad. Each panel appears the moment its piece exists, newest
 * on top: putting it together, the voice-over and the music, the script scene by scene (each card gets its
 * picture, drawing or moving clip as it is made), the photos found on the website. Nothing here is a
 * stand-in: a piece the job has not made yet is a labelled placeholder. No offer either: the AI Media Machine offer
 * waits until the video ad is ready (owner 2026-10-08), so nobody reads this page as bait.
 */
export function LiveMaking({ view, staleNotice, paidEarly, onPromoSound }: LiveMakingProps) {
  const domain = view.domain;
  const live: FreeVideoLive = view.live ?? {};
  const checking = view.state === 'checking';
  const queued = view.state === 'queued';
  const step = view.step ?? 'reading';
  const current = queued ? 0 : checking ? 5 : STEP_OF[step];
  const rendering = !queued && !checking && step === 'rendering';
  const renderPercent = Math.max(0, Math.min(100, view.progress ?? 0));
  const lines = statusSteps(domain, rendering ? renderPercent : undefined);
  const plainLines = statusSteps(domain);
  const percent = queued ? 0 : checking ? 96 : Math.round(((current - 1 + (rendering ? renderPercent / 100 : 0.15)) / plainLines.length) * 100);
  const title = queued ? STATUS.queuedTitle(view.firstName, domain, view.position ?? 0) : LIVE.title(view.firstName, domain);

  let eta: string;
  if (queued) {
    const minutes = view.etaMinutes;
    if (typeof minutes === 'number') eta = minutes > BUSY_ETA_MINUTES ? STATUS.etaBusy : STATUS.eta(minutes);
    else eta = view.etaNote === 'capped' ? STATUS.etaCapped : STATUS.etaPaused;
  } else if (checking) {
    eta = LIVE.checkHint;
  } else {
    eta = STATUS.eta(rendering ? Math.max(1, 2 - (1.5 * renderPercent) / 100) : MINUTES_LEFT[step]);
  }
  const spoken = queued ? title : STATUS.nowLabel(plainLines[Math.max(0, current - 1)] ?? plainLines[0]);

  const scenes = live.scenes ?? [];
  const photos = live.photos ?? view.photos ?? [];
  const sceneImages = scenes.map((scene) => pictureOf(scene, live).url).filter((url): url is string => Boolean(url));
  const finalStretch = !queued && (checking || step === 'rendering' || step === 'finishing' || step === 'done');

  return (
    <>
      <section className={styles.liveTop} aria-labelledby="fv-live-title">
        <div className={styles.liveCard}>
          <p className={cn(styles.livePill, queued && styles.livePillQueued)}>
            <span className={styles.liveDot} aria-hidden="true" />
            {queued ? LIVE.pillQueued : LIVE.pill}
          </p>
          <h1 id="fv-live-title" className={styles.liveTitle}>
            {title}
          </h1>
          <Stage
            domain={domain}
            live={live}
            queued={queued}
            checking={checking}
            rendering={rendering}
            renderPercent={renderPercent}
            finalStretch={finalStretch}
            photos={photos}
            sceneImages={sceneImages}
            onPromoSound={onPromoSound}
          />
          <div className={styles.bar} role="progressbar" aria-label={STATUS.progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span className={styles.barFill} style={{ width: `${percent}%` }} />
          </div>
          {!queued && <p className={styles.stageStep}>{LIVE.progressLine(current, lines.length, lines[Math.max(0, current - 1)] ?? lines[0])}</p>}
          <p className={styles.liveEta}>
            {eta} <span className={styles.liveEmail}>{LIVE.emailNote}</span>
          </p>
          <p className={styles.srOnly} aria-live="polite">
            {spoken}
          </p>
          {staleNotice}
          {paidEarly}
        </div>
      </section>

      <section className={styles.liveStage}>
        <div className={styles.liveColumn}>
          {finalStretch && <RenderPanel checking={checking} percent={rendering ? renderPercent : step === 'rendering' ? 0 : 100} images={sceneImages.length ? sceneImages : photos} />}

          {(live.presenterPhoto || live.presenterClip) && (
            <div className={cn(styles.livePanel, styles.liveIn, styles.presenterPanel)}>
              <div className={styles.presenterMedia}>
                <Media url={live.presenterClip ?? (live.presenterPhoto as string)} alt="" />
              </div>
              <div>
                <h2 className={styles.livePanelTitle}>{LIVE.presenterTitle}</h2>
                <p className={styles.livePanelHint}>{live.presenterClip ? LIVE.presenterReady : LIVE.presenterRecording}</p>
              </div>
            </div>
          )}

          {(live.voiceUrl || live.musicUrl) && (
            <div className={cn(styles.livePanel, styles.liveIn)}>
              {live.voiceUrl && <SoundRow title={LIVE.voiceTitle} label={LIVE.voicePlay} src={live.voiceUrl} />}
              {live.musicUrl && <SoundRow title={LIVE.musicTitle} label={LIVE.musicPlay} src={live.musicUrl} quiet />}
            </div>
          )}

          {!queued && step === 'directing' && scenes.length === 0 && (
            <div className={cn(styles.livePanel, styles.liveIn, styles.liveWriting)}>
              <h2 className={styles.livePanelTitle}>{LIVE.writingTitle}</h2>
              <p className={styles.livePanelHint}>{LIVE.writingHint(domain)}</p>
              <div className={styles.writingLines} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {scenes.length > 0 && (
            <div className={cn(styles.livePanel, styles.liveIn)}>
              <h2 className={styles.livePanelTitle}>{LIVE.scriptTitle}</h2>
              <p className={styles.livePanelHint}>{LIVE.scriptHint(live.look)}</p>
              <ol className={styles.storyboard}>
                {scenes.map((scene, index) => (
                  <SceneCard key={index} scene={scene} number={index + 1} live={live} />
                ))}
              </ol>
            </div>
          )}

          {!queued && photos.length > 0 && (
            <div className={cn(styles.livePanel, styles.liveIn)}>
              <h2 className={styles.livePanelTitle}>{LIVE.photosTitle(domain)}</h2>
              <p className={styles.livePanelHint}>{LIVE.photosCount(photos.length)}</p>
              <ul className={styles.livePhotos}>
                {photos.map((url, index) => (
                  <li key={url} className={styles.livePhoto} style={{ animationDelay: `${index * 90}ms` }}>
                    <Media url={url} alt="" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!queued && photos.length === 0 && scenes.length === 0 && (
            <div className={cn(styles.livePanel, styles.liveReading)}>
              <span className={styles.liveScan} aria-hidden="true" />
              <h2 className={styles.livePanelTitle}>{LIVE.readingTitle(domain)}</h2>
              <p className={styles.livePanelHint}>{LIVE.readingHint}</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

interface StageProps {
  domain: string;
  live: FreeVideoLive;
  queued: boolean;
  checking: boolean;
  rendering: boolean;
  renderPercent: number;
  /** Rendering, finishing or the final check. */
  finalStretch: boolean;
  photos: string[];
  sceneImages: string[];
  onPromoSound?: () => void;
}

/**
 * The stage at the top of the live page (owner 2026-10-07: "keep the person on the page ... so they see something
 * nice"): one phone-shaped frame in the first screen. The picture is the best one so far (the presenter's clip, their
 * photo, the scene pictures while the video ad is put together, the website's photos); the caption is the newest step
 * (reading, the photos found, the opening line typing out, the render percent). While the video ad waits in line it
 * plays the "how it works" video ad. Everything shown is real: nothing appears before the job made it.
 */
function Stage({ domain, live, queued, checking, rendering, renderPercent, finalStretch, photos, sceneImages, onPromoSound }: StageProps) {
  const presenter = live.presenterClip ?? live.presenterPhoto;
  const turns = presenter ? [] : finalStretch && sceneImages.length ? sceneImages : photos;
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (turns.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setTurn((value) => value + 1), 1700);
    return () => window.clearInterval(timer);
  }, [turns.length]);

  if (queued) {
    return (
      <div className={styles.stage}>
        {/* No label on it: the video ad's own headline sits at the top. */}
        <VideoAdPlayer src={EXAMPLE_VIDEOS.heroReel.video} label={LIVE.promoLabel} onPlayWithSound={onPromoSound} />
      </div>
    );
  }

  const picture = presenter ?? (turns.length ? turns[turn % turns.length] : null);
  const hook = live.scenes?.[0]?.say;
  let caption: ReactNode;
  if (checking || (finalStretch && !rendering)) caption = LIVE.stageCheck;
  else if (rendering) caption = LIVE.stageRender(Math.round(renderPercent));
  else if (hook)
    caption = (
      <>
        <span className={styles.stageCaptionSmall}>{LIVE.stageOpensWith}</span>
        <TypedLine text={`“${hook}”`} />
      </>
    );
  else if (live.presenterPhoto)
    caption = (
      <>
        {LIVE.stagePresenterCast}
        <span className={styles.stageCaptionSmall}>{LIVE.stagePresenterRehearsing}</span>
      </>
    );
  else if (photos.length) caption = LIVE.stagePhotos(domain, photos.length);
  else caption = LIVE.stageReading(domain);

  return (
    <div className={styles.stage} aria-hidden="true">
      {picture ? (
        <div key={picture} className={cn(styles.stageMedia, !presenter && styles.stagePan)}>
          <Media url={picture} alt="" />
        </div>
      ) : (
        <span className={styles.liveScan} />
      )}
      {(presenter || photos.length > 0) && <span className={styles.stageLabel}>{presenter ? LIVE.stagePresenterLabel : LIVE.stageWebsiteLabel}</span>}
      <div className={styles.stageCaption}>{caption}</div>
    </div>
  );
}

/** A line that types itself out once (all at once for visitors who ask for less motion). */
function TypedLine({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const timer = window.setInterval(() => setShown((value) => (value >= text.length ? value : value + 1)), 38);
    return () => window.clearInterval(timer);
  }, [text]);
  return <span className={styles.stageTyped}>{text.slice(0, shown)}</span>;
}

/**
 * A scene's picture now: its moving clip, else a picture The Phantom made, else the website photo; drawing = a
 * whiteboard scene still being drawn. Scene 1 shows the presenter instead once they are cast.
 */
function pictureOf(scene: FreeVideoLiveScene, live: FreeVideoLive, number = 0): { url?: string; clip?: string; pending: boolean; drawing: boolean } {
  if (number === 1 && (live.presenterClip || live.presenterPhoto)) return { url: live.presenterPhoto, clip: live.presenterClip, pending: false, drawing: false };
  const id = scene.imageId;
  const clip = id ? live.clips?.[id] : undefined;
  const made = id ? live.made?.[id] : undefined;
  const url = made ?? scene.image;
  return { url, clip, pending: !url && !clip && Boolean(id), drawing: Boolean(scene.drawing) };
}

const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

function Media({ url, alt }: { url: string; alt: string }) {
  if (isVideo(url)) return <video className={styles.liveMedia} src={url} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element -- the job's own files on storage, shown as they arrive
  return <img className={styles.liveMedia} src={url} alt={alt} loading="lazy" decoding="async" />;
}

interface SceneCardProps {
  scene: FreeVideoLiveScene;
  number: number;
  live: FreeVideoLive;
}

function SceneCard({ scene, number, live }: SceneCardProps) {
  const picture = pictureOf(scene, live, number);
  return (
    <li className={styles.sceneCard} style={{ animationDelay: `${(number - 1) * 140}ms` }}>
      <div className={cn(styles.sceneMedia, picture.drawing && styles.sceneDrawing)}>
        {picture.clip ? (
          <video className={styles.liveMedia} src={picture.clip} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" />
        ) : picture.url ? (
          <Media url={picture.url} alt="" />
        ) : picture.pending ? (
          <div className={styles.sceneMaking}>
            <span className={styles.sceneSpinner} aria-hidden="true" />
            <span>{picture.drawing ? LIVE.drawing : LIVE.making}</span>
          </div>
        ) : (
          // A scene without a picture shows its words on the brand colour, as the video ad will.
          <div className={styles.sceneTitleCard}>{scene.show[0] ?? ''}</div>
        )}
        <span className={styles.sceneNumber}>{LIVE.sceneLabel(number)}</span>
        {picture.clip && <span className={styles.sceneMoving}>{number === 1 && live.presenterClip ? LIVE.presenterLabel : LIVE.moving}</span>}
      </div>
      <div className={styles.sceneText}>
        <p className={styles.sceneSay}>{scene.say}</p>
        {scene.show.length > 0 && (
          <div className={styles.sceneShow}>
            {scene.show.slice(0, 3).map((text, index) => (
              <span key={index} className={styles.sceneChip}>
                {text}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

interface SoundRowProps {
  title: string;
  label: string;
  src: string;
  /** The music: a smaller, secondary row. */
  quiet?: boolean;
}

/** A recorded sound with one play/pause button and a waveform that moves while it plays. Sound only starts on a tap. */
function SoundRow({ title, label, src, quiet = false }: SoundRowProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const stop = () => setPlaying(false);
    element.addEventListener('ended', stop);
    element.addEventListener('pause', stop);
    return () => {
      element.removeEventListener('ended', stop);
      element.removeEventListener('pause', stop);
    };
  }, []);
  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (playing) {
      element.pause();
      return;
    }
    // One sound at a time on the page.
    document.querySelectorAll('audio').forEach((other) => other !== element && other.pause());
    void element.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  return (
    <div className={cn(styles.soundRow, quiet && styles.soundRowQuiet)}>
      <button type="button" className={cn(styles.soundButton, playing && styles.soundPlaying)} onClick={toggle} aria-label={playing ? LIVE.pause : label} aria-pressed={playing}>
        <span className={playing ? styles.soundPauseIcon : styles.soundPlayIcon} aria-hidden="true" />
      </button>
      <div className={styles.soundText}>
        <p className={styles.soundTitle}>{title}</p>
        <p className={styles.soundLabel}>{playing ? LIVE.pause : label}</p>
      </div>
      <span className={cn(styles.wave, playing && styles.waveOn)} aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} style={{ animationDelay: `${(index % 7) * 90}ms` }} />
        ))}
      </span>
      <audio ref={audio} src={src} preload="none" />
    </div>
  );
}

interface RenderPanelProps {
  checking: boolean;
  /** 0-100 while rendering; 100 once the render is through. */
  percent: number;
  /** The scenes' pictures, shown one after the other inside the phone. */
  images: string[];
}

/** Putting it together: the scene pictures pass through a phone while the real render percent climbs; then the final check. */
function RenderPanel({ checking, percent, images }: RenderPanelProps) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % images.length), 1300);
    return () => window.clearInterval(timer);
  }, [images.length]);
  const shown = images.length ? images[index % images.length] : null;
  return (
    <div className={cn(styles.livePanel, styles.liveIn, styles.renderPanel)}>
      <div className={styles.renderPhone} aria-hidden="true">
        {shown && <Media key={shown} url={shown} alt="" />}
      </div>
      <div className={styles.renderText}>
        <h2 className={styles.livePanelTitle}>{checking || percent >= 100 ? LIVE.checkTitle : LIVE.renderTitle}</h2>
        <p className={styles.livePanelHint}>{checking || percent >= 100 ? LIVE.checkHint : LIVE.renderHint}</p>
        {!checking && percent < 100 && <p className={styles.renderPercent}>{Math.round(percent)}%</p>}
      </div>
    </div>
  );
}
