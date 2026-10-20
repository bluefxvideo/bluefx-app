'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { useFreeVideoBeacon } from '@/hooks/use-free-video-beacon';
import { cn } from '@/lib/utils';
import styles from './result-page.module.css';

/**
 * The chat bubble on the result page (owner 2026-10-20: "a sort of chat bubble thing, so people can ask questions";
 * he answers himself, in Crisp's phone app). Crisp's own launcher stays hidden: the page shows Szilard's face instead,
 * above the buy bar on a phone. Crisp loads a few seconds after the page so the video ad starts first; a click before
 * that loads it at once (Crisp runs the queued commands when its script arrives). Each chat carries the lead's first
 * name and website, so he knows who is asking; when he is offline, Crisp asks the visitor for an email.
 */
const CRISP_WEBSITE_ID = '72ac9323-35c3-495a-aa73-6918565d892f';
const LOAD_AFTER_MS = 3000;

type CrispQueue = unknown[];
declare global {
  interface Window {
    $crisp?: CrispQueue;
    CRISP_WEBSITE_ID?: string;
  }
}

let loading = false;

function crisp(): CrispQueue {
  if (!window.$crisp) window.$crisp = [];
  return window.$crisp;
}

function loadCrisp(firstName: string, domain: string) {
  if (loading) return;
  loading = true;
  const queue = crisp();
  window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;
  queue.push(['do', 'chat:hide']);
  queue.push(['on', 'chat:closed', () => crisp().push(['do', 'chat:hide'])]);
  // his reply shows even when the visitor had closed the chat
  queue.push(['on', 'message:received', () => crisp().push(['do', 'chat:show'])]);
  if (firstName) queue.push(['set', 'user:nickname', [firstName]]);
  queue.push(['set', 'session:data', [[['website', domain], ['video_ad_page', window.location.origin + window.location.pathname]]]]);
  queue.push(['set', 'session:segments', [['free-video-ad']]]);
  const script = document.createElement('script');
  script.src = 'https://client.crisp.chat/l.js';
  script.async = true;
  document.head.appendChild(script);
}

interface ChatLauncherProps {
  token: string;
  firstName: string;
  domain: string;
  /** The buy bar is showing at the bottom of a phone's screen: sit above it. */
  raised: boolean;
}

export function ChatLauncher({ token, firstName, domain, raised }: ChatLauncherProps) {
  const beacon = useFreeVideoBeacon(token);

  useEffect(() => {
    const id = window.setTimeout(() => loadCrisp(firstName, domain), LOAD_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [firstName, domain]);

  const open = () => {
    loadCrisp(firstName, domain);
    crisp().push(['do', 'chat:show']);
    crisp().push(['do', 'chat:open']);
    beacon('chat_open');
  };

  return (
    <button type="button" className={cn(styles.chat, raised && styles.chatRaised)} onClick={open} aria-label="Questions? Chat with Szilard">
      <span className={styles.chatFace}>
        <Image src="/free-video/owner.jpg" alt="" width={112} height={112} />
        <span className={styles.chatBadge} aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24">
            <path d="M4 5h16v10H9l-5 4z" fill="#ffffff" />
          </svg>
        </span>
      </span>
      <span className={styles.chatLabel}>Questions? Ask me</span>
    </button>
  );
}
