'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFreeVideoBeacon } from '@/hooks/use-free-video-beacon';
import { DOWNLOAD, PLAYER } from '@/lib/free-video/copy';
import { PLAN_INFO_PATH, planGoUrl, unlockGoUrl } from '@/lib/free-video/offer';
import { UNLOCK_PAGE } from '@/lib/free-video/unlock-page';
import { cn } from '@/lib/utils';
import type { FreeVideoView } from '@/types/free-video';
import { PayCards, Shield, Tick } from './result-page';
import { SaveToPhotos } from './save-to-photos';
import { VideoAdPlayer } from './video-ad-player';
import rp from './result-page.module.css';
import s from './unlock-page.module.css';

interface UnlockPageProps {
  token: string;
  initial: FreeVideoView;
  changesLeft: number;
  /** A local preview of one display: the page never asks for news. */
  preview?: boolean;
}

/** How often the page asks for news while the payment or the clean video ad is on its way. */
const POLL_MS = 4000;
/** A checkout click keeps the page asking for 30 minutes. */
const CLICK_WINDOW_MS = 30 * 60_000;

/**
 * The unlock page (owner 2026-10-27): offer → "unlocking" (paid, the clean render runs) → ready (download, change box,
 * the Weekly Video Plan). The checkout opens in a new tab through /go/fvunlock; this page polls the lead's view.
 */
export function UnlockPage({ token, initial, changesLeft, preview = false }: UnlockPageProps) {
  const [view, setView] = useState(initial);
  const [clickedAt, setClickedAt] = useState<number | null>(null);
  const beacon = useFreeVideoBeacon(token);
  const unlock = view.unlock;
  const working = unlock.state === 'paid' || unlock.state === 'rendering';

  useEffect(() => {
    beacon('unlock_view');
  }, [beacon]);

  // Ask for news while the payment is expected or the clean video ad is being made.
  useEffect(() => {
    const waiting = working || (clickedAt !== null && unlock.state === 'available');
    if (!waiting || preview) return;
    const ask = async () => {
      if (clickedAt !== null && !working && Date.now() - clickedAt > CLICK_WINDOW_MS) return;
      try {
        const res = await fetch(`/api/free-video/${encodeURIComponent(token)}`, { cache: 'no-store' });
        const answer = await res.json().catch(() => null);
        if (res.ok && answer?.success && answer.data) setView(answer.data as FreeVideoView);
      } catch {
        /* the next round asks again */
      }
    };
    const timer = window.setInterval(ask, POLL_MS);
    const onShow = () => document.visibilityState === 'visible' && void ask();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [token, working, clickedAt, unlock.state, preview]);

  const onCheckout = useCallback(() => setClickedAt(Date.now()), []);

  return (
    <div className={cn(rp.page, s.page)}>
      {unlock.state === 'available' && <Offer view={view} token={token} clicked={clickedAt !== null} onCheckout={onCheckout} />}
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
  clicked: boolean;
  onCheckout: () => void;
}

function Offer({ view, token, clicked, onCheckout }: OfferProps) {
  const F = UNLOCK_PAGE;
  const beacon = useFreeVideoBeacon(token);
  const topBuy = useRef<HTMLDivElement>(null);
  const bottomBuy = useRef<HTMLDivElement>(null);
  const [barOn, setBarOn] = useState(false);
  const checkout = unlockGoUrl(token);

  // Phone bar: shows once the top button has scrolled away, hides again when the bottom button is on screen.
  useEffect(() => {
    const check = () => {
      const top = topBuy.current?.getBoundingClientRect();
      const bottom = bottomBuy.current?.getBoundingClientRect();
      setBarOn(Boolean(top && top.bottom < 0) && !(bottom && bottom.top < window.innerHeight));
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const buy = <BuyBox href={checkout} clicked={clicked} onCheckout={onCheckout} />;
  return (
    <>
      <section className={s.top} aria-labelledby="unlock-title">
        <div className={s.topIn}>
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
          <div className={s.text}>
            <p className={s.kicker}>{F.kicker(view.domain)}</p>
            <h1 id="unlock-title" className={s.title}>
              {F.title}
            </h1>
            <p className={s.sub}>{F.sub}</p>
            <div ref={topBuy} className={s.buyWrap}>
              {buy}
            </div>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.narrow}>
          <h2 className={s.h2}>{F.getTitle}</h2>
          <ul className={s.ticks}>
            {F.get.map((line) => (
              <li key={line}>
                <span className={s.tick}>
                  <Tick size={14} stroke={3} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={cn(s.section, s.sectionSoft)}>
        <div className={s.narrow}>
          <h2 className={s.h2}>{F.changesTitle}</h2>
          <p className={s.p}>{F.changesText}</p>
          <ul className={s.changes}>
            {F.changes.map((line) => (
              <li key={line}>
                <Tick size={14} stroke={3} color="#3f6a1c" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.narrow}>
          <div className={s.guarantee}>
            <Shield />
            <div>
              <h2>{F.guaranteeTitle}</h2>
              <p>{F.guarantee}</p>
            </div>
          </div>
          <h2 className={cn(s.h2, s.h2Gap)}>{F.faqTitle}</h2>
          <dl className={s.faq}>
            {F.faq.map((item) => (
              <div key={item.q}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={cn(s.section, s.sectionSoft)}>
        <div ref={bottomBuy} className={s.narrow}>
          <h2 className={cn(s.h2, s.center)}>{F.bottomTitle(view.domain)}</h2>
          {buy}
        </div>
      </section>

      <div className={cn(s.bar, barOn && s.barOn)} aria-hidden={!barOn}>
        <b>{F.price}</b>
        <a href={checkout} target="_blank" rel="noopener noreferrer" onClick={onCheckout} tabIndex={barOn ? 0 : -1}>
          {F.bar}
        </a>
      </div>
    </>
  );
}

function BuyBox({ href, clicked, onCheckout }: { href: string; clicked: boolean; onCheckout: () => void }) {
  const F = UNLOCK_PAGE;
  return (
    <div className={s.buy}>
      <p className={s.price}>
        <b>{F.price}</b> <span>{F.priceUnit}</span> <em>{F.priceNote}</em>
      </p>
      {/* A new tab, so this page keeps asking and shows the clean video ad once the payment arrives. */}
      <a className={s.button} href={href} target="_blank" rel="noopener noreferrer" onClick={onCheckout}>
        {F.button}
      </a>
      {clicked && (
        <p className={s.clicked} role="status">
          {F.afterClick}
        </p>
      )}
      <div className={s.trust}>
        <PayCards />
        <p>{F.trust}</p>
      </div>
    </div>
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
        setMessage(F.sent(now));
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
