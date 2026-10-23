'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/user/dashboard-layout';
import { cn } from '@/lib/utils';
import { findWebsite } from '@/lib/smart-video/link';
import { PHANTOM_EXAMPLES } from '@/lib/smart-video/examples';
import { urlToFile } from '@/lib/url-to-file';
import type { VideoFormat, VideoLook } from '@/lib/smart-video/types';
import type { SmartVideoJob } from '@/types/smart-video';
import type { BonusVideoAd } from '@/types/free-video';
import { MakeVideoAdView, type SmartVideo } from './make-video-ad';
import { PREVIEW_STATES, type PreviewState } from './preview-states';

/**
 * DEV ONLY (see app/dev-preview/make-video-ad): Make a Video Ad in every state, from sample data. The control panel
 * in the corner switches the state and light or dark. Typing in the box and the options work; nothing is sent.
 */


const roof = PHANTOM_EXAMPLES.find((e) => e.id === 'roofing')!;
const realtor = PHANTOM_EXAMPLES.find((e) => e.id === 'realtor')!;
const product = PHANTOM_EXAMPLES.find((e) => e.id === 'product')!;
const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const roofScript = [
  { say: 'The storm damage you cannot see is the part that costs you.', show: ['STORM DAMAGE?'], speaker: true, presenter: true },
  { say: 'Ridgeline Roofing checks your roof for free within 24 hours.', show: ['FREE INSPECTION', '24 HOURS'], speaker: false },
  { say: 'You get photos of every problem the same day.', show: ['PHOTOS THE SAME DAY'], speaker: false },
  { say: 'We meet your insurance adjuster for you.', show: ['WE MEET YOUR ADJUSTER'], speaker: false },
  { say: 'Most repairs are done in one day.', show: ['DONE IN 1 DAY'], speaker: false },
  { say: 'Call 405-555-0174 today.', show: ['405-555-0174'], speaker: false },
];

const original: SmartVideoJob = {
  id: id(1),
  userId: 'preview',
  status: 'done',
  brief: roof.brief,
  format: 'vertical',
  look: 'bold',
  presenter: true,
  createdAt: ago(3600),
  updatedAt: ago(3400),
  videoUrl: roof.videoUrl,
  durationSeconds: 38,
  script: roofScript,
  warnings: ['The video ad says "licensed and insured". Make sure that is true before you post your video ad.'],
};
const change1: SmartVideoJob = {
  ...original,
  id: id(2),
  parentId: original.id,
  note: 'Make the phone number bigger on the last screen.',
  createdAt: ago(1800),
  updatedAt: ago(1650),
  warnings: undefined,
};
const productAd: SmartVideoJob = {
  ...original,
  id: id(3),
  brief: product.brief,
  format: 'horizontal',
  videoUrl: product.videoUrl,
  durationSeconds: 30,
  createdAt: ago(86400 * 2),
  updatedAt: ago(86400 * 2),
  script: undefined,
  warnings: undefined,
};
const realtorAd: SmartVideoJob = {
  ...original,
  id: id(4),
  brief: realtor.brief,
  videoUrl: realtor.videoUrl,
  durationSeconds: 33,
  createdAt: ago(86400 * 3),
  updatedAt: ago(86400 * 3),
  script: undefined,
  warnings: undefined,
};
const making: SmartVideoJob = {
  id: id(5),
  userId: 'preview',
  status: 'producing',
  brief: 'ascentequipment.com\nFree demo of our channel letter machine this month. Call 555-0128.',
  link: 'https://ascentequipment.com/',
  format: 'vertical',
  look: 'auto',
  presenter: true,
  createdAt: ago(112),
  updatedAt: ago(5),
};
const changeMaking: SmartVideoJob = {
  ...original,
  id: id(6),
  parentId: original.id,
  status: 'producing',
  videoUrl: undefined,
  note: 'Use a woman presenter in her 50s.',
  presenter: true,
  presenterRequest: 'Use a woman presenter in her 50s.',
  createdAt: ago(72),
  updatedAt: ago(4),
};
const failed: SmartVideoJob = {
  ...making,
  id: id(7),
  status: 'failed',
  error:
    'the AI Media Machine could not open ascentequipment.com. Check the address, or type a few lines about your business instead. 60 credits have been returned to your balance.',
};
const changeFailed: SmartVideoJob = {
  ...change1,
  id: id(8),
  status: 'failed',
  videoUrl: undefined,
  error: 'Director call failed (503): The model is overloaded. 10 credits have been returned to your balance.',
};
const freeBase: SmartVideoJob = {
  id: id(9),
  userId: 'preview',
  status: 'rendering',
  renderProgress: 40,
  brief: '',
  link: 'https://ascentequipment.com/',
  format: 'vertical',
  freeLeadId: 'lead',
  freeSite: 'ascentequipment.com',
  freePreviewUrl: realtor.videoUrl,
  createdAt: ago(40),
  updatedAt: ago(3),
};

