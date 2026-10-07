import { OFFER_COPY } from '@/lib/free-video/copy';
import { goUrl, PHANTOM_PATH, type PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';
import { StyleReel } from './style-reel';

interface LifetimeOfferProps {
  /** The ClickBank tid of this page: fvthank on the thank-you page, fvpage on /v/<token>, fvland under the form's refusal. */
  placement: (typeof PAGE_PLACEMENTS)[number];
  token: string;
  isCustomer: boolean;
  /**
   * waiting: "Make 100+ video ads a year yourself" while the video ad is made. ready: the main offer under the finished
   * video ad. upgrade: the same card under the form's "one free video ad per business" refusal.
   */
  variant: 'waiting' | 'ready' | 'upgrade';
}

/**
 * Offer 2: AI Media Machine lifetime, through /go/<placement> (logs the click, then ClickBank).
 * Existing customers get "Open The Phantom" instead. No hooks of its own (StyleReel is a client component), so it
 * renders in server and client trees.
 */
export function LifetimeOffer({ placement, token, isCustomer, variant }: LifetimeOfferProps) {
  if (isCustomer) {
    return (
      <div className={styles.offer}>
        <h2 className={styles.offerTitle}>{OFFER_COPY.customerTitle}</h2>
        <p className={styles.offerText}>{OFFER_COPY.customerBody}</p>
        <a className={cn(styles.btn, styles.btnBlue)} href={PHANTOM_PATH}>
          {OFFER_COPY.customerButton}
        </a>
      </div>
    );
  }

  const waiting = variant === 'waiting';
  const upgrade = variant === 'upgrade';
  return (
    <div className={cn(styles.offer, !waiting && styles.offerPrimary)}>
      {!waiting && <span className={styles.tag}>{OFFER_COPY.tag}</span>}
      <h2 className={styles.offerTitle}>{waiting ? OFFER_COPY.headingWaiting : upgrade ? OFFER_COPY.headingUpgrade : OFFER_COPY.heading}</h2>
      <p className={styles.offerText}>{waiting ? OFFER_COPY.bodyWaiting : upgrade ? OFFER_COPY.bodyUpgrade : OFFER_COPY.body}</p>
      <StyleReel />
      <ul className={styles.ticks}>
        {OFFER_COPY.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
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
      {/* The anchor compares with the $99 clean video ad, which only the ready page offers. */}
      {variant === 'ready' && <p className={styles.offerText}>{OFFER_COPY.anchor}</p>}
      {/* A new tab, so this page keeps checking on the video ad. */}
      <a className={cn(styles.btn, waiting && styles.btnBlue)} href={goUrl(placement, token)} target="_blank" rel="noopener noreferrer">
        {OFFER_COPY.button}
      </a>
      <p className={styles.fine}>{OFFER_COPY.smallPrint}</p>
    </div>
  );
}
