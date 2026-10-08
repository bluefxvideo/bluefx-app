import { PAYMENT_TRUST } from '@/lib/free-video/copy';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';

interface PaymentTrustProps {
  /** On the navy closing band. */
  dark?: boolean;
}

/**
 * The card logos and the guarantee under an offer button, copied from the lifetime page's price box (the same inline
 * badges, the same words). A thin frame keeps the white badges visible on this page's light background.
 */
export function PaymentTrust({ dark = false }: PaymentTrustProps) {
  return (
    <div className={cn(styles.trust, dark && styles.trustDark)}>
      <div className={styles.trustCards} role="img" aria-label={PAYMENT_TRUST.cardsLabel}>
        <svg width="48" height="30" viewBox="0 0 48 30" aria-hidden="true">
          <rect width="48" height="30" rx="4" fill="#ffffff" />
          <text x="24" y="20" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="bold" fontStyle="italic" fill="#1a1f71" textAnchor="middle">
            VISA
          </text>
        </svg>
        <svg width="48" height="30" viewBox="0 0 48 30" aria-hidden="true">
          <rect width="48" height="30" rx="4" fill="#ffffff" />
          <circle cx="20" cy="15" r="8" fill="#eb001b" />
          <circle cx="28" cy="15" r="8" fill="#f79e1b" fillOpacity="0.85" />
        </svg>
        <svg width="48" height="30" viewBox="0 0 48 30" aria-hidden="true">
          <rect width="48" height="30" rx="4" fill="#2e77bc" />
          <text x="24" y="19" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="bold" fill="#ffffff" textAnchor="middle">
            AMEX
          </text>
        </svg>
        <svg width="56" height="30" viewBox="0 0 56 30" aria-hidden="true">
          <rect width="56" height="30" rx="4" fill="#ffffff" />
          <text x="25" y="18.5" fontFamily="Arial, sans-serif" fontSize="7.5" fontWeight="bold" fill="#231f20" textAnchor="middle">
            DISCOVER
          </text>
          <circle cx="47" cy="15" r="3.5" fill="#f76e20" />
        </svg>
        <svg width="56" height="30" viewBox="0 0 56 30" aria-hidden="true">
          <rect width="56" height="30" rx="4" fill="#ffffff" />
          <text x="28" y="19.5" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="bold" fontStyle="italic" textAnchor="middle">
            <tspan fill="#003087">Pay</tspan>
            <tspan fill="#009cde">Pal</tspan>
          </text>
        </svg>
      </div>
      <p className={styles.trustGuarantee}>
        {PAYMENT_TRUST.guarantee[0]}
        <strong>{PAYMENT_TRUST.guarantee[1]}</strong>
        {PAYMENT_TRUST.guarantee[2]}
      </p>
    </div>
  );
}
