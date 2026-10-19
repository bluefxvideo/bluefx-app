'use client';

import Image from 'next/image';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER } from '@/lib/free-video/copy';
import { goUrl, type ResultPagePlacement } from '@/lib/free-video/offer';
import { bonusDeadlineLabel, RESULT_PAGE, REVIEW_FACES, VIDEO_REVIEWS, VIDEO_REVIEWS_UNDER_ADS } from '@/lib/free-video/result-page';
import { SALES_PAGE } from '@/lib/free-video/sales-page';
import { cn } from '@/lib/utils';
import type { FreeVideoNextAdCard, FreeVideoView } from '@/types/free-video';
import { useFreeVideoBeacon } from '@/hooks/use-free-video-beacon';
import { OfferButton } from './offer-button';
import { VideoAdPlayer } from './video-ad-player';
import styles from './result-page.module.css';

const ROBOT = { hevc: '/free-video/robot.mov', webm: '/free-video/robot.webm', poster: '/free-video/robot-poster.webp' };

interface ResultPageProps {
  view: FreeVideoView;
  token: string;
  /** The 2 free bonuses still run (offer.ts cleanCopyUntil, not past on this page). */
  bonus: boolean;
  /** The bonus deadline in the visitor's time zone ("Wednesday" and "Wednesday at 9:47 PM"); null on the server and in the first render. */
  deadline: { day: string; when: string } | null;
  onPlayWithSound: () => void;
  onComplete: () => void;
}

/**
 * The result page of a free video ad for a lead (not a customer, not a buyer): result-page.ts has the words and the
 * order. The buttons and the bar on phones open ClickBank's checkout through /go (fvresads, fvres1, fvres2, fvres3, fvresbar).
 */
