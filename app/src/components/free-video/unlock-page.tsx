'use client';

import Image from 'next/image';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useFreeVideoBeacon } from '@/hooks/use-free-video-beacon';
import { DOWNLOAD, PLAYER } from '@/lib/free-video/copy';
import { PLAN_INFO_PATH, planGoUrl, unlockGoUrl } from '@/lib/free-video/offer';
import { UNLOCK_PAGE } from '@/lib/free-video/unlock-page';
import type { UnlockPrice } from '@/lib/free-video/unlock-price';
import { cn } from '@/lib/utils';
import type { FreeVideoView } from '@/types/free-video';
import { PayCards, ResultScene, Shield, Stars, Tick, VideoReview, videoReviewsOf } from './result-page';
import { SaveToPhotos } from './save-to-photos';
import { VideoAdPlayer } from './video-ad-player';
import rp from './result-page.module.css';
import s from './unlock-page.module.css';

interface UnlockPageProps {
  token: string;
  initial: FreeVideoView;
  price: UnlockPrice;
  /** The last day the video ad can be unlocked (ISO), or null when unknown. */
  filesUntil: string | null;
  changesLeft: number;
  /** A local preview of one display: the page never asks for news. */
  preview?: boolean;
}

/** How often the page asks for news while the payment or the clean video ad is on its way. */
const POLL_MS = 4000;
/** A checkout click keeps the page asking on a timer for 30 minutes; after that it still asks whenever the page is shown again. */
const CLICK_WINDOW_MS = 30 * 60_000;

/**
 * The unlock page (owner 2026-10-27): offer → "unlocking" (paid, the clean render runs) → ready (download, change box,
 * the Weekly Video Plan). The checkout opens in a new tab through /go/fvunlock; this page polls the lead's view, and asks
 * again every time the visitor comes back to this tab (no time limit), or taps "Paid? Tap here" in the phone bar.
 */
