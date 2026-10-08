'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { META_PIXEL_ID, pixelMode } from '@/lib/free-video/pixel';

/** Meta's standard base code (fbevents.js), then init and the PageView. Later page changes inside the app count as PageViews by themselves. */
const BASE_CODE = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`;

/** The debug stand-in: every call goes to the console, nothing leaves the browser. */
const DEBUG_CODE = `window.fbq=window.fbq||function(){console.log('[fbq]',...arguments)};fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`;

/**
 * The BlueFx pixel on every funnel page (the layout renders it). Decided after mount, in the browser: only on
 * app.bluefx.net and never for a visitor whose time zone is in Europe (see pixel.ts); the localStorage flag
 * fv_pixel_debug=1 logs the calls instead (local checks).
 */
export function MetaPixel() {
  const [mode, setMode] = useState<'live' | 'debug' | null>(null);

  useEffect(() => {
    setMode(pixelMode());
  }, []);

  if (!mode) return null;
  return (
    <Script id="fv-meta-pixel" strategy="afterInteractive">
      {mode === 'live' ? BASE_CODE : DEBUG_CODE}
    </Script>
  );
}
