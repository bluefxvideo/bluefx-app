'use client';

import { type ReactNode, useEffect } from 'react';
import { CHECKOUT_EVENT_PARAM, newCheckoutEventId, PIXEL_DATA, trackPixel, withCheckoutEventId } from '@/lib/free-video/pixel';

interface OfferButtonProps {
  /** The /go/<placement> link of the lifetime offer. */
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * The lifetime offer's button: a click is an InitiateCheckout for the pixel, and the same event id rides along to /go as
 * ?e=, so the server's Conversions API event and this one count once. Opens a new tab, so the page (and the pixel's
 * request) keeps going while the visitor reads the offer. ClickBank's script (clickbank-tracking.tsx) appends the
 * affiliate's hop to the link: the click keeps the link as it is by then, and a button that appears after the script
 * ran (the video ad just finished) asks the script for its hop again (finishHop).
 */
export function OfferButton({ href, className, children }: OfferButtonProps) {
  useEffect(() => {
    try {
      (window as Window & { finishHop?: () => void }).finishHop?.();
    } catch {
      // Attribution never breaks a button.
    }
  }, []);
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        const eventId = newCheckoutEventId();
        trackPixel('InitiateCheckout', PIXEL_DATA.checkout, eventId);
        const current = new URL(event.currentTarget.href, window.location.href);
        current.searchParams.delete(CHECKOUT_EVENT_PARAM);
        event.currentTarget.href = withCheckoutEventId(current.toString(), eventId);
      }}
    >
      {children}
    </a>
  );
}
