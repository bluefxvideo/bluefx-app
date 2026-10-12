'use client';

import { type RefObject, useEffect, useRef, useState } from 'react';
import { OFFER_CARD, OFFER_COPY } from '@/lib/free-video/copy';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';

const BAR_CLOSED_KEY = 'fv-buy-bar-closed';

interface BuyBarProps {
  /** The finished video ad (its column): once it has scrolled up past the top of the screen, the lead has seen it. */
  watch: RefObject<HTMLElement | null>;
  /** The video ad played to the end with sound. */
  ended: boolean;
  /** The offer card is open. */
  cardOpen: boolean;
  /** The 3-day bonus runs: the line names their video ad without the watermark, else the new video ads. */
  bonus: boolean;
  /** Opens the offer card. */
  onOpen: () => void;
  /** Dev preview only: shown at once, as if the video ad had been seen. */
  forceSeen?: boolean;
}

/**
 * The buy bar on phones (owner 2026-10-12, "ok on the buy bar"): slim, at the bottom of the screen, one short line and
 * one button that opens the offer card. It comes up only after the lead has seen the result (the video ad played to the
 * end, or scrolled up past the top of the screen), and steps aside while the card is open, while the video ad itself
 * reaches into the bar's strip at the bottom of the screen (it never covers the video ad, its "Tap for sound" button or
 * its controls), while one of the page's own "Get the AI Media Machine" buttons, the "Download without the watermark"
 * button or the offer box's "Remove the watermark and change anything" button is on screen, and from the ClickBank
 * notices down to the footer (data-fv-bar-hide, and the footer). Its close button keeps it away for the
 * visit. Wider screens (760 px and up) never show it: the CSS hides it. Not for customers, and not on a page without
 * the offer: the status page only renders it with the offer card.
 */
export function BuyBar({ watch, ended, cardOpen, bonus, onOpen, forceSeen = false }: BuyBarProps) {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [closed, setClosed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [overVideo, setOverVideo] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(BAR_CLOSED_KEY) === '1') setClosed(true);
    } catch {
      // Storage blocked: the bar shows again on the next page view.
    }
  }, []);

  // Seen: the video ad's column has scrolled up past the top of the screen, once.
  useEffect(() => {
    const target = watch.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting || entry.boundingClientRect.bottom > 0) return;
      setScrolledPast(true);
      observer.disconnect();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [watch]);

  // A buy button, the main download button, the offer box's button, the ClickBank notices or the footer on screen: the bar steps aside.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    // Not the card's own button: the bar is already away while the card is open, and that button would keep it away for
    // a moment after the card closes, so the focus could not go back to the bar's button.
    const targets = [...document.querySelectorAll<HTMLElement>('[data-fv-bar-hide], footer')].filter((target) => !target.closest('dialog'));
    if (!targets.length) return;
    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setBlocked(onScreen.size > 0);
    });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  // The video ad (the player, data-fv-player) in the bar's strip at the bottom of the screen: the bar steps aside, so it
  // never sits over the video ad, its "Tap for sound" button or its controls. The strip follows the screen's height
  // (a phone's toolbars come and go).
  useEffect(() => {
    const player = watch.current?.querySelector<HTMLElement>('[data-fv-player]');
    const bar = barRef.current;
    if (!player || !bar || typeof IntersectionObserver === 'undefined') return;
    let observer: IntersectionObserver | null = null;
    const start = () => {
      observer?.disconnect();
      const strip = bar.offsetHeight + 16;
      const top = Math.max(0, Math.round(window.innerHeight - strip));
      observer = new IntersectionObserver(([entry]) => setOverVideo(entry.isIntersecting), { rootMargin: `-${top}px 0px 0px 0px` });
      observer.observe(player);
    };
    start();
    window.addEventListener('resize', start);
    return () => {
      window.removeEventListener('resize', start);
      observer?.disconnect();
    };
  }, [watch]);

  const seen = forceSeen || ended || scrolledPast;
  const shown = seen && !closed && !cardOpen && !blocked && !overVideo;
  /**
   * Out of reach (inert, aria-hidden) when it is not shown, except while the card is open: the open card already makes
   * the page behind it inert, and an inert bar would drop the focus of its own button before the card notes what opened
   * it, so the focus could not go back to the bar's button when the card closes.
   */
  const away = !shown && !cardOpen;
  const line = bonus ? OFFER_CARD.bar.bonus : OFFER_CARD.bar.later;

  const close = () => {
    setClosed(true);
    try {
      sessionStorage.setItem(BAR_CLOSED_KEY, '1');
    } catch {
      // Storage blocked: closed for this page view only.
    }
  };

  return (
    <aside ref={barRef} className={cn(styles.buyBar, shown && styles.buyBarOn)} aria-label={OFFER_CARD.bar.label} aria-hidden={away} inert={away}>
      <div className={styles.buyBarIn}>
        <p className={styles.buyBarText}>
          <b>{line[0]}</b> <span>{line[1]}</span>
        </p>
        <button type="button" className={cn(styles.btn, styles.buyBarBtn)} aria-haspopup="dialog" onClick={onOpen}>
          {OFFER_COPY.button}
        </button>
        <button type="button" className={styles.buyBarClose} aria-label={OFFER_CARD.bar.close} onClick={close}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </aside>
  );
}
