'use client';

import type { ReactNode } from 'react';
import { newCheckoutEventId, PIXEL_DATA, trackPixel, withCheckoutEventId } from '@/lib/free-video/pixel';

interface OfferButtonProps {
  /** The /go/<placement> link of the lifetime offer. */
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * The lifetime offer's button: a click is an InitiateCheckout for the pixel, and the same event id rides along to /go as
 * ?e=, so the server's Conversions API event and this one count once. Opens a new tab, so the page (and the pixel's
 * request) keeps going while the visitor reads the offer.
 */
export function OfferButton({ href, className, children }: OfferButtonProps) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        const eventId = newCheckoutEventId();
        trackPixel('InitiateCheckout', PIXEL_DATA.checkout, eventId);
        event.currentTarget.href = withCheckoutEventId(href, eventId);
      }}
    >
      {children}
    </a>
  );
}
