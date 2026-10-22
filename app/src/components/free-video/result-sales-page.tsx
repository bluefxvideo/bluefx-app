'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { RESULT_PAGE, VIDEO_REVIEWS_UNDER_ADS } from '@/lib/free-video/result-page';
import { RESULT_SALES, TOOL_GROUPS, type SalesTool } from '@/lib/free-video/result-sales';
import { goUrl, OFFER, type ResultPagePlacement } from '@/lib/free-video/offer';
import { PLAYER } from '@/lib/free-video/copy';
import type { FreeVideoView } from '@/types/free-video';
import { cn } from '@/lib/utils';
import { ChatLauncher } from './chat-launcher';
import { OfferButton } from './offer-button';
import { VideoAdPlayer } from './video-ad-player';
import {
  Countdown,
  Legal,
  LoopVideo,
  PayCards,
  PlayIcon,
  ResultScene,
  Reviews,
  Shield,
  Stars,
  Tick,
  VideoReview,
  videoReviewsOf,
  Viewer,
  Walkthrough,
  WritingCard,
  WrittenAd,
} from './result-page';
import rp from './result-page.module.css';
import s from './result-sales.module.css';

interface ResultSalesPageProps {
  view: FreeVideoView;
  token: string;
  /** The 2 free bonuses still run (offer.ts cleanCopyUntil). */
  bonus: boolean;
  /** The bonus deadline in the visitor's time zone; null on the server and in the first render. */
  deadline: { day: string; when: string } | null;
  onPlayWithSound: () => void;
  onComplete: () => void;
}

/**
 * The result page "the sales page way" (design board J, owner 2026-10-22): result-sales.ts has the words and the order.
 * Every button opens ClickBank's checkout through /go (fvres1 price box, fvresads bonus, fvres2 how, fvrestools the 4
 * tool groups, fvres4 old way, fvres5 value table, fvres6 still thinking, fvres3 walkthrough, fvresbar the phone bar).
 */
