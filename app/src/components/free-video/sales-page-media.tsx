'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';

/** False for visitors who ask for less motion: their clips stay on the poster until they tap one. */
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

interface VideoWallProps {
  items: readonly { video: string; poster: string }[];
  soundOn: string;
  soundOff: string;
  previous: string;
  next: string;
}

/**
 * The lifetime page's strip of vertical example videos: the ones on screen play as silent loops, a tap turns one clip's
 * sound on (and every other clip's off), and nothing loads before the strip is near. Arrows scroll it on wider screens.
 */
export function VideoWall({ items, soundOn, soundOff, previous, next }: VideoWallProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const visible = useRef(new Set<number>());
  const motionOk = useMotionOk();
  const [sound, setSound] = useState<number | null>(null);

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
  };

  const scroll = (direction: 1 | -1) => {
    const strip = stripRef.current;
    if (strip) strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={styles.spWall}>
      <button type="button" className={cn(styles.spWallArrow, styles.spWallArrowLeft)} aria-label={previous} onClick={() => scroll(-1)}>
        ‹
      </button>
      <div ref={stripRef} className={styles.spWallStrip}>
        {items.map((item, index) => (
          <div key={item.video} className={styles.spWallItem} data-index={index}>
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
            <button type="button" className={styles.spSound} aria-label={sound === index ? soundOff : soundOn} aria-pressed={sound === index} onClick={() => toggle(index)}>
              <SpeakerIcon on={sound === index} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={cn(styles.spWallArrow, styles.spWallArrowRight)} aria-label={next} onClick={() => scroll(1)}>
        ›
      </button>
    </div>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

interface DemoLoopProps {
  video: string;
  poster: string;
  label: string;
}

/** One tool's demo (the lifetime page's GIF, as a small MP4): a silent loop while it is on screen. */
export function DemoLoop({ video, poster, label }: DemoLoopProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const motionOk = useMotionOk();
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.4 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (motionOk && onScreen) {
      // Set before play(): browsers only autoplay a muted video.
      element.muted = true;
      void element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [motionOk, onScreen]);

  return <video ref={ref} className={styles.spDemo} src={video} poster={poster} width={600} height={336} muted loop playsInline preload="none" aria-label={label} />;
}