export function UnlockPage({ token, initial, price, filesUntil, changesLeft, preview = false }: UnlockPageProps) {
  const [view, setView] = useState(initial);
  const [clickedAt, setClickedAt] = useState<number | null>(null);
  const beacon = useFreeVideoBeacon(token);
  const unlock = view.unlock;
  const working = unlock.state === 'paid' || unlock.state === 'rendering';

  useEffect(() => {
    beacon('unlock_view');
  }, [beacon]);

  const ask = useCallback(async () => {
    try {
      const res = await fetch(`/api/free-video/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const answer = await res.json().catch(() => null);
      if (res.ok && answer?.success && answer.data) setView(answer.data as FreeVideoView);
    } catch {
      /* the next round asks again */
    }
  }, [token]);

  // Ask for news while the payment is expected or the clean video ad is being made.
  useEffect(() => {
    const waiting = working || (clickedAt !== null && unlock.state === 'available');
    if (!waiting || preview) return;
    const timer = window.setInterval(() => {
      if (!working && clickedAt !== null && Date.now() - clickedAt > CLICK_WINDOW_MS) return;
      void ask();
    }, POLL_MS);
    const onShow = () => document.visibilityState === 'visible' && void ask();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, [ask, working, clickedAt, unlock.state, preview]);

  const onCheckout = useCallback(() => setClickedAt(Date.now()), []);

  return (
    <div className={cn(rp.page, s.page)}>
      {unlock.state === 'available' && (
        <Offer view={view} token={token} price={price} filesUntil={filesUntil} clicked={clickedAt !== null} onCheckout={onCheckout} onCheck={ask} />
      )}
      {working && <Unlocking view={view} token={token} />}
      {unlock.state === 'ready' && <Ready view={view} token={token} changesLeft={changesLeft} onDownload={() => beacon('download')} />}
      {unlock.state === 'failed' && <Note title={UNLOCK_PAGE.failed.title} text={UNLOCK_PAGE.failed.text} />}
      {unlock.state === 'unavailable' && <Note title={UNLOCK_PAGE.closed.title} text={UNLOCK_PAGE.closed.text} link={{ href: `/v/${token}`, label: UNLOCK_PAGE.closed.button }} />}
    </div>
  );
}

interface OfferProps {
  view: FreeVideoView;
  token: string;
  price: UnlockPrice;
  filesUntil: string | null;
  clicked: boolean;
  onCheckout: () => void;
  onCheck: () => void;
}

/** "7 days 4 h left" until the launch price ends, updated every minute; null without a deadline or before the page runs. */
function useTimeLeft(endsAt: string | null): string | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt || now === null) return null;
  const ms = Date.parse(endsAt) - now;
  return ms > 0 ? UNLOCK_PAGE.left(ms) : null;
}

/** Phone bar: on once the first buy box has scrolled away, off while any buy box is on screen. */
function useBar(boxes: RefObject<HTMLDivElement | null>[]): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => {
      const rects = boxes.map((box) => box.current?.getBoundingClientRect()).filter((r): r is DOMRect => Boolean(r));
      const first = rects[0];
      const anyShown = rects.some((r) => r.top < window.innerHeight && r.bottom > 0);
      setOn(Boolean(first && first.bottom < 0) && !anyShown);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [boxes]);
  return on;
}

function Offer({ view, token, price, filesUntil, clicked, onCheckout, onCheck }: OfferProps) {
  const F = UNLOCK_PAGE;
  const beacon = useFreeVideoBeacon(token);
  const topBuy = useRef<HTMLDivElement>(null);
  const midBuy = useRef<HTMLDivElement>(null);
  const lateBuy = useRef<HTMLDivElement>(null);
  const bottomBuy = useRef<HTMLDivElement>(null);
  const [boxes] = useState(() => [topBuy, midBuy, lateBuy, bottomBuy]);
  const barOn = useBar(boxes);
  const checkout = unlockGoUrl(token);
  const left = useTimeLeft(price.endsAt);
    const action = <Action href={checkout} price={price} clicked={clicked} onCheckout={onCheckout} />;

  return (
    <>
      <section className={s.top} aria-labelledby="unlock-title">
        <div className={s.hero}>
          <p className={s.kicker}>{F.kicker(view.domain)}</p>
          <h1 id="unlock-title" className={s.title}>
            {F.title}
          </h1>
          <p className={s.sub}>{F.sub}</p>
          <div className={s.video}>
            <VideoAdPlayer
              src={view.videoUrl as string}
              label={PLAYER.label(view.domain)}
              className={rp.heroPlayerFrame}
              tapToPlay
              onPlayWithSound={() => beacon('video_play')}
              onComplete={() => beacon('video_complete')}
            />
          </div>
          <div className={s.heroPrice}>
            <PriceBlock price={price} left={left} />
          </div>
          <div ref={topBuy} className={s.heroAction}>
            {action}
          </div>
        </div>
      </section>

      <section className={s.proofStrip} aria-label={F.proof.line}>
        <div className={s.faces}>
          {F.proof.faces.map((r) => (
            <Image key={r.name} src={r.photo} alt="" width={80} height={80} sizes="40px" />
          ))}
        </div>
        <div>
          <Stars size={14} label={F.proof.stars} />
          <p>{F.proof.line}</p>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.narrow}>
          <h2 className={s.h2}>{F.changes.title}</h2>
          <p className={s.p}>{F.changes.text}</p>
          <p className={s.label}>{F.changes.examplesTitle}</p>
          <ul className={s.chips}>
            {F.changes.examples.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={cn(s.section, s.sectionSoft)}>
        <div className={s.narrow}>
          <h2 className={s.h2}>{F.getTitle}</h2>
          <ul className={s.stack}>
            {F.get.map((item, i) => (
              <li key={item.title}>
                <span className={s.tick}>
                  <Tick size={14} stroke={3} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  {i === F.get.length - 1 && (
                    <ul className={cn(s.chips, s.chipsSmall)}>
                      {F.platforms.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div ref={midBuy}>
            <CompactBuy price={price} left={left} action={action} />
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.narrow}>
          <h2 className={s.h2}>{F.scrolling.title}</h2>
          <p className={s.p}>{F.scrolling.text}</p>
          <ResultScene domain={view.domain} note={F.scrolling.sceneNote} />
          <p className={s.p}>
            <strong>{F.scrolling.leadsStrong}</strong> {F.scrolling.leadsRest}
          </p>
          <figure className={s.leads}>
            <Image src={F.scrolling.image} alt={F.scrolling.alt} width={554} height={178} sizes="(min-width: 700px) 640px, 100vw" />
            <figcaption>{F.scrolling.caption}</figcaption>
          </figure>
        </div>
      </section>

      <section className={cn(s.section, s.sectionSoft)}>
        <div className={s.narrow}>
          <h2 className={s.h2}>{F.compare.title}</h2>
          <div className={s.bill}>
            {F.compare.parts.map((item) => (
              <p key={item.part} className={s.billRow}>
                <span>{item.part}</span>
                <b>{item.price}</b>
              </p>
            ))}
            <p className={cn(s.billRow, s.billTotal)}>
              <span>
                {F.compare.totalLabel}
                <small>{F.compare.wait}</small>
              </span>
              <b className={s.compareBad}>{F.compare.total}</b>
            </p>
          </div>
          <div className={s.billUs}>
            <p className={s.billRow}>
              <span>{F.compare.usLabel}</span>
              <b className={s.compareGood}>{price.price}</b>
            </p>
            <p className={s.small}>{F.compare.usNote}</p>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.narrow}>
          <h2 className={s.h2}>{F.reviewsTitle}</h2>
          <p className={s.p}>{F.reviewsLead}</p>
          <p className={s.label}>{F.reviewsWorkLabel}</p>
          <div className={s.reviews}>
            {F.reviews.map((r) => (
              <figure key={r.name} className={s.review}>
                <figcaption className={s.reviewHead}>
                  <Image className={s.reviewFace} src={r.photo} alt={r.name} width={80} height={80} sizes="40px" />
                  <span>
                    <b>{r.name}</b>
                    <small>{r.role}</small>
                  </span>
                  <Stars size={12} label={F.proof.stars} />
                </figcaption>
                <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
              </figure>
            ))}
          </div>
          <p className={s.label}>{F.videoReviewsLabel}</p>
          <ul className={rp.reviews}>
            {videoReviewsOf(F.videoReviews).map((item) => (
              <VideoReview key={item.name} item={item} />
            ))}
          </ul>
        </div>
      </section>

      <section className={cn(s.section, s.sectionSoft)}>
        <div className={s.narrow}>
          <div className={s.founder}>
            <Image className={s.founderFace} src={F.founder.photo} alt={F.founder.name} width={240} height={240} sizes="120px" />
            <div className={s.founderText}>
              <p className={s.label}>{F.founder.name}</p>
              <h2 className={s.h2}>{F.founder.title}</h2>
              {F.founder.text(price.price).map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                <b>{F.founder.lessonsTitle}</b>
              </p>
              <ol className={s.lessons}>
                {F.founder.lessons.map((l) => (
                  <li key={l.strong}>
                    <b>{l.strong}</b> {l.text}
                  </li>
                ))}
              </ol>
              <p>{F.founder.lessonsEnd}</p>
            </div>
          </div>
          <ul className={s.stats}>
            {F.founder.stats.map((st) => (
              <li key={st.label}>
                <b>{st.n}</b>
                <span>{st.label}</span>
              </li>
            ))}
          </ul>
          <div className={s.guarantee}>
            <Shield />
            <div>
              <h2>{F.guaranteeTitle}</h2>
              <p className={s.guaranteeSub}>{F.guaranteeSub}</p>
              <p>{F.guarantee(price.price)}</p>
            </div>
          </div>
          <div ref={lateBuy}>
            <CompactBuy price={price} left={left} action={action} />
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.narrow}>
          <h2 className={s.h2}>{F.faqTitle}</h2>
          <dl className={s.faq}>
            {F.faq(price.price, filesUntil).map((item) => (
              <div key={item.q}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={cn(s.section, s.sectionFinal)}>
        <div ref={bottomBuy} className={s.narrow}>
          <h2 className={cn(s.h2, s.center)}>{F.bottomTitle(view.domain)}</h2>
          <div className={s.finalBuy}>
            <PriceBlock price={price} left={left} />
            {action}
            {filesUntil && <p className={cn(s.small, s.center)}>{F.filesLine(filesUntil)}</p>}
          </div>
        </div>
      </section>

      <div className={cn(s.bar, barOn && s.barOn)} aria-hidden={!barOn}>
        {clicked ? (
          <>
            <p className={s.barWaiting}>{F.barWaiting}</p>
            <button type="button" className={s.barCheck} onClick={onCheck} tabIndex={barOn ? 0 : -1}>
              {F.barCheck}
            </button>
          </>
        ) : (
          <>
            <div className={s.barPrice}>
              {price.launch && <s>{price.regular}</s>}
              <b>{price.price}</b>
              {left && <small>{left}</small>}
            </div>
            <a href={checkout} target="_blank" rel="noopener noreferrer" onClick={onCheckout} tabIndex={barOn ? 0 : -1}>
              {F.bar}
            </a>
          </>
        )}
      </div>
    </>
  );
}

/** The price, the saving and the deadline. */
function PriceBlock({ price, left }: { price: UnlockPrice; left: string | null }) {
  const F = UNLOCK_PAGE;
  return (
    <div className={s.priceBlock}>
      {price.launch && <p className={s.save}>{F.save(price.regular, price.price)}</p>}
      <p className={s.price}>
        {price.launch && <s>{price.regular}</s>}
        <b>{price.price}</b> <span>{F.priceUnit}</span>
      </p>
      {price.launch && price.endsAt && (
        <p className={s.deadline}>
          <b>
            <Clock /> {left ?? ' '}
          </b>
          <span>{F.ends(price.endsAt, price.regular)}</span>
        </p>
      )}
    </div>
  );
}

interface ActionProps {
  href: string;
  price: UnlockPrice;
  clicked: boolean;
  onCheckout: () => void;
}

/** The button, the promise and the payment logos. */
function Action({ href, price, clicked, onCheckout }: ActionProps) {
  const F = UNLOCK_PAGE;
  return (
    <div className={s.buy}>
      {/* A new tab, so this page keeps asking and shows the clean video ad once the payment arrives. */}
      <a className={s.button} href={href} target="_blank" rel="noopener noreferrer" onClick={onCheckout}>
        {F.button(price.price)}
      </a>
      {clicked && (
        <p className={s.clicked} role="status">
          {F.afterClick}
        </p>
      )}
      <p className={s.guaranteeShort}>
        <Shield /> {F.promiseShort}
      </p>
      <div className={s.trust}>
        <p>{F.trust}</p>
        <PayCards />
      </div>
    </div>
  );
}

/** A short buy box between sections: the price line and the button. */
function CompactBuy({ price, left, action }: { price: UnlockPrice; left: string | null; action: ReactNode }) {
  const F = UNLOCK_PAGE;
  return (
    <div className={s.compactBuy}>
      <p className={s.compactPrice}>
        {price.launch && <s>{price.regular}</s>} <b>{price.price}</b> <span>{F.priceUnit}</span>
        {price.launch && left && <em>{left}</em>}
      </p>
      {action}
    </div>
  );
}

function Clock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ verticalAlign: '-2px' }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Unlocking({ view, token }: { view: FreeVideoView; token: string }) {
  const F = UNLOCK_PAGE.paid;
  return (
    <section className={s.section}>
      <div className={s.narrow}>
        <div className={s.status} role="status">
          <span className={s.statusTick}>
            <Tick size={18} stroke={3} />
          </span>
          <div>
            <h1 className={s.statusTitle}>{F.title}</h1>
            <p>{F.text}</p>
          </div>
        </div>
        <div className={s.progress}>
          <div className={s.progressTrack}>
            <span />
          </div>
          <p>{F.progress}</p>
        </div>
        <PlanCard view={view} token={token} />
      </div>
    </section>
  );
}

interface ReadyProps {
  view: FreeVideoView;
  token: string;
  changesLeft: number;
  onDownload: () => void;
}

function Ready({ view, token, changesLeft, onDownload }: ReadyProps) {
  const F = UNLOCK_PAGE.ready;
  const clean = view.unlock.cleanVideoUrl as string;
  const download = view.unlock.cleanDownloadUrl ?? clean;
  return (
    <section className={s.section}>
      <div className={s.narrow}>
        <h1 className={cn(s.title, s.center, s.readyTitle)}>{F.title}</h1>
        <div className={s.readyVideo}>
          <VideoAdPlayer key={clean} src={clean} label={PLAYER.label(view.domain)} className={rp.heroPlayerFrame} tapToPlay />
        </div>
        <a className={s.button} href={download} onClick={onDownload}>
          {F.button}
        </a>
        <SaveToPhotos url={clean} fileName={DOWNLOAD.cleanFileName(view.domain)} onSaved={onDownload} variant="link" />
        <ChangeBox token={token} initialLeft={changesLeft} />
        <PlanCard view={view} token={token} />
      </div>
    </section>
  );
}

function ChangeBox({ token, initialLeft }: { token: string; initialLeft: number }) {
  const F = UNLOCK_PAGE.ready;
  const [text, setText] = useState('');
  const [left, setLeft] = useState(initialLeft);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(left > 0 ? null : F.refusals.noRoundsLeft);

  const send = async () => {
    if (text.trim().length < 3 || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/free-video/${encodeURIComponent(token)}/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      const answer = await res.json().catch(() => null);
      if (res.ok && answer?.success) {
        const now = Number(answer.data?.left ?? 0);
        setLeft(now);
        setText('');
        setMessage(F.sent());
      } else {
        const code = answer?.details?.code as keyof typeof F.refusals | undefined;
        if (code === 'noRoundsLeft') setLeft(0);
        setMessage(code && code in F.refusals ? F.refusals[code] : F.refusals.generic);
      }
    } catch {
      setMessage(F.refusals.generic);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={s.changeBox}>
      {left > 0 && (
        <>
          <label className={s.boxLabel}>
            {F.changeLabel}
            <textarea className={s.box} rows={3} maxLength={2000} placeholder={F.changePlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <button type="button" className={s.buttonQuiet} onClick={send} disabled={sending || text.trim().length < 3}>
            {sending ? F.sending : F.changeButton}
          </button>
          <p className={s.small}>{F.changeNote}</p>
        </>
      )}
      {message && (
        <p className={s.sent} role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function PlanCard({ view, token }: { view: FreeVideoView; token: string }) {
  const F = UNLOCK_PAGE.plan;
  return (
    <div className={s.upsell}>
      <p className={s.upsellKicker}>{F.kicker}</p>
      <h2 className={s.h2}>{F.title(view.domain)}</h2>
      <p className={s.upsellText}>{F.text}</p>
      <p className={s.upsellPrice}>
        <b>{F.price}</b> <span>{F.priceUnit}</span>
      </p>
      <a className={s.button} href={planGoUrl(token)} target="_blank" rel="noopener noreferrer">
        {F.button}
      </a>
      <a className={s.noThanks} href={PLAN_INFO_PATH} target="_blank" rel="noopener noreferrer">
        {F.more}
      </a>
    </div>
  );
}

function Note({ title, text, link }: { title: string; text: string; link?: { href: string; label: string } }) {
  return (
    <section className={s.section}>
      <div className={cn(s.narrow, s.center)}>
        <h1 className={cn(s.title, s.readyTitle)}>{title}</h1>
        <p className={s.p}>{text}</p>
        {link && (
          <a className={s.button} href={link.href}>
            {link.label}
          </a>
        )}
      </div>
    </section>
  );
}
