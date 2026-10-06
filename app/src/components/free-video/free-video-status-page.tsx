import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { cache } from 'react';
import { STATUS } from '@/lib/free-video/copy';
import { getLeadByToken, markViewed, readSettings, toView } from '@/lib/free-video/leads';
import type { PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import { cn } from '@/lib/utils';
import { FREE_VIDEO_TOKEN_PATTERN, type FreeVideoView } from '@/types/free-video';
import { FreeVideoStatus } from './free-video-status';
import styles from './free-video.module.css';

/** The lead behind a view token, read once per request (a page and its metadata share it). Throws on a database error. */
export const loadLead = cache(async (token: string) => (FREE_VIDEO_TOKEN_PATTERN.test(token) ? getLeadByToken(token) : null));

interface FreeVideoStatusPageProps {
  token: string;
  /** fvthank: the thank-you page right after the form. fvpage: /v/<token>, the link in the email. */
  placement: (typeof PAGE_PLACEMENTS)[number];
}

/**
 * Server side of both status pages: reads the lead, renders the first view (so the first paint shows
 * the visitor's name and domain) and hands over to the polling client component. An unknown token is a
 * 404. On /v/ the first visit is recorded after the response (the email click-through metric).
 */
export async function FreeVideoStatusPage({ token, placement }: FreeVideoStatusPageProps) {
  const pagePath = placement === 'fvpage' ? `/v/${token}` : `/free-video-ad/thanks/${token}`;

  let lead: Awaited<ReturnType<typeof loadLead>>;
  try {
    lead = await loadLead(token);
  } catch (error) {
    console.error('❌ [free-video] Status page could not read the lead:', error);
    return <LoadError pagePath={pagePath} />;
  }
  if (!lead) notFound();

  let view: FreeVideoView;
  try {
    view = await toView(lead, await readSettings());
  } catch (error) {
    console.error('❌ [free-video] Status page could not build the view:', error);
    return <LoadError pagePath={pagePath} />;
  }

  if (placement === 'fvpage') {
    const viewed = lead;
    after(() => markViewed(viewed));
  }
  return <FreeVideoStatus token={token} initial={view} placement={placement} />;
}

interface LoadErrorProps {
  pagePath: string;
}

/** A database hiccup: a calm message and a reload button instead of the error page. */
function LoadError({ pagePath }: LoadErrorProps) {
  return (
    <>
      <div className={styles.band}>
        <div className={cn(styles.wrap, styles.narrow)}>
          <h1 className={styles.bandTitle}>{STATUS.loadErrorTitle}</h1>
        </div>
      </div>
      <section className={styles.sectionLight}>
        <div className={cn(styles.wrap, styles.narrow)}>
          <div className={styles.box}>
            <p className={styles.boxText}>{STATUS.loadError}</p>
            <a className={cn(styles.btn, styles.boxAction)} href={pagePath}>
              {STATUS.reload}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
