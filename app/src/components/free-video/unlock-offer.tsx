import { UNLOCK_COPY } from '@/lib/free-video/copy';
import { cn } from '@/lib/utils';
import type { FreeVideoUnlockView } from '@/types/free-video';
import styles from './free-video.module.css';

interface UnlockOfferProps {
  unlock: FreeVideoUnlockView;
  domain: string;
  /** /go/fvunlock?t=<token>: logs the click, then the FastSpring checkout. */
  checkoutPath: string;
  /** The checkout was opened in a new tab: this page now waits for the payment. */
  clicked: boolean;
  onCheckout: () => void;
  onDownload: () => void;
}

/**
 * Offer 1 on the ready page, in each unlock state: the clean video ad (no watermark) for a one-time
 * price, then "payment received", then the clean download. Nothing shows while the state is
 * 'unavailable' (the free video ad is not ready, or the unlock is switched off).
 */
export function UnlockOffer({ unlock, domain, checkoutPath, clicked, onCheckout, onDownload }: UnlockOfferProps) {
  switch (unlock.state) {
    case 'available':
      return (
        <div className={cn(styles.offer, styles.offerPrimary)}>
          <span className={styles.tag}>{UNLOCK_COPY.tag}</span>
          <h2 className={styles.offerTitle}>{UNLOCK_COPY.title}</h2>
          <p className={styles.offerText}>{UNLOCK_COPY.body(domain)}</p>
          <p className={styles.price}>
            <b className={styles.priceNow}>{UNLOCK_COPY.price}</b>
            <span className={styles.priceUnit}>{UNLOCK_COPY.priceUnit}</span>
          </p>
          {/* A new tab, so this page keeps checking and shows the clean video ad once the payment arrives. */}
          <a className={styles.btn} href={checkoutPath} target="_blank" rel="noopener noreferrer" onClick={onCheckout}>
            {UNLOCK_COPY.button}
          </a>
          {clicked && (
            <p className={cn(styles.note, styles.noteBelow)} role="status">
              {UNLOCK_COPY.afterClick}
            </p>
          )}
          <p className={styles.fine}>{UNLOCK_COPY.fine}</p>
        </div>
      );
    case 'paid':
    case 'rendering':
      return (
        <div className={cn(styles.offer, styles.offerPrimary)} role="status">
          <div className={styles.offerStatus}>
            <span className={styles.dot} aria-hidden="true" />
            <div>
              <h2 className={styles.offerTitle}>{UNLOCK_COPY.paidTitle}</h2>
              <p className={styles.offerText}>{UNLOCK_COPY.paidBody}</p>
            </div>
          </div>
          <p className={styles.fine}>{UNLOCK_COPY.paidFine}</p>
        </div>
      );
    case 'ready':
      return (
        <div className={cn(styles.offer, styles.offerPrimary)} role="status">
          <h2 className={styles.offerTitle}>{UNLOCK_COPY.readyTitle}</h2>
          <p className={styles.offerText}>{UNLOCK_COPY.readyBody}</p>
          {unlock.cleanDownloadUrl && (
            <a className={styles.btn} href={unlock.cleanDownloadUrl} onClick={onDownload}>
              {UNLOCK_COPY.readyButton}
            </a>
          )}
          <p className={styles.fine}>{UNLOCK_COPY.readyFine}</p>
        </div>
      );
    case 'failed':
      return (
        <div className={cn(styles.offer, styles.offerPrimary)} role="status">
          <h2 className={styles.offerTitle}>{UNLOCK_COPY.failedTitle}</h2>
          <p className={styles.offerText}>{UNLOCK_COPY.failedBody}</p>
        </div>
      );
    default:
      return null;
  }
}
