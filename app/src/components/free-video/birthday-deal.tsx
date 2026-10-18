import Image from 'next/image';

import { READY_NEXT } from '@/lib/free-video/copy';
import { SALES_PAGE } from '@/lib/free-video/sales-page';
import styles from './free-video.module.css';

/**
 * The deal, said the sales page's way: my photo and name over the red "94.62% OFF" badge and the 40th-birthday line
 * (owner 2026-10-18: "a picture with me and my name, since we say my birthday"). On the result page above the top
 * button, and in the form's "one free video ad per business" box, both of which open the sales page.
 */
export function BirthdayDeal() {
  return (
    <div className={styles.readyDeal}>
      <Image className={styles.readyDealFace} src={SALES_PAGE.founder.photo} alt={SALES_PAGE.founder.name} width={600} height={600} sizes="56px" />
      <div>
        <p className={styles.readyDealName}>{READY_NEXT.founderLabel}</p>
        <p className={styles.readyDealText}>
          <span className={styles.readyBadge}>{READY_NEXT.badge}</span> {READY_NEXT.badgeText}
        </p>
      </div>
    </div>
  );
}
