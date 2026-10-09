import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import type { ReactNode } from 'react';
import styles from '@/components/free-video/free-video.module.css';
import { ClickBankTracking } from '@/components/free-video/clickbank-tracking';
import { MetaPixel } from '@/components/free-video/meta-pixel';
import { LAYOUT, SUPPORT_EMAIL } from '@/lib/free-video/copy';

/**
 * The public free video ad funnel (/free-video-ad, its thank-you page and /v/<token>). noindex for the
 * whole list test: the landing page becomes indexable when bot protection (Turnstile) ships.
 * No Open Graph tags: the status pages carry a visitor's domain, and the landing page sets its own.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'strict-origin-when-cross-origin',
  openGraph: null,
  twitter: null,
};

/** Pinch zoom stays on (the app's root viewport turns it off); the phone's browser bar takes the header's navy. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#143d70',
};

interface FunnelLayoutProps {
  children: ReactNode;
}

/**
 * The root layout forces the app's dark theme, so this layout paints its own light page: every color
 * comes from free-video.module.css, never from the shadcn theme tokens. No auth calls. The BlueFx pixel
 * loads here for every funnel page (MetaPixel decides in the browser whether it may), and so does ClickBank's
 * attribution script (ClickBankTracking, live site only).
 */
export default function FunnelLayout({ children }: FunnelLayoutProps) {
  return (
    <div className={styles.root}>
      <MetaPixel />
      <ClickBankTracking />
      <header className={styles.header}>
        <div className={styles.headerIn}>
          <Image src="/brand/bluefx-logo-white.png" alt={LAYOUT.logoAlt} width={98} height={34} priority className={styles.logo} />
          <a className={styles.headerHelp} href={`mailto:${SUPPORT_EMAIL}`}>
            {LAYOUT.help} <span className={styles.headerHelpEmail}>{SUPPORT_EMAIL}</span>
          </a>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.footerIn}>
          <span>
            {LAYOUT.questions} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </span>
          <a href={LAYOUT.privacyUrl} target="_blank" rel="noopener noreferrer">
            {LAYOUT.privacy}
          </a>
          <a href={LAYOUT.termsUrl} target="_blank" rel="noopener noreferrer">
            {LAYOUT.terms}
          </a>
          <span>{LAYOUT.copyright}</span>
          <a href={LAYOUT.geoCreditUrl} target="_blank" rel="noopener noreferrer">
            {LAYOUT.geoCredit}
          </a>
        </div>
      </footer>
    </div>
  );
}
