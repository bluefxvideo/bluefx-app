'use client';

import { type MouseEvent, type PointerEvent, type SyntheticEvent, useEffect, useRef } from 'react';
import { OFFER_CARD, OFFER_COPY, OFFER_READY } from '@/lib/free-video/copy';
import { cardPlacementOf, goUrl, type PagePlacement } from '@/lib/free-video/offer';
import { SALES_PAGE } from '@/lib/free-video/sales-page';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';
import { OfferButton } from './offer-button';
import { PaymentTrust } from './payment-trust';

interface OfferCardProps {
  open: boolean;
  onClose: () => void;
  /** The result page (fvthank or fvpage); the card's button has its own placement (cardPlacementOf). */
  placement: PagePlacement;
  token: string;
  /** The lead's website, for the title after the 3-day bonus. */
  domain: string;
  /** The 3-day bonus runs (the view's cleanUntil, not seen to pass on this page). */
  bonus: boolean;
  /** The bonus deadline in the visitor's own time, once the browser has printed it (useDeadline). */
  when: string | null;
  /** The watermarked free sample, the same link as the small link under the main button. */
  freeDownload: string;
  /** The free sample's download started (the download event). */
  onFreeDownload: () => void;
}

/** showModal() traps focus and makes the page behind inert. Old browsers without <dialog> get a plain open window. */
function showDialog(dialog: HTMLDialogElement) {
  if (dialog.hasAttribute('open')) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function hideDialog(dialog: HTMLDialogElement) {
  if (!dialog.hasAttribute('open')) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

/**
 * The offer at the moment they act (owner 2026-10-12): one card, opened by "Download without the watermark" under the
 * finished video ad and by the buy bar on phones. A bottom sheet on phones, a centred window from 640 px (the landing
 * page's step 2 sheet look, .sheet). What they get first, compactly (the bonus with its deadline while it runs, then
 * the stack's first 3 lines), then the stack's price (with its "why" and the freelancer anchor), the named guarantee
 * and one button with the page's buy label, through its own /go placement (fvthankcard, fvpagecard), with the stack's
 * last "What happens when you click" step under it. Then "See everything you get" closes the card and goes to the
 * stack, and "No thanks" starts the watermarked download and closes the card.
 *
 * Always in the page (a closed <dialog> is display: none), so ClickBank's script finds the button's link at load.
 * Escape, the close button and a tap beside the card close it; focus goes back to what opened it.
 */
export function OfferCard({ open, onClose, placement, token, domain, bonus, when, freeDownload, onFreeDownload }: OfferCardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  /** "See everything you get" moves the focus to the stack itself: no trip back to the opener. */
  const keepFocus = useRef(false);
  const pressedBackdrop = useRef(false);
  const { offer, founder, changes } = SALES_PAGE;
  const steps = offer.next.steps(bonus);
  const nextStep = steps[steps.length - 1];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      keepFocus.current = false;
      showDialog(dialog);
      // The card stays in the page while closed: each opening starts at its top, not where the last one was scrolled to
      // (after showing it: a closed card has no box to scroll).
      if (boxRef.current) boxRef.current.scrollTop = 0;
      return;
    }
    hideDialog(dialog);
    // Back to what opened the card. A tap on a phone may leave nothing focused: then focus stays put.
    const back = opener.current;
    opener.current = null;
    if (!keepFocus.current && back && back !== document.body && back.isConnected) back.focus({ preventScroll: true });
  }, [open]);

  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };
  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => {
    pressedBackdrop.current = event.target === event.currentTarget;
  };
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && pressedBackdrop.current) onClose();
    pressedBackdrop.current = false;
  };

  const seeAll = (event: MouseEvent<HTMLAnchorElement>) => {
    const stack = document.getElementById(SALES_PAGE.stackAnchor);
    if (!stack) return;
    event.preventDefault();
    keepFocus.current = true;
    onClose();
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // After the card has closed, so nothing scrolls the page back to the opener.
    window.requestAnimationFrame(() => {
      stack.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
      stack.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className={cn(styles.sheet, styles.offerSheet)}
      aria-labelledby="fv-offer-sheet-title"
      onCancel={onCancel}
      // A browser may close the window by itself (a second Escape): the page's state follows.
      onClose={() => {
        if (open) onClose();
      }}
      onPointerDown={onPointerDown}
      onClick={onBackdropClick}
    >
      <div ref={boxRef} className={cn(styles.sheetBox, styles.offerSheetBox)}>
        <button type="button" className={styles.sheetClose} aria-label={OFFER_CARD.close} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
        <p className={styles.stepTag}>{changes.kicker}</p>
        <h2 id="fv-offer-sheet-title" className={cn(styles.sheetTitle, styles.offerSheetTitle)}>
          {bonus ? OFFER_CARD.title : SALES_PAGE.close.title(domain)}
        </h2>

        {bonus && (
          <div className={styles.offerSheetBonus}>
            <p className={styles.offerSheetBonusTitle}>{OFFER_READY.bonusTitle}</p>
            <p className={styles.offerSheetBonusLine}>{when ? OFFER_READY.bonusLine(when) : OFFER_READY.bonusLineSoon}</p>
          </div>
        )}
        <ul className={cn(styles.ticks, styles.offerSheetList)}>
          {OFFER_CARD.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        {/* The stack's price, as the stack shows it: the birthday tag, the regular price struck through, the price, why
            it is lower, and the freelancer's $600 for one video ad (the anchor at the price, Kennedy review 2026-10-09). */}
        <div className={styles.offerSheetPrice}>
          <span className={styles.spPriceTag}>{offer.tag}</span>
          <p className={styles.offerSheetPriceRow}>
            <s className={styles.offerSheetPriceWas}>
              <span className={styles.srOnly}>{OFFER_COPY.wasLabel} </span>
              {offer.was}
            </s>
            <b className={styles.offerSheetPriceNow}>
              <span className={styles.srOnly}>{OFFER_COPY.nowLabel} </span>
              {offer.now}
            </b>
            <span className={styles.offerSheetPriceUnit}>{offer.unit}</span>
          </p>
          <p className={styles.offerSheetPriceWhy}>{offer.why}</p>
          <p className={styles.offerSheetPriceAnchor}>{offer.anchor}</p>
        </div>
        <p className={styles.offerSheetGuarantee}>
          <b>{founder.guarantee.name}:</b> {founder.guarantee.text}
        </p>
        {/* The button stays in sight at the bottom of the card when the card scrolls (a small phone with its toolbars). */}
        <div className={styles.offerSheetBuy}>
          <OfferButton className={styles.btn} href={goUrl(cardPlacementOf(placement), token)}>
            {OFFER_COPY.button}
          </OfferButton>
        </div>
        {/* What happens after paying: where their video ad without the watermark ends up (the stack's last step). */}
        <p className={styles.offerSheetNext}>{nextStep}</p>
        <PaymentTrust cardsOnly />

        <div className={styles.offerSheetLinks}>
          <a className={styles.offerSheetSeeAll} href={`#${SALES_PAGE.stackAnchor}`} onClick={seeAll}>
            {OFFER_CARD.seeAll}
          </a>
          <a
            className={styles.offerSheetNoThanks}
            href={freeDownload}
            onClick={() => {
              onFreeDownload();
              onClose();
            }}
          >
            {OFFER_CARD.noThanks}
          </a>
        </div>
      </div>
    </dialog>
  );
}
