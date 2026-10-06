'use client';

import { useEffect, useRef, useState } from 'react';
import { STYLES } from '@/lib/free-video/copy';
import styles from './free-video.module.css';

/**
 * Offer 2's style strip: six short silent loops of what AI Media Machine makes. They play muted while the strip is on
 * screen, load nothing before that, and stay on their posters for visitors who ask for less motion.
 */
export function StyleReel() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [motionOk, setMotionOk] = useState(false);
  const [onScreen, setOnScreen] = useState(false);

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

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const videos = gridRef.current?.querySelectorAll('video') ?? [];
    videos.forEach((video) => {
      if (motionOk && onScreen) {
        // Set before play(): browsers only autoplay a muted video.
        video.muted = true;
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [motionOk, onScreen]);

  return (
    <div className={styles.styleReel}>
      <h3 className={styles.styleReelTitle}>{STYLES.title}</h3>
      <p className={styles.styleReelText}>{STYLES.text}</p>
      <div ref={gridRef} className={styles.styleGrid}>
        {STYLES.items.map((item) => (
          <figure key={item.id} className={styles.styleTile}>
            <video className={styles.styleVideo} src={item.video} poster={item.poster} muted loop playsInline preload="none" aria-hidden="true" />
            <figcaption className={styles.styleLabel}>{item.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
