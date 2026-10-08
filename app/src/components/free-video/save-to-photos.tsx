'use client';

import { useEffect, useRef, useState } from 'react';
import { DOWNLOAD } from '@/lib/free-video/copy';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';

interface SaveToPhotosProps {
  /** The video ad file on screen (the free or the clean version). */
  url: string;
  fileName: string;
  /** Dev preview only: show the Save to Photos button on any device that can share files. */
  forceIphone?: boolean;
  /** The Share menu was used (the download event). */
  onSaved?: () => void;
}

type SaveMode = 'none' | 'share';
type SaveStep = 'idle' | 'loading' | 'again';

function isIphoneOrIpad(): boolean {
  const agent = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
}

function canShareVideoFiles(): boolean {
  try {
    const probe = new File([new Blob([''], { type: 'video/mp4' })], 'video-ad.mp4', { type: 'video/mp4' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Getting the video ad into Photos on an iPhone (review finding F7): Safari puts a download in Files,
 * where Instagram, Facebook and TikTok can't find the video ad. iOS 15 and later get a "Save to Photos"
 * button that opens the Share menu with the file (Save Video is in that menu). Where that cannot work (older iPhones, in-app
 * browsers like Facebook's) the button stays away and the Download button is the way: the old how-to about Safari's address
 * bar is gone (owner 2026-10-08: "remove"). Other phones and computers see nothing here: their downloads work as they are.
 */
export function SaveToPhotos({ url, fileName, forceIphone = false, onSaved }: SaveToPhotosProps) {
  const [mode, setMode] = useState<SaveMode>('none');
  const [step, setStep] = useState<SaveStep>('idle');
  const saved = useRef<{ url: string; file: File } | null>(null);

  useEffect(() => {
    if (!forceIphone && !isIphoneOrIpad()) return;
    if (canShareVideoFiles()) setMode('share');
  }, [forceIphone]);

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file] });
      setStep('idle');
      onSaved?.();
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'AbortError') {
        setStep('idle');
      } else if (name === 'NotAllowedError') {
        // The file took longer to load than the tap's permission lasts: one more tap opens the menu.
        setStep('again');
      } else {
        setStep('idle');
        setMode('none');
      }
    }
  };

  const onClick = async () => {
    const ready = saved.current?.url === url ? saved.current.file : null;
    if (ready) {
      await share(ready);
      return;
    }
    setStep('loading');
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error(`The video ad answered ${res.status}`);
      const file = new File([await res.blob()], fileName, { type: 'video/mp4' });
      saved.current = { url, file };
      await share(file);
    } catch {
      setStep('idle');
      setMode('none');
    }
  };

  if (mode === 'none') return null;
  return (
    <div className={styles.btnGap}>
      <button
        type="button"
        className={cn(styles.btn, styles.btnGhost)}
        onClick={onClick}
        disabled={step === 'loading'}
        aria-busy={step === 'loading' || undefined}
      >
        {step === 'loading' ? DOWNLOAD.saveToPhotosBusy : step === 'again' ? DOWNLOAD.saveToPhotosAgain : DOWNLOAD.saveToPhotos}
      </button>
      <p className={styles.fine}>{DOWNLOAD.saveToPhotosHint}</p>
    </div>
  );
}
