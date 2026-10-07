'use client';

import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFreeVideoBeacon } from '@/hooks/use-free-video-beacon';
import { EXAMPLES, EXAMPLE_VIDEOS, FORM, LANDING, REEL_ADS, RESULT_PREVIEW, STICKY } from '@/lib/free-video/copy';
import { cn } from '@/lib/utils';
import { FormMessage } from './form-message';
import { useLanding, type WebsiteFormId } from './free-video-landing';
import styles from './free-video.module.css';

interface WebsiteFormProps {
  form: WebsiteFormId;
}

/** Step 1: the big website field and the green button. A valid website opens step 2 (name and email). */
export function WebsiteForm({ form }: WebsiteFormProps) {
  const { websites, setWebsite, websiteProblem, registerWebsiteInput, startStep2, noteFormStart } = useLanding();
  const problem = websiteProblem?.form === form ? websiteProblem : null;
  const inputId = `fv-website-${form}`;
  const errorId = `${inputId}-error`;
  const register = useCallback((input: HTMLInputElement | null) => registerWebsiteInput(form, input), [form, registerWebsiteInput]);

  return (
    <>
      <form
        className={styles.urlForm}
        method="post"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          startStep2(form);
        }}
      >
        <label className={styles.srOnly} htmlFor={inputId}>
          {FORM.website}
        </label>
        <input
          ref={register}
          id={inputId}
          name="website"
          type="text"
          inputMode="url"
          className={cn(styles.input, styles.urlInput, problem && styles.urlInputInvalid)}
          value={websites[form]}
          onChange={(event) => setWebsite(form, event.target.value)}
          onFocus={noteFormStart}
          placeholder={FORM.websitePlaceholder}
          autoComplete="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? errorId : undefined}
        />
        <button type="submit" className={cn(styles.btn, styles.urlButton)}>
          {FORM.websiteButton} <span aria-hidden="true">→</span>
        </button>
      </form>
      {problem && (
        <div className={styles.heroMessage}>
          <FormMessage id={errorId} problem={problem.problem} website={problem.website} variant="box" />
        </div>
      )}
    </>
  );
}

/**
 * The silent reel (inside the result card since v8): a 15 s loop of the three examples inside a button. It plays muted
 * while on screen, stays on its poster for visitors who ask for less motion, pauses while the player
 * or the step 2 sheet is open, and a tap opens the full example with sound.
 * `media`: the screens this reel is for (phones show one under the headline, wider screens the one in the card,
 * owner 2026-10-07). Elsewhere it stays a poster, so the video file is loaded once.
 */
export function HeroReel({ media }: { media?: string }) {
  const { openExample, overlayOpen } = useLanding();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionOk, setMotionOk] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [forThisScreen, setForThisScreen] = useState(!media);
  const example = EXAMPLE_VIDEOS.ads.find((ad) => ad.id === EXAMPLE_VIDEOS.heroReel.opens) ?? EXAMPLE_VIDEOS.ads[0];

  useEffect(() => {
    if (!media) return;
    const query = window.matchMedia(media);
    const update = () => setForThisScreen(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [media]);

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
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [forThisScreen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!(motionOk && onScreen && !overlayOpen)) {
      video.pause();
      return;
    }
    // Set before play(): browsers only autoplay a muted video.
    video.muted = true;
    const play = () => void video.play().catch(() => undefined);
    play();
    // A page opened in the background: the browser pauses a silent video until the page is shown (2026-10-07).
    const onShown = () => {
      if (document.visibilityState === 'visible') play();
    };
    document.addEventListener('visibilitychange', onShown);
    return () => document.removeEventListener('visibilitychange', onShown);
  }, [motionOk, onScreen, overlayOpen, forThisScreen]);

  return (
    <button type="button" className={styles.reel} aria-label={EXAMPLES.reelLabel} onClick={(event) => openExample(example, event.currentTarget)}>
      {forThisScreen ? (
        <video
          ref={videoRef}
          className={styles.reelVideo}
          src={EXAMPLE_VIDEOS.heroReel.video}
          poster={EXAMPLE_VIDEOS.heroReel.poster}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- the poster of a video that is not loaded on this screen
        <img className={styles.reelVideo} src={EXAMPLE_VIDEOS.heroReel.poster} alt="" aria-hidden="true" />
      )}
      <span className={styles.reelChip} aria-hidden="true">
        {EXAMPLES.reelChip}
      </span>
    </button>
  );
}