/** The 3 bonus video ads of a buyer (a real dry run on jmpaintingservices.com, 2026-10-19). */
const BONUS_PICTURES = 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/free-video/next-ads/preview';
const bonusAds = (states: BonusVideoAd['state'][], leadId = 'lead', site = 'jmpaintingservices.com'): BonusVideoAd[] =>
  [
    { n: 2 as const, title: 'Why Christine loves her clean paint job', teaser: 'Christine shares how the painters arrived on time, left no mess, and double checked her satisfaction.' },
    { n: 3 as const, title: 'The faded exterior siding needing fresh paint', teaser: 'A presenter points to dirty, faded exterior siding and explains how surface washing and painting fixes it.' },
    { n: 4 as const, title: 'Your free estimate booked within 24 hours', teaser: 'A presenter holds a clipboard and explains how to get a clear, zero-pressure quote today.' },
  ].map((ad, index) => ({ ...ad, leadId, site, imageUrl: `${BONUS_PICTURES}/n${ad.n}.jpg?v=jm8`, jobId: `${leadId}-${id(20 + index)}`, state: states[index] }));
const bonusFailed: SmartVideoJob = {
  id: id(21),
  userId: 'preview',
  status: 'failed',
  brief: 'The faded exterior siding needing fresh paint',
  link: 'https://jmpaintingservices.com/',
  format: 'vertical',
  presenter: true,
  creditsUsed: 0,
  bonus: { leadId: 'lead', n: 3, site: 'jmpaintingservices.com', attempt: 1 },
  error: 'The job stopped unexpectedly (the server restarted during an update). Please run it again.',
  createdAt: ago(600),
  updatedAt: ago(400),
};

function jobsFor(state: PreviewState): { job: SmartVideoJob | null; history: SmartVideoJob[] } {
  const library = [original, change1, productAd, realtorAd];
  switch (state) {
    case 'making':
      return { job: making, history: [making, ...library] };
    case 'slow':
      return { job: { ...making, status: 'rendering', renderProgress: 72, createdAt: ago(7 * 60 + 14) }, history: library };
    case 'ready':
    case 'presenter':
      return { job: original, history: [original, productAd, realtorAd] };
    case 'changed':
      return { job: change1, history: library };
    case 'change-making':
      return { job: changeMaking, history: [original, changeMaking, productAd, realtorAd] };
    case 'failed':
      return { job: failed, history: [failed, ...library] };
    case 'change-failed':
      return { job: changeFailed, history: [original, change1, changeFailed, productAd] };
    case 'free-making':
      return { job: { ...freeBase, status: 'directing', freeStage: 'making', freePreviewUrl: undefined }, history: [] };
    case 'free-arriving':
      return { job: freeBase, history: [freeBase] };
    case 'bonus':
    case 'bonus-sites':
    case 'bonus-making':
      return { job: null, history: [{ ...freeBase, status: 'done', videoUrl: realtor.videoUrl, freeSite: 'jmpaintingservices.com' }] };
    case 'bonus-failed':
      return { job: bonusFailed, history: [bonusFailed] };
    default:
      return { job: null, history: library };
  }
}

const noop = () => undefined;
const noopAsync = async () => false;

