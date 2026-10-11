'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BONUS_TIMER } from '@/lib/free-video/copy';
import { deadlineLabel } from '@/lib/free-video/sales-page';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';

/** False for visitors who ask for less motion: their video ads stay on the poster until they tap one. */
function useMotionOk(): boolean {
  const [motionOk, setMotionOk] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionOk(!query.matches);
    update();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    query.addListener(update);
    return () => query.removeListener(update);
  }, []);
  return motionOk;
}

/**
 * The 3-day bonus deadline in the visitor's own time ("Saturday, October 11 at 2:15 PM"), or null: on the server and in
 * the first render (only the browser knows the time zone, and both renders must match), and when there is no bonus.
 */
export function useDeadline(iso?: string): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(iso ? deadlineLabel(iso) : null);
  }, [iso]);
  return label;
}

/**
 * True once the 3-day bonus has run out while the page is open (false on the server, in the first render and without a
 * bonus): the offer then reads like a visit after the bonus, and the timers say it has ended.
 */
export function useBonusEnded(iso?: string): boolean {
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (!iso) return;
    const left = Date.parse(iso) - Date.now();
    if (left <= 0) {
      setEnded(true);
      return;
    }
    // The bonus is 3 days, well under setTimeout's limit of about 24.8 days.
    const timer = window.setTimeout(() => setEnded(true), left);
    return () => window.clearTimeout(timer);
  }, [iso]);
  return ended;
}

/** The time left until iso, once a second: null on the server and in the first render (both must match). */
function useCountdown(iso: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [iso]);
  if (now === null) return null;
  const left = Math.max(0, Date.parse(iso) - now);
  const seconds = Math.floor(left / 1000);
  return {
    parts: [Math.floor(seconds / 86400), Math.floor((seconds % 86400) / 3600), Math.floor((seconds % 3600) / 60), seconds % 60],
    ended: left === 0,
  };
}

interface BonusTimerProps {
  /** The end of the 3-day bonus (the view's cleanUntil). */
  until: string;
  /** On the navy closing band. */
  dark?: boolean;
}

/**
 * The 3-day bonus counting down: days, hours, minutes and seconds in four boxes. Dashes until the page runs in the
 * browser; at zero it says the bonus has ended.
 */
export function BonusTimer({ until, dark = false }: BonusTimerProps) {
  const left = useCountdown(until);
  if (left?.ended) return <p className={cn(styles.timerEnded, dark && styles.timerDark)}>{BONUS_TIMER.ended}</p>;
  return (
    <div className={cn(styles.timer, dark && styles.timerDark)} role="timer" aria-label={BONUS_TIMER.label}>
      {BONUS_TIMER.units.map((unit, index) => (
        <span key={unit} className={styles.timerBox}>
          <b className={styles.timerNumber}>{left ? String(left.parts[index]).padStart(2, '0') : '--'}</b>
          <span className={styles.timerUnit}>{unit}</span>
        </span>
      ))}
    </div>
  );
}

interface VideoWallProps {
  items: readonly { video: string; poster: string; label: string; note?: string }[];
  soundOn: string;
  soundOff: string;
  previous: string;
  next: string;
  /** Show each label (and note) under its video ad. Without it the labels are for screen readers only. */
  captions?: boolean;
  /** 16:9 video ads instead of 9:16 ones. */
  wide?: boolean;
}

/** One wall turning its sound on tells the others on the page to turn theirs off: one video ad speaks at a time. */
const WALL_SOUND_EVENT = 'fv-wall-sound';

/**
 * A row of video ads, as at the top of the lifetime page: the ones on screen play as silent loops, a tap turns one video
 * ad's sound on (and every other one's off, on every wall of the page), and nothing loads before the row is near. Phones
 * swipe through the row; wider screens get arrows when the row is wider than the screen. With captions, each label and
 * note shows under its video ad.
 */
export function VideoWall({ items, soundOn, soundOff, previous, next, captions = false, wide = false }: VideoWallProps) {
  const wallId = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const visible = useRef(new Set<number>());
  const motionOk = useMotionOk();
  const [sound, setSound] = useState<number | null>(null);
  const [scrollable, setScrollable] = useState(true);

  const sync = useCallback(() => {
    videos.current.forEach((video, index) => {
      if (!video) return;
      const withSound = index === sound;
      video.muted = !withSound;
      if (visible.current.has(index) && (motionOk || withSound)) void video.play().catch(() => undefined);
      else video.pause();
    });
  }, [motionOk, sound]);
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
    sync();
  }, [sync]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting) visible.current.add(index);
          else visible.current.delete(index);
        }
        syncRef.current();
      },
      { threshold: 0.6 },
    );
    strip.querySelectorAll('[data-index]').forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  // Another wall started its sound: this one goes quiet.
  useEffect(() => {
    const quiet = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== wallId) setSound(null);
    };
    window.addEventListener(WALL_SOUND_EVENT, quiet);
    return () => window.removeEventListener(WALL_SOUND_EVENT, quiet);
  }, [wallId]);

  // Arrows only when the row is wider than the screen (two wide video ads side by side fit on a desktop).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => setScrollable(strip.scrollWidth > strip.clientWidth + 2);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const toggle = (index: number) => {
    const video = videos.current[index];
    if (!video) return;
    if (sound === index) {
      setSound(null);
      return;
    }
    // Inside the tap itself: browsers only start sound from a user gesture.
    video.muted = false;
    void video.play().catch(() => undefined);
    setSound(index);
    window.dispatchEvent(new CustomEvent(WALL_SOUND_EVENT, { detail: wallId }));
  };

  const scroll = (direction: 1 | -1) => {
    const strip = stripRef.current;
    if (strip) strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={styles.spWallWrap}>
      {scrollable && (
        <button type="button" className={cn(styles.spWallArrow, styles.spWallArrowLeft)} aria-label={previous} onClick={() => scroll(-1)}>
          ‹
        </button>
      )}
      <div ref={stripRef} className={styles.spWall}>
        {items.map((item, index) => (
          <div key={item.video} className={cn(styles.spWallTile, wide && styles.spWallTileWide)}>
            <div className={cn(styles.spWallItem, wide && styles.spWallItemWide)} data-index={index}>
              <video
                ref={(video) => {
                  videos.current[index] = video;
                }}
                className={styles.spWallVideo}
                src={item.video}
                poster={item.poster}
                muted
                loop
                playsInline
                preload="none"
                aria-hidden="true"
                onClick={() => toggle(index)}
              />
              <button
                type="button"
                className={styles.spSound}
                aria-label={`${sound === index ? soundOff : soundOn}: ${item.label}`}
                aria-pressed={sound === index}
                onClick={() => toggle(index)}
              >
                <SpeakerIcon on={sound === index} />
              </button>
            </div>
            {captions && (
              <p className={styles.spWallCaption}>
                <b className={styles.spWallLabel}>{item.label}</b>
                {item.note && <span className={styles.spWallNote}>{item.note}</span>}
              </p>
            )}
          </div>
        ))}
      </div>
      {scrollable && (
        <button type="button" className={cn(styles.spWallArrow, styles.spWallArrowRight)} aria-label={next} onClick={() => scroll(1)}>
          ›
        </button>
      )}
    </div>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {on ? (
        <>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </>
      ) : (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      )}
    </svg>
  );
}
