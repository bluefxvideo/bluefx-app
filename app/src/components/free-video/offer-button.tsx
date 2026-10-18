'use client';

import { type ReactNode, useEffect } from 'react';
import { visitorId } from '@/hooks/use-free-video-beacon';
import { trackCheckout } from '@/lib/free-video/analytics';
import { CLICK_VISITOR_PARAM } from '@/lib/free-video/internal-visit';
import { CHECKOUT_EVENT_PARAM, newCheckoutEventId, PIXEL_DATA, trackPixel, withCheckoutEventId } from '@/lib/free-video/pixel';

interface OfferButtonProps {
  /** The /go/<placement> link of the lifetime offer. */
  href: string;
  className?: string;
  children: ReactNode;
  /**
   * false: a link to the AI Media Machine's sales page (a SALES_PAGE_PLACEMENTS link, offer.ts), not the checkout: it
   * opens in the same tab and sends no InitiateCheckout or begin_checkout. The affiliate's hop still goes on the link.
   */
  checkout?: boolean;
}

/**
 * The lifetime offer's button: a click is an InitiateCheckout for the pixel (and, on the opt-in page, a begin_checkout
 * for Google Analytics, analytics.ts), and the pixel's event id rides along to /go as ?e=, so the server's Conversions API event and this one
 * count once. Opens a new tab, so the page (and the pixel's
 * request) keeps going while the visitor reads the offer. ClickBank's script (clickbank-tracking.tsx) appends the
 * affiliate's hop to the link: the click keeps the link as it is by then, and a button that appears after the script
 * ran (the video ad just finished) asks the script for its hop again (finishHop). data-fv-bar-hide: the buy bar on
 * phones (buy-bar.tsx) steps aside while one of these buttons is on screen.
 */
export function OfferButton({ href, className, children, checkout = true }: OfferButtonProps) {
  useEffect(() => {
    try {
      (window as Window & { finishHop?: () => void }).finishHop?.();
    } catch {
      // Attribution never breaks a button.
    }
  }, []);
  if (!checkout) {
    return (
      <a className={className} href={href} data-fv-bar-hide="">
        {children}
      </a>
    );
  }
  return (
    <a
      className={className}
      href={href}
      data-fv-bar-hide=""
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        const eventId = newCheckoutEventId();
        trackPixel('InitiateCheckout', PIXEL_DATA.checkout, eventId);
        trackCheckout(href);
        const current = new URL(event.currentTarget.href, window.location.href);
        current.searchParams.delete(CHECKOUT_EVENT_PARAM);
        // The browser of the click, so the admin numbers can tell the owner's own clicks apart (funnel-stats.ts).
        current.searchParams.set(CLICK_VISITOR_PARAM, visitorId());
        event.currentTarget.href = withCheckoutEventId(current.toString(), eventId);
      }}
    >
      {children}
    </a>
  );
}
