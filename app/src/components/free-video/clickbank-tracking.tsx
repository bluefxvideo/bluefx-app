'use client';

import { useEffect } from 'react';
import { CLICKBANK_HOST, CLICKBANK_SCRIPT_URL, CLICKBANK_VENDOR } from '@/lib/free-video/clickbank';

const SCRIPT_ID = 'fv-clickbank-hop';

/**
 * ClickBank's Attribution Tracking Script (Direct Offer Tracking) on every funnel page, as on ai.bluefx.net/lifetime:
 * window.clickbank = { vendor }, then hop.min.js. It registers an affiliate's click from ?affiliate= or ?shield= on the
 * address, sets the vq cookie on .bluefx.net, puts ?hopId= in the address and appends hopId and vq to the page's links,
 * the /go buttons included (clickbank.ts). ClickBank wants it on every page before the order form. Live site only: on
 * another host the script would register hops for the wrong domain, and a bad affiliate value sends the visitor to
 * ClickBank's error page.
 */
export function ClickBankTracking() {
  useEffect(() => {
    try {
      if (window.location.hostname !== CLICKBANK_HOST || document.getElementById(SCRIPT_ID)) return;
      (window as Window & { clickbank?: { vendor: string } }).clickbank = { vendor: CLICKBANK_VENDOR };
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = CLICKBANK_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    } catch {
      // Attribution never breaks a page.
    }
  }, []);
  return null;
}
