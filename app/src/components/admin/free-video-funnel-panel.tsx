'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FunnelChoice, FunnelCounts, FunnelRates, FunnelSourceRow, FunnelStats } from '@/lib/free-video/funnel-stats';

type Preset = 'today' | '7d' | '30d' | 'all' | 'custom';

const PRESETS: { value: Exclude<Preset, 'custom'>; label: string; daysBack: number | null }[] = [
  { value: 'today', label: 'Today', daysBack: 0 },
  { value: '7d', label: '7 days', daysBack: 6 },
  { value: '30d', label: '30 days', daysBack: 29 },
  { value: 'all', label: 'All time', daysBack: null },
];

/**
 * The funnel's steps. base: the step its rate is taken from (not always the row above: plays, offer card opens and offer
 * clicks also happen on the thank-you page, and a purchase needs no click). detail: a small line under the label.
 */
const STEPS: {
  key: keyof FunnelCounts;
  label: string;
  base?: { key: keyof FunnelCounts; label: string };
  detail?: (counts: FunnelCounts) => string;
}[] = [
  { key: 'visitors', label: 'Visitors on the opt-in page (browsers)' },
  { key: 'formStarts', label: 'Started the form (browsers)', base: { key: 'visitors', label: 'of visitors' } },
  { key: 'optIns', label: 'Opted in (people who sent the form)', base: { key: 'formStarts', label: 'of form starts' } },
  { key: 'videosMade', label: 'Video ad made', base: { key: 'optIns', label: 'of opt-ins' } },
  { key: 'viewed', label: 'Opened the emailed video ad page', base: { key: 'videosMade', label: 'of video ads made' } },
  { key: 'played', label: 'Played the video ad', base: { key: 'videosMade', label: 'of video ads made' } },
  {
    key: 'offerOpens',
    label: 'Opened the offer card',
    base: { key: 'videosMade', label: 'of video ads made' },
    detail: (c) => `From the download button: ${c.offerOpensDownload}. From the phone buy bar: ${c.offerOpensBar}.`,
  },
  {
    key: 'offerClicks',
    label: 'Clicked the lifetime offer',
    base: { key: 'videosMade', label: 'of video ads made' },
    // The share is of the people who opened the card (cardOpenClicks), never cardClicks / offerOpens: a card click whose
    // offer_open beacon was lost would push that over 100%.
    detail: (c) =>
      `On the offer card's button: ${c.cardClicks}.` +
      (c.offerOpens > 0 ? ` Of the ${c.offerOpens} who opened the card, ${c.cardOpenClicks} clicked its button (${percent(share(c.cardOpenClicks, c.offerOpens))}).` : ''),
  },
  { key: 'purchases', label: 'Bought (any AI Media Machine purchase after opting in)', base: { key: 'optIns', label: 'of opt-ins' } },
];

const RATES: { key: keyof FunnelRates; label: string; part: keyof FunnelCounts; whole: keyof FunnelCounts }[] = [
  { key: 'optIn', label: 'Opt-in rate', part: 'optIns', whole: 'visitors' },
  { key: 'view', label: 'Opened the video ad page', part: 'viewed', whole: 'videosMade' },
  { key: 'open', label: 'Offer card open rate', part: 'offerOpens', whole: 'videosMade' },
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
  { label: 'Opened offer', value: (c) => String(c.offerOpens) },
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
 * accounts"): the funnel from visitor to sale for a date range, the six rates, each traffic source and each day.
 * Days are the admin's own (the browser's time zone). lib/free-video/funnel-stats.ts defines every number.
 */
const FUNNELS: { value: FunnelChoice; label: string; hint: string }[] = [
  { value: 'all', label: 'Both funnels', hint: 'Everyone' },
  { value: 'app', label: 'App offer', hint: 'The AI Media Machine offer: app.bluefx.net/free-video-ad' },
  { value: 'service', label: '$49 video ad', hint: 'Funnel 2, the $49 video ad: app.bluefx.net/free-ad' },
];

