import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClickBankFunnelPanel } from '@/components/admin/clickbank-funnel-panel';
import type { FunnelPanelPreset } from '@/components/admin/free-video-funnel-panel';
import { computeCbFunnelReport } from '@/lib/free-video/cb-funnel-stats';
import { isLive } from '@/lib/free-video/config';
import { DEFAULT_STATS_TZ } from '@/lib/free-video/funnel-stats';

/**
 * DEV ONLY: the admin panel's "ClickBank funnel" tab with the real numbers, without signing in (the admin page needs an
 * admin sign-in). The page computes the report on the server with the same computeCbFunnelReport the admin API runs
 * (read only), for ?range=today, 7d (default), 30d or all, with the days in Europe/Bucharest. The Block switches save
 * nothing here. A 404 on the live site and in any production build (like the funnel preview next to it).
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ClickBank funnel: numbers by affiliate (dev preview)',
};

const DAYS_BACK: Record<FunnelPanelPreset, number | null> = { today: 0, '7d': 6, '30d': 29, all: null };

const isPreset = (value: string | undefined): value is FunnelPanelPreset => Boolean(value && value in DAYS_BACK);

/** Milliseconds a time zone is ahead of UTC at an instant (the same helper as preview/funnel). */
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

interface CbFunnelPreviewPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function CbFunnelPreviewPage({ searchParams }: CbFunnelPreviewPageProps) {
  if (isLive() || process.env.NODE_ENV === 'production') notFound();
  const { range: input } = await searchParams;
  const range: FunnelPanelPreset = isPreset(input) ? input : '7d';
  const daysBack = DAYS_BACK[range];
  const report = await computeCbFunnelReport({
    from: daysBack === null ? null : midnightIn(DEFAULT_STATS_TZ, daysBack).toISOString(),
    to: new Date().toISOString(),
    tz: DEFAULT_STATS_TZ,
  });

  return (
    <div className="dark bg-background font-sans text-foreground [color-scheme:dark]">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <p className="mb-4 text-xs text-muted-foreground">
          DEV PREVIEW: the admin panel&apos;s ClickBank funnel tab with the real numbers (read only). Range: ?range=today, 7d, 30d or all. The range
          buttons below do not reload here, and the Block switches save nothing.
        </p>
        <ClickBankFunnelPanel preview={{ report, preset: range }} />
      </div>
    </div>
  );
}