export function ResultPage({ view, token, bonus, deadline, onPlayWithSound, onComplete }: ResultPageProps) {
  const { domain, firstName } = view;
  const videoUrl = view.videoUrl as string;
  const cards = view.nextAds ?? null;
  // The 3 written video ads are a bonus: on the page only while it runs.
  const written = bonus && (Boolean(cards) || Boolean(view.nextAdsPending));
  const compareRef = useRef<HTMLElement>(null);
  const [viewing, setViewing] = useState<(typeof RESULT_PAGE.examples.items)[number] | null>(null);
  const { hero, how, scrolling, compare, buy, stack, founder, promise, faq, reviews, examples, ps } = RESULT_PAGE;

  return (
    <div className={styles.page}>
      <section className={cn(styles.wrap, styles.hero)} aria-labelledby="fv-result-title">
        <div className={styles.heroGrid}>
          <div className={styles.heroVideo}>
            <VideoAdPlayer src={videoUrl} label={PLAYER.label(domain)} onPlayWithSound={onPlayWithSound} onComplete={onComplete} className={styles.heroPlayerFrame} tapToPlay />
          </div>
          {/* On a phone the head sits above the video and the text below it (display: contents); on a computer both sit beside it. */}
          <div className={styles.heroText}>
            <div className={styles.heroHead}>
              <Confetti />
              <Robot className={styles.robot} label={hero.robot} burst />
              <span className={styles.robotLabel}>{hero.robotLabel}</span>
              <h1 id="fv-result-title" className={styles.h1}>
                <span className={styles.h1Name}>{hero.congrats(firstName)}</span>
                {hero.title(domain)}
              </h1>
            </div>
            <div className={cn(styles.stack, styles.heroSide)}>
              <p className={styles.heroLine}>{hero.line(domain)}</p>
              {/* No price at the top (owner 2026-10-19: "lets move the price down"): a computer gets the 3 video ads' pictures and a link down to them. */}
              {written && (
                <a className={styles.seeNext} href={`#${RESULT_PAGE.written.anchor}`}>
                  {cards && (
                    <span className={styles.seeThumbs} aria-hidden="true">
                      {cards.map((card) => (
                        <span key={card.n} className={styles.seeThumb}>
                          {card.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.imageUrl} alt="" loading="lazy" />
                          )}
                          <span className={styles.seeThumbNumber}>#{card.n}</span>
                        </span>
                      ))}
                    </span>
                  )}
                  <span className={styles.seeText}>
                    {hero.seeNext}
                    <ArrowDown />
                  </span>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {written && (
        <section id={RESULT_PAGE.written.anchor} className={cn(styles.wrap, styles.section, styles.stack)} aria-labelledby="fv-written-title">
          <div className={cn(styles.stack, styles.writtenHead)}>
            <h2 id="fv-written-title" className={styles.writtenTitle}>
              {RESULT_PAGE.written.title}
            </h2>
            <p className={styles.text}>{RESULT_PAGE.written.text(domain, deadline?.day ?? null)}</p>
          </div>
          <ul className={styles.ads}>
            {(cards ?? ([2, 3, 4] as const).map((n) => ({ n, pending: true }) as const)).map((card) =>
              'pending' in card ? <WritingCard key={card.n} n={card.n} /> : <WrittenAd key={card.n} ad={card} />
            )}
          </ul>
          {/* Right where they want the 3 video ads (owner 2026-10-19: "how do i get it? maybe some button there?"). */}
          <div className={styles.adsBuy}>
            <BuyBlock token={token} placement="fvresads" note={[buy.guarantee, buy.loginWritten]} />
          </div>
          {/* Customers in their own videos right under the button (owner 2026-10-19: "after the first button i agree, we need testimonial"). */}
          <ul className={cn(styles.reviews, styles.adsProof)}>
            {videoReviewsOf(VIDEO_REVIEWS_UNDER_ADS).map((item) => (
              <VideoReview key={item.name} item={item} />
            ))}
          </ul>
        </section>
      )}

      <section className={cn(styles.wrap, styles.how)} aria-labelledby="fv-how-title">
        <h2 id="fv-how-title" className={styles.h2}>
          {how.title}
        </h2>
        <div className={styles.howGrid}>
          <DemoWindow domain={domain} />
          <ol className={styles.steps}>
            {how.steps.map((step, index) => (
              <li key={step.title} className={cn(styles.step, step.done && styles.stepDone)}>
                <span className={cn(styles.stepIcon, !step.done && styles.stepIconNext)} aria-hidden="true">
                  {step.done ? <Tick size={18} stroke={3.2} /> : index + 1}
                </span>
                <div className={styles.stepText}>
                  <p className={styles.stepTitle}>
                    {index + 1}. {step.title} <span className={cn(styles.stepTag, !step.done && styles.stepTagNext)}>{step.done ? how.doneTag : how.nextTag}</span>
                  </p>
                  <p className={cn(styles.stepNote, step.done && styles.stepNoteDone)}>{step.text(domain)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <ResultScene domain={domain} />
      </section>

      <section className={cn(styles.wrap, styles.narrow, styles.section, styles.stack, styles.scrolling)} aria-labelledby="fv-scroll-title">
        <div className={styles.scrollText}>
          <h2 id="fv-scroll-title" className={styles.h2}>
            {scrolling.title}
          </h2>
          <p className={styles.text}>{scrolling.text}</p>
          <p className={styles.text} style={{ color: '#0f172a' }}>
            <strong>{scrolling.leadsStrong}</strong> {scrolling.leadsRest}
          </p>
        </div>
        <figure className={styles.figure}>
          <Image src={scrolling.image} alt={scrolling.alt} width={554} height={178} sizes="(min-width: 600px) 554px, 100vw" />
          <figcaption>{scrolling.caption}</figcaption>
        </figure>
      </section>

      {/* Everything they get, right before the price comparison (owner 2026-10-19, Hormozi: the list before the price). */}
      <section className={cn(styles.wrap, styles.column, styles.section, styles.stack)} aria-labelledby="fv-stack-title">
        <div className={styles.offer}>
          <h2 id="fv-stack-title" className={styles.offerTitle}>
            {stack.title}
          </h2>
          <ul className={styles.offerList}>
            {stack.items(domain, written, bonus).map((item) => (
              <li key={item.text} className={styles.offerItem}>
                <span className={cn(styles.offerTick, item.bonus && styles.offerTickBonus)} aria-hidden="true">
                  {item.bonus ? <Gift /> : <Tick size={12} stroke={3.6} />}
                </span>
                <span>
                  {item.bonus && <strong style={{ fontWeight: 800 }}>{stack.bonusLabel} </strong>}
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.quotes}>
          {stack.proof.map((quote) => (
            <figure key={quote.name} className={styles.quote} style={{ margin: 0 }}>
              <Image className={styles.quoteFace} src={quote.photo} alt={quote.name} width={88} height={88} />
              <div className={styles.quoteBody}>
                <Stars size={13} label={reviews.stars} />
                <blockquote className={styles.quoteText} style={{ margin: 0 }}>
                  {quote.before}
                  <strong>{quote.strong}</strong>
                  {quote.after}
                </blockquote>
                <figcaption className={styles.quoteWho}>
                  {quote.name}
                  <span className={styles.quoteRole}>, {quote.role}</span>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </section>

      <section ref={compareRef} className={cn(styles.wrap, styles.narrow, styles.section, styles.stack, styles.compareSection)} aria-labelledby="fv-compare-title">
        <h2 id="fv-compare-title" className={styles.compareTitle}>
          {compare.title}
        </h2>
        <div className={styles.compare}>
          <div className={styles.compareCard}>
            <p className={styles.compareName}>{compare.freelancer.name}</p>
            <p className={styles.compareLine}>
              {compare.freelancer.line1}
              <br />× <strong style={{ color: '#0f172a' }}>{compare.freelancer.line2}</strong>
            </p>
            <p className={styles.comparePrice}>{compare.freelancer.price}</p>
            <p className={styles.comparePer}>{compare.freelancer.per}</p>
          </div>
          <div className={cn(styles.compareCard, styles.compareCardUs)}>
            <p className={styles.compareName}>{compare.machine.name}</p>
            <p className={styles.compareLine}>
              {compare.machine.line1}
              <br />
              <strong style={{ color: '#0f172a' }}>{compare.machine.line2}</strong>
              {compare.machine.line2After}
            </p>
            <p className={styles.comparePrice}>{compare.machine.price}</p>
            <p className={styles.comparePer}>{compare.machine.per}</p>
          </div>
        </div>
        <p className={styles.compareAfter}>{compare.line(domain)}</p>
      </section>

      {/* The first price button, under the comparison, on a phone and on a computer (owner 2026-10-19: "lets move the price down"). */}
      <div className={cn(styles.wrap, styles.narrow, styles.sectionTight)}>
        <BuyBlock token={token} placement="fvres1" note={[buy.guarantee, written ? buy.loginWritten : buy.login]} />
      </div>

      <section className={cn(styles.wrap, styles.column, styles.sectionTight, styles.stack)} aria-label={founder.name}>
        <div className={styles.founder}>
          <Image className={styles.founderFace} src={founder.photo} alt={founder.name} width={120} height={120} />
          <div className={styles.founderBody}>
            <p className={styles.founderName}>{founder.name}</p>
            <p className={styles.founderText}>{founder.text}</p>
            <p className={styles.prices}>
              <span className={styles.priceWas}>{founder.was}</span>
              <span className={styles.priceNow}>{founder.now}</span>
              <span className={styles.priceOnce}>{founder.once}</span>
            </p>
          </div>
        </div>
        {bonus && view.cleanUntil && (
          <div className={styles.bonus}>
            <p className={styles.bonusTitle}>{RESULT_PAGE.bonus.title(written, deadline?.when ?? null)}</p>
            <Countdown until={view.cleanUntil} />
          </div>
        )}
        <BuyBlock token={token} placement="fvres2" note={[buy.secure, written ? buy.loginWritten : buy.login]} />
        <div className={styles.promise}>
          <Shield />
          <div className={styles.promiseBody}>
            <p className={styles.promiseTitle}>{promise.title}</p>
            <p className={styles.promiseText}>{promise.text(written)}</p>
            <p className={styles.signature}>{promise.signature}</p>
          </div>
        </div>
      </section>

      <section className={cn(styles.wrap, styles.narrow, styles.section, styles.stack)} aria-labelledby="fv-faq-title">
        <h2 id="fv-faq-title" className={cn(styles.h2, styles.h2Small, styles.centerWide)}>
          {faq.title}
        </h2>
        <dl className={styles.faq}>
          {faq.items.map((item) => (
            <div key={item.q} className={styles.faqItem}>
              <dt className={styles.faqQ}>{item.q}</dt>
              <dd className={styles.faqA} style={{ margin: 0 }}>
                {item.yes && <span className={styles.faqYes}>{item.yes} </span>}
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={cn(styles.wrap, styles.section, styles.stack)} aria-labelledby="fv-reviews-title">
        <p className={cn(styles.kicker, styles.centerWide)}>{reviews.kicker}</p>
        <h2 id="fv-reviews-title" className={cn(styles.h2, styles.h2Small, styles.centerWide)}>
          {reviews.title}
        </h2>
        <p className={cn(styles.text, styles.centerWide, styles.leadWide)}>{reviews.lead}</p>
        <div className={styles.tiles}>
          {reviews.tiles.map((tile) => (
            <div key={tile.big} className={styles.tile}>
              <span className={styles.tileBig}>{tile.big}</span>
              <span className={styles.tileSmall}>{tile.small}</span>
            </div>
          ))}
        </div>
        <Reviews />
      </section>

      <section className={styles.examples} aria-labelledby="fv-examples-title">
        <div className={cn(styles.wrap, styles.stack)}>
          <h2 id="fv-examples-title" className={cn(styles.h2, styles.h2Small, styles.centerWide)}>
            {examples.title}
          </h2>
          <p className={cn(styles.text, styles.centerWide)}>{examples.lead}</p>
        </div>
        <ul className={styles.reel}>
          {examples.items.map((item) => (
            <li key={item.id} className={styles.reelItem}>
              <button type="button" className={styles.reelButton} onClick={() => setViewing(item)} aria-label={examples.watch(item.label)}>
                <span className={styles.reelVideo}>
                  <LoopVideo src={item.loop} poster={item.poster} />
                  <span className={styles.reelSound} aria-hidden="true">
                    <PlayIcon size={12} fill="#ffffff" />
                    {examples.sound}
                  </span>
                </span>
                <span className={styles.reelLabel}>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Walkthrough token={token} />

      <div className={cn(styles.wrap, styles.column, styles.section)}>
        <BuyBlock token={token} placement="fvres3" note={[buy.last]} />
      </div>

      <section className={cn(styles.wrap, styles.column, styles.section)} aria-label="P.S.">
        <div className={styles.ps}>
          <Image className={styles.psFace} src={founder.photo} alt={founder.name} width={88} height={88} />
          <div className={styles.psBody}>
            {written ? (
              <>
                <p className={styles.psText}>
                  <strong>P.S.</strong> {ps.ps(firstName, domain, deadline?.when ?? null)}
                </p>
                <p className={styles.psText}>
                  <strong>P.P.S.</strong> {ps.pps(domain)}
                  <strong>{ps.ppsStrong}</strong>
                  {ps.ppsEnd}
                </p>
              </>
            ) : (
              <p className={styles.psText}>
                <strong>P.S.</strong> {ps.pps(domain)}
                <strong>{ps.ppsStrong}</strong>
                {ps.ppsEnd}
              </p>
            )}
          </div>
        </div>
      </section>

      <Legal />
      <StickyBar token={token} watch={compareRef} />
      {viewing && <Viewer item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** The bonus deadline in the visitor's own time zone, once the page runs in the browser (null on the server and in the first render). */
export function useBonusDeadline(iso?: string): { day: string; when: string } | null {
  const [label, setLabel] = useState<{ day: string; when: string } | null>(null);
  useEffect(() => {
    setLabel(iso ? bonusDeadlineLabel(iso) : null);
  }, [iso]);
  return label;
}

// ---------------------------------------------------------------------------------------------------------------
// Buttons

function BuyBlock({ token, placement, note }: { token: string; placement: ResultPagePlacement; note: string[] }) {
  const { buy } = RESULT_PAGE;
  return (
    <div className={styles.buy}>
      <OfferButton className={styles.buyButton} href={goUrl(placement, token)}>
        {buy.button}
        <span className={styles.buyMore}>{buy.buttonMore}</span>
        <span className={styles.buyPrice}>
          <s className={styles.buyWas}>{buy.was}</s>&nbsp; {buy.now}, {buy.once}
        </span>
      </OfferButton>
      <PayCards />
      <p className={styles.buyNote}>
        {note.map((line, index) => (
          <span key={line}>
            {index > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * The bar at the bottom of a phone's screen once the comparison has scrolled up past the top (no price before the value,
 * owner 2026-10-19), away while another buy button or the footer is on screen.
 */
function StickyBar({ token, watch }: { token: string; watch: React.RefObject<HTMLElement | null> }) {
  const [past, setPast] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const { buy, bar } = RESULT_PAGE;

  // From the scroll position, not an IntersectionObserver: a jump back up over the comparison never crosses it, so an observer would leave the bar on.
  useEffect(() => {
    const target = watch.current;
    if (!target) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      setPast(target.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [watch]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = [...document.querySelectorAll<HTMLElement>('[data-fv-bar-hide], footer')].filter((target) => !target.closest('[data-fv-bar]'));
    if (!targets.length) return;
    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        // A hidden one (the computer's top button on a phone) has no box, and the browser calls its empty box at the top "on screen".
        if (entry.isIntersecting && entry.boundingClientRect.height > 0) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setBlocked(onScreen.size > 0);
    });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const shown = past && !blocked;
  return (
    <aside className={cn(styles.bar, shown && styles.barOn)} aria-label={bar.label} aria-hidden={!shown} inert={!shown} data-fv-bar="">
      <Robot className={styles.barRobot} />
      <OfferButton className={cn(styles.buyButton, styles.barButton)} href={goUrl('fvresbar', token)}>
        {buy.button}
        <span className={styles.buyPrice}>
          <s className={styles.buyWas}>{buy.was}</s>&nbsp; {buy.now}
        </span>
      </OfferButton>
    </aside>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The robot and the confetti

/** The AI Media Machine's robot with a transparent background: HEVC with alpha for Safari, VP9 with alpha elsewhere. */
function Robot({ className, label, burst = false }: { className: string; label?: string; burst?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    // A tab that comes back starts the loop again (browsers pause hidden videos).
    const again = () => {
      if (document.visibilityState === 'visible') void video.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, []);
  const burstDone = useRef(false);
  useEffect(() => {
    if (!burst || burstDone.current || !ref.current) return;
    burstDone.current = true;
    confettiFrom(ref.current);
  }, [burst]);
  return (
    <video ref={ref} className={className} poster={ROBOT.poster} autoPlay muted loop playsInline aria-label={label} aria-hidden={label ? undefined : true}>
      <source src={ROBOT.hevc} type='video/quicktime; codecs="hvc1"' />
      <source src={ROBOT.webm} type="video/webm" />
    </video>
  );
}

/** One confetti burst from the robot when the result shows (none for people who turn motion off). */
function confettiFrom(robot: HTMLElement) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const box = robot.getBoundingClientRect();
  if (box.bottom < 0 || box.top > window.innerHeight) return;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height * 0.45;
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.cssText = `position: fixed; left: 0; top: 0; width: ${width}px; height: ${height}px; pointer-events: none; z-index: 90`;
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);
  const colors = ['#7CB342', '#FFD447', '#E85D75', '#143D70', '#3F6A1C'];
  const pieces = Array.from({ length: 90 }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 5 + Math.random() * 8;
    return { x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: Math.random() * 3, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 3, c: colors[i % colors.length] };
  });
  const start = performance.now();
  const LIFE = 2600;
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.max(0, 1 - t / LIFE);
    for (const q of pieces) {
      q.vy += 0.22;
      q.vx *= 0.99;
      q.x += q.vx;
      q.y += q.vy;
      q.r += q.vr;
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.r);
      ctx.fillStyle = q.c;
      ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      ctx.restore();
    }
    if (t < LIFE) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function Confetti() {
  return (
    <svg className={styles.confetti} viewBox="0 0 342 140" aria-hidden="true">
      <rect x="62" y="26" width="11" height="5" rx="1.5" fill="#7CB342" transform="rotate(25 67 28)" />
      <rect x="84" y="96" width="11" height="5" rx="1.5" fill="#FFD447" transform="rotate(-30 89 98)" />
      <circle cx="104" cy="50" r="3.5" fill="#E85D75" />
      <circle cx="58" cy="118" r="3" fill="#143D70" />
      <circle cx="122" cy="12" r="2.5" fill="#FFD447" />
      <rect x="262" y="22" width="11" height="5" rx="1.5" fill="#143D70" transform="rotate(-20 267 24)" />
      <circle cx="284" cy="78" r="3.5" fill="#7CB342" />
      <rect x="246" y="108" width="11" height="5" rx="1.5" fill="#E85D75" transform="rotate(35 251 110)" />
      <rect x="296" y="46" width="11" height="5" rx="1.5" fill="#FFD447" transform="rotate(50 301 48)" />
      <circle cx="232" cy="56" r="2.5" fill="#E85D75" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// How it works

/** The AI Media Machine's window, playing on a loop as on the boards: the website typed, the video ad ready, "Use a woman presenter" typed and the new presenter in its place. */
function DemoWindow({ domain }: { domain: string }) {
  const { demo } = RESULT_PAGE.how;
  return (
    <div className={styles.demo} role="img" aria-label={demo.label(domain)}>
      <div className={styles.demoBar} aria-hidden="true">
        <span className={styles.demoDot} style={{ background: '#F87171' }} />
        <span className={styles.demoDot} style={{ background: '#FBBF24' }} />
        <span className={styles.demoDot} style={{ background: '#34D399' }} />
        <span className={styles.demoApp}>{demo.app}</span>
      </div>
      <div className={styles.demoBody} aria-hidden="true">
        <div className={styles.demoLabel}>{demo.field}</div>
        <div className={styles.demoField}>
          <span className={styles.demoTyped} style={{ '--chars': domain.length } as CSSProperties}>
            {domain}
          </span>
          <span className={styles.caret} />
        </div>
        <div className={styles.demoRow}>
          <span className={styles.demoMake}>{demo.make}</span>
          <span className={styles.demoOr}>{demo.or}</span>
        </div>
        <div className={styles.demoChips}>
          {demo.chips.map((chip) => (
            <span key={chip} className={styles.demoChip}>
              {chip}
            </span>
          ))}
        </div>
        <div className={styles.demoResult}>
          <div className={styles.demoThumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demo.before} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.demoNew} src={demo.after} alt="" />
          </div>
          <div className={styles.demoSide}>
            <div className={styles.demoReady}>{demo.ready}</div>
            <div className={styles.demoLabel}>{demo.changeLabel}</div>
            <div className={styles.demoChange}>
              <span className={styles.demoChangeTyped} style={{ '--chars': demo.change.length } as CSSProperties}>
                {demo.change}
              </span>
            </div>
            <span className={styles.demoChangeButton}>{demo.makeChange}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Where each walker rests when motion is off, along the drawing's street (in % of its width). */
const WALKERS = [
  { shirt: '#7CB342', bag: true, rest: '27cqi' },
  { shirt: '#143D70', bag: false, rest: '41.4cqi' },
  { shirt: '#F2C14E', bag: true, rest: '55.6cqi' },
  { shirt: '#2E77BC', bag: false, rest: '70.1cqi' },
  { shirt: '#3F6A1C', bag: true, rest: '84.6cqi' },
];

/** THE RESULT: the whiteboard drawing with customers walking from the video ad on the phone into the shop, and the money they bring popping up at the door. */
function ResultScene({ domain }: { domain: string }) {
  const { result } = RESULT_PAGE.how;
  return (
    <div className={styles.result}>
      <div className={styles.scene}>
        <Image className={styles.sceneImage} src={result.image} alt={result.alt} width={1240} height={516} sizes="(min-width: 960px) 620px, 100vw" />
        {WALKERS.map((walker, index) => (
          <div key={walker.shirt} className={styles.walker} style={{ animationDelay: `${-1.6 * (5 - index)}s`, '--rest': walker.rest } as CSSProperties}>
            <svg viewBox="0 0 26 40" aria-hidden="true">
              <g className={styles.legA}>
                <path d="M11 26 L10 38" stroke="#111" strokeWidth="2.4" strokeLinecap="round" fill="none" />
              </g>
              <g className={styles.legB}>
                <path d="M15 26 L16 38" stroke="#111" strokeWidth="2.4" strokeLinecap="round" fill="none" />
              </g>
              <rect x="7" y="12.5" width="12" height="14" rx="4.5" fill={walker.shirt} stroke="#111" strokeWidth="2.2" />
              <g className={styles.armA}>
                <path d="M8 15 L5 23" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </g>
              <g className={styles.armB}>
                <path d="M18 15 L21 23" stroke="#111" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </g>
              {walker.bag && <rect x="19" y="21" width="6" height="7" rx="1.2" fill="#FFFFFF" stroke="#111" strokeWidth="1.8" />}
              <circle cx="13" cy="7" r="5.2" fill="#FFFFFF" stroke="#111" strokeWidth="2.2" />
              <path d="M10.6 8.4 Q13 10.4 15.4 8.4" stroke="#111" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        ))}
        {result.cash.map((amount, index) => (
          // Each amount pops up as its walker reaches the door (93% of the 8 s walk).
          <span key={amount} className={styles.cash} style={{ animationDelay: `${-1.6 * (5 - index) + 0.93 * 8 - 8}s` }} aria-hidden="true">
            {amount}
          </span>
        ))}
      </div>
      <div className={styles.resultText}>
        <p className={styles.resultKicker}>{result.kicker}</p>
        <p className={styles.resultTitle}>{result.title(domain)}</p>
        <p className={styles.resultNote}>{result.text}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The 3 written video ads

function WrittenAd({ ad }: { ad: FreeVideoNextAdCard }) {
  const { written } = RESULT_PAGE;
  return (
    <li className={styles.ad}>
      <div className={styles.adFrame}>
        {ad.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.imageUrl} alt={written.alt(ad.n, ad.title)} loading="lazy" />
        )}
        <span className={styles.adNumber}>#{ad.n}</span>
        <span className={styles.adLength}>{written.length}</span>
        <span className={styles.adChip}>
          <Sparkle />
          {written.chip}
        </span>
      </div>
      <div className={styles.adText}>
        <p className={styles.adTitle}>{ad.title}</p>
        <p className={styles.adTeaser}>{ad.teaser}</p>
        <p className={styles.adMeta}>{written.meta}</p>
      </div>
    </li>
  );
}

/** A card while its video ad is still being planned (the page asks again every few seconds). */
function WritingCard({ n }: { n: number }) {
  return (
    <li className={styles.ad}>
      <div className={styles.adFrame}>
        <span className={styles.adNumber}>#{n}</span>
        <span className={styles.adWriting} role="status">
          {RESULT_PAGE.written.writing(n)}
        </span>
      </div>
      <div className={styles.adText}>
        <p className={styles.adMeta}>{RESULT_PAGE.written.meta}</p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Customers, more video ads

/** The customers with a video, by name, in the given order. */
function videoReviewsOf(names: readonly string[]): VideoReviewItem[] {
  return names
    .map((name) => SALES_PAGE.reviews.items.find((item) => item.name === name))
    .filter((item): item is VideoReviewItem => Boolean(item && 'video' in item));
}

/** Every customer, with Dov's quote first (owner 2026-10-20: all of them stay here, the 3 under the first button too). */
function Reviews() {
  const { reviews } = RESULT_PAGE;
  const dov = SALES_PAGE.reviews.items.find((item) => item.name === 'Dov Rom');
  const videos = videoReviewsOf(VIDEO_REVIEWS);
  return (
    <ul className={styles.reviews}>
      {dov && (
        <li className={styles.review}>
          <div className={styles.reviewFace}>
            <Image src={dov.photo} alt={dov.name} width={240} height={240} sizes="120px" />
          </div>
          <div className={styles.reviewBody}>
            <Stars size={13} label={reviews.stars} />
            <blockquote className={styles.quoteText} style={{ margin: 0 }}>
              &ldquo;{dov.quote}&rdquo;
            </blockquote>
            <p className={styles.quoteWho}>
              {dov.name}
              <span className={styles.reviewRole}>President, Ascent Equipment</span>
            </p>
          </div>
        </li>
      )}
      {videos.map((item) => (
        <VideoReview key={item.name} item={item} />
      ))}
    </ul>
  );
}

type VideoReviewItem = Extract<(typeof SALES_PAGE.reviews.items)[number], { video: unknown }>;

/** A customer's own video: its picture until a tap, then the player in the card. */
function VideoReview({ item }: { item: VideoReviewItem }) {
  const [playing, setPlaying] = useState(false);
  const { reviews } = RESULT_PAGE;
  const video = item.video;
  const src =
    'youtube' in video
      ? `https://www.youtube-nocookie.com/embed/${video.youtube}?autoplay=1&rel=0&playsinline=1`
      : `https://player.vimeo.com/video/${video.vimeo}?autoplay=1&title=0&byline=0&portrait=0`;
  return (
    <li className={cn(styles.review, playing && styles.reviewPlaying)}>
      {playing ? (
        <iframe
          className={cn(styles.reviewPlayer, video.vertical && styles.reviewPlayerTall)}
          src={src}
          title={reviews.play(item.name)}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" className={styles.reviewThumb} onClick={() => setPlaying(true)} aria-label={reviews.play(item.name)}>
          <Image src={video.poster} alt="" width={640} height={360} sizes="(min-width: 960px) 352px, 92px" style={{ objectPosition: REVIEW_FACES[item.name as keyof typeof REVIEW_FACES] ?? '50% 35%' }} />
          <span className={styles.play} aria-hidden="true">
            <PlayIcon size={14} />
          </span>
        </button>
      )}
      <div className={styles.reviewBody}>
        <Stars size={14} label={reviews.stars} />
        <blockquote className={styles.quoteText} style={{ margin: 0 }}>
          &ldquo;{item.quote}&rdquo;
        </blockquote>
        <p className={styles.quoteWho}>
          {item.name}
          <span className={styles.reviewRole}>{item.role}</span>
        </p>
      </div>
    </li>
  );
}

/** A 6 s silent loop that plays while it is on screen. */
function LoopVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;
    video.muted = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);
  return <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-hidden="true" />;
}

/** The whole video ad with sound, over the page; Escape, the button or a tap beside it closes it. */
function Viewer({ item, onClose }: { item: (typeof RESULT_PAGE.examples.items)[number]; onClose: () => void }) {
  const close = useCallback(() => onClose(), [onClose]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div className={styles.viewer} role="dialog" aria-modal="true" aria-label={item.label} onClick={(event) => event.target === event.currentTarget && close()}>
      <button ref={closeRef} type="button" className={styles.viewerClose} onClick={close}>
        {RESULT_PAGE.examples.close}
      </button>
      <video className={styles.viewerVideo} src={item.full} poster={item.poster} controls autoPlay playsInline />
    </div>
  );
}

/** Szilard's walkthrough as the boards show it: the picture with its length, then the video in place on a tap, from the start or from a chapter. */
function Walkthrough({ token }: { token: string }) {
  const { tour } = SALES_PAGE;
  const { walkthrough } = RESULT_PAGE;
  const beacon = useFreeVideoBeacon(token);
  const [from, setFrom] = useState<number | null>(null);
  const play = (at: number) => {
    if (from === null) beacon('tour_play');
    setFrom(at);
  };
  return (
    <section id={tour.anchor} className={cn(styles.wrap, styles.walkthrough)} aria-labelledby="fv-tour-title">
      <div className={styles.walkText}>
        <p className={styles.kicker}>{walkthrough.kicker}</p>
        <h2 id="fv-tour-title" className={cn(styles.h2, styles.h2Small)}>
          {tour.title}
        </h2>
        <p className={styles.text}>{tour.lead}</p>
        <div className={cn(styles.jump, styles.jumpWide)}>
          <span className={styles.jumpLabel}>{walkthrough.jump}</span>
          {tour.chapters.map((chapter) => (
            <button key={chapter.at} type="button" className={styles.jumpChip} onClick={() => play(chapter.at)}>
              {chapter.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.walkVideo}>
        {from === null ? (
          <button type="button" className={styles.walkPoster} onClick={() => play(0)} aria-label={tour.playLabel}>
            <Image src={tour.poster} alt={walkthrough.posterAlt} width={1280} height={720} sizes="(min-width: 960px) 584px, 100vw" />
            <span className={styles.walkPlay} aria-hidden="true">
              <PlayIcon size={28} />
            </span>
            <span className={styles.walkLength}>{walkthrough.length}</span>
          </button>
        ) : (
          <iframe
            key={from}
            className={styles.walkPlayer}
            src={`https://www.youtube-nocookie.com/embed/${tour.youtubeId}?autoplay=1&rel=0&playsinline=1&start=${from}`}
            title={tour.title}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
        <div className={cn(styles.jump, styles.jumpPhone)}>
          <span className={styles.jumpLabel}>{walkthrough.jump}</span>
          {tour.chapters.map((chapter) => (
            <button key={chapter.at} type="button" className={styles.jumpChip} onClick={() => play(chapter.at)}>
              {chapter.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The countdown, ClickBank's notice, small pictures

/** Days, hours, minutes and seconds until the bonus ends, once a second (dashes on the server and in the first render). */
function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  const left = now === null ? null : Math.max(0, Date.parse(until) - now);
  const parts =
    left === null ? null : [Math.floor(left / 86_400_000), Math.floor(left / 3_600_000) % 24, Math.floor(left / 60_000) % 60, Math.floor(left / 1000) % 60];
  const units = ['days', 'hours', 'min', 'sec'];
  return (
    <div style={{ display: 'flex', gap: 8 }} role="timer" aria-label="Time left until the free bonuses end">
      {units.map((unit, index) => (
        <div
          key={unit}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', background: '#FFFFFF', border: '1px solid #F2D8A0', borderRadius: 10 }}
        >
          <span style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
            {parts ? (index === 0 ? parts[0] : String(parts[index]).padStart(2, '0')) : '--'}
          </span>
          <span style={{ fontSize: 12, color: '#64748B' }}>{unit}</span>
        </div>
      ))}
    </div>
  );
}

/** ClickBank sells the lifetime license, so its retailer notice goes with the checkout buttons (as on the sales page). */
function Legal() {
  const { legal } = SALES_PAGE;
  return (
    <div className={cn(styles.wrap, styles.narrow, styles.legal)} data-fv-bar-hide="">
      <p>
        {legal.support[0]}
        <a href="mailto:support@bluefx.net">support@bluefx.net</a>
        {legal.support[1]}
        <a href={legal.clickbankUrl} target="_blank" rel="noopener noreferrer">
          {legal.support[2]}
        </a>
        {legal.support[3]}
      </p>
      {legal.notes.map((note) => (
        <p key={note.slice(0, 24)}>{note}</p>
      ))}
    </div>
  );
}

function PayCards() {
  return (
    <div className={styles.cards} role="img" aria-label={RESULT_PAGE.buy.cards}>
      <svg width="42" height="26" viewBox="0 0 48 30" aria-hidden="true">
        <rect width="48" height="30" rx="4" fill="#ffffff" />
        <text x="24" y="20" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="bold" fontStyle="italic" fill="#1a1f71" textAnchor="middle">
          VISA
        </text>
      </svg>
      <svg width="42" height="26" viewBox="0 0 48 30" aria-hidden="true">
        <rect width="48" height="30" rx="4" fill="#ffffff" />
        <circle cx="20" cy="15" r="8" fill="#eb001b" />
        <circle cx="28" cy="15" r="8" fill="#f79e1b" fillOpacity="0.85" />
      </svg>
      <svg width="42" height="26" viewBox="0 0 48 30" aria-hidden="true">
        <rect width="48" height="30" rx="4" fill="#2e77bc" />
        <text x="24" y="19" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="bold" fill="#ffffff" textAnchor="middle">
          AMEX
        </text>
      </svg>
      <svg width="49" height="26" viewBox="0 0 56 30" aria-hidden="true">
        <rect width="56" height="30" rx="4" fill="#ffffff" />
        <text x="25" y="18.5" fontFamily="Arial, sans-serif" fontSize="7.5" fontWeight="bold" fill="#231f20" textAnchor="middle">
          DISCOVER
        </text>
        <circle cx="47" cy="15" r="3.5" fill="#f76e20" />
      </svg>
      <svg width="49" height="26" viewBox="0 0 56 30" aria-hidden="true">
        <rect width="56" height="30" rx="4" fill="#ffffff" />
        <text x="28" y="19.5" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="bold" fontStyle="italic" textAnchor="middle">
          <tspan fill="#003087">Pay</tspan>
          <tspan fill="#009cde">Pal</tspan>
        </text>
      </svg>
    </div>
  );
}

function Tick({ size, stroke, color = '#FFFFFF' }: { size: number; stroke: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Gift() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z"
        fill="none"
        stroke="#6B4F00"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sparkle() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z" fill="#7CB342" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Shield() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 2.5l8 3v6.2c0 4.6-3.3 8.4-8 9.8-4.7-1.4-8-5.2-8-9.8V5.5z" fill="#143D70" />
      <path d="M8 12.2l2.8 2.8L16.5 9.3" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon({ size, fill = '#143D70' }: { size: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill={fill} />
    </svg>
  );
}

function Stars({ size, label }: { size: number; label: string }) {
  return (
    <div className={styles.stars} role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6L1.3 7.8l6.1-.7z" fill="#F5B301" />
        </svg>
      ))}
    </div>
  );
}
