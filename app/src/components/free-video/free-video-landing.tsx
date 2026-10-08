'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { refTagFromUrl, useFreeVideoBeacon } from '@/hooks/use-free-video-beacon';
import { ERRORS, EXAMPLES, FORM, type ExampleVideoAd } from '@/lib/free-video/copy';
import { clickIdFromUrl, PIXEL_DATA, trackPixel } from '@/lib/free-video/pixel';
import { cn } from '@/lib/utils';
import type { FreeVideoLeadBody, FreeVideoSubmitData } from '@/types/free-video';
import { checkEmail, checkFirstName, checkWebsite, domainOf, problemFromAnswer, type FormProblem } from './form-errors';
import { FormMessage } from './form-message';
import styles from './free-video.module.css';
import { LifetimeOffer } from './lifetime-offer';

/** The two website fields on the landing page: the hero and the blue band at the bottom. */
export type WebsiteFormId = 'top' | 'bottom' | 'sticky';

/**
 * What the form POSTs to /api/free-video: FreeVideoLeadBody plus elapsedMs, the milliseconds between
 * this page's first render and the submit, measured with performance.now() on the visitor's own clock
 * (startedAt is never sent: comparing two clocks dropped real visitors, review finding F4).
 */
type SubmitBody = FreeVideoLeadBody & { elapsedMs: number };

/** FREE_VIDEO_TOKEN_PATTERN (types/free-video.ts), repeated here so the page bundle does not load zod. */
const VIEW_TOKEN = /^[A-Za-z0-9_-]{22}$/;

interface WebsiteProblem {
  form: WebsiteFormId;
  problem: FormProblem;
  /** The text the problem is about (the resend email quotes it). */
  website: string;
}

interface SheetProblems {
  firstName?: FormProblem;
  email?: FormProblem;
  /** Not about one field: shown above the send button. */
  form?: FormProblem;
}

interface LandingContextValue {
  websites: Record<WebsiteFormId, string>;
  setWebsite: (form: WebsiteFormId, value: string) => void;
  websiteProblem: WebsiteProblem | null;
  registerWebsiteInput: (form: WebsiteFormId, input: HTMLInputElement | null) => void;
  /** Step 1 → step 2: checks the website, then opens the sheet. */
  startStep2: (form: WebsiteFormId) => void;
  /** The first focus of a website field (the form_start event, once per page). */
  noteFormStart: () => void;
  /** Opens the one player with this example, with sound (the tap is the user gesture). */
  openExample: (example: ExampleVideoAd, opener: HTMLElement) => void;
  /** The player or the step 2 sheet is open: the hero reel pauses. */
  overlayOpen: boolean;
}

const LandingContext = createContext<LandingContextValue | null>(null);