export function ResultSalesPage({ view, token, bonus, deadline, onPlayWithSound, onComplete }: ResultSalesPageProps) {
  const { domain, firstName } = view;
  const videoUrl = view.videoUrl as string;
  const cards = view.nextAds ?? null;
  const written = bonus && (Boolean(cards) || Boolean(view.nextAdsPending));
  const priceRef = useRef<HTMLElement>(null);
  const [barShown, setBarShown] = useState(false);
  const [viewing, setViewing] = useState<(typeof RESULT_PAGE.examples.items)[number] | null>(null);
  const { banner, top, hero, salesVideo, price, button, how, tools, oldWay, customers, founder, lifetime, own, guarantee, still, faq, ps } = RESULT_SALES;
  const dov = RESULT_PAGE.stack.proof[0];

  return (
    <div className={cn(rp.page, s.page)}>
      <p className={s.banner}>
        <strong>{banner.strong}</strong> {banner.text} <u>{banner.off}</u> {banner.end}
      </p>

      <section className={cn(rp.wrap, s.top)} aria-labelledby="fv-sales-title">
        <h1 id="fv-sales-title" className={s.topTitle}>
          {top.title(firstName)}
        </h1>
        <div className={s.topVideo}>
          <VideoAdPlayer src={videoUrl} label={PLAYER.label(domain)} onPlayWithSound={onPlayWithSound} onComplete={onComplete} className={rp.heroPlayerFrame} tapToPlay />
        </div>
        <p className={s.topSample}>{top.sample}</p>
      </section>

      <section className={s.hero} aria-labelledby="fv-sales-hero">
        <div className={cn(rp.wrap, s.heroText)}>
          <p className={s.heroKicker}>{hero.kicker}</p>
          <span className={s.heroPill}>{hero.pill}</span>
          <h2 id="fv-sales-hero" className={s.heroTitle}>
            {hero.titleStart}
            <span className={s.heroMark}>{hero.titleMark}</span>
            {hero.titleEnd}
          </h2>
          <p className={s.heroSub}>
            {hero.subStart}
            <strong>{hero.subStrong}</strong>
            {hero.subEnd}
          </p>
        </div>
        <ul className={s.heroReel}>
          {RESULT_PAGE.examples.items.slice(0, 6).map((item) => (
            <li key={item.id}>
              <button type="button" className={s.heroTile} onClick={() => setViewing(item)} aria-label={RESULT_PAGE.examples.watch(item.label)}>
                <LoopVideo src={item.loop} poster={item.poster} />
                <span className={s.heroSound} aria-hidden="true">
                  <PlayIcon size={11} fill="#ffffff" />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className={cn(rp.wrap, s.note)}>{hero.note}</p>
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-video">
        <h2 id="fv-sales-video" className={rp.h2}>
          {salesVideo.title}
        </h2>
        <div className={s.vsl}>
          <iframe
            src={`https://player.vimeo.com/video/${salesVideo.vimeo}?title=0&byline=0&portrait=0`}
            title={salesVideo.caption}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
        <p className={s.caption}>{salesVideo.caption}</p>
      </section>

      <section ref={priceRef} className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-price">
        <h2 id="fv-sales-price" className={rp.h2}>
          {price.title}
        </h2>
        <div className={s.priceBox}>
          <BirthdayTimer label={price.timer} />
          <p className={s.priceDeal}>{price.deal}</p>
          <div className={s.prices}>
            <p className={s.priceRegular}>
              {price.regular} <s>{OFFER.was}</s>
            </p>
            <p className={s.priceBirthday}>
              {price.birthday} <span>{OFFER.now}</span>
            </p>
          </div>
          <p className={s.priceLine}>{price.line}</p>
          <SalesBuy token={token} placement="fvres1" note={button.guarantee} />
        </div>
        <ul className={cn(rp.reviews, s.priceProof)}>
          <li className={rp.review}>
            <div className={rp.reviewFace}>
              <Image src={dov.photo} alt={dov.name} width={240} height={240} sizes="120px" />
            </div>
            <div className={rp.reviewBody}>
              <Stars size={13} label={RESULT_PAGE.reviews.stars} />
              <blockquote className={rp.quoteText} style={{ margin: 0 }}>
                {dov.before}
                <strong>{dov.strong}</strong>
                {dov.after}
              </blockquote>
              <p className={rp.quoteWho}>
                {dov.name}
                <span className={rp.reviewRole}>{dov.role}</span>
              </p>
            </div>
          </li>
          {videoReviewsOf(VIDEO_REVIEWS_UNDER_ADS).map((item) => (
            <VideoReview key={item.name} item={item} />
          ))}
        </ul>
      </section>

      {bonus && (
        <section id={RESULT_PAGE.written.anchor} className={cn(rp.wrap, s.section, s.bonusSection)} aria-labelledby="fv-sales-bonus">
          <h2 id="fv-sales-bonus" className={rp.h2}>
            {RESULT_SALES.bonus.title(domain)}
          </h2>
          <p className={rp.text}>{RESULT_SALES.bonus.text(domain, deadline?.day ?? null)}</p>
          {written && (
            <ul className={rp.ads}>
              {(cards ?? ([2, 3, 4] as const).map((n) => ({ n, pending: true }) as const)).map((card) =>
                'pending' in card ? <WritingCard key={card.n} n={card.n} /> : <WrittenAd key={card.n} ad={card} />
              )}
            </ul>
          )}
          <ul className={s.bonusItems}>
            {RESULT_SALES.bonus.items.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong> {item.text}
              </li>
            ))}
          </ul>
          {view.cleanUntil && (
            <div className={s.timerBlock}>
              <p className={s.timerLabel}>{RESULT_SALES.bonus.timer}</p>
              <Countdown until={view.cleanUntil} />
            </div>
          )}
          <SalesBuy token={token} placement="fvresads" note={button.written} />
        </section>
      )}

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-how">
        <h2 id="fv-sales-how" className={rp.h2}>
          {how.title}
        </h2>
        <ol className={rp.steps}>
          {RESULT_PAGE.how.steps.map((step, index) => (
            <li key={step.title} className={cn(rp.step, step.done && rp.stepDone)}>
              <span className={cn(rp.stepIcon, !step.done && rp.stepIconNext)} aria-hidden="true">
                {step.done ? <Tick size={18} stroke={3.2} /> : index + 1}
              </span>
              <div className={rp.stepText}>
                <p className={rp.stepTitle}>
                  {index + 1}. {step.title} <span className={cn(rp.stepTag, !step.done && rp.stepTagNext)}>{step.done ? RESULT_PAGE.how.doneTag : RESULT_PAGE.how.nextTag}</span>
                </p>
                <p className={cn(rp.stepNote, step.done && rp.stepNoteDone)}>{step.text(domain)}</p>
              </div>
            </li>
          ))}
        </ol>
        <ResultScene domain={domain} />
        <h3 className={s.h3}>{how.scrollTitle}</h3>
        <p className={rp.text}>{how.scrollText}</p>
        <div className={s.leads}>
          <Image src={how.leadsImage} alt={how.leadsAlt} width={554} height={178} sizes="(min-width: 600px) 280px, 50vw" />
          <p>{how.leads}</p>
        </div>
        <SalesBuy token={token} placement="fvres2" note={button.guarantee} />
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-tools">
        <p className={rp.kicker}>{tools.kicker}</p>
        <h2 id="fv-sales-tools" className={rp.h2}>
          {tools.title}
        </h2>
        <p className={rp.text}>{tools.lead(domain)}</p>
        <p className={s.note}>{tools.note}</p>
        {(() => {
          let number = 0;
          return TOOL_GROUPS.map((group, index) => (
            <div key={group.title} className={s.group}>
              <p className={s.groupTitle}>{group.title}</p>
              {group.lead && <p className={rp.text}>{group.lead}</p>}
              {group.tools.map((tool) => {
                number += 1;
                return <ToolCard key={tool.name} n={number} tool={tool} domain={domain} />;
              })}
              {index === TOOL_GROUPS.length - 1 && <p className={s.also}>{tools.alsoIncluded}</p>}
              <SalesBuy token={token} placement="fvrestools" label={button.tools} withPrice={false} />
            </div>
          ));
        })()}
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-old">
        <p className={rp.kicker}>{oldWay.kicker}</p>
        <h2 id="fv-sales-old" className={rp.h2}>
          {oldWay.title}
        </h2>
        <p className={rp.text}>{oldWay.intro}</p>
        <Image className={s.drawing} src={oldWay.image} alt={oldWay.alt} width={900} height={600} sizes="(min-width: 760px) 712px, 100vw" />
        <div className={s.oldList}>
          <p className={s.oldTitle}>{oldWay.oldTitle}</p>
          {oldWay.old.map((line) => (
            <p key={line} className={s.oldItem}>
              <span aria-hidden="true">✗</span> {line}
            </p>
          ))}
        </div>
        <div className={s.newList}>
          <p className={s.newTitle}>{oldWay.newTitle}</p>
          {oldWay.new.map((line) => (
            <p key={line} className={s.newItem}>
              <span aria-hidden="true">✓</span> {line}
            </p>
          ))}
        </div>
        <h3 className={s.h3}>{oldWay.costTitle}</h3>
        <div className={s.cost}>
          {[oldWay.freelancer, oldWay.machine].map((card, index) => (
            <div key={card.name} className={cn(s.costCard, index === 1 && s.costCardUs)}>
              <p className={s.costName}>{card.name}</p>
              <p className={s.costLine}>{card.line1}</p>
              <p className={s.costLine}>{card.line2}</p>
              <p className={s.costPrice}>{card.price}</p>
              <p className={s.costPer}>{card.per}</p>
            </div>
          ))}
        </div>
        <p className={s.strongLine}>{oldWay.after(domain)}</p>
        <SalesBuy token={token} placement="fvres4" />
      </section>

      <section className={cn(rp.wrap, s.section)} aria-labelledby="fv-sales-customers">
        <p className={cn(rp.kicker, rp.centerWide)}>{customers.kicker}</p>
        <h2 id="fv-sales-customers" className={cn(rp.h2, rp.centerWide)}>
          {customers.title}
        </h2>
        <p className={cn(rp.text, rp.centerWide, rp.leadWide)}>{customers.lead}</p>
        <Reviews />
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-founder">
        <p className={rp.kicker}>{founder.kicker}</p>
        <h2 id="fv-sales-founder" className={rp.h2}>
          {founder.title}
        </h2>
        <div className={s.founderHead}>
          <Image className={s.face} src={founder.photo} alt={founder.name} width={128} height={128} />
          <div>
            <p className={s.founderName}>{founder.name}</p>
            <p className={s.founderRole}>{founder.role}</p>
          </div>
        </div>
        {founder.text.map((line) => (
          <p key={line.slice(0, 30)} className={s.body}>
            {line}
          </p>
        ))}
        <ul className={s.stats}>
          {founder.stats.map((stat) => (
            <li key={stat}>{stat}</li>
          ))}
        </ul>
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-lifetime">
        <h2 id="fv-sales-lifetime" className={rp.h2}>
          {lifetime.title}
        </h2>
        {lifetime.paragraphs.map((paragraph) => (
          <p key={paragraph.text.slice(0, 30)} className={s.body}>
            {paragraph.lead && <strong>{paragraph.lead}</strong>}
            {paragraph.text}
          </p>
        ))}
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-own">
        <h2 id="fv-sales-own" className={rp.h2}>
          {own.title}
        </h2>
        <p className={rp.text}>{own.lead}</p>
        <Image className={s.product} src={own.image} alt={own.imageAlt} width={1200} height={800} sizes="(min-width: 760px) 712px, 100vw" />
        <ul className={s.rows}>
          {own.rows.map((row) => (
            <li key={row.text}>
              <span>✓ {row.text}</span>
              <strong>{row.value}</strong>
            </li>
          ))}
        </ul>
        {bonus && (
          <ul className={s.bonusRows}>
            {own.bonusRows.map((row) => (
              <li key={row.label}>
                <span>
                  <strong>
                    {row.label} {deadline ? `until ${deadline.when}` : ''}:
                  </strong>{' '}
                  {typeof row.text === 'function' ? row.text(domain) : row.text}
                </span>
                <strong>{row.value}</strong>
              </li>
            ))}
          </ul>
        )}
        <div className={s.finale}>
          <p className={s.finaleTotal}>
            {own.total} <span>{own.totalValue}</span>
          </p>
          <p className={s.finaleLifetime}>
            {own.lifetime} <s>{OFFER.was}</s>
          </p>
          <p className={s.finaleBirthday}>
            {own.birthday} <span>{OFFER.now}</span>
          </p>
          <p className={s.finaleGrab}>{own.grab}</p>
          <p className={s.finaleOff}>{own.off}</p>
        </div>
        <SalesBuy token={token} placement="fvres5" note={button.guarantee} />
        <p className={s.small}>{own.recharge}</p>
        {bonus && deadline && <p className={s.small}>{own.bonusEnds(deadline.when)}</p>}
        <p className={s.small}>{own.source}</p>
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-guarantee">
        <div className={s.guarantee}>
          <Shield />
          <div className={s.guaranteeBody}>
            <h2 id="fv-sales-guarantee" className={rp.h2}>
              {guarantee.title}
            </h2>
            <div className={s.founderHead}>
              <Image className={s.face} src={founder.photo} alt={guarantee.name} width={128} height={128} />
              <p className={s.founderRole}>{guarantee.name}</p>
            </div>
            {guarantee.text.map((line, index) => (
              <p key={line.slice(0, 30)} className={s.body}>
                {index === 1 && !written ? guarantee.textNoBonus : line}
              </p>
            ))}
            <p className={s.signature}>{guarantee.signature}</p>
          </div>
        </div>
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-still">
        <h2 id="fv-sales-still" className={rp.h2}>
          {still.title}
        </h2>
        {still.text.map((line) => (
          <p key={line.slice(0, 30)} className={s.body}>
            {line}
          </p>
        ))}
        <BirthdayTimer label={price.timer} />
        <SalesBuy token={token} placement="fvres6" note={button.guarantee} />
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-faq">
        <h2 id="fv-sales-faq" className={rp.h2}>
          {faq.title}
        </h2>
        <dl className={rp.faq}>
          {faq.items.map((item) => (
            <div key={item.q} className={rp.faqItem}>
              <dt className={rp.faqQ}>{item.q}</dt>
              {item.a.map((line) => (
                <dd key={line.slice(0, 30)} className={rp.faqA} style={{ margin: 0 }}>
                  {line}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </section>

      <Walkthrough token={token} />
      <div className={cn(rp.wrap, rp.narrow, s.sectionTight)}>
        <SalesBuy token={token} placement="fvres3" />
      </div>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-label="P.S.">
        <p className={s.body}>{ps.p1(firstName, domain)}</p>
        <p className={s.body}>{ps.p2}</p>
        <p className={s.body}>{ps.p3}</p>
        {written && <p className={s.body}>{ps.bonus(domain, deadline?.when ?? null)}</p>}
        <p className={s.body}>{ps.pps(domain)}</p>
      </section>

      <Legal />
      <ChatLauncher token={token} firstName={firstName} domain={domain} raised={barShown} />
      <SalesBar token={token} watch={priceRef} onShown={setBarShown} />
      {viewing && <Viewer item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** A buy button: the name, "$297 once, for life", the card logos, and a line under it. */
function SalesBuy({ token, placement, label = RESULT_SALES.button.main, withPrice = true, note }: { token: string; placement: ResultPagePlacement; label?: string; withPrice?: boolean; note?: string }) {
  return (
    <div className={rp.buy}>
      <OfferButton className={rp.buyButton} href={goUrl(placement, token)}>
        {label}
        {withPrice && <span className={rp.buyPrice}>{RESULT_SALES.button.price}</span>}
      </OfferButton>
      <PayCards />
      {note && <p className={rp.buyNote}>{note}</p>}
    </div>
  );
}

/** One of the 12 tools: its demo, what it does, what it does for the business, the monthly amount and the value. */
function ToolCard({ n, tool, domain }: { n: number; tool: SalesTool; domain: string }) {
  const { tools } = RESULT_SALES;
  const media = tool.media;
  return (
    <article className={s.tool}>
      <div className={s.toolHead}>
        <span className={s.toolNumber}>{n}</span>
        <h3 className={s.toolName}>{tool.name}</h3>
      </div>
      {media.kind === 'gif' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={s.toolMedia} src={media.src} alt={media.alt} loading="lazy" />
      )}
      {media.kind === 'video' && (
        <div className={cn(s.toolMedia, s.toolVideo)}>
          <LoopVideo src={media.src} poster={media.poster} />
        </div>
      )}
      {media.kind === 'audio' && <AudioSamples tracks={media.tracks} />}
      {media.kind === 'placeholder' && <div className={cn(s.toolMedia, s.toolPlaceholder)}>{media.label}</div>}
      {media.kind !== 'audio' && media.kind !== 'placeholder' && <p className={s.caption}>{tools.proof(tool.name)}</p>}
      <p className={s.body}>{tool.does(domain)}</p>
      <p className={s.forBusiness}>
        <strong>{tools.forBusiness}</strong> {tool.forBusiness}
      </p>
      <p className={s.amount}>{tool.amount}</p>
      <p className={s.value}>
        <span>
          {tools.value} <strong>{tool.value}</strong> {tools.elsewhere}
        </span>
        <span className={s.included}>{tools.included}</span>
      </p>
    </article>
  );
}

/** The sales page's audio samples: one button per track, one track playing at a time. */
function AudioSamples({ tracks }: { tracks: readonly { label: string; src: string }[] }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const toggle = (src: string) => {
    const audio = ref.current;
    if (!audio) return;
    if (playing === src) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.src = src;
    void audio.play().catch(() => setPlaying(null));
    setPlaying(src);
  };
  return (
    <div className={s.audio}>
      {tracks.map((track) => (
        <button key={track.src} type="button" className={cn(s.audioButton, playing === track.src && s.audioOn)} onClick={() => toggle(track.src)} aria-pressed={playing === track.src}>
          <PlayIcon size={12} fill={playing === track.src ? '#ffffff' : '#143D70'} />
          {track.label}
        </button>
      ))}
      <audio ref={ref} onEnded={() => setPlaying(null)} preload="none" />
    </div>
  );
}

/**
 * The birthday price's clock, the way the sales page shows it (ai.bluefx.net/lifetime/): a per-visitor 1:57:23 window
 * kept in the browser, a fresh window 5 minutes after it ends (owner's sales page mechanism, kept on his decision).
 */
const BIRTHDAY_KEY = 'amm_founding_deadline_2h';
const BIRTHDAY_WINDOW_MS = (117 * 60 + 23) * 1000;
const BIRTHDAY_COOLDOWN_MS = 5 * 60 * 1000;
function BirthdayTimer({ label }: { label: string }) {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const start = Date.now();
    let deadline = 0;
    try {
      deadline = Number(window.localStorage.getItem(BIRTHDAY_KEY) || 0);
    } catch {
      deadline = 0;
    }
    if (!deadline || (deadline <= start && start - deadline > BIRTHDAY_COOLDOWN_MS)) {
      deadline = start + BIRTHDAY_WINDOW_MS;
      try {
        window.localStorage.setItem(BIRTHDAY_KEY, String(deadline));
      } catch {
        // A private window: the clock still runs for this visit.
      }
    }
    setUntil(deadline);
    setNow(start);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const left = until === null || now === null ? null : Math.max(0, until - now);
  if (left === 0) return null;
  const parts = left === null ? null : [Math.floor(left / 86_400_000), Math.floor(left / 3_600_000) % 24, Math.floor(left / 60_000) % 60, Math.floor(left / 1000) % 60];
  return (
    <div className={s.timerBlock}>
      <p className={s.timerLabel}>{label}</p>
      <div className={s.clock} role="timer" aria-label={label}>
        {['Days', 'Hours', 'Min', 'Sec'].map((unit, index) => (
          <div key={unit}>
            <span>{parts ? String(parts[index]).padStart(2, '0') : '--'}</span>
            <small>{unit}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The bar at the bottom of a phone's screen once the price box has scrolled up, away while a buy button is on screen. */
function SalesBar({ token, watch, onShown }: { token: string; watch: React.RefObject<HTMLElement | null>; onShown: (shown: boolean) => void }) {
  const [past, setPast] = useState(false);
  const [blocked, setBlocked] = useState(false);
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
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [watch]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = [...document.querySelectorAll<HTMLElement>('[data-fv-bar-hide], footer')].filter((target) => !target.closest('[data-fv-bar]'));
    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.boundingClientRect.height > 0) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setBlocked(onScreen.size > 0);
    });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  const shown = past && !blocked;
  useEffect(() => onShown(shown), [shown, onShown]);
  return (
    <aside className={cn(rp.bar, shown && rp.barOn, s.bar)} aria-label={RESULT_SALES.button.bar} aria-hidden={!shown} inert={!shown} data-fv-bar="">
      <OfferButton className={cn(rp.buyButton, rp.barButton)} href={goUrl('fvresbar', token)}>
        {RESULT_SALES.button.bar}
      </OfferButton>
    </aside>
  );
}
