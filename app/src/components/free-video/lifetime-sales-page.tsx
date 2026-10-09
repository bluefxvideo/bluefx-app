'use client';

import { useState } from 'react';

import Image from 'next/image';
import { OFFER_COPY, SUPPORT_EMAIL } from '@/lib/free-video/copy';
import { claimUrl, goUrl, type PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import { SALES_PAGE } from '@/lib/free-video/sales-page';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';
import { OfferButton } from './offer-button';
import { PaymentTrust } from './payment-trust';
import { BonusTimer, useBonusEnded, useDeadline, VideoWall } from './sales-page-media';

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
 * answered, proof, the math (under $3 per video ad against a freelancer's $600), one offer box with the price, the
 * 3-day bonus and the guarantee, the founder, the questions, one last button. Under every button: the card logos and the
 * guarantee (PaymentTrust), as on the lifetime page. Copy in
 * lib/free-video/sales-page.ts. Every button opens ClickBank's checkout through /go (OfferButton fires the pixel's
 * InitiateCheckout). The deadline lines appear once the page runs in the browser (useDeadline).
 */
export function LifetimeSalesPage({ placement, token, domain, cleanUntil }: LifetimeSalesPageProps) {
  const href = goUrl(placement, token);
  const when = useDeadline(cleanUntil);
  const ended = useBonusEnded(cleanUntil);
  /** The 3-day bonus runs: the view has its end and the page has not seen it pass. */
  const bonus = Boolean(cleanUntil) && !ended;
  const { questions, reviews, changes, proof, math, offer, founder, faq, close, legal } = SALES_PAGE;
  return (
    <section id={SALES_PAGE.anchor} className={styles.sp} aria-labelledby="fv-sales-title">
      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInnerWide}>
          <h2 id="fv-sales-title" className={styles.spTitle}>
            {questions.title}
          </h2>
          <p className={styles.spLead}>{questions.lead}</p>
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

      {/* Customers in their own words, 5 stars each (SALES_PAGE.reviews). */}
      <div className={styles.spBlock}>
        <div className={styles.spInnerWide}>
          <h2 className={styles.spTitle}>{reviews.title}</h2>
          <p className={styles.spLead}>{reviews.lead}</p>
          <ul className={styles.spReviews}>
            {reviews.items.map((item) => (
              <li key={item.name} className={styles.spReview}>
                <Stars label={reviews.starsLabel} />
                {'video' in item && (
                  <ReviewVideo
                    src={'youtube' in item.video ? `https://www.youtube-nocookie.com/embed/${item.video.youtube}?autoplay=1&rel=0` : `https://player.vimeo.com/video/${item.video.vimeo}?autoplay=1&title=0&byline=0&portrait=0`}
                    poster={item.video.poster}
                    vertical={item.video.vertical}
                    label={reviews.play(item.name)}
                  />
                )}
                <blockquote className={styles.spReviewQuote}>&ldquo;{item.quote}&rdquo;</blockquote>
                <div className={styles.spReviewWho}>
                  <Image className={styles.spReviewFace} src={item.photo} alt="" width={240} height={240} sizes="48px" />
                  <span>
                    <b>{item.name}</b>
                    <br />
                    {item.role}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* What a buyer can change, a lead's own questions, with the presenters to pick from (SALES_PAGE.changes). */}
      <div className={cn(styles.spBlock, styles.spChanges)}>
        <div className={styles.spInnerWide}>
          <p className={styles.spKicker}>{changes.kicker}</p>
          <h2 className={styles.spTitle}>{changes.title}</h2>
          <p className={styles.spLead}>{changes.lead}</p>
          <figure className={styles.spDemo}>
            <video className={styles.spDemoVideo} src={changes.demo.video} poster={changes.demo.poster} autoPlay muted loop playsInline controls preload="metadata" aria-label={changes.demo.label} />
            <figcaption className={styles.spDemoCaption}>{changes.demo.caption}</figcaption>
          </figure>
          <ol className={styles.spSteps}>
            {changes.items.map((item, i) => (
              <li key={item.q} className={cn(styles.spStep, styles.spChangeCard)}>
                <span className={styles.spStepNumber} aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className={styles.spStepTitle}>{item.q}</h3>
                <p className={styles.spStepText}>{item.a}</p>
              </li>
            ))}
          </ol>
          <div className={styles.spFaces}>
            <p className={styles.spFacesTitle}>{changes.facesTitle}</p>
            <ul className={styles.spFacesGrid}>
              {changes.faces.map((src) => (
                <li key={src}>
                  <Image className={styles.spFacesImg} src={src} alt="" width={240} height={240} sizes="80px" />
                </li>
              ))}
              <li className={styles.spFacesMore} aria-hidden="true">
                {changes.more}
              </li>
            </ul>
            <p className={styles.spFacesNote}>{changes.facesNote}</p>
          </div>
        </div>
      </div>

      <div className={styles.spProof}>
        <div className={styles.spInnerWide}>
          <h2 className={styles.spProofTitle}>{proof.title}</h2>
          <p className={styles.spProofText}>{proof.text}</p>
          <VideoWall items={proof.items} soundOn={proof.soundOn} soundOff={proof.soundOff} previous={proof.previous} next={proof.next} />
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInnerWide}>
          <p className={styles.eyebrow}>{math.eyebrow}</p>
          <h2 className={styles.spMathTitle}>{math.title}</h2>
          <p className={cn(styles.spLead, styles.spMathLead)}>
            <span>{math.lead[0]}</span>
            <span>{math.lead[1]}</span>
            <strong>{math.lead[2]}</strong>
          </p>
          <div className={styles.spMath}>
            <div className={styles.spMathThem}>
              <p className={styles.spMathName}>{math.them.name}</p>
              <p className={cn(styles.spMathPrice, styles.spMathPriceThem)}>{math.them.price}</p>
              <p className={styles.spMathPer}>{math.them.per}</p>
              <p className={styles.spMathNote}>{math.them.note}</p>
              <p className={cn(styles.spMathTime, styles.spMathTimeThem)}>{math.them.time}</p>
              <ul className={cn(styles.ticks, styles.spMathIncludes, styles.spMathIncludesThem)}>
                {math.them.includes.map((row) => (
                  <li key={row.text} className={row.has ? undefined : styles.spMathMissing}>
                    {!row.has && <span className={styles.srOnly}>{math.missingLabel} </span>}
                    {row.text}
                  </li>
                ))}
              </ul>
            </div>
            <p className={styles.spMathVs} aria-hidden="true">
              vs
            </p>
            <div className={styles.spMathUs}>
              <p className={styles.spMathName}>{math.us.name}</p>
              <p className={cn(styles.spMathPrice, styles.spMathPriceUs)}>{math.us.price}</p>
              <p className={styles.spMathPer}>{math.us.per}</p>
              <p className={cn(styles.spMathTime, styles.spMathTimeUs)}>{math.us.time}</p>
              <ul className={cn(styles.ticks, styles.spMathIncludes)}>
                {math.us.includes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInner}>
          <div id={SALES_PAGE.stackAnchor} className={styles.spOffer}>
            <Image className={styles.spProduct} src={offer.image.src} alt={offer.image.alt} width={816} height={632} sizes="(min-width: 760px) 360px, 300px" />
            <h2 className={styles.spOfferTitle}>{offer.title}</h2>
            <ul className={styles.ticks}>
              {offer.items.map((item) => (
                <li key={item.text}>
                  <span className={styles.spStackItem}>
                    <span>{item.text}</span>
                    <span className={styles.spStackValue}>{item.value}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.spStackTotal}>
              <span>{offer.totalLabel}</span>
              <b>{offer.total}</b>
            </p>
            <p className={cn(styles.spStackTotal, styles.spStackYours)}>
              <span>{offer.yoursLabel}</span>
              <b>{offer.yours}</b>
            </p>
            {cleanUntil && (
              <div className={styles.spBonus}>
                {!ended && <p className={styles.spBonusTag}>{offer.bonus.tag(when)}</p>}
                <BonusTimer until={cleanUntil} />
                <p className={styles.spBonusTitle}>{offer.bonus.title(domain)}</p>
                {!ended && <p className={styles.spBonusText}>{offer.bonus.text}</p>}
              </div>
            )}
            <div className={cn(styles.spReview, styles.spReviewNearPrice)}>
              <Stars label={reviews.starsLabel} />
              <blockquote className={styles.spReviewQuote}>&ldquo;{reviews.items[0].quote}&rdquo;</blockquote>
              <div className={styles.spReviewWho}>
                <Image className={styles.spReviewFace} src={reviews.items[0].photo} alt="" width={240} height={240} sizes="48px" />
                <span>
                  <b>{reviews.items[0].name}</b>
                  <br />
                  {reviews.items[0].role}
                </span>
              </div>
            </div>
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
              <p className={styles.spPriceAnchor}>{offer.anchor}</p>
            </div>
            <p className={styles.spPriceGuarantee}>
              <b>{founder.guarantee.name}:</b> {founder.guarantee.text}
            </p>
            <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
              {OFFER_COPY.button}
            </OfferButton>
            <PaymentTrust />
            <div className={styles.spNext}>
              <p className={styles.spNextTitle}>{offer.next.title}</p>
              <ol>
                {offer.next.steps(bonus).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
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
              <div className={styles.spGuarantee}>
                <p className={styles.spGuaranteeName}>{founder.guarantee.name}</p>
                <p className={styles.spGuaranteeText}>{founder.guarantee.text}</p>
              </div>
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
          {cleanUntil && <BonusTimer until={cleanUntil} dark />}
          <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
            {OFFER_COPY.button}
          </OfferButton>
          <PaymentTrust dark />
          <p className={styles.spCloseLine}>{close.line}</p>
          <p className={styles.spPs}>{close.ps(bonus ? when : null)}</p>
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

/** Five gold stars, read out as one label. */
function Stars({ label }: { label: string }) {
  return (
    <span className={styles.spStars} role="img" aria-label={label}>
      {'\u2605\u2605\u2605\u2605\u2605'}
    </span>
  );
}

/** A customer's video testimonial: the poster with a play button, and the Vimeo or YouTube player once tapped (autoplay, public video). */
function ReviewVideo({ src, poster, vertical, label }: { src: string; poster: string; vertical: boolean; label: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={cn(styles.spReviewVideo, vertical && styles.spReviewVideoTall)}>
      {playing ? (
        <iframe
          className={styles.spReviewPlayer}
          src={src}
          title={label}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" className={styles.spReviewPlay} onClick={() => setPlaying(true)} aria-label={label}>
          <Image className={styles.spReviewPoster} src={poster} alt="" width={vertical ? 640 : 640} height={vertical ? 1138 : 360} sizes="(min-width: 760px) 340px, 100vw" />
          <span className={styles.spReviewPlayIcon} aria-hidden="true">
            &#9654;
          </span>
        </button>
      )}
    </div>
  );
}

