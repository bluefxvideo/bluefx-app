'use client';

import { OFFER_COPY, OFFER_READY } from '@/lib/free-video/copy';
import { claimUrl, goUrl, PHANTOM_PATH, type PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import { SALES_PAGE } from '@/lib/free-video/sales-page';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';
import { OfferButton } from './offer-button';
import { useDeadline } from './sales-page-media';
import { StyleReel } from './style-reel';

interface LifetimeOfferProps {
  /** The ClickBank tid of this page: fvthank on the thank-you page, fvpage on /v/<token>, fvland under the form's refusal. */
  placement: (typeof PAGE_PLACEMENTS)[number];
  token: string;
  isCustomer: boolean;
  /**
   * ready: the short offer beside the finished video ad, which links down to the whole sales page under it (OfferDetails).
   * upgrade: "Make 100+ video ads a year yourself" under the form's "one free video ad per business" refusal. Nothing
   * offers anything while the video ad is made (owner 2026-10-08: only "once the result is visible").
   */
  variant: 'ready' | 'upgrade';
  /** ready: the end of the 3-day bonus (the view's cleanUntil), while it runs. */
  cleanUntil?: string;
}

/**
 * Offer 2: AI Media Machine lifetime, through /go/<placement> (logs the click, then ClickBank).
 * Existing customers and buyers get the AI Media Machine instead: under a finished video ad, a button that puts this
 * video ad in their account (/go/claim); a customer the email did not match finds the same link under the offer. No hooks of its own (StyleReel and
 * OfferButton are client components), so it renders in server and client trees.
 */
export function LifetimeOffer({ placement, token, isCustomer, variant, cleanUntil }: LifetimeOfferProps) {
  const claimable = variant === 'ready' && Boolean(token);
  const when = useDeadline(cleanUntil);
  if (isCustomer) {
    return (
      <div className={styles.offer}>
        <h2 className={styles.offerTitle}>{OFFER_COPY.customerTitle}</h2>
        <p className={styles.offerText}>{claimable ? OFFER_COPY.customerBodyReady : OFFER_COPY.customerBody}</p>
        <a className={cn(styles.btn, styles.btnBlue)} href={claimable ? claimUrl(token) : PHANTOM_PATH}>
          {claimable ? OFFER_COPY.customerButtonReady : OFFER_COPY.customerButton}
        </a>
      </div>
    );
  }

  const ready = variant === 'ready';
  return (
    <div className={cn(styles.offer, styles.offerPrimary)}>
      {/* One offer on the ready page, so no "best value" tag there (the $99 offer is gone). */}
      {!ready && <span className={styles.tag}>{OFFER_COPY.tag}</span>}
      <h2 className={styles.offerTitle}>{ready ? (cleanUntil ? OFFER_READY.heading : OFFER_READY.headingLater) : OFFER_COPY.headingUpgrade}</h2>
      <p className={styles.offerText}>{ready ? OFFER_READY.body : OFFER_COPY.bodyUpgrade}</p>
      {/* The ready page shows the styles and everything else in the sales page under the video ad. */}
      {!ready && <StyleReel />}
      {!ready && (
        <ul className={styles.ticks}>
          {OFFER_COPY.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      )}
      <p className={styles.price}>
        <s className={styles.priceWas}>
          <span className={styles.srOnly}>{OFFER_COPY.wasLabel} </span>
          {OFFER_COPY.was}
        </s>
        <b className={styles.priceNow}>
          <span className={styles.srOnly}>{OFFER_COPY.nowLabel} </span>
          {OFFER_COPY.now}
        </b>
        <span className={styles.priceUnit}>{OFFER_COPY.unit}</span>
        <span className={styles.priceOff}>{OFFER_COPY.off}</span>
      </p>
      {ready && <p className={styles.offerPerVideo}>{OFFER_READY.perVideo}</p>}
      {/* The 3-day bonus, named and valued; the exact end appears once the browser knows its time zone. */}
      {ready && cleanUntil && (
        <div className={styles.offerBonus}>
          <p className={styles.offerBonusTitle}>{OFFER_READY.bonusTitle}</p>
          <p className={styles.offerBonusLine}>{when ? OFFER_READY.bonusLine(when) : OFFER_READY.bonusLineSoon}</p>
        </div>
      )}
      {/* A new tab, so this page keeps checking on the video ad. The click is the pixel's InitiateCheckout. */}
      <OfferButton className={styles.btn} href={goUrl(placement, token)}>
        {OFFER_COPY.button}
      </OfferButton>
      <p className={styles.fine}>{ready ? OFFER_READY.fine : OFFER_COPY.smallPrint}</p>
      {ready && (
        <p className={styles.fine}>
          <a className={styles.link} href={`#${SALES_PAGE.anchor}`}>
            {OFFER_READY.seeAll}
          </a>
        </p>
      )}
    </div>
  );
}
