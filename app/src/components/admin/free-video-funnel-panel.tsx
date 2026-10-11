'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FunnelCounts, FunnelRates, FunnelSourceRow, FunnelStats } from '@/lib/free-video/funnel-stats';

type Preset = 'today' | '7d' | '30d' | 'all' | 'custom';

const PRESETS: { value: Exclude<Preset, 'custom'>; label: string; daysBack: number | null }[] = [
  { value: 'today', label: 'Today', daysBack: 0 },
  { value: '7d', label: '7 days', daysBack: 6 },
  { value: '30d', label: '30 days', daysBack: 29 },
  { value: 'all', label: 'All time', daysBack: null },
];

/** The funnel's steps. base: the step its rate is taken from (not always the row above: plays and offer clicks also happen on the thank-you page, and a purchase needs no click). */
const STEPS: { key: keyof FunnelCounts; label: string; base?: { key: keyof FunnelCounts; label: string } }[] = [
  { key: 'visitors', label: 'Visitors on the opt-in page (browsers)' },
  { key: 'formStarts', label: 'Started the form (browsers)', base: { key: 'visitors', label: 'of visitors' } },
  { key: 'optIns', label: 'Opted in (people who sent the form)', base: { key: 'formStarts', label: 'of form starts' } },
  { key: 'videosMade', label: 'Video ad made', base: { key: 'optIns', label: 'of opt-ins' } },
  { key: 'viewed', label: 'Opened the emailed video ad page', base: { key: 'videosMade', label: 'of video ads made' } },
  { key: 'played', label: 'Played the video ad', base: { key: 'videosMade', label: 'of video ads made' } },
  { key: 'offerClicks', label: 'Clicked the lifetime offer', base: { key: 'videosMade', label: 'of video ads made' } },
  { key: 'purchases', label: 'Bought (any AI Media Machine purchase after opting in)', base: { key: 'optIns', label: 'of opt-ins' } },
];

const RATES: { key: keyof FunnelRates; label: string; part: keyof FunnelCounts; whole: keyof FunnelCounts }[] = [
  { key: 'optIn', label: 'Opt-in rate', part: 'optIns', whole: 'visitors' },
  { key: 'view', label: 'Opened the video ad page', part: 'viewed', whole: 'videosMade' },
  { key: 'click', label: 'Offer click rate', part: 'offerClicks', whole: 'videosMade' },
  { key: 'purchase', label: 'Purchase rate', part: 'purchases', whole: 'optIns' },
  { key: 'visitorToSale', label: 'Visitor to sale', part: 'purchases', whole: 'visitors' },
];

/** The table columns, in funnel order. */
const COLUMNS: { label: string; value: (counts: FunnelCounts, rates: FunnelRates) => string }[] = [
  { label: 'Visitors', value: (c) => String(c.visitors) },
  { label: 'Started form', value: (c) => String(c.formStarts) },
  { label: 'Opt-ins', value: (c) => String(c.optIns) },
  { label: 'Opt-in rate', value: (_c, r) => percent(r.optIn) },
  { label: 'Made', value: (c) => String(c.videosMade) },
  { label: 'Opened', value: (c) => String(c.viewed) },
  { label: 'Played', value: (c) => String(c.played) },
  { label: 'Clicked', value: (c) => String(c.offerClicks) },
  { label: 'Bought', value: (c) => String(c.purchases) },
  { label: 'Visitor to sale', value: (_c, r) => percent(r.visitorToSale) },
];

function percent(value: number | null): string {
  if (value === null) return '-';
  const pct = value * 100;
  return `${pct >= 99.95 ? Math.round(pct) : pct.toFixed(1)}%`;
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** YYYY-MM-DD of a local date (for the date inputs). */
function dateValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a YYYY-MM-DD date, plus `addDays` days; null for a bad value. */
function localMidnight(value: string, addDays = 0): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + addDays);
}

function daysAgoMidnight(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

const dayLabel = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Bucharest';
  } catch {
    return 'Europe/Bucharest';
  }
};

/** A range button of the panel. */
export type FunnelPanelPreset = Exclude<Preset, 'custom'>;

interface FreeVideoFunnelPanelProps {
  /**
   * DEV ONLY (app/(funnel)/free-video-ad/preview/funnel): numbers that page computed on the server for one range. The
   * panel shows them and never calls the admin API, which needs an admin sign-in.
   */
  preview?: { stats: FunnelStats; preset: FunnelPanelPreset };
}

