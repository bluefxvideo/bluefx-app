'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { RESULT_PAGE } from '@/lib/free-video/result-page';
import { RESULT_SALES, SALES_PAGE_HERO_VIMEO, TOOL_GROUPS, type SalesTool } from '@/lib/free-video/result-sales';
import { goUrl, OFFER, type ResultPagePlacement } from '@/lib/free-video/offer';
import { PLAYER } from '@/lib/free-video/copy';
import type { FreeVideoView } from '@/types/free-video';
import { cn } from '@/lib/utils';
import { ChatLauncher } from './chat-launcher';
import { OfferButton } from './offer-button';
import { VideoAdPlayer } from './video-ad-player';
import {
  Confetti,
  Legal,
  Robot,
  LoopVideo,
  PayCards,
  PlayIcon,
  ResultScene,
  Reviews,
  Shield,
  Stars,
  Tick,
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
  const reelRef = useRef<HTMLUListElement>(null);
  const [barShown, setBarShown] = useState(false);
  // Krug: on a phone the chat bubble covered the line under their video ad; it comes in once they scroll past it.
  const [chatOn, setChatOn] = useState(false);
  useEffect(() => {
    const check = () => setChatOn(window.innerWidth >= 960 || window.scrollY > 640);
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);
  const [viewing, setViewing] = useState<(typeof RESULT_PAGE.examples.items)[number] | null>(null);
  const { banner, top, hero, salesVideo, price, button, how, tools, oldWay, customers, founder, lifetime, own, guarantee, still, faq, ps } = RESULT_SALES;
  const dov = RESULT_PAGE.stack.proof[0];

  return (
    <div className={cn(rp.page, s.page)}>
      <p className={s.banner}>
        <strong>{banner.strong}</strong> {banner.text} <u>{banner.off}</u> {banner.end}
      </p>

      <section className={cn(rp.wrap, s.top)} aria-labelledby="fv-sales-title">
        <div className={s.topVideo}>
          <VideoAdPlayer src={videoUrl} label={PLAYER.label(domain)} onPlayWithSound={onPlayWithSound} onComplete={onComplete} className={rp.heroPlayerFrame} tapToPlay />
        </div>
        {/* On a phone the title sits above the video (display: contents); on a computer the words fill the space beside it and lead down the page (owner 2026-10-22). */}
        <div className={s.topText}>
          {/* The robot with its confetti burst, as on the classic page (owner 2026-10-22: "the lil robot is gone"). */}
          <div className={s.topHead}>
            <Confetti />
            <Robot className={cn(rp.robot, s.topRobot)} label={RESULT_PAGE.hero.robot} burst />
            <span className={rp.robotLabel}>{RESULT_PAGE.hero.robotLabel}</span>
            <h1 id="fv-sales-title" className={s.topTitle}>
              {top.title(firstName)}
            </h1>
          </div>
          <p className={s.topSample}>{top.sample}</p>
          <div className={s.topNext}>
            <p className={s.topKicker}>{hero.kicker}</p>
          </div>
        </div>
      </section>

      <section className={s.hero} aria-labelledby="fv-sales-hero">
        <div className={cn(rp.wrap, s.heroText)}>
          <p className={cn(s.heroKicker, s.phoneOnly)}>{hero.kicker}</p>
          <span className={s.heroPill}>{hero.pill}</span>
          <h2 id="fv-sales-hero" className={s.heroTitle}>
            {hero.titleLine1}
            <br />
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
        {/* Like the sales page's carousel: a fixed width, the edges fade, arrows on a computer, swipe on a phone. */}
        <div id="fv-sales-reel" className={s.reelWrap}>
          <button type="button" className={cn(s.reelArrow, s.reelArrowLeft)} onClick={() => reelRef.current?.scrollBy({ left: -340, behavior: 'smooth' })} aria-label="Earlier video ads">
            ‹
          </button>
          <button type="button" className={cn(s.reelArrow, s.reelArrowRight)} onClick={() => reelRef.current?.scrollBy({ left: 340, behavior: 'smooth' })} aria-label="More video ads">
            ›
          </button>
        <ul ref={reelRef} className={s.heroReel}>
          {SALES_PAGE_HERO_VIMEO.map((id) => (
            <li key={id}>
              <VimeoTile id={id} />
            </li>
          ))}
          {RESULT_PAGE.examples.items.map((item) => (
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
        </div>
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-video">
        <h2 id="fv-sales-video" className={rp.h2}>
          {salesVideo.title}
        </h2>
        <SalesVideo />
        <p className={s.caption}>{salesVideo.caption}</p>
      </section>

      <section ref={priceRef} className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-price">
        <h2 id="fv-sales-price" className={rp.h2}>
          {price.title}
        </h2>
        <div className={s.priceBox}>
          <p className={s.priceReason}>{price.reason}</p>
          <BirthdayTimer label={bonus ? price.timerBonus : price.timer} until={bonus ? view.cleanUntil : undefined} />
          <div className={s.prices}>
            <p className={s.priceRegular}>
              {price.regular} <s className={s.slash}>{OFFER.was}</s>
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
        </ul>
      </section>

      {bonus && (
        <section id={RESULT_PAGE.written.anchor} className={cn(rp.wrap, s.section, s.bonusSection)} aria-labelledby="fv-sales-bonus">
          <h2 id="fv-sales-bonus" className={rp.h2}>
            {RESULT_SALES.bonus.title(domain)}
          </h2>
          <p className={cn(rp.text, s.intro)}>{RESULT_SALES.bonus.text(domain, deadline?.day ?? null)}</p>
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
          <SalesBuy token={token} placement="fvresads" note={`${button.guarantee} ${button.written}`} />
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
        <div className={s.sceneWrap}>
          <ResultScene domain={domain} />
        </div>
        <h3 className={cn(s.h3, s.subSection)}>{how.scrollTitle}</h3>
        <p className={rp.text}>{how.scrollText}</p>
        <figure className={s.leads}>
          <Image src={how.leadsImage} alt={how.leadsAlt} width={1320} height={192} sizes="(min-width: 760px) 712px, 100vw" />
          <figcaption>{how.leads}</figcaption>
        </figure>
        <SalesBuy token={token} placement="fvres2" note={button.guarantee} />
      </section>

      {/* The most important section (owner 2026-10-22): its own dark band and a headline as big as the hero's. */}
      <div className={s.toolsBand}>
      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-tools">
        <p className={s.toolsKicker}>{tools.kicker}</p>
        <h2 id="fv-sales-tools" className={s.toolsTitle}>
          {tools.titleStart}
          <span>{tools.titleMark}</span>
        </h2>
        <p className={s.toolsLead}>{tools.lead(domain)}</p>
        <p className={s.toolsNote}>{tools.note}</p>
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
              {(index === 1 || index === TOOL_GROUPS.length - 1) && <SalesBuy token={token} placement="fvrestools" />}
            </div>
          ));
        })()}
      </section>
      </div>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-old">
        <p className={cn(rp.kicker, s.kicker)}>{oldWay.kicker}</p>
        <h2 id="fv-sales-old" className={rp.h2}>
          {oldWay.title}
        </h2>
        <p className={cn(rp.text, s.intro)}>{oldWay.intro}</p>
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
        <p className={cn(rp.kicker, s.kicker, rp.centerWide)}>{customers.kicker}</p>
        <h2 id="fv-sales-customers" className={cn(rp.h2, rp.centerWide)}>
          {customers.title}
        </h2>
        <p className={cn(rp.text, rp.centerWide, rp.leadWide)}>{customers.lead}</p>
        <Reviews />
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-founder">
        <p className={cn(rp.kicker, s.kicker)}>{founder.kicker}</p>
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
        <p className={cn(rp.text, s.intro)}>{own.lead}</p>
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
                  <strong>{row.label}:</strong>{' '}
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
            {own.lifetime} <s className={s.slash}>{OFFER.was}</s>
          </p>
          <p className={s.finaleBirthday}>
            {own.birthday} <span>{OFFER.now}</span>
          </p>
          <p className={s.finaleGrab}>{own.grab}</p>
          <p className={s.finaleOff}>{own.off}</p>
        </div>
        <SalesBuy token={token} placement="fvres5" note={button.guarantee} />
        <p className={s.small}>{own.source}</p>
      </section>

      <section className={cn(rp.wrap, rp.narrow, s.section)} aria-labelledby="fv-sales-guarantee">
        <div className={s.guarantee}>
          <div className={s.guaranteeBody}>
            <h2 id="fv-sales-guarantee" className={cn(rp.h2, s.guaranteeTitle)}>
              <Shield />
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
        <BirthdayTimer label={bonus ? price.timerBonus : price.timer} until={bonus ? view.cleanUntil : undefined} />
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
        <p className={s.body}>
          <strong>P.S.</strong> {ps.p1(firstName, domain)}
        </p>
        <p className={s.body}>{ps.p2}</p>
        <p className={s.body}>{ps.p3}</p>
        {written && <p className={s.body}>{ps.bonus(domain, deadline?.when ?? null)}</p>}
        <p className={s.body}>
          <strong>P.P.S.</strong> {ps.pps(domain)}
        </p>
      </section>

      <Legal />
      {chatOn && <ChatLauncher token={token} firstName={firstName} domain={domain} raised={barShown} />}
      <SalesBar token={token} watch={priceRef} onShown={setBarShown} />
      {viewing && <Viewer item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** The sales video: its thumbnail until a tap, then the Vimeo player with sound. */
function SalesVideo() {
  const { salesVideo } = RESULT_SALES;
  const [playing, setPlaying] = useState(false);
  return (
    <div className={s.vsl}>
      {playing ? (
        <iframe
          src={`https://player.vimeo.com/video/${salesVideo.vimeo}?autoplay=1&title=0&byline=0&portrait=0`}
          title={salesVideo.caption}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" className={s.vslPoster} onClick={() => setPlaying(true)} aria-label={salesVideo.play}>
          <Image src={salesVideo.poster} alt="" fill sizes="(min-width: 760px) 712px, 100vw" />
          <span className={s.vslPlay} aria-hidden="true">
            <PlayIcon size={30} />
          </span>
        </button>
      )}
    </div>
  );
}

/** A buy button: the name, "$297 once, for life", the card logos, and a line under it. */
function SalesBuy({ token, placement, label = RESULT_SALES.button.main, withPrice = true, note = RESULT_SALES.button.guarantee }: { token: string; placement: ResultPagePlacement; label?: string; withPrice?: boolean; note?: string }) {
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
      {media.kind === 'phone' && (
        <div className={s.toolPhone}>
          <LoopVideo src={media.src} poster={media.poster} />
        </div>
      )}
      {media.kind === 'slides' && <Slides slides={media.slides} />}
      {media.kind === 'audio' && <AudioSamples tracks={media.tracks} />}
      {media.kind === 'placeholder' && <div className={cn(s.toolMedia, s.toolPlaceholder)}>{media.label}</div>}
      <p className={s.body}>{tool.does(domain)}</p>
      <p className={s.forBusiness}>
        <strong>{tools.forBusiness}</strong> {tool.forBusiness}
      </p>
      {/* Krug: the monthly amount and the value on 1 row. */}
      <p className={s.value}>
        <span>
          <strong className={s.amountInline}>{tool.amount}</strong> · {tool.value} {tools.elsewhere}
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
/**
 * The birthday price's clock. While their 3-day bonus runs it ends with the bonus (owner 2026-10-22: "maybe we need to
 * go with the 3 days"), so the page has 1 deadline; after that, the sales page's per-visitor 1:57:23 window.
 */
function BirthdayTimer({ label, until }: { label: string; until?: string }) {
  const [end, setEnd] = useState<number | null>(null);
  useEffect(() => {
    if (until) {
      setEnd(Date.parse(until));
      return;
    }
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
    setEnd(deadline);
  }, [until]);
  return <Clock label={label} until={end} />;
}

/** Days, hours, minutes and seconds until `until`, once a second; dashes before the page runs in the browser, gone at zero. */
function Clock({ label, until }: { label: string; until: number | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
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

/** One of the sales page's top video ads: a Vimeo background player, loaded when it comes near the screen; a tap plays it with sound. */
function VimeoTile({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [sound, setSound] = useState(false);
  useEffect(() => {
    const tile = ref.current;
    if (!tile || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: '200px' });
    observer.observe(tile);
    return () => observer.disconnect();
  }, []);
  const src = sound
    ? `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0&controls=1`
    : `https://player.vimeo.com/video/${id}?background=1&autopause=0`;
  return (
    <div ref={ref} className={s.heroTile}>
      {near && <iframe src={src} title="A video ad made with the AI Media Machine" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
      {!sound && (
        <button type="button" className={s.heroTap} onClick={() => setSound(true)} aria-label="Play this video ad with sound">
          <span className={s.heroSound} aria-hidden="true">
            <PlayIcon size={11} fill="#ffffff" />
          </span>
        </button>
      )}
    </div>
  );
}

/** Image Maker: their photo in the corner, the AI's picture big, one example every 3 seconds. */
function Slides({ slides }: { slides: readonly { from: string | null; to: string; label: string }[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 3000);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  return (
    <div className={s.slides}>
      {slides.map((slide, i) => (
        <figure key={slide.to} className={cn(s.slide, i === index && s.slideOn)} aria-hidden={i !== index}>
          {/* The whole picture fits (owner: a cropped face looked strange); a blurred copy fills the sides. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.slideBack} src={slide.to} alt="" aria-hidden="true" loading="lazy" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.slideTo} src={slide.to} alt={slide.label} loading="lazy" />
          {slide.from && (
            <span className={s.slideFrom}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.from} alt="" loading="lazy" />
              <small>{RESULT_SALES.tools.yourPhoto}</small>
            </span>
          )}
          <figcaption>{slide.label}</figcaption>
        </figure>
      ))}
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
