'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { CLARITY_ID, GA_MEASUREMENT_ID, startTracking, updateTrackedPage, type TrackingStart } from '@/lib/free-video/analytics';

/** Microsoft's standard Clarity snippet (the queue, then the tag script) for a checked project id. */
const claritySnippet = (projectId: string) =>
  `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${projectId}");`;

interface FunnelTrackingProps {
  /** CLARITY_PROJECT_ID from config.ts, passed by the funnel layout. Empty: no Clarity. */
  clarityProjectId: string;
}

/**
 * Google Analytics 4 and Microsoft Clarity for the opt-in page (the funnel layout renders it next to MetaPixel, on
 * every funnel page; on the others it loads nothing). What may load is decided in the browser, a tick after mount (the
 * landing page has taken ?website= out of the address by then): lib/free-video/analytics.ts has the rules. A page change
 * away from the opt-in page turns both off for the rest of the page load.
 */
export function FunnelTracking({ clarityProjectId }: FunnelTrackingProps) {
  const pathname = usePathname();
  const [started, setStarted] = useState<TrackingStart | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setStarted(startTracking(clarityProjectId)), 0);
    return () => window.clearTimeout(timer);
  }, [clarityProjectId]);

  useEffect(() => {
    if (started) updateTrackedPage(pathname);
  }, [started, pathname]);

  if (started?.mode !== 'live') return null;
  return (
    <>
      <Script id="fv-ga" src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      {started.clarity && CLARITY_ID.test(clarityProjectId) && (
        <Script id="fv-clarity" strategy="afterInteractive">
          {claritySnippet(clarityProjectId)}
        </Script>
      )}
    </>
  );
}