/**
 * The opt-in page's conversion numbers (owner 2026-10-11: "i want to know the conversion rate, except my test
 * accounts"): the funnel from visitor to sale for a date range, the five rates, each traffic source and each day.
 * Days are the admin's own (the browser's time zone). lib/free-video/funnel-stats.ts defines every number.
 */
export function FreeVideoFunnelPanel({ preview }: FreeVideoFunnelPanelProps) {
  const [preset, setPreset] = useState<Preset>(preview?.preset ?? '7d');
  const [fromDate, setFromDate] = useState(() => dateValue(daysAgoMidnight(PRESETS.find((option) => option.value === preview?.preset)?.daysBack ?? 6)));
  const [toDate, setToDate] = useState(() => dateValue(new Date()));
  const [view, setView] = useState<'channels' | 'tags'>('channels');
  const [stats, setStats] = useState<FunnelStats | null>(preview?.stats ?? null);
  const [isLoading, setIsLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (preview) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tz: browserTimeZone() });
      const chosen = PRESETS.find((option) => option.value === preset);
      if (chosen) {
        if (chosen.daysBack !== null) params.set('from', daysAgoMidnight(chosen.daysBack).toISOString());
        params.set('to', new Date().toISOString());
      } else {
        const from = localMidnight(fromDate);
        const to = localMidnight(toDate, 1);
        if (!from || !to || from >= to) {
          setError('Pick a start date on or before the end date');
          return;
        }
        params.set('from', from.toISOString());
        params.set('to', (to.getTime() > Date.now() ? new Date() : to).toISOString());
      }
      const response = await fetch(`/api/admin/free-video-funnel?${params}`);
      const result = await response.json();
      if (response.ok && result.success) setStats(result.stats);
      else setError(result.error || 'Could not load the funnel numbers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the funnel numbers');
    } finally {
      setIsLoading(false);
    }
  }, [preset, fromDate, toDate, preview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const choosePreset = (value: Exclude<Preset, 'custom'>, daysBack: number | null) => {
    setPreset(value);
    if (daysBack !== null) setFromDate(dateValue(daysAgoMidnight(daysBack)));
    setToDate(dateValue(new Date()));
  };

  const totals = stats?.totals;
  const sourceRows = stats ? (view === 'channels' ? stats.byChannel : stats.bySource) : [];
  const notFromPage = stats?.notFromPage;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Opt-in page conversion</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={preset === option.value ? 'default' : 'outline'}
                onClick={() => choosePreset(option.value, option.daysBack)}
              >
                {option.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} aria-label="Reload the numbers">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>From</span>
          <Input
            type="date"
            className="h-8 w-[150px] text-sm"
            value={fromDate}
            max={toDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPreset('custom');
            }}
          />
          <span>to</span>
          <Input
            type="date"
            className="h-8 w-[150px] text-sm"
            value={toDate}
            min={fromDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPreset('custom');
            }}
          />
          {preset === 'all' && <span>(all time: since the first visit)</span>}
          {stats && <span className="text-xs">Days in {stats.tz}</span>}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !stats || !totals ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5', isLoading && 'opacity-60')}>
              {RATES.map((rate) => (
                <div key={rate.key} className="rounded-lg border p-3">
                  <div className="text-2xl font-semibold">{percent(stats.rates[rate.key])}</div>
                  <div className="text-xs font-medium">{rate.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {totals[rate.part]} of {totals[rate.whole]}
                  </div>
                </div>
              ))}
            </div>

            <div className={cn('overflow-x-auto', isLoading && 'opacity-60')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Step</th>
                    <th className="py-2 pr-4 font-medium text-right">Count</th>
                    <th className="py-2 pr-4 font-medium text-right">Rate</th>
                    <th className="hidden py-2 pr-4 font-medium text-right whitespace-nowrap sm:table-cell">Of visitors</th>
                    <th className="hidden py-2 font-medium w-[30%] min-w-[120px] sm:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {STEPS.map((step) => {
                    const count = totals[step.key];
                    const ofVisitors = share(count, totals.visitors);
                    return (
                      <tr key={step.key} className="border-b last:border-0">
                        <td className="min-w-[120px] py-2 pr-4 sm:min-w-[150px]">{step.label}</td>
                        <td className="py-2 pr-4 text-right font-semibold">{count}</td>
                        <td className="py-2 pr-4 text-right">
                          {step.base && (
                            <>
                              <div>{percent(share(count, totals[step.base.key]))}</div>
                              <div className="whitespace-nowrap text-xs text-muted-foreground">{step.base.label}</div>
                            </>
                          )}
                        </td>
                        <td className="hidden py-2 pr-4 text-right sm:table-cell">{percent(ofVisitors)}</td>
                        <td className="hidden py-2 sm:table-cell">
                          <div className="h-2 rounded bg-muted">
                            <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, (ofVisitors ?? 0) * 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                Opt-ins count people: someone who tried three websites counts once. Of the {totals.optIns} people: {stats.extras.refused} had every website
                refused at the form (not readable or not allowed), {stats.extras.inProgress} still waiting or being made. $99 clean versions bought:{' '}
                {stats.extras.unlocks}. Bought counts any AI Media Machine purchase with the same email after the opt-in, with or without a click on the
                offer.
              </p>
              {notFromPage && notFromPage.optIns > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Not in these numbers: {notFromPage.optIns} people with video ads made without the page (email replies or by hand): {notFromPage.videosMade}{' '}
                  made, {notFromPage.viewed} opened, {notFromPage.played} played, {notFromPage.offerClicks} clicked the offer, {notFromPage.purchases} bought.
                  They have their own rows in the source table.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Where they came from</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant={view === 'channels' ? 'default' : 'outline'} onClick={() => setView('channels')}>
                    By channel
                  </Button>
                  <Button size="sm" variant={view === 'tags' ? 'default' : 'outline'} onClick={() => setView('tags')}>
                    By tag
                  </Button>
                </div>
              </div>
              <CountsTable
                firstColumn="Source"
                rows={sourceRows.map((row: FunnelSourceRow) => ({
                  key: row.key,
                  label: row.label,
                  sublabel: !row.fromPage ? 'not from the page' : view === 'tags' && row.channel !== 'direct' ? row.channelLabel : null,
                  counts: row.counts,
                  rates: row.rates,
                }))}
                empty="Nobody in this range."
                dimmed={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                A visitor counts under the tag in the page address (?ref=, for example yt- for YouTube, fb- for Facebook ads, bfx for bluefx.net). An opt-in without a
                tag counts under Facebook or a ClickBank affiliate when the browser carried their click id, so those rows can show opt-ins without visitors.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Day by day</h3>
              <CountsTable
                firstColumn="Day"
                rows={stats.byDay.map((row) => ({ key: row.day, label: dayLabel(row.day), sublabel: null, counts: row.counts, rates: row.rates }))}
                empty="No days in this range."
                dimmed={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Opt-ins count on the day they were made, with whatever they did later. A visitor who came back on another day counts on both days.
              </p>
            </div>
          </>
        )}

        <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <p>
            Not counted: {(stats?.excluded.emails ?? ['contact@bluefx.net', 'sziliblue@gmail.com', 'support@bluefx.net']).join(', ')} (also with a +tag or Gmail dots), and every
            visit from a browser marked internal: open the opt-in page with ?internal=1 once on each of your browsers and phones (this admin page marks
            its own browser by itself).
          </p>
          {stats && (
            <p>
              Also left out: your own browsers ({stats.excluded.browsers}, the ones that played one of your test video ads) with all their visits, plays and
              clicks
              {stats.excluded.linkChecks > 0 &&
                `; ${plural(stats.excluded.linkChecks, 'browser')} that were link checks, not people (${stats.excluded.linkCheckNotes.join('; ')})`}
              {stats.excluded.ownerOpens + stats.excluded.ownerClicks > 0 &&
                `; ${plural(stats.excluded.ownerOpens, 'page open')} and ${plural(stats.excluded.ownerClicks, 'offer click')} that came right after activity from your browsers (older opens and clicks do not record the browser, so they are judged by timing)`}
              .
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CountsTableRow {
  key: string;
  label: string;
  sublabel: string | null;
  counts: FunnelCounts;
  rates: FunnelRates;
}

interface CountsTableProps {
  firstColumn: string;
  rows: CountsTableRow[];
  empty: string;
  dimmed: boolean;
}

function CountsTable({ firstColumn, rows, empty, dimmed }: CountsTableProps) {
  if (!rows.length) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className={cn('overflow-x-auto', dimmed && 'opacity-60')}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-4 font-medium">{firstColumn}</th>
            {COLUMNS.map((column) => (
              <th key={column.label} className="py-2 pr-3 font-medium text-right whitespace-nowrap">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b last:border-0">
              <td className="py-2 pr-4">
                <div className="whitespace-nowrap">{row.label}</div>
                {row.sublabel && <div className="text-xs text-muted-foreground">{row.sublabel}</div>}
              </td>
              {COLUMNS.map((column) => (
                <td key={column.label} className="py-2 pr-3 text-right tabular-nums">
                  {column.value(row.counts, row.rates)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
