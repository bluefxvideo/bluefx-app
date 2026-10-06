'use client';

import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PLAYER } from '@/lib/free-video/copy';
import styles from './free-video.module.css';

interface VideoAdPlayerProps {
  src: string;
  label: string;
  /** The visitor turned the sound on (the video_play event). */
  onPlayWithSound?: () => void;
  /** The video ad played to the end with sound (the video_complete event). */
  onComplete?: () => void;
}

type PlayerMode = 'muted' | 'blocked' | 'sound';

/**
 * The visitor's own video ad, in place: it plays muted and looped while on screen, and a big
 * "Tap for sound" button restarts the video ad with sound and the normal controls. When the phone
 * blocks even muted autoplay (Low Power Mode), the same button says "Play the video ad".
 */
export function VideoAdPlayer({ src, label, onPlayWithSound, onComplete }: VideoAdPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const withSound = useRef(false);
  const completed = useRef(false);
  const [mode, setMode] = useState<PlayerMode>('muted');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Set before play(): browsers only autoplay a muted video.
    video.muted = true;
    const play = () => {
      if (withSound.current) return;
      video.play().catch(() => setMode((current) => (current === 'sound' ? current : 'blocked')));
    };
    if (typeof IntersectionObserver === 'undefined') {
      play();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (withSound.current) return;
        if (entry.isIntersecting) play();
        else video.pause();
      },
      { threshold: 0.4 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const playWithSound = () => {
    const video = videoRef.current;
    if (!video) return;
    withSound.current = true;
    video.loop = false;
    video.muted = false;
    video.currentTime = 0;
    setMode('sound');
    // Inside the tap, so the browser allows sound.
    void video.play().catch(() => undefined);
    onPlayWithSound?.();
  };

  return (
    <div className={styles.phone}>
      <video
        ref={videoRef}
        className={styles.phoneVideo}
        // #t=0.001 makes Safari paint the first frame before playback starts.
        src={`${src}#t=0.001`}
        muted={mode !== 'sound'}
        loop={mode !== 'sound'}
        controls={mode === 'sound'}
        playsInline
        preload="metadata"
        aria-label={label}
        onEnded={() => {
          if (!withSound.current || completed.current) return;
          completed.current = true;
          onComplete?.();
        }}
        onError={() => setFailed(true)}
      />
      {failed ? (
        <p className={styles.playerMessage} role="alert">
          {PLAYER.loadError}
        </p>
      ) : (
        mode !== 'sound' && (
          <button type="button" className={styles.soundBtn} onClick={playWithSound}>
            <Volume2 aria-hidden="true" size={18} strokeWidth={2.25} />
            {mode === 'blocked' ? PLAYER.play : PLAYER.soundOn}
          </button>
        )
      )}
    </div>
  );
}
