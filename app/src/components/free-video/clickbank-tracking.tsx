'use client';

import { useEffect } from 'react';
import { CLICKBANK_HOST, CLICKBANK_SCRIPT_URL, CLICKBANK_VENDOR } from '@/lib/free-video/clickbank';

const SCRIPT_ID = 'fv-clickbank-hop';

/**
 * ClickBank's script puts ?hopId= in the address with history.pushState("", "", url): a string state, which Next's
 * patched pushState throws on (the console says "Browser version does not allow adding query params" and the address
 * keeps no hopId; seen live 2026-10-09). An object state goes through, and the router follows the new address without
 * a reload, so the form keeps its state. Installed a tick after mount: React runs this component's effect before the
 * app router's, which installs Next's patch, and a wrapper put in first ends up under the patch instead of over it
 * (seen live 2026-10-09 too).
 */
function allowStringState() {
  const history = window.history;
  const original = history.pushState.bind(history);
  history.pushState = (state: unknown, unused: string, url?: string | URL | null) =>
    original(state && typeof state === 'object' ? state : {}, unused, url);
}

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
    if (typeof window === 'undefined' || window.location.hostname !== CLICKBANK_HOST) return;
    const timer = window.setTimeout(() => {
      try {
        if (document.getElementById(SCRIPT_ID)) return;
        allowStringState();
        (window as Window & { clickbank?: { vendor: string } }).clickbank = { vendor: CLICKBANK_VENDOR };
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = CLICKBANK_SCRIPT_URL;
        script.async = true;
        document.head.appendChild(script);
      } catch {
        // Attribution never breaks a page.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