export function useLanding(): LandingContextValue {
  const value = useContext(LandingContext);
  if (!value) throw new Error('useLanding() needs <FreeVideoLanding> around it');
  return value;
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

/** The browser's time zone (Intl), one of the two country signals (lib/free-video/geo.ts). */
function timeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** The data of a 200 answer, or null when the answer is not one. */
function submitData(answer: unknown): FreeVideoSubmitData | null {
  if (!answer || typeof answer !== 'object') return null;
  const body = answer as { success?: unknown; data?: unknown };
  if (body.success !== true || !body.data || typeof body.data !== 'object') return null;
  const { token, eventId } = body.data as { token?: unknown; eventId?: unknown };
  if (token !== null && typeof token !== 'string') return null;
  return { token, ...(typeof eventId === 'string' ? { eventId } : {}) };
}

interface FreeVideoLandingProps {
  children: ReactNode;
}

/**
 * The landing page's client side (mockup v5): the two website fields (step 1), the step 2 sheet
 * (first name and email; a bottom sheet on phones, a centred window from 640 px) and the one example
 * player that the hero reel and the 3 thumbnails open. The page's sections are server markup passed
 * in as children.
 */
export function FreeVideoLanding({ children }: FreeVideoLandingProps) {
  const router = useRouter();
  const beacon = useFreeVideoBeacon();
  const mountedAt = useRef(0);
  const sentView = useRef(false);
  const sentStart = useRef(false);

  // Step 1
  const [websites, setWebsites] = useState<Record<WebsiteFormId, string>>({ top: '', bottom: '', sticky: '' });
  const [websiteProblem, setWebsiteProblem] = useState<WebsiteProblem | null>(null);
  const [activeForm, setActiveForm] = useState<WebsiteFormId>('top');
  const websiteInputs = useRef<Record<WebsiteFormId, HTMLInputElement | null>>({ top: null, bottom: null, sticky: null });
  /** The country name when the free video ad is not offered where the visitor is (GET /api/free-video/country). */
  const blockedCountry = useRef<string | null>(null);
  const openedOnce = useRef(false);

  // Step 2
  const sheetRef = useRef<HTMLDialogElement>(null);
  const sheetTitleRef = useRef<HTMLHeadingElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const sheetOpener = useRef<HTMLElement | null>(null);
  const pressedSheetBackdrop = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [problems, setProblems] = useState<SheetProblems>({});
  const [sending, setSending] = useState(false);
  /** Blocks a second submit in the same frame, before the disabled button has rendered. */
  const sendingNow = useRef(false);
  const [slow, setSlow] = useState(false);
  const [silentThanks, setSilentThanks] = useState(false);

  // The example player
  const playerRef = useRef<HTMLDialogElement>(null);
  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const playerOpener = useRef<HTMLElement | null>(null);
  const pressedPlayerBackdrop = useRef(false);
  const [playing, setPlaying] = useState<ExampleVideoAd | null>(null);

  const overlayOpen = sheetOpen || playing !== null;
  const website = websites[activeForm];

  useEffect(() => {
    mountedAt.current = performance.now();
    if (sentView.current) return;
    sentView.current = true;
    beacon('landing_view');
  }, [beacon]);

  // No page scroll behind an open window. The cleanup also runs when the page goes away (the push to the thanks page).
  useEffect(() => {
    if (!overlayOpen) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previous;
    };
  }, [overlayOpen]);

  // Phones: keep the sheet inside the visible area while the keyboard is up (iOS shrinks only the visual viewport).
  useEffect(() => {
    const sheet = sheetRef.current;
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (!sheetOpen || !sheet || !viewport) return;
    const fit = () => {
      sheet.style.top = `${viewport.offsetTop}px`;
      sheet.style.height = `${viewport.height}px`;
    };
    fit();
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    return () => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
      sheet.style.top = '';
      sheet.style.height = '';
    };
  }, [sheetOpen]);

  const setWebsite = useCallback((form: WebsiteFormId, value: string) => {
    setWebsites((current) => ({ ...current, [form]: value }));
    setWebsiteProblem((current) => (current?.form === form ? null : current));
  }, []);

  const registerWebsiteInput = useCallback((form: WebsiteFormId, input: HTMLInputElement | null) => {
    websiteInputs.current[form] = input;
  }, []);

  const noteFormStart = useCallback(() => {
    if (sentStart.current) return;
    sentStart.current = true;
    beacon('form_start');
  }, [beacon]);

  /** Step 1 → step 2 with this website text: checks it and the visitor's country, then opens the sheet. */
  const openStep2 = useCallback((form: WebsiteFormId, text: string) => {
    const country = blockedCountry.current;
    const problem = checkWebsite(text) ?? (country ? { field: 'website' as const, message: ERRORS.country(country) } : null);
    if (problem) {
      setWebsiteProblem({ form, problem, website: text });
      websiteInputs.current[form]?.focus();
      return;
    }
    const sheet = sheetRef.current;
    if (!sheet) return;
    setWebsiteProblem(null);
    setActiveForm(form);
    setProblems({});
    sheetOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    showDialog(sheet);
    setSheetOpen(true);
    // Focus inside the same tap, so a phone opens its keyboard at once.
    const target = !firstNameRef.current?.value.trim()
      ? firstNameRef.current
      : !emailRef.current?.value.trim()
        ? emailRef.current
        : sendRef.current;
    target?.focus();
  }, []);

  const startStep2 = useCallback((form: WebsiteFormId) => openStep2(form, websites[form]), [websites, openStep2]);

  // Once: the country check, and the website bluefx.net's homepage hands over (?website=), which goes straight to step 2
  // as soon as the country answer is in (at most 1.5 s). The ref keeps React's dev double-run from doing it twice.
  useEffect(() => {
    if (openedOnce.current) return;
    openedOnce.current = true;
    const country = fetch(`/api/free-video/country?tz=${encodeURIComponent(timeZone() ?? '')}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((answer: { blocked?: unknown } | null) => {
        blockedCountry.current = typeof answer?.blocked === 'string' ? answer.blocked : null;
      })
      .catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    const handoff = (params.get('website') ?? '').trim().slice(0, 500);
    if (!handoff) return;
    params.delete('website');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    setWebsites((current) => ({ ...current, top: handoff }));
    noteFormStart();
    void Promise.race([country, new Promise((resolve) => window.setTimeout(resolve, 1500))]).then(() => openStep2('top', handoff));
  }, [noteFormStart, openStep2]);

  const closeSheet = useCallback(() => {
    const sheet = sheetRef.current;
    if (sheet) hideDialog(sheet);
    setSheetOpen(false);
    // Back to what opened the sheet. A tap on a phone leaves nothing focused: then focus stays put, so the keyboard does not pop up again.
    const opener = sheetOpener.current;
    if (opener && opener !== document.body && opener.isConnected) opener.focus();
  }, []);

  /**
   * A website problem goes back to the field it is about; name and email problems stay in the sheet. One free video ad
   * per business (upgrade): the sheet swaps its fields for the reason and the AI Media Machine offer.
   */
  const showProblem = (problem: FormProblem, text: string) => {
    if (problem.field === 'website') {
      const sheet = sheetRef.current;
      if (sheet) hideDialog(sheet);
      setSheetOpen(false);
      setWebsiteProblem({ form: activeForm, problem, website: text });
      if (problem.clearWebsite) setWebsites((current) => ({ ...current, [activeForm]: '' }));
      websiteInputs.current[activeForm]?.focus();
      return;
    }
    if (problem.field === 'firstName' || problem.field === 'email') {
      setProblems({ [problem.field]: problem });
      (problem.field === 'email' ? emailRef : firstNameRef).current?.focus();
      return;
    }
    setProblems({ form: problem });
    // The send button that had the focus goes away with the fields: the title takes it (and scrolls the sheet back up).
    if (problem.upgrade) window.requestAnimationFrame(() => sheetTitleRef.current?.focus());
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingNow.current) return;
    const nameProblem = checkFirstName(firstName);
    const emailProblem = checkEmail(email);
    if (nameProblem || emailProblem) {
      setProblems({ firstName: nameProblem ?? undefined, email: emailProblem ?? undefined });
      (nameProblem ? firstNameRef : emailRef).current?.focus();
      return;
    }
    const text = website.trim();
    sendingNow.current = true;
    setProblems({});
    setSending(true);
    const slowTimer = window.setTimeout(() => setSlow(true), 1000);
    const ref = refTagFromUrl();
    const fbclid = clickIdFromUrl();
    const body: SubmitBody = {
      firstName: firstName.trim(),
      email: email.trim(),
      website: text,
      consent: true,
      fv_note: honeypotRef.current?.value ?? '',
      tz: timeZone(),
      // The schema accepts 0 to 24 h.
      elapsedMs: Math.min(86_400_000, Math.max(0, Math.round(performance.now() - mountedAt.current))),
      ...(ref ? { ref } : {}),
      ...(fbclid ? { fbclid } : {}),
    };
    let leaving = false;
    try {
      const res = await fetch('/api/free-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const answer: unknown = await res.json().catch(() => null);
      const data = res.ok ? submitData(answer) : null;
      if (data?.token && VIEW_TOKEN.test(data.token)) {
        leaving = true;
        // The Lead, with the id the server sends to the Conversions API too, so Facebook counts it once.
        if (data.eventId) trackPixel('Lead', PIXEL_DATA.lead, data.eventId);
        router.push(`/free-video-ad/thanks/${data.token}`);
        return;
      }
      if (data && data.token === null) {
        setSilentThanks(true);
        return;
      }
      showProblem(res.ok ? { field: null, message: ERRORS.generic } : problemFromAnswer(res.status, answer, text), text);
    } catch {
      showProblem({ field: null, message: FORM.offline }, text);
    } finally {
      window.clearTimeout(slowTimer);
      if (!leaving) {
        sendingNow.current = false;
        setSending(false);
        setSlow(false);
      }
    }
  };

  const openExample = useCallback(
    (example: ExampleVideoAd, opener: HTMLElement) => {
      const dialog = playerRef.current;
      const video = playerVideoRef.current;
      if (!dialog || !video) return;
      playerOpener.current = opener;
      video.poster = example.poster;
      video.src = example.video;
      showDialog(dialog);
      setPlaying(example);
      // Still inside the tap, so the browser lets the video ad start with sound.
      void video.play().catch(() => undefined);
      beacon('video_play');
    },
    [beacon]
  );

  const closePlayer = useCallback(() => {
    const video = playerVideoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.removeAttribute('poster');
      video.load();
    }
    const dialog = playerRef.current;
    if (dialog) hideDialog(dialog);
    setPlaying(null);
    playerOpener.current?.focus();
  }, []);

  /** A click counts as a backdrop click only when the press started on the backdrop too (a text selection may end there). */
  const pressStart = (pressed: { current: boolean }) => (event: PointerEvent<HTMLDialogElement>) => {
    pressed.current = event.target === event.currentTarget;
  };
  const backdropClick = (pressed: { current: boolean }, close: () => void) => (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && pressed.current) close();
    pressed.current = false;
  };
  const onSheetCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (!sending) closeSheet();
  };
  const onPlayerCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    closePlayer();
  };

  const value = useMemo<LandingContextValue>(
    () => ({ websites, setWebsite, websiteProblem, registerWebsiteInput, startStep2, noteFormStart, openExample, overlayOpen }),
    [websites, setWebsite, websiteProblem, registerWebsiteInput, startStep2, noteFormStart, openExample, overlayOpen]
  );

  const upgrade = problems.form?.upgrade ? problems.form : null;
  const firstNameError = problems.firstName ? 'fv-first-name-error' : undefined;
  const emailError = problems.email ? 'fv-email-error' : undefined;

  return (
    <LandingContext.Provider value={value}>
      {children}

      <dialog
        ref={sheetRef}
        className={styles.sheet}
        aria-labelledby="fv-step2-title"
        onCancel={onSheetCancel}
        onPointerDown={pressStart(pressedSheetBackdrop)}
        onClick={backdropClick(pressedSheetBackdrop, () => {
          if (!sending) closeSheet();
        })}
      >
        <form className={styles.sheetBox} method="post" noValidate onSubmit={submit}>
          <button type="button" className={styles.sheetClose} aria-label={FORM.close} onClick={closeSheet} disabled={sending}>
            <span aria-hidden="true">×</span>
          </button>
          {!upgrade && <p className={styles.stepTag}>{FORM.stepTag}</p>}
          <h2 ref={sheetTitleRef} id="fv-step2-title" className={styles.sheetTitle} tabIndex={-1}>
            {upgrade ? FORM.upgradeTitle : FORM.sheetTitle(domainOf(website))}
          </h2>

          {silentThanks ? (
            <p className={styles.thanksBox} role="status">
              {FORM.silentThanks}
            </p>
          ) : upgrade ? (
            <>
              <FormMessage problem={upgrade} website={website} variant="note" />
              <LifetimeOffer placement="fvland" token="" isCustomer={false} variant="upgrade" />
            </>
          ) : (
            <>
              {problems.form && <FormMessage problem={problems.form} website={website} variant="box" />}

              <label className={styles.label} htmlFor="fv-first-name">
                {FORM.firstName}
              </label>
              <input
                ref={firstNameRef}
                id="fv-first-name"
                name="firstName"
                className={cn(styles.input, problems.firstName && styles.inputInvalid)}
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  if (problems.firstName) setProblems((current) => ({ ...current, firstName: undefined }));
                }}
                placeholder={FORM.firstNamePlaceholder}
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                aria-invalid={problems.firstName ? true : undefined}
                aria-describedby={firstNameError}
              />
              {problems.firstName && <FormMessage id={firstNameError} problem={problems.firstName} website={website} variant="field" />}

              <label className={styles.label} htmlFor="fv-email">
                {FORM.email}
              </label>
              <input
                ref={emailRef}
                id="fv-email"
                name="email"
                type="email"
                inputMode="email"
                className={cn(styles.input, problems.email && styles.inputInvalid)}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (problems.email) setProblems((current) => ({ ...current, email: undefined }));
                }}
                placeholder={FORM.emailPlaceholder}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                aria-invalid={problems.email ? true : undefined}
                aria-describedby={emailError}
              />
              {problems.email && <FormMessage id={emailError} problem={problems.email} website={website} variant="field" />}

              {/* Honeypot: off-screen, out of the tab order, a name no autofill knows. A person never fills it. */}
              <div className={styles.honeypot} aria-hidden="true">
                <input ref={honeypotRef} name="fv_note" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
              </div>

              <button ref={sendRef} type="submit" className={styles.btn} disabled={sending} aria-busy={sending || undefined}>
                {slow ? FORM.busy : FORM.sendButton}
              </button>
              <p className={styles.fine}>{FORM.consent}</p>
            </>
          )}
        </form>
      </dialog>

      <dialog
        ref={playerRef}
        className={styles.modal}
        aria-label={EXAMPLES.dialogLabel(playing?.name)}
        onCancel={onPlayerCancel}
        onPointerDown={pressStart(pressedPlayerBackdrop)}
        onClick={backdropClick(pressedPlayerBackdrop, closePlayer)}
      >
        <button type="button" className={styles.modalClose} aria-label={EXAMPLES.close} onClick={closePlayer}>
          <span aria-hidden="true">×</span>
        </button>
        {/* src and poster are set when a video ad opens and removed when the player closes. */}
        <video ref={playerVideoRef} className={styles.modalVideo} playsInline controls preload="none" />
      </dialog>
    </LandingContext.Provider>
  );
}
