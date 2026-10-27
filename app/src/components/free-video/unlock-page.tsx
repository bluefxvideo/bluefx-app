'use client';

import Image from 'next/image';
import { Caveat } from 'next/font/google';
import { ArrowUp, Download, Maximize2, Pencil, Phone, User, X } from 'lucide-react';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useFreeVideoBeacon } from '@/hooks/use-free-video-beacon';
import { DOWNLOAD, PLAYER } from '@/lib/free-video/copy';
import { PLAN_INFO_PATH, planGoUrl, unlockGoUrl } from '@/lib/free-video/offer';
import { RESULT_SALES } from '@/lib/free-video/result-sales';
import { SALES_PAGE } from '@/lib/free-video/sales-page';
import { UNLOCK_PAGE } from '@/lib/free-video/unlock-page';
import type { UnlockPrice } from '@/lib/free-video/unlock-price';
import { cn } from '@/lib/utils';
import type { FreeVideoView } from '@/types/free-video';
import { LoopVideo, PayCards, ResultScene, Shield, Stars, Tick, VideoReview, videoReviewsOf } from './result-page';
import { SaveToPhotos } from './save-to-photos';
import { VideoAdPlayer } from './video-ad-player';
import rp from './result-page.module.css';
import s from './unlock-page.module.css';

/** The handwritten note by the arrow. */
const caveat = Caveat({ subsets: ['latin'], weight: '700', display: 'swap' });
const SALES_PAGE_FOUNDER_PHOTO = SALES_PAGE.founder.photo;

interface UnlockPageProps {
  token: string;
  initial: FreeVideoView;
  price: UnlockPrice;
  /** The last day the video ad can be unlocked (ISO), or null when unknown. */
  filesUntil: string | null;
  /** The change list confirmed in the change chat, if any. */
  plan: string[] | null;
  /** The changes asked for after the payment (the ready page lists them). */
  requested: string[];
  changesLeft: number;
  /** The free-month Weekly Video Plan offer is on (its FastSpring product exists, or a local preview). */
  trial: boolean;
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
export function UnlockPage({ token, initial, price, filesUntil, plan, requested, changesLeft, trial, preview = false }: UnlockPageProps) {
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
        <Offer view={view} token={token} price={price} filesUntil={filesUntil} initialPlan={plan} clicked={clickedAt !== null} onCheckout={onCheckout} onCheck={ask} />
      )}
      {working && <Unlocking view={view} token={token} requested={requested} trial={trial} preview={preview} />}
      {unlock.state === 'ready' && <Ready view={view} token={token} requested={requested} trial={trial} preview={preview} changesLeft={changesLeft} onDownload={() => beacon('download')} />}
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
  initialPlan: string[] | null;
  clicked: boolean;
  onCheckout: () => void;
  onCheck: () => void;
}

/** The milliseconds until the launch price ends, ticking every second; null without a deadline, before the page runs or after it ends. */
function useTimeLeft(endsAt: string | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt || now === null) return null;
  const ms = Date.parse(endsAt) - now;
  return ms > 0 ? ms : null;
}

/** The time left split into days, hours, minutes and seconds. */
function parts(ms: number | null) {
  const total = ms === null ? null : Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (total === null) return { d: '--', h: '--', m: '--', s: '--' };
  return { d: pad(Math.floor(total / 86400)), h: pad(Math.floor((total % 86400) / 3600)), m: pad(Math.floor((total % 3600) / 60)), s: pad(total % 60) };
}

/** "2d 23:59:12", for the small spots (the phone bar, the short buy boxes). */
function shortClock(ms: number | null): string | null {
  if (ms === null) return null;
  const p = parts(ms);
  return `${Number(p.d) > 0 ? `${Number(p.d)}d ` : ''}${p.h}:${p.m}:${p.s}`;
}

