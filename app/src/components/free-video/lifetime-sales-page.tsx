'use client';

import Image from 'next/image';
import { OFFER_COPY, SUPPORT_EMAIL } from '@/lib/free-video/copy';
import { claimUrl, goUrl, type PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import { SALES_PAGE } from '@/lib/free-video/sales-page';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';
import { OfferButton } from './offer-button';
import { useDeadline, VideoWall } from './sales-page-media';

interface LifetimeSalesPageProps {
  /** The ClickBank vtid of this page: fvthank on the thank-you page, fvpage on /v/<token>. */
  placement: (typeof PAGE_PLACEMENTS)[number];
  token: string;
  /** The lead's website, as the page above shows it. */
  domain: string;
  /** The end of the 3-day bonus (the view's cleanUntil), while it runs. */
  cleanUntil?: string;
}

/**
 * The AI Media Machine offer under the finished video ad, never before it is ready (owner 2026-10-08: "it should be
 * shown only once the result is visible"), in Hormozi's order: the promise, the 3 questions the free video ad already
 * answered, proof, one offer box with the price, the 3-day bonus and the guarantee, the founder, five questions, one
 * last button. Copy in
 * lib/free-video/sales-page.ts. Every button opens ClickBank's checkout through /go (OfferButton fires the pixel's
 * InitiateCheckout). The deadline lines appear once the page runs in the browser (useDeadline).
 */
export function LifetimeSalesPage({ placement, token, domain, cleanUntil }: LifetimeSalesPageProps) {
  const href = goUrl(placement, token);
  const bonus = Boolean(cleanUntil);
  const when = useDeadline(cleanUntil);
  const { bridge, questions, proof, offer, founder, faq, close, legal } = SALES_PAGE;
  return (
    <section id={SALES_PAGE.anchor} className={styles.sp} aria-labelledby="fv-sales-title">
      <div className={styles.spBlock}>
        <div className={styles.spInner}>
          <p className={styles.spKicker}>{bridge.kicker}</p>
          <h2 id="fv-sales-title" className={styles.spTitle}>
            {bridge.title(domain)}
          </h2>
          <p className={styles.spLead}>{bridge.text(domain)}</p>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInnerWide}>
          <h2 className={styles.spTitle}>{questions.title}</h2>
          <ol className={styles.spSteps}>
            {questions.items(domain).map((item) => (
              <li key={item.q} className={styles.spStep}>
                <span className={cn(styles.spStepNumber, styles.spStepCheck)} aria-hidden="true">
                  ✓
                </span>
                <h3 className={styles.spStepTitle}>{item.q}</h3>
                <p className={styles.spStepText}>{item.a}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={styles.spProof}>
        <div className={styles.spInnerWide}>
          <h2 className={styles.spProofTitle}>{proof.title}</h2>
          <p className={styles.spProofText}>{proof.text}</p>
          <VideoWall items={proof.items} soundOn={proof.soundOn} soundOff={proof.soundOff} previous={proof.previous} next={proof.next} />
          <p className={styles.spWideTitle}>{proof.wideTitle}</p>
          <div className={styles.spWide}>
            {proof.wide.map((item) => (
              <video key={item.video} className={styles.spWideVideo} src={item.video} poster={item.poster} controls playsInline preload="none" aria-label={item.label} />
            ))}
          </div>
          <p className={styles.spWideNote}>{proof.wideNote}</p>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInner}>
          <div className={styles.spOffer}>
            <h2 className={styles.spOfferTitle}>{offer.title}</h2>
            <ul className={styles.ticks}>
              {offer.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {bonus && (
              <div className={styles.spBonus}>
                <p className={styles.spBonusTag}>{offer.bonus.tag(when)}</p>
                <p className={styles.spBonusTitle}>{offer.bonus.title(domain)}</p>
                <p className={styles.spBonusText}>{offer.bonus.text}</p>
              </div>
            )}
            <div className={styles.spCompare}>
              {[offer.compare.them, offer.compare.us].map((side, index) => (
                <div key={side.name} className={cn(styles.spCompareSide, index === 1 && styles.spCompareUs)}>
                  <p className={styles.spCompareName}>{side.name}</p>
                  {side.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
            <p className={styles.spCompareNote}>{offer.compare.note}</p>
            <div className={styles.spPrice}>
              <span className={styles.spPriceTag}>{offer.tag}</span>
              <p className={styles.spPriceRow}>
                <s className={styles.spPriceWas}>
                  <span className={styles.srOnly}>{OFFER_COPY.wasLabel} </span>
                  {offer.was}
                </s>
                <b className={styles.spPriceNow}>
                  <span className={styles.srOnly}>{OFFER_COPY.nowLabel} </span>
                  {offer.now}
                </b>
              </p>
              <p className={styles.spPriceUnit}>{offer.unit}</p>
              <p className={styles.spPriceWhy}>{offer.why}</p>
            </div>
            <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
              {OFFER_COPY.button}
            </OfferButton>
            <div className={styles.spNext}>
              <p className={styles.spNextTitle}>{offer.next.title}</p>
              <ol>
                {offer.next.steps(bonus).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <p className={styles.spGuarantee}>{offer.guarantee}</p>
          </div>
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInner}>
          <div className={styles.spFounder}>
            <Image className={styles.spFace} src={founder.photo} alt={founder.name} width={1920} height={1080} sizes="160px" />
            <div>
              <p className={styles.spName}>{founder.name}</p>
              <p className={styles.spRole}>{founder.role}</p>
              <p className={styles.spFounderText}>{founder.text}</p>
              <p className={cn(styles.spFounderText, styles.spStrong)}>{founder.risk}</p>
              <ul className={styles.spFacts}>
                {founder.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInner}>
          <h2 className={styles.spTitle}>{faq.title}</h2>
          <div className={styles.faq}>
            {faq.items(bonus, when).map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
                {'claim' in item && token && (
                  <p>
                    <a className={styles.link} href={claimUrl(token)}>
                      {faq.claim}
                    </a>
                  </p>
                )}
              </details>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.spClose}>
        <div className={styles.spInner}>
          <h2 className={styles.spCloseTitle}>{close.title(domain)}</h2>
          {bonus && when && <p className={styles.spCloseDeadline}>{close.reminder(when)}</p>}
          <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
            {OFFER_COPY.button}
          </OfferButton>
          <p className={styles.spCloseLine}>{close.line}</p>
        </div>
      </div>

      <div className={styles.spLegal}>
        <div className={styles.spInner}>
          <p>
            {legal.support[0]}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            {legal.support[1]}
            <a href={legal.clickbankUrl} target="_blank" rel="noopener noreferrer">
              {legal.support[2]}
            </a>
            {legal.support[3]}
          </p>
          {legal.notes.map((line) => (
            <p key={line.slice(0, 40)}>{line}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