/** Phones see the reel right under the headline, wider screens in the result card; the CSS shows one of the two. */
const PHONE_SCREEN = '(max-width: 639px)';
const WIDE_SCREEN = '(min-width: 640px)';

/** The reel under the headline on phones (owner 2026-10-07: "on mobile people first see a whole lot of text, and only see the video later"). */
export function PhoneReel() {
  return (
    <div className={styles.toolReelPhone}>
      <HeroReel media={PHONE_SCREEN} />
    </div>
  );
}

/** The hand-drawn "Start here!" note left of the top website field, with a curved arrow into the field (wide screens only). */
export function StartHere() {
  return (
    <div className={styles.startHere} aria-hidden="true">
      <span className={styles.startHereText}>{LANDING.startHere}</span>
      <svg className={styles.startHereArrow} viewBox="0 0 96 44" fill="none">
        <path d="M6 4 C 10 30, 46 40, 86 30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M74 22 L 87 30 L 73 37" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/**
 * The result card beside the steps (as Neil Patel shows his tool's dashboard): the video ad page in a
 * browser window, the silent reel playing inside, the checklist of what the visitor gets and one real
 * button that opens the pizza example with sound.
 */
export function ResultPreview() {
  const { openExample } = useLanding();
  const example = EXAMPLE_VIDEOS.ads.find((ad) => ad.id === EXAMPLE_VIDEOS.heroReel.opens) ?? EXAMPLE_VIDEOS.ads[0];
  return (
    <figure className={styles.result}>
      <div className={styles.resultBar} aria-hidden="true">
        <span className={styles.resultDots}>
          <span />
          <span />
          <span />
        </span>
        <span className={styles.resultAddress}>{RESULT_PREVIEW.address}</span>
      </div>
      <div className={styles.resultBody}>
        <HeroReel media={WIDE_SCREEN} />
        <figcaption className={styles.resultInfo}>
          <span className={styles.resultBadge}>{RESULT_PREVIEW.badge}</span>
          <p className={styles.resultTitle}>{RESULT_PREVIEW.title}</p>
          <ul className={styles.resultList}>
            {RESULT_PREVIEW.checklist.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button type="button" className={cn(styles.btn, styles.resultWatch)} onClick={(event) => openExample(example, event.currentTarget)}>
            {RESULT_PREVIEW.watch}
          </button>
          <p className={styles.resultFile}>{RESULT_PREVIEW.file}</p>
        </figcaption>
      </div>
    </figure>
  );
}

/**
 * The autoplay row of video ads (as at the top of bluefx.net/video-ad/, owner 2026-10-06): every video ad that is at
 * least half on screen plays silently in a loop, the speaker button plays one with sound (and silences the
 * others), and the arrows page through the row on wide screens (phones swipe). Visitors who ask for less
 * motion see the posters; the speaker still plays a video ad. An open sheet or player pauses the row.
 */
export function AdCarousel() {
  const { overlayOpen } = useLanding();
  const beacon = useFreeVideoBeacon();
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const onScreen = useRef<boolean[]>([]);
  const [motionOk, setMotionOk] = useState(false);
  const [soundAt, setSoundAt] = useState<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionOk(!query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const sync = useCallback(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      video.muted = soundAt !== index;
      const play = !overlayOpen && Boolean(onScreen.current[index]) && (motionOk || soundAt === index);
      if (play) {
        video.preload = 'auto';
        void video.play().catch(() => undefined);
      } else if (!video.paused) {
        video.pause();
      }
    });
  }, [motionOk, overlayOpen, soundAt]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          onScreen.current[Number((entry.target as HTMLElement).dataset.index)] = entry.isIntersecting;
        });
        sync();
      },
      { threshold: 0.5 }
    );
    videoRefs.current.forEach((video) => video && observer.observe(video));
    return () => observer.disconnect();
  }, [sync]);

  useEffect(() => {
    if (overlayOpen) setSoundAt(null);
  }, [overlayOpen]);

  const toggleSound = (index: number) => {
    if (soundAt === index) {
      setSoundAt(null);
      return;
    }
    const video = videoRefs.current[index];
    if (video) {
      // Inside the tap, so the browser lets the sound play.
      videoRefs.current.forEach((other) => other && (other.muted = true));
      video.muted = false;
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    }
    setSoundAt(index);
    beacon('video_play');
  };

  const page = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: calm ? 'auto' : 'smooth' });
  };

  return (
    <div className={styles.carousel}>
      <button type="button" className={cn(styles.carNav, styles.carPrev)} aria-label={EXAMPLES.prev} onClick={() => page(-1)}>
        <ChevronLeft aria-hidden="true" size={22} strokeWidth={2.6} />
      </button>
      <div className={styles.carTrack} ref={trackRef}>
        {REEL_ADS.map((ad, index) => (
          <div key={ad.id} className={styles.carCard}>
            <video
              ref={(video) => {
                videoRefs.current[index] = video;
              }}
              data-index={index}
              className={styles.carVideo}
              src={ad.video}
              poster={ad.poster}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden="true"
            />
            <span className={styles.carTag}>{ad.tag}</span>
            <button
              type="button"
              className={styles.carSound}
              aria-pressed={soundAt === index}
              aria-label={soundAt === index ? EXAMPLES.soundOff(ad.tag) : EXAMPLES.soundOn(ad.tag)}
              onClick={() => toggleSound(index)}
            >
              {soundAt === index ? <Volume2 aria-hidden="true" size={18} /> : <VolumeX aria-hidden="true" size={18} />}
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={cn(styles.carNav, styles.carNext)} aria-label={EXAMPLES.next} onClick={() => page(1)}>
        <ChevronRight aria-hidden="true" size={22} strokeWidth={2.6} />
      </button>
    </div>
  );
}

const STICKY_CLOSED_KEY = 'fv-sticky-closed';

/**
 * The sticky bar (as on neilpatel.com, with the owner popping up at its left edge, pointing at the line):
 * slides up from the bottom once the top website field has scrolled out of view and then STAYS ON for the
 * rest of the visit, at the bottom form and back at the top too (owner 2026-10-06: "keep it on, just like
 * Ubersuggest"). It steps aside only while the sheet or the player is open, and stays closed for the visit
 * after its close button. Wide screens get a third website field; phones get a button that goes back to the
 * top field, because a field in a bar is cramped next to a phone keyboard.
 */
export function StickyBar() {
  const { overlayOpen } = useLanding();
  const [seen, setSeen] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STICKY_CLOSED_KEY) === '1') setClosed(true);
    } catch {
      // Storage blocked: the bar simply shows again on the next visit.
    }
  }, []);

  useEffect(() => {
    const top = document.getElementById('fv-website-top');
    if (!top || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting || entry.boundingClientRect.top >= 0) return;
      // Scrolled past the top field once: on for good.
      setSeen(true);
      observer.disconnect();
    });
    observer.observe(top);
    return () => observer.disconnect();
  }, []);

  const shown = seen && !closed && !overlayOpen;

  const close = () => {
    setClosed(true);
    try {
      sessionStorage.setItem(STICKY_CLOSED_KEY, '1');
    } catch {
      // Storage blocked: closed for this page view only.
    }
  };

  const backToTop = () => {
    const input = document.getElementById('fv-website-top') as HTMLInputElement | null;
    if (!input) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    input.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
    // Focus inside the same tap, so a phone opens its keyboard at once.
    input.focus({ preventScroll: true });
  };

  return (
    <aside className={cn(styles.sticky, shown && styles.stickyOn)} aria-label={STICKY.label} aria-hidden={!shown} inert={!shown}>
      <div className={styles.stickyIn}>
        <Image className={styles.stickyPhoto} src={STICKY.photo.src} width={STICKY.photo.width} height={STICKY.photo.height} alt="" sizes="(min-width: 900px) 124px, 80px" />
        <div className={styles.stickyText}>
          <p className={styles.stickyTitle}>{STICKY.title}</p>
          <p className={styles.stickySub}>{STICKY.text}</p>
        </div>
        <div className={styles.stickyForm}>
          <WebsiteForm form="sticky" />
        </div>
        <button type="button" className={cn(styles.btn, styles.stickyStart)} onClick={backToTop}>
          {STICKY.start} <span aria-hidden="true">→</span>
        </button>
        <button type="button" className={styles.stickyClose} aria-label={STICKY.close} onClick={close}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </aside>
  );
}