/** The ticking timer: 4 boxes, days, hours, minutes, seconds. */
function Timer({ ms, label }: { ms: number | null; label: string }) {
  const p = parts(ms);
  const boxes: Array<[string, string]> = [
    [p.d, 'days'],
    [p.h, 'hours'],
    [p.m, 'min'],
    [p.s, 'sec'],
  ];
  return (
    <div className={s.timer} role="timer" aria-label={label}>
      {boxes.map(([value, label]) => (
        <span key={label} className={s.timerBox}>
          <b>{value}</b>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
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

function Offer({ view, token, price, filesUntil, initialPlan, clicked, onCheckout, onCheck }: OfferProps) {
  const [plan, setPlanState] = useState<string[] | null>(initialPlan);
  const [pending, setPending] = useState<{ text: string | null; n: number }>({ text: null, n: 0 });
  const [pulse, setPulse] = useState(0);
  const [big, setBig] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const setPlan = useCallback((next: string[]) => {
    setPlanState(next);
    setPulse((n) => n + 1);
  }, []);
  // A chip or the "Want changes first?" link: scroll to the chat, then send the chip's message (or just focus the box).
  const ask = useCallback((text: string | null) => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setPending((p) => ({ text, n: p.n + 1 }));
  }, []);
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
    const action = <Action href={checkout} price={price} changed={Boolean(plan)} clicked={clicked} onCheckout={onCheckout} />;

  return (
    <>
      <section className={s.top} aria-labelledby="unlock-title">
        <div className={s.hero}>
          <p className={s.kicker}>{F.kicker(view.domain)}</p>
          <h1 id="unlock-title" className={s.title}>
            {F.title} <span className={s.titleRed}>{F.titleRed}</span>
          </h1>
          <ul className={s.changeChips} aria-label="Changes people ask for">
            {F.chips.map((chip, i) => {
              const Icon = [Pencil, User, Phone][i];
              return (
                <li key={chip}>
                  <button type="button" onClick={() => ask(F.chat.chipAsks[i])}>
                    <Icon size={13} strokeWidth={2.5} aria-hidden="true" /> {chip}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={cn(s.sub, s.heroSub)}>{F.sub}</p>
          <div className={s.side}>
            <div className={s.video}>
              <VideoAdPlayer
                src={view.videoUrl as string}
                label={PLAYER.label(view.domain)}
                className={rp.heroPlayerFrame}
                tapToPlay
                onPlayWithSound={() => beacon('video_play')}
                onComplete={() => beacon('video_complete')}
              />
              <button type="button" className={s.watchBig} onClick={() => setBig(true)}>
                <Maximize2 size={13} strokeWidth={2.5} aria-hidden="true" /> {F.watchBig}
              </button>
            </div>
            {big && <BigPlayer src={view.videoUrl as string} label={PLAYER.label(view.domain)} onClose={() => setBig(false)} />}
            <div ref={chatRef} className={s.heroChat} id="changes-chat">
              <ArrowNote text={F.chat.arrowNote} />
              <ChangeChat
                token={token}
                plan={plan}
                onPlan={setPlan}
                pending={pending}
                buy={
                  <a className={s.button} href={checkout} target="_blank" rel="noopener noreferrer" onClick={onCheckout}>
                    {F.buttonChanged(price.price)}
                  </a>
                }
              />
            </div>
          </div>
          <div className={s.heroPrice}>
            <PriceBlock price={price} left={left} />
          </div>
          <div ref={topBuy} className={s.heroAction}>
            <Action href={checkout} price={price} changed={Boolean(plan)} clicked={clicked} onCheckout={onCheckout} only="button" pulse={pulse} />
          </div>
          <div className={s.heroStyles}>
            <p className={s.heroStylesTitle}>{F.styles.title}</p>
            <p className={s.heroStylesText}>{F.styles.text}</p>
            <ul className={s.styleGrid}>
              {RESULT_SALES.styles.items.map((style) => (
                <li key={style.id}>
                  <span className={s.styleTile}>
                    <LoopVideo src={`/smart-video/looks/${style.id}.mp4`} poster={`/smart-video/looks/${style.id}-poster.jpg`} />
                  </span>
                  <span className={s.styleName}>{style.label}</span>
                </li>
              ))}
            </ul>
            <p className={s.heroStylesText}>{F.styles.more}</p>
          </div>
          <div className={s.heroTrust}>
            <Action href={checkout} price={price} changed={Boolean(plan)} clicked={clicked} onCheckout={onCheckout} only="trust" />
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
          <div className={s.sceneWrap}>
            <ResultScene domain={view.domain} note={F.scrolling.sceneNote} />
          </div>
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
          <ul className={cn(rp.reviews, s.videoReviews)}>
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
              <p>
                <b>{F.founder.lessonsEnd}</b> {F.founder.proofLine}
              </p>
              <figure className={s.leads}>
                <Image src={F.founder.proofImage} alt={F.founder.proofAlt} width={554} height={178} sizes="(min-width: 700px) 520px, 100vw" />
                <figcaption>{F.founder.proofCaption}</figcaption>
              </figure>
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
              {left !== null && <small>{shortClock(left)}</small>}
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
function PriceBlock({ price, left }: { price: UnlockPrice; left: number | null }) {
  const F = UNLOCK_PAGE;
  return (
    <div className={s.priceBlock}>
      {price.launch && <p className={s.save}>{F.save(price.regular, price.price)}</p>}
      <p className={s.price}>
        {price.launch && <s>{price.regular}</s>}
        <b>{price.price}</b> <span>{F.priceUnit}</span>
      </p>
      {price.launch && price.endsAt && (
        <div className={s.deadline}>
          <b>
            <Clock /> {F.timerLabel(price.price)}
          </b>
          <Timer ms={left} label={F.timerLabel(price.price)} />
          {/* In the visitor's own time zone, so only once the page runs in the browser (left is null before that). */}
          <span>{left !== null ? F.ends(price.endsAt, price.regular) : '\u00a0'}</span>
        </div>
      )}
    </div>
  );
}

interface ActionProps {
  href: string;
  price: UnlockPrice;
  /** The visitor confirmed a change list in the chat. */
  changed: boolean;
  /** The hero splits the box: the button (with the chat link under it) and the trust lines. */
  only?: 'button' | 'trust';
  /** Grows by one each time a change list is saved: the button pulses once. */
  pulse?: number;
  clicked: boolean;
  onCheckout: () => void;
}

/** The button, the promise and the payment logos. */
function Action({ href, price, changed, clicked, onCheckout, only, pulse = 0 }: ActionProps) {
  const F = UNLOCK_PAGE;
  return (
    <div className={s.buy}>
      {only !== 'trust' && (
        <>
      {/* A new tab, so this page keeps asking and shows the clean video ad once the payment arrives. */}
      <a key={pulse} className={cn(s.button, pulse > 0 && s.buttonPulse)} href={href} target="_blank" rel="noopener noreferrer" onClick={onCheckout}>
        {changed ? F.buttonChanged(price.price) : F.button(price.price)}
      </a>
      {clicked && (
        <p className={s.clicked} role="status">
          {F.afterClick}
        </p>
      )}
        </>
      )}
      {only !== 'button' && (
        <>
      <p className={s.guaranteeShort}>
        <Shield /> {F.promiseShort(price.price)}
      </p>
      <div className={s.trust}>
        <p>{F.trust}</p>
        <PayCards />
      </div>
        </>
      )}
    </div>
  );
}

/** A short buy box between sections: the price line and the button. */
function CompactBuy({ price, left, action }: { price: UnlockPrice; left: number | null; action: ReactNode }) {
  const F = UNLOCK_PAGE;
  return (
    <div className={s.compactBuy}>
      <p className={s.compactPrice}>
        {price.launch && <s>{price.regular}</s>} <b>{price.price}</b> <span>{F.priceUnit}</span>
        {price.launch && left !== null && <em>{UNLOCK_PAGE.priceUpIn} {shortClock(left)}</em>}
      </p>
      {action}
    </div>
  );
}


/** The hand-drawn red arrow and note that point at the change chat (UX review 2026-10-27); the arrow draws itself once in view. */
function ArrowNote({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setShown(true);
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && (setShown(true), io.disconnect()), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn(s.arrowNote, shown && s.arrowShown)} aria-hidden="true">
      <span className={cn(caveat.className, s.arrowText)}>{text}</span>
      <svg className={s.arrowSvg} viewBox="0 0 90 70" fill="none">
        <path d="M6 6 C 40 4, 70 18, 72 52" stroke="#c0271c" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M60 42 L72 56 L82 41" stroke="#c0271c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

interface ChangeChatProps {
  token: string;
  plan: string[] | null;
  onPlan: (plan: string[]) => void;
  /** A chip tap from the page: send this text (or just focus the box when text is null). n changes on every tap. */
  pending: { text: string | null; n: number };
  buy: ReactNode;
}

/** The change chat (change-chat.ts): the visitor tells the assistant what to change before paying; the confirmed list is saved. */
function ChangeChat({ token, plan, onPlan, pending, buy }: ChangeChatProps) {
  const F = UNLOCK_PAGE.chat;
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([{ role: 'assistant', text: F.hello }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [glow, setGlow] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const started = messages.some((m) => m.role === 'user');

  useEffect(() => {
    const el = list.current;
    if (el && messages.length > 1) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // A soft glow on the message box the first time the chat is on screen.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && (setGlow(true), io.disconnect()), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const said = raw.trim();
      if (!said || busy) return;
      const next = [...messages, { role: 'user' as const, text: said.slice(0, 600) }];
      setMessages(next);
      setText('');
      setBusy(true);
      try {
        // The greeting is the page's own line: the model sees the talk from the visitor's first message.
        const res = await fetch(`/api/free-video/${encodeURIComponent(token)}/change-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: next.slice(1).slice(-16) }),
        });
        const answer = await res.json().catch(() => null);
        if (res.ok && answer?.success) {
          setMessages((m) => [...m, { role: 'assistant', text: answer.data.reply as string }]);
          if (Array.isArray(answer.data.changes) && answer.data.changes.length) onPlan(answer.data.changes as string[]);
        } else {
          setMessages((m) => [...m, { role: 'assistant', text: answer?.details?.code === 'limit' ? F.limit : F.error }]);
        }
      } catch {
        setMessages((m) => [...m, { role: 'assistant', text: F.error }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, token, onPlan, F.limit, F.error]
  );

  // A tap on a chip under the headline or on "Want changes first?".
  const lastPending = useRef(0);
  useEffect(() => {
    if (pending.n === 0 || pending.n === lastPending.current) return;
    lastPending.current = pending.n;
    if (pending.text) void send(pending.text);
    else if (window.matchMedia('(min-width: 860px)').matches) input.current?.focus({ preventScroll: true });
  }, [pending, send]);

  return (
    <div ref={box} className={s.chat}>
      <div className={s.chatHead}>
        <span className={s.chatFace}>
          <Image src={SALES_PAGE_FOUNDER_PHOTO} alt="Szilard" width={88} height={88} sizes="44px" />
        </span>
        <div>
          <p className={s.chatTitle}>{F.title}</p>
          <p className={s.chatNote}>{F.note}</p>
        </div>
      </div>
      <div ref={list} className={s.chatList} aria-live="polite">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className={s.chatMe}>
              {m.text}
            </p>
          ) : (
            <p key={i} className={s.chatThem}>
              {m.text}
            </p>
          )
        )}
        {!started && (
          <div className={s.chatIdeas}>
            {F.ideas.map((idea) => (
              <button key={idea.label} type="button" onClick={() => void send(idea.ask)}>
                {idea.label}
              </button>
            ))}
          </div>
        )}
        {busy && (
          <p className={cn(s.chatThem, s.chatBusy)}>
            <span className={s.dots} aria-label={F.thinking}>
              <i />
              <i />
              <i />
            </span>
          </p>
        )}
      </div>
      {plan && (
        <div className={s.chatPlan}>
          <p>
            <b>{F.listTitle}</b>
          </p>
          <ul className={s.checklist}>
            {plan.map((c) => (
              <li key={c}>
                <span className={s.tick}>
                  <Tick size={11} stroke={3.5} />
                </span>
                {c}
              </li>
            ))}
          </ul>
          <p className={s.chatNote}>{F.listNote}</p>
          {buy}
        </div>
      )}
      <form
        className={cn(s.chatForm, glow && s.chatGlow, text.trim() && s.chatReady)}
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={F.placeholder} maxLength={600} aria-label={F.title} />
        <button type="submit" disabled={busy || !text.trim()} aria-label={F.send}>
          <ArrowUp size={18} strokeWidth={2.75} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

/** The visitor's video ad, big, with sound, over a dark backdrop (UX review 2026-10-27: on a computer the page shows a small preview). */
function BigPlayer({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className={s.bigBack} role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className={s.bigBox} onClick={(e) => e.stopPropagation()}>
        <video src={src} controls autoPlay playsInline className={s.bigVideo} />
        <button type="button" className={s.bigClose} onClick={onClose} aria-label={UNLOCK_PAGE.close}>
          <X size={22} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
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

function Unlocking({ view, token, requested, trial, preview }: { view: FreeVideoView; token: string; requested: string[]; trial: boolean; preview: boolean }) {
  const F = UNLOCK_PAGE.thanks;
  return (
    <>
      <section className={cn(s.section, s.thanksTop)}>
        <div className={s.narrow}>
          <div className={s.paidStrip} role="status">
            <span className={s.statusTick}>
              <Tick size={14} stroke={3} />
            </span>
            <div>
              <h1>{F.paidTitle(view.firstName)}</h1>
              <p>{F.paidNote}</p>
              {requested.length > 0 && (
                <div className={s.makingChanges}>
                  <b>{F.makingChanges}</b>
                  {requested.map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      {trial ? (
        <ThanksOffer view={view} token={token} kicker={F.kickerPaid} preview={preview} />
      ) : (
        <section className={s.section}>
          <div className={s.narrow}>
            <PlanCard view={view} token={token} />
          </div>
        </section>
      )}
    </>
  );
}

/** The Weekly Video Plan offer after the $49 payment (owner 2026-10-27, rebuilt after the 3-expert review): the offer names itself first. */
function ThanksOffer({ view, token, kicker, preview = false }: { view: FreeVideoView; token: string; kicker: string; preview?: boolean }) {
  const F = UNLOCK_PAGE.thanks;
  const [declined, setDeclined] = useState(false);
  const planned = (view.nextAds ?? []).slice(0, 3);
  const promoImage = view.poster || planned[0]?.imageUrl || null;
  if (declined) {
    return (
      <section className={s.section}>
        <div className={cn(s.narrow, s.center)}>
          <p className={s.p}>{F.declined}</p>
        </div>
      </section>
    );
  }
  const cards = [
    ...planned.map((ad) => ({ key: String(ad.n), title: ad.title, teaser: ad.teaser, image: ad.imageUrl })),
    { key: 'promo', title: F.promoCard.title, teaser: F.promoCard.teaser, image: promoImage },
  ].slice(0, 4);
  const buy = (
    <div className={s.thanksBuy}>
      <a className={s.button} href={planGoUrl(token)} target="_blank" rel="noopener noreferrer">
        {F.button}
      </a>
      <p className={s.small}>{F.today}</p>
    </div>
  );
  return (
    <section className={cn(s.section, s.thanks)}>
      <div className={s.narrow}>
        <div className={s.thanksHead}>
          <p className={s.label}>{kicker}</p>
          <h2 className={s.h2}>{F.title(view.domain)}</h2>
          <p className={s.p}>{F.sub}</p>
        </div>
        {F.salesVideo ? (
          <div className={s.salesVideo}>
            <VideoAdPlayer src={F.salesVideo} label={F.title(view.domain)} className={rp.heroPlayerFrame} tapToPlay />
          </div>
        ) : preview ? (
          <div className={s.salesVideoSpot}>{F.salesVideoSpot}</div>
        ) : null}
        {buy}
        <div className={s.thanksBlock}>
          <p className={s.h3}>{F.plannedTitle}</p>
          <p className={s.p}>{F.plannedNote}</p>
          <ul className={s.plannedGrid}>
            {cards.map((card, i) => (
              <li key={card.key}>
                <span className={s.plannedImage}>
                  {card.image ? <Image src={card.image} alt="" width={432} height={540} sizes="(min-width: 700px) 150px, 45vw" /> : null}
                  <em>
                    {F.week(i + 1)} · {F.styles[i]}
                  </em>
                </span>
                <b>{card.title}</b>
                <span>{card.teaser}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={s.thanksBlock}>
          <p className={s.h3}>{F.howTitle}</p>
          <ol className={s.steps}>
            {F.how.map((step, i) => (
              <li key={step.title}>
                <span className={s.stepNum}>{i + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className={s.getBox}>
          <p className={s.h3}>{F.getTitle}</p>
          <ul className={s.checklist}>
            {F.get.map((line) => (
              <li key={line}>
                <span className={s.tick}>
                  <Tick size={11} stroke={3.5} />
                </span>
                {line}
              </li>
            ))}
          </ul>
          <div className={s.getPrices}>
            <p className={s.strikeLine}>{F.oneByOne}</p>
            <p>{F.planPrice}</p>
            <p className={s.firstMonth}>{F.firstMonth}</p>
          </div>
          {buy}
        </div>
        {F.quote && (
          <figure className={s.review}>
            <figcaption className={s.reviewHead}>
              <Image className={s.reviewFace} src={F.quote.photo} alt={F.quote.name} width={80} height={80} sizes="40px" />
              <span>
                <b>{F.quote.name}</b>
                <small>{F.quote.role}</small>
              </span>
              <Stars size={12} label={UNLOCK_PAGE.proof.stars} />
            </figcaption>
            <blockquote>&ldquo;{F.quote.quote}&rdquo;</blockquote>
          </figure>
        )}
        <div className={s.thanksBlock}>
          <p className={s.h3}>{F.riskTitle}</p>
          <ul className={s.checklist}>
            {F.risk.map((line) => (
              <li key={line}>
                <span className={s.tick}>
                  <Tick size={11} stroke={3.5} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className={s.thanksBlock}>
          <p className={s.h3}>{F.faqTitle}</p>
          <dl className={s.faq}>
            {F.faq.map((item) => (
              <div key={item.q}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
        {buy}
        <button type="button" className={s.noThanks} onClick={() => setDeclined(true)}>
          {F.noThanks}
        </button>
        <div className={s.thanksSign}>
          <Image className={s.chatFaceImg} src={SALES_PAGE_FOUNDER_PHOTO} alt="Szilard" width={96} height={96} sizes="48px" />
          <p>
            {F.sign}
            <br />
            <b>{F.signName}</b>
          </p>
        </div>
      </div>
    </section>
  );
}

interface ReadyProps {
  view: FreeVideoView;
  token: string;
  requested: string[];
  trial: boolean;
  preview: boolean;
  changesLeft: number;
  onDownload: () => void;
}

function Ready({ view, token, requested, trial, preview, changesLeft, onDownload }: ReadyProps) {
  const F = UNLOCK_PAGE.ready;
  const clean = view.unlock.cleanVideoUrl as string;
  const download = view.unlock.cleanDownloadUrl ?? clean;
  return (
    <>
    <section className={cn(s.section, s.thanksTop)}>
      <div className={s.narrow}>
        <h1 className={cn(s.title, s.center, s.readyTitle)}>{F.title}</h1>
        <div className={cn(s.readyVideo, trial && s.readyVideoSmall)}>
          <VideoAdPlayer key={clean} src={clean} label={PLAYER.label(view.domain)} className={rp.heroPlayerFrame} tapToPlay />
        </div>
        <a className={trial ? s.downloadQuiet : s.button} href={download} onClick={onDownload}>
          {trial && <Download size={17} strokeWidth={2.5} aria-hidden="true" />} {F.button}
        </a>
        <SaveToPhotos url={clean} fileName={DOWNLOAD.cleanFileName(view.domain)} onSaved={onDownload} variant="link" />
        {requested.length > 0 && (
          <div className={s.chatPlan}>
            <p>
              <b>{F.requestedTitle}</b>
            </p>
            {requested.map((r) => (
              <p key={r} className={s.requestedText}>
                {r}
              </p>
            ))}
            <p className={s.chatNote}>{F.requestedNote}</p>
          </div>
        )}
        <ChangeBox token={token} initialLeft={changesLeft} collapsible={trial} />
        {!trial && <PlanCard view={view} token={token} />}
      </div>
    </section>
    {trial && <ThanksOffer view={view} token={token} kicker={UNLOCK_PAGE.thanks.kickerReady} preview={preview} />}
    </>
  );
}

function ChangeBox({ token, initialLeft, collapsible = false }: { token: string; initialLeft: number; collapsible?: boolean }) {
  const F = UNLOCK_PAGE.ready;
  const [open, setOpen] = useState(!collapsible);
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

  if (!open && left > 0) {
    return (
      <button type="button" className={s.askLink} onClick={() => setOpen(true)}>
        {F.changeOpen}
      </button>
    );
  }
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
