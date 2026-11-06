'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import {
  CLARITY_ID,
  GA_MEASUREMENT_ID,
  resultToken,
  startTracking,
  trackResultState,
  updateTrackedPage,
  type TrackingStart,
} from '@/lib/free-video/analytics';
import { rememberLeadToken } from '@/lib/free-video/lead-cookie';

/** Microsoft's standard Clarity snippet (the queue, then the tag script) for a checked project id. */
const claritySnippet = (projectId: string) =>
  `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${projectId}");`;

/** The status query of a result page: FreeVideoStatus (free-video-status.tsx) keeps its view under ['free-video', token]. */
const STATUS_QUERY = 'free-video';

interface FunnelTrackingProps {
  /** CLARITY_PROJECT_ID from config.ts, passed by the funnel layout. Empty: no Clarity. */
  clarityProjectId: string;
}

/**
 * Google Analytics 4 (the opt-in page) and Microsoft Clarity (the opt-in page and the result pages) for the funnel (the
 * funnel layout renders it next to MetaPixel, on every funnel page; on the others it loads nothing). What may load is
 * decided in the browser, a tick after mount (the landing page has taken ?website= out of the address by then):
 * lib/free-video/analytics.ts has the rules. A page change away from the opt-in page turns Google Analytics off for the
 * rest of the page load; one away from the opt-in page and the result pages turns Clarity off too. On a result page,
 * Clarity's funnel_step follows the page's own view ('making', then 'ready'), read from the status query the page
 * already runs (no second request).
 */
export function FunnelTracking({ clarityProjectId }: FunnelTrackingProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [started, setStarted] = useState<TrackingStart | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setStarted(startTracking(clarityProjectId)), 0);
    return () => window.clearTimeout(timer);
  }, [clarityProjectId]);

  useEffect(() => {
    if (started) updateTrackedPage(pathname);
  }, [started, pathname]);

  // The free website check on bluefx.net's OTO3 page finds this buyer by this cookie (lead-cookie.ts).
  useEffect(() => {
    rememberLeadToken(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!started?.clarity) return;
    const token = resultToken(pathname);
    if (!token) return;
    const report = () => {
      try {
        const view = queryClient.getQueryData<{ state?: unknown }>([STATUS_QUERY, token]);
        if (typeof view?.state === 'string') trackResultState(view.state);
      } catch {
        // Measurement must never break the page.
      }
    };
    report();
    return queryClient.getQueryCache().subscribe((event) => {
      const [name, key] = event.query.queryKey;
      if (name === STATUS_QUERY && key === token) report();
    });
  }, [started, pathname, queryClient]);

  if (started?.mode !== 'live') return null;
  return (
    <>
      {started.ga && <Script id="fv-ga" src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />}
      {started.clarity && CLARITY_ID.test(clarityProjectId) && (
        <Script id="fv-clarity" strategy="afterInteractive">
          {claritySnippet(clarityProjectId)}
        </Script>
      )}
    </>
  );
}
