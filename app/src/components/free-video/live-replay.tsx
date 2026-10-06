'use client';

import { useEffect, useState } from 'react';
import { LIVE_DEMO, LIVE_DEMO_DOMAIN, LIVE_DEMO_VIDEO } from '@/lib/free-video/live-demo';
import { unlockGoUrl } from '@/lib/free-video/offer';
import type { FreeVideoView } from '@/types/free-video';
import { FreeVideoStatus } from './free-video-status';
import styles from './free-video.module.css';

const TOKEN = 'previewlivereplayxxxxx';
const base: Omit<FreeVideoView, 'state'> = {
  firstName: 'Joe',
  domain: LIVE_DEMO_DOMAIN,
  isCustomer: false,
  unlock: { state: 'unavailable', checkoutPath: unlockGoUrl(TOKEN) },
};

/** The real run's steps, sped up (seconds on this page; the real run took 205). */
function viewAt(second: number): FreeVideoView {
  if (second < 3) return { ...base, state: 'making', step: 'reading', live: {} };
  if (second < 9) return { ...base, state: 'making', step: 'directing', live: LIVE_DEMO.photos };
  if (second < 14) return { ...base, state: 'making', step: 'producing', live: LIVE_DEMO.script };
  if (second < 18) return { ...base, state: 'making', step: 'producing', live: LIVE_DEMO.music };
  if (second < 21) return { ...base, state: 'making', step: 'producing', live: LIVE_DEMO.clips };
  if (second < 30) return { ...base, state: 'making', step: 'rendering', progress: Math.round(((second - 21) / 9) * 100), live: LIVE_DEMO.clips };
  if (second < 33) return { ...base, state: 'making', step: 'finishing', live: LIVE_DEMO.clips };
  return {
    ...base,
    state: 'ready',
    videoUrl: LIVE_DEMO_VIDEO,
    downloadUrl: LIVE_DEMO_VIDEO,
    unlock: { state: 'available', checkoutPath: unlockGoUrl(TOKEN) },
  };
}

/** Dev preview: the live page playing a real run, with a restart button. */
export function LiveReplay() {
  const [start, setStart] = useState(() => Date.now());
  const [second, setSecond] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSecond((Date.now() - start) / 1000), 500);
    return () => window.clearInterval(timer);
  }, [start]);
  const view = viewAt(second);
  return (
    <>
      <div className={styles.replayBar}>
        <span>Replay of a real run (joespizzanyc.com), sped up: {Math.min(33, Math.floor(second))} s</span>
        <button
          type="button"
          onClick={() => {
            setStart(Date.now());
            setSecond(0);
            window.scrollTo({ top: 0 });
          }}
        >
          Restart
        </button>
      </div>
      <FreeVideoStatus key={view.state} token={TOKEN} initial={view} placement="fvthank" demo={{}} />
    </>
  );
}
