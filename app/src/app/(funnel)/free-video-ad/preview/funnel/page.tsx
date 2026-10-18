import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FreeVideoFunnelPanel, type FunnelPanelPreset } from '@/components/admin/free-video-funnel-panel';
import { computeFunnelStats, DEFAULT_STATS_TZ, type TurnedAway } from '@/lib/free-video/funnel-stats';

/**
 * DEV ONLY: the admin panel's "Opt-in page conversion" card with the real numbers, without signing in (the admin page
 * needs an admin sign-in). The page computes them on the server with the same computeFunnelStats the admin API runs
 * (read only), for ?range=today, 7d (default), 30d or all, with the days in Europe/Bucharest. A 404 in production.
 * ?sample=turned-away swaps in SAMPLE_TURNED_AWAY, so the turned-away list can be seen with rows before real ones exist.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Free video ad: funnel numbers (dev preview)',
};

const DAYS_BACK: Record<FunnelPanelPreset, number | null> = { today: 0, '7d': 6, '30d': 29, all: null };

const isPreset = (value: string | undefined): value is FunnelPanelPreset => Boolean(value && value in DAYS_BACK);

/** Milliseconds a time zone is ahead of UTC at an instant. */
function offsetMs(tz: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')) - at;
}

/** 00:00 in a time zone, daysBack calendar days before today there (the panel's range buttons, on the server). */
function midnightIn(tz: string, daysBack: number): Date {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  const wallClock = Date.UTC(y, m - 1, d - daysBack);
  const first = wallClock - offsetMs(tz, wallClock);
  return new Date(wallClock - offsetMs(tz, first));
}

/** Made-up rows for ?sample=turned-away: one of each kind the list has to show. */
const SAMPLE_TURNED_AWAY: TurnedAway = {
  sends: 5,
  people: 3,
  byReason: [
    { code: 'bot', check: 'honeypot', sends: 3 },
    { code: 'notFound', check: null, sends: 1 },
    { code: 'tries', check: null, sends: 1 },
  ],
  recent: [
    { at: '2026-10-18T00:22:50Z', code: 'bot', check: 'honeypot', firstName: 'Daniel', email: 'daniel@example.com', website: 'yourwebsite.com', ref: 'fb-Instagram_Feed' },
    { at: '2026-10-18T00:01:10Z', code: 'bot', check: 'honeypot', firstName: 'Daniel', email: 'daniel@example.com', website: 'yourwebsite.com', ref: 'fb-Instagram_Feed' },
    { at: '2026-10-17T23:58:40Z', code: 'bot', check: 'honeypot', firstName: 'Daniel', email: 'daniel@example.com', website: 'yourwebsite.com', ref: 'fb-Instagram_Feed' },
    { at: '2026-10-17T19:12:03Z', code: 'notFound', check: null, firstName: 'Maria', email: 'maria@example.com', website: 'mariasbakery.co', ref: 'fb-Facebook_Mobile_Feed' },
    { at: '2026-10-17T15:40:31Z', code: 'tries', check: null, firstName: 'Tom', email: 'tom@example.com', website: 'www.tomsroofing', ref: 'bfxhome' },
  ],
};

interface FunnelPreviewPageProps {
  searchParams: Promise<{ range?: string; sample?: string }>;
}

export default async function FunnelPreviewPage({ searchParams }: FunnelPreviewPageProps) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { range: input, sample } = await searchParams;
  const range: FunnelPanelPreset = isPreset(input) ? input : '7d';
  const daysBack = DAYS_BACK[range];
  const stats = await computeFunnelStats({
    from: daysBack === null ? null : midnightIn(DEFAULT_STATS_TZ, daysBack).toISOString(),
    to: new Date().toISOString(),
    tz: DEFAULT_STATS_TZ,
  });

  return (
    <div className="dark bg-background font-sans text-foreground [color-scheme:dark]">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <p className="mb-4 text-xs text-muted-foreground">
          DEV PREVIEW: the admin panel card with the real numbers (read only). Range: ?range=today, 7d, 30d or all. The range buttons below do not
          reload here. ?sample=turned-away shows made-up rows in the turned-away list.
        </p>
        <FreeVideoFunnelPanel preview={{ stats: sample === 'turned-away' ? { ...stats, turnedAway: SAMPLE_TURNED_AWAY } : stats, preset: range }} />
      </div>
    </div>
  );
}