export function FreeVideoFunnelPanel({ preview }: FreeVideoFunnelPanelProps) {
  const [preset, setPreset] = useState<Preset>(preview?.preset ?? '7d');
  const [fromDate, setFromDate] = useState(() => dateValue(daysAgoMidnight(PRESETS.find((option) => option.value === preview?.preset)?.daysBack ?? 6)));
  const [toDate, setToDate] = useState(() => dateValue(new Date()));
  const [view, setView] = useState<'channels' | 'tags'>('channels');
  // Which funnel: both, the AI Media Machine offer (/free-video-ad) or Unlimited Video Ads (/free-ad).
  const [funnel, setFunnel] = useState<FunnelChoice>('all');
  const [stats, setStats] = useState<FunnelStats | null>(preview?.stats ?? null);
  const [isLoading, setIsLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (preview) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tz: browserTimeZone(), funnel });
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
  }, [preset, fromDate, toDate, preview, funnel]);

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
            {FUNNELS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={funnel === option.value ? 'default' : 'outline'}
                onClick={() => setFunnel(option.value)}
                title={option.hint}
              >
                {option.label}
              </Button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
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
            <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6', isLoading && 'opacity-60')}>
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
                        <td className="min-w-[120px] py-2 pr-4 sm:min-w-[150px]">
                          <div>{step.label}</div>
                          {step.detail && <div className="text-xs text-muted-foreground">{step.detail(totals)}</div>}
                        </td>
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
                  made, {notFromPage.viewed} opened, {notFromPage.played} played, {notFromPage.offerOpens} opened the offer card, {notFromPage.offerClicks}{' '}
                  clicked the offer, {notFromPage.purchases} bought.
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

            <TurnedAwayList turnedAway={stats.turnedAway} dimmed={isLoading} />
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
              Also left out: your own browsers ({stats.excluded.browsers}, the ones that played one of your test video ads) with all their visits, plays,
              offer card opens and clicks
              {stats.excluded.linkChecks > 0 &&
                `; ${plural(stats.excluded.linkChecks, 'browser')} that were link checks, not people (${stats.excluded.linkCheckNotes.join('; ')})`}
              {stats.excluded.reviewVisits > 0 &&
                `; ${plural(stats.excluded.reviewVisits, 'page load')} by Meta's ad review (a burst of empty visits each time an ad is published or edited, many tagged Right_Column), not people`}
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

/** Why a form send was turned away (refusals.ts RefusalCode), in plain words. */
const REASON_LABELS: Record<string, string> = {
  notFound: 'Website not found',
  unreadable: 'Website not readable',
  refused: 'A page on a big platform (YouTube, Facebook, Amazon...)',
  invalid: 'Not a website address, or a bad name or email',
  duplicateEmail: 'This email already had its free video ad',
  duplicateSite: 'This website already had its free video ad',
  tooMany: 'Already asked today (same connection or email)',
  tries: 'Over 5 tries in a minute',
  triesToday: 'Over 20 tries in a day from one connection',
  closed: "Today's free video ads were all taken",
  paused: 'The maker was paused',
  generic: 'Server busy',
  country: 'Country not served',
  bot: 'Spam trap',
  error: 'Server error',
};

/** Which check, when a reason has more than one (refusals.ts RefusalCheck). */
const CHECK_LABELS: Record<string, string> = {
  honeypot: 'hidden field filled in',
  tooFast: 'sent within 1.5 seconds',
};

const reasonLabel = (code: string, check: string | null) => `${REASON_LABELS[code] ?? code}${check ? ` (${CHECK_LABELS[check] ?? check})` : ''}`;

interface TurnedAwayListProps {
  turnedAway: FunnelStats['turnedAway'];
  dimmed: boolean;
}

/** Every form send of the range that did not become a free video ad, with what was typed, so the owner can write to them. */
function TurnedAwayList({ turnedAway, dimmed }: TurnedAwayListProps) {
  const { sends, people, byReason, recent } = turnedAway;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Turned away at the form</h3>
      {sends === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nobody was turned away in this range.</p>
      ) : (
        <div className={cn('space-y-2', dimmed && 'opacity-60')}>
          <p className="text-sm">
            {plural(sends, 'send')} that did not become a free video ad, from {people === 1 ? '1 person' : `${people} people`} (by email).
          </p>
          <ul className="space-y-0.5 text-sm">
            {byReason.map((reason) => (
              <li key={`${reason.code}/${reason.check ?? ''}`} className="flex justify-between gap-4">
                <span>{reasonLabel(reason.code, reason.check)}</span>
                <span className="tabular-nums">{reason.sends}</span>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">When</th>
                  <th className="py-2 pr-2 font-medium">Why</th>
                  <th className="py-2 pr-2 font-medium">Name</th>
                  <th className="py-2 pr-2 font-medium">Email</th>
                  <th className="py-2 pr-2 font-medium">Website typed</th>
                  <th className="py-2 font-medium">Tag</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row, index) => (
                  <tr key={`${row.at}-${index}`} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap py-2 pr-2">
                      {new Date(row.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="min-w-[9rem] max-w-[13rem] py-2 pr-2">{reasonLabel(row.code, row.check)}</td>
                    <td className="py-2 pr-2">{row.firstName ?? ''}</td>
                    <td className="max-w-[12rem] py-2 pr-2 [overflow-wrap:anywhere]">
                      {row.email ? (
                        <a className="underline" href={`mailto:${row.email}`}>
                          {row.email}
                        </a>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="min-w-[8rem] max-w-[12rem] py-2 pr-2 [overflow-wrap:anywhere]">{row.website ?? ''}</td>
                    <td className="max-w-[9rem] py-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">{row.ref ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sends > recent.length && <p className="text-xs text-muted-foreground">The newest {recent.length} are listed.</p>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Kept since 18 Oct 2026: every form send that did not become a free video ad, with what the person typed, so you can write to them. The spam trap
        answers &quot;Thanks! Check your inbox.&quot;, so the people on its line think a video ad is coming.
      </p>
    </div>
  );
}
