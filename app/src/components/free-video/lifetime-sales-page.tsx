import Image from 'next/image';
import { OFFER_COPY, SUPPORT_EMAIL } from '@/lib/free-video/copy';
import { goUrl, type PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import { SALES_PAGE } from '@/lib/free-video/sales-page';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';
import { OfferButton } from './offer-button';
import { VideoWall } from './sales-page-media';

interface LifetimeSalesPageProps {
  /** The ClickBank vtid of this page: fvthank on the thank-you page, fvpage on /v/<token>. */
  placement: (typeof PAGE_PLACEMENTS)[number];
  token: string;
  /** The lead's website, as the page above shows it. */
  domain: string;
}

/**
 * The AI Media Machine offer under the finished video ad, never before it is ready (owner 2026-10-08: "it should be
 * shown only once the result is visible"). One buyer, one problem, one offer and one button label, built on the video
 * ad above: make 12 more for this domain every month, the stack with a price on each piece, the birthday price, video
 * ads made with the AI Media Machine, the guarantee, five questions, the last button. Copy in lib/free-video/sales-page.ts. Every
 * button opens ClickBank's checkout through /go (OfferButton fires the pixel's InitiateCheckout). No hooks of its own.
 */
export function LifetimeSalesPage({ placement, token, domain }: LifetimeSalesPageProps) {
  const href = goUrl(placement, token);
  const { bridge, stack, price, proof, guarantee, faq, close, legal } = SALES_PAGE;
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
        <div className={styles.spInner}>
          <h2 className={styles.spTitle}>{stack.title}</h2>
          <ul className={styles.spStack}>
            {stack.items(domain).map((item) => (
              <li key={item.title} className={styles.spStackItem}>
                <div>
                  <p className={styles.spStackTitle}>{item.title}</p>
                  <p className={styles.spStackText}>{item.text}</p>
                </div>
                <p className={styles.spStackValue}>
                  {item.value === 'included' ? <span className={styles.spIncluded}>{item.value}</span> : <s>{item.value}</s>}
                  {'note' in item && <span className={styles.spStackNote}>{item.note}</span>}
                </p>
              </li>
            ))}
          </ul>
          <p className={styles.spStackTotal}>
            <span>{stack.total[0]}</span>
            <s>{stack.total[1]}</s>
          </p>

          <div className={styles.spPrice}>
            <span className={styles.spPriceTag}>{price.tag}</span>
            <p className={styles.spPriceWas}>
              {price.was[0]} <s>{price.was[1]}</s>
            </p>
            <p className={styles.spPriceNow}>{price.now}</p>
            <p className={styles.spPriceLine}>{price.line}</p>
            <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
              {OFFER_COPY.button}
            </OfferButton>
            <p className={styles.spPriceWhy}>{price.why}</p>
            <p className={styles.fine}>{price.fine}</p>
          </div>
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
              <figure key={item.video} className={styles.spWideTile}>
                <video className={styles.spWideVideo} src={item.video} poster={item.poster} controls playsInline preload="none" aria-label={item.label} />
                <figcaption className={styles.spWallLabel}>{item.label}</figcaption>
              </figure>
            ))}
          </div>
          <p className={styles.spWideNote}>{proof.wideNote}</p>
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInner}>
          <div className={styles.spGuarantee}>
            <Image className={styles.spFace} src={guarantee.photo} alt={guarantee.name} width={1920} height={1080} sizes="160px" />
            <div>
              <h2 className={styles.spGuaranteeTitle}>{guarantee.title}</h2>
              {guarantee.text.map((line, index) => (
                <p key={line} className={cn(styles.spGuaranteeText, index === guarantee.text.length - 1 && styles.spStrong)}>
                  {line}
                </p>
              ))}
              <p className={styles.spName}>{guarantee.name}</p>
              <p className={styles.spRole}>{guarantee.role}</p>
              <ul className={styles.spFacts}>
                {guarantee.facts.map((fact) => (
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
            {faq.items.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.spClose}>
        <div className={styles.spInner}>
          <h2 className={styles.spCloseTitle}>{close.title(domain)}</h2>
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
