import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import styles from '@/components/free-video/free-video.module.css';
import { ERROR_CODES, problemForCode } from '@/components/free-video/form-errors';
import { FormMessage } from '@/components/free-video/form-message';
import { LifetimeOffer } from '@/components/free-video/lifetime-offer';
import { FreeVideoStatus, type FreeVideoStatusDemo } from '@/components/free-video/free-video-status';
import { EXAMPLE_VIDEOS } from '@/lib/free-video/copy';
import { unlockGoUrl, type PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import type { FreeVideoView } from '@/types/free-video';
import { LIVE_DEMO, LIVE_DEMO_DOMAIN, LIVE_DEMO_VIDEO } from '@/lib/free-video/live-demo';

/**
 * DEV ONLY: every state of the status page, rendered from fixtures, so each one can be checked in a
 * browser without a database. No polling, no events, no tab titles. A 404 in production.
 * The example videos stand in for the visitor's files (the real free file has the watermark burned in).
 */

export const metadata: Metadata = {
  title: 'Free video ad: every state (dev preview)',
};

interface Fixture {
  id: string;
  label: string;
  view: FreeVideoView;
  placement: (typeof PAGE_PLACEMENTS)[number];
  demo?: FreeVideoStatusDemo;
}

const DOMAIN = 'yourbusiness.com';
const FREE_FILE = EXAMPLE_VIDEOS.ads[0].video;
const CLEAN_FILE = EXAMPLE_VIDEOS.ads[1].video;

/** A 22-character stand-in token per fixture, like a real view token. */
const tokenOf = (id: string) => `preview${id.replace(/[^A-Za-z0-9]/g, '')}xxxxxxxxxxxxxxxxxxxxxx`.slice(0, 22);

const base = { firstName: 'Joe', domain: DOMAIN, isCustomer: false };

const waiting = (id: string, view: Omit<FreeVideoView, 'firstName' | 'domain' | 'isCustomer' | 'unlock'> & Partial<FreeVideoView>): FreeVideoView => ({
  ...base,
  unlock: { state: 'unavailable', checkoutPath: unlockGoUrl(tokenOf(id)) },
  ...view,
});

const ready = (id: string, extra: Partial<FreeVideoView> = {}): FreeVideoView => ({
  ...base,
  state: 'ready',
  videoUrl: FREE_FILE,
  downloadUrl: `${FREE_FILE}?download=${DOMAIN}-video-ad-free.mp4`,
  unlock: { state: 'available', checkoutPath: unlockGoUrl(tokenOf(id)) },
  // Ready a day ago: 47 hours of the 3-day bonus left (offer.ts cleanCopyUntil).
  cleanUntil: new Date(Date.now() + 47 * 3_600_000).toISOString(),
  ...extra,
});

/** The live page, step by step, with the pieces of a real run (live-demo.ts). */
const liveView = (id: string, view: Partial<FreeVideoView>): FreeVideoView =>
  waiting(id, { state: 'making', domain: LIVE_DEMO_DOMAIN, ...view });

const FIXTURES: Fixture[] = [
  { id: 'live-1', label: 'LIVE 1: reading the website (nothing found yet)', placement: 'fvthank', view: liveView('live-1', { step: 'reading', live: {} }) },
  { id: 'live-2', label: 'LIVE 2: website photos found, writing the script', placement: 'fvthank', view: liveView('live-2', { step: 'directing', live: LIVE_DEMO.photos }) },
  { id: 'live-2b', label: 'LIVE 2b: the presenter is cast, still writing the script', placement: 'fvthank', view: liveView('live-2b', { step: 'directing', live: LIVE_DEMO.cast }) },
  { id: 'live-3', label: 'LIVE 3: the script is in, pictures and sound being made', placement: 'fvthank', view: liveView('live-3', { step: 'producing', live: LIVE_DEMO.script }) },
  { id: 'live-3b', label: 'LIVE 3b: the voice-over and the music are in', placement: 'fvthank', view: liveView('live-3b', { step: 'producing', live: LIVE_DEMO.music }) },
  { id: 'live-3c', label: 'LIVE 3c: the moving clips are in', placement: 'fvthank', view: liveView('live-3c', { step: 'producing', live: LIVE_DEMO.clips }) },
  { id: 'live-4', label: 'LIVE 4: putting it together, 47%', placement: 'fvthank', view: liveView('live-4', { step: 'rendering', progress: 47, live: LIVE_DEMO.clips }) },
  { id: 'live-5', label: 'LIVE 5: final check', placement: 'fvthank', view: liveView('live-5', { step: 'finishing', live: LIVE_DEMO.clips }) },
  {
    id: 'live-ready',
    label: 'LIVE ready: the real free video ad of that run',
    placement: 'fvthank',
    view: ready('live-ready', { domain: LIVE_DEMO_DOMAIN, videoUrl: LIVE_DEMO_VIDEO, downloadUrl: LIVE_DEMO_VIDEO }),
  },
  { id: 'queued-next', label: 'queued: next in line, ETA 16 min', placement: 'fvthank', view: waiting('queued-next', { state: 'queued', position: 0, etaMinutes: 16 }) },
  { id: 'queued-6th', label: 'queued: number 6 in line, ETA 32 min', placement: 'fvthank', view: waiting('queued-6th', { state: 'queued', position: 5, etaMinutes: 32 }) },
  { id: 'queued-busy', label: 'queued: number 41, ETA over 90 min (busy-day line)', placement: 'fvthank', view: waiting('queued-busy', { state: 'queued', position: 40, etaMinutes: 336 }) },
  { id: 'queued-paused', label: "queued: starts paused (etaNote 'paused')", placement: 'fvthank', view: waiting('queued-paused', { state: 'queued', position: 2, etaMinutes: null, etaNote: 'paused' }) },
  { id: 'queued-capped', label: "queued: past today's cap (etaNote 'capped')", placement: 'fvthank', view: waiting('queued-capped', { state: 'queued', position: 160, etaMinutes: null, etaNote: 'capped' }) },
  { id: 'making-1', label: 'making: step 1 reading', placement: 'fvthank', view: waiting('making-1', { state: 'making', step: 'reading' }) },
  { id: 'making-2', label: 'making: step 2 directing (writing the script)', placement: 'fvthank', view: waiting('making-2', { state: 'making', step: 'directing' }) },
  { id: 'making-3', label: 'making: step 3 producing (voice-over and music)', placement: 'fvthank', view: waiting('making-3', { state: 'making', step: 'producing' }) },
  { id: 'making-4', label: 'making: step 4 rendering at 45%', placement: 'fvthank', view: waiting('making-4', { state: 'making', step: 'rendering', progress: 45 }) },
  { id: 'making-5', label: 'making: step 5 finishing (final check)', placement: 'fvthank', view: waiting('making-5', { state: 'making', step: 'finishing' }) },
  {
    id: 'making-paid',
    label: 'making, unlock already paid (paid through the email link before the video ad was done)',
    placement: 'fvpage',
    view: waiting('making-paid', { state: 'making', step: 'producing', unlock: { state: 'paid' } }),
  },
  { id: 'making-customer', label: 'making, existing customer (no offer while the video ad is made, for anyone)', placement: 'fvthank', view: waiting('making-customer', { state: 'making', step: 'directing', isCustomer: true }) },
  { id: 'making-stale', label: 'making, the page stopped checking after 90 min', placement: 'fvthank', view: waiting('making-stale', { state: 'making', step: 'rendering', progress: 80 }), demo: { stale: true } },
  { id: 'checking', label: 'checking: held for the final check', placement: 'fvthank', view: waiting('checking', { state: 'checking' }) },
  { id: 'ready', label: 'ready (thank-you page, Save to Photos shown; the $99 offer is off the page since 2026-10-08)', placement: 'fvthank', view: ready('ready'), demo: { iphone: true } },
  { id: 'ready-clicked', label: 'ready, the $99 button was clicked in a tab opened before the offer came off (looks like ready)', placement: 'fvthank', view: ready('ready-clicked'), demo: { unlockClicked: true } },
  { id: 'ready-paid', label: 'ready, unlock paid', placement: 'fvthank', view: ready('ready-paid', { unlock: { state: 'paid' } }) },
  { id: 'ready-rendering', label: 'ready, unlock rendering the clean version', placement: 'fvpage', view: ready('ready-rendering', { unlock: { state: 'rendering' } }) },
  {
    id: 'ready-clean',
    label: 'ready, clean version ready (the player swaps to the clean file)',
    placement: 'fvpage',
    view: ready('ready-clean', {
      unlock: { state: 'ready', cleanVideoUrl: CLEAN_FILE, cleanDownloadUrl: `${CLEAN_FILE}?download=${DOMAIN}-video-ad.mp4` },
    }),
    demo: { iphone: true },
  },
  { id: 'ready-unlock-failed', label: 'ready, the clean render failed for good', placement: 'fvpage', view: ready('ready-unlock-failed', { unlock: { state: 'failed' } }) },
  {
    id: 'ready-late',
    label: 'ready, /v/ page visited after the 3-day bonus: no deadline, the offer leads with the new video ads',
    placement: 'fvpage',
    view: ready('ready-late', { cleanUntil: undefined, unlock: { state: 'unavailable' } }),
  },
  { id: 'ready-customer', label: 'ready, existing customer or buyer, /v/ page: Open this video ad in the AI Media Machine (no $99 offer)', placement: 'fvpage', view: ready('ready-customer', { isCustomer: true }) },
  { id: 'ready-stale', label: 'ready, clean version rendering, the page stopped checking', placement: 'fvthank', view: ready('ready-stale', { unlock: { state: 'rendering' } }), demo: { stale: true } },
  { id: 'unreadable', label: 'unreadable: the website could not be read', placement: 'fvthank', view: waiting('unreadable', { state: 'unreadable', unlock: { state: 'unavailable' } }) },
  { id: 'failed', label: 'failed', placement: 'fvthank', view: waiting('failed', { state: 'failed', unlock: { state: 'unavailable' } }) },
];

/** Where each answer of POST /api/free-video shows on the landing page. */
function placeOf(field: string | null, upgrade?: boolean): string {
  if (upgrade) return 'the step 2 sheet swaps its fields for this note and the AI Media Machine offer (title: One free video ad per business)';
  if (field === 'website') return 'under the website field (the sheet closes)';
  if (field === 'email' || field === 'firstName') return `under ${field} in the step 2 sheet`;
  return 'above the send button in the step 2 sheet';
}

interface FreeVideoPreviewPageProps {
  /** ?only=<fixture id> shows that one state (or only=form-messages), for full-page screenshots. */
  searchParams: Promise<{ only?: string }>;
}

export default async function FreeVideoPreviewPage({ searchParams }: FreeVideoPreviewPageProps) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { only } = await searchParams;
  const fixtures = only ? FIXTURES.filter((fixture) => fixture.id === only) : FIXTURES;

  return (
    <>
      <nav className={styles.devBar} aria-label="Preview states">
        <strong>DEV PREVIEW: every status page state from fixtures (no database, no polling, no events). </strong>
        {FIXTURES.map((fixture) => (
          <a key={fixture.id} href={`#${fixture.id}`}>
            {fixture.id}
          </a>
        ))}
        <a href="#form-messages">form-messages</a>
      </nav>

      {fixtures.map((fixture) => (
        <section key={fixture.id} id={fixture.id}>
          <p className={styles.devLabel}>
            {fixture.id}: {fixture.label} [{fixture.placement}]
          </p>
          <FreeVideoStatus token={tokenOf(fixture.id)} initial={fixture.view} placement={fixture.placement} demo={fixture.demo ?? {}} />
        </section>
      ))}

      {(!only || only === 'form-messages') && (
        <section id="form-messages">
          <p className={styles.devLabel}>form-messages: every answer code of POST /api/free-video, as the landing page shows it</p>
          <div className={styles.devMessages}>
            {ERROR_CODES.map((code) => {
              const problem = problemForCode(code, DOMAIN);
              return (
                <div key={code}>
                  <h3>
                    {code}: {placeOf(problem.field, problem.upgrade)}
                  </h3>
                  <FormMessage problem={problem} website={DOMAIN} variant={problem.upgrade ? 'note' : problem.field === 'email' ? 'field' : 'box'} />
                  {code === 'tooMany' && <LifetimeOffer placement="fvland" token="" isCustomer={false} variant="upgrade" />}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