export function MakeVideoAdPreview({ state, theme, empty, bare }: { state: PreviewState; theme: 'light' | 'dark'; empty: boolean; bare?: boolean }) {
  const typed = state === 'website' || state === 'options';
  const [brief, setBrief] = useState(typed ? 'ascentequipment.com\nFree demo of our channel letter machine this month. Call 555-0128.' : '');
  const [format, setFormat] = useState<VideoFormat>('vertical');
  const [look, setLook] = useState<VideoLook>('auto');
  const [presenter, setPresenter] = useState(true);
  const [voiceOver, setVoiceOver] = useState(true);
  const [music, setMusic] = useState(true);
  const [exactWords, setExactWords] = useState(false);
  // Two real photos from the roofer example stand in for the client's own.
  const [photos, setPhotos] = useState<File[]>([]);
  useEffect(() => {
    if (!typed) return;
    Promise.all(roof.files.slice(0, 2).map((f) => urlToFile(f.url, f.name, 'image/jpeg')))
      .then(setPhotos)
      .catch(() => undefined);
  }, [typed]);
  const { job, history } = jobsFor(state);

  const smart = {
    job,
    jobId: job?.id ?? null,
    history: empty ? [] : history,
    uploading: state === 'uploading' ? { done: 1, total: 2 } : null,
    stalePage: false,
    brief,
    setBrief,
    website: findWebsite(brief),
    files: photos,
    addFiles: noop,
    removeFile: noop,
    isBusy: false,
    start: noop,
    credits: 50 + (format === 'vertical' && presenter ? 10 : 0),
    format,
    setFormat,
    look,
    setLook,
    presenter,
    setPresenter,
    voiceOver,
    setVoiceOver,
    music,
    setMusic,
    exactWords,
    setExactWords,
    openJob: noop,
    revise: noopAsync,
    revising: false,
    reset: noop,
    tryAgain: noop,
    retryEdit: noopAsync,
  } as unknown as SmartVideo;

  const href = (next: { state?: string; theme?: string }) =>
    `?state=${next.state ?? state}&theme=${next.theme ?? theme}${empty ? '&empty=1' : ''}`;

  return (
    <div className={cn(theme === 'light' && 'light', 'bg-background text-foreground')}>
      <DashboardLayout>
        <MakeVideoAdView
          key={`${state}-${theme}`}
          smart={smart}
          balance={600}
          preview={{
            moreOpen: state === 'options',
            changeNote: state === 'presenter' ? 'Use a woman presenter in her 50s.' : undefined,
            bonusAds:
              state === 'bonus'
                ? bonusAds(['new', 'new', 'new'])
                : state === 'bonus-making'
                  ? bonusAds(['making', 'new', 'new'])
                  : state === 'bonus-failed'
                    ? bonusAds(['done', 'failed', 'new'])
                    : state === 'bonus-sites'
                      ? [...bonusAds(['new', 'new', 'new'], 'newest', 'aispartan.com'), ...bonusAds(['done', 'new', 'new'])]
                      : undefined,
          }}
        />
      </DashboardLayout>
      {!bare && (
      <nav className="fixed bottom-3 right-3 z-[60] w-[230px] rounded-xl border border-border bg-card p-3 text-sm text-card-foreground shadow-2xl">
        <p className="mb-2 font-bold">Preview (sample data)</p>
        <div className="mb-2 flex gap-2">
          {(['light', 'dark'] as const).map((t) => (
            <Link key={t} href={href({ theme: t })} className={cn('flex-1 rounded-md border px-2 py-1 text-center capitalize', t === theme ? 'border-primary bg-primary/10 font-bold' : 'border-border')}>
              {t}
            </Link>
          ))}
        </div>
        <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto">
          {PREVIEW_STATES.map((s) => (
            <li key={s.id}>
              <Link href={href({ state: s.id })} className={cn('block rounded px-2 py-1 hover:bg-accent', s.id === state && 'bg-primary/10 font-bold')}>
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href={`?state=start&theme=${theme}${empty ? '' : '&empty=1'}`} className="mt-2 block rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
          {empty ? 'Show Your video ads' : 'New user (no video ads yet)'}
        </Link>
      </nav>
      )}
    </div>
  );
}
