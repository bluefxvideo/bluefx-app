'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { browserTimeZone, dateValue, daysAgoMidnight, localMidnight, PRESETS, type FunnelPanelPreset } from '@/components/admin/free-video-funnel-panel';
import { cn } from '@/lib/utils';
import type { CbFunnelReport, CbReportCounts, CbReportRow } from '@/lib/free-video/cb-funnel-stats';

type Preset = FunnelPanelPreset | 'custom';

/** The note column's limit (cb-affiliates.ts, migration 20261114000000). */
const NOTE_MAX = 500;

const usd = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const people = (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const countriesText = (countries: CbReportCounts['countries']) => (countries.length ? countries.map((c) => `${c.code} ${c.leads}`).join(', ') : '-');

const NUM = 'py-2 pr-3 text-right tabular-nums whitespace-nowrap';
const SUB = 'text-xs text-muted-foreground';

/** The table's columns after Affiliate and Status, with what each one counts (shown on hover). */
const COLUMNS: { label: string; title: string; numeric: boolean }[] = [
  { label: 'Leads', title: 'Every request from their link, refused and blocked ones included. Below: different email addresses.', numeric: true },
  { label: 'Blocked', title: 'Requests turned away because the affiliate is blocked', numeric: true },
  { label: 'Countries', title: "The top 3, from each lead's internet address", numeric: false },
  { label: 'Videos made', title: 'Free video ads finished', numeric: true },
  { label: 'Video cost', title: 'What making their video ads cost', numeric: true },
  { label: 'Opened', title: 'Opened the video ad page', numeric: true },
  { label: 'Played', title: 'Played the video ad (not counting your own browsers)', numeric: true },
  { label: '$49 sales', title: 'Paid ClickBank orders of the clean video ad, refunded ones left out', numeric: true },
  { label: 'Refunds', title: '$49 orders refunded', numeric: true },
  { label: 'AIMM sales', title: 'AI Media Machine purchases matched to their leads, at the first ClickBank payment of the order', numeric: true },
  { label: 'Money in', title: '$49 sales plus AIMM sales', numeric: true },
  { label: 'After commission', title: "Money in minus the affiliate's commission (none on orders ClickBank sold directly)", numeric: true },
  { label: 'Cost per lead', title: 'Video cost divided by leads', numeric: true },
  { label: 'Last lead', title: 'Their newest lead, any date', numeric: false },
];

interface ClickBankFunnelPanelProps {
  /**
   * DEV ONLY (app/(funnel)/free-video-ad/preview/cb-funnel): a report that page computed on the server for one range.
   * The panel shows it and never calls the admin API (it needs an admin sign-in); the Block switch saves nothing.
   */
  preview?: { report: CbFunnelReport; preset: FunnelPanelPreset };
}

/**
 * The ClickBank affiliate funnel (owner 2026-11-14: its own report and a block switch per affiliate): for a date range,
 * one row per affiliate with what their leads did and the money they brought in, and a Block button. Days are the
 * admin's own (the browser's time zone). lib/free-video/cb-funnel-stats.ts defines every number, cb-affiliates.ts the switch.
 */
export function ClickBankFunnelPanel({ preview }: ClickBankFunnelPanelProps = {}) {
  const [preset, setPreset] = useState<Preset>(preview?.preset ?? '7d');
  const [fromDate, setFromDate] = useState(() => dateValue(daysAgoMidnight(PRESETS.find((option) => option.value === preview?.preset)?.daysBack ?? 6)));
  const [toDate, setToDate] = useState(() => dateValue(new Date()));
  const [report, setReport] = useState<CbFunnelReport | null>(preview?.report ?? null);
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
      const response = await fetch(`/api/admin/clickbank-funnel?${params}`);
      const result = await response.json();
      if (response.ok && result.success) setReport(result.report);
      else setError(result.error || 'Could not load the ClickBank funnel numbers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the ClickBank funnel numbers');
    } finally {
      setIsLoading(false);
    }
  }, [preset, fromDate, toDate, preview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const choosePreset = (value: FunnelPanelPreset, daysBack: number | null) => {
    setPreset(value);
    if (daysBack !== null) setFromDate(dateValue(daysAgoMidnight(daysBack)));
    setToDate(dateValue(new Date()));
  };

  const blockedAffiliates = report ? report.rows.filter((row) => row.status === 'blocked').length : 0;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">ClickBank funnel by affiliate</CardTitle>
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
          {preset === 'all' && <span>(all time)</span>}
          {report && <span className="text-xs">Days in {report.tz}</span>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {report?.affiliatesError && (
          <p className="text-sm text-amber-600">
            The block list could not be read ({report.affiliatesError}), so every affiliate shows as active here. Blocking may not work until it can be read.
          </p>
        )}
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !report ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : report.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No ClickBank funnel leads in this range.</p>
        ) : (
          <div className={cn('overflow-x-auto', isLoading && 'opacity-60')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Affiliate</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  {COLUMNS.map((column) => (
                    <th key={column.label} title={column.title} className={cn('py-2 pr-3 font-medium whitespace-nowrap', column.numeric && 'text-right')}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.nickname ?? '(none)'} className="border-b align-top">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">{row.nickname ?? 'No affiliate'}</td>
                    <td className="py-2 pr-3">
                      {row.nickname ? (
                        <AffiliateSwitch nickname={row.nickname} row={row} onChanged={loadData} preview={Boolean(preview)} />
                      ) : (
                        <span className={SUB}>Can&apos;t be blocked (no nickname)</span>
                      )}
                    </td>
                    <CountCells counts={row} />
                  </tr>
                ))}
                <tr className="border-t-2 align-top font-semibold">
                  <td className="py-2 pr-3">Total</td>
                  <td className={cn('py-2 pr-3 font-normal', SUB)}>{blockedAffiliates > 0 ? `${plural(blockedAffiliates, 'affiliate')} blocked` : ''}</td>
                  <CountCells counts={report.totals} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
          <p>
            One row per affiliate (the ?affiliate= nickname on their link), for the leads made in this range, with whatever they did later. Hover a column
            name to see what it counts. No affiliate: links without a valid nickname, which can&apos;t be blocked by name.
          </p>
          <p>
            Money columns are gross order amounts. AIMM sales count the first ClickBank payment of each order (later payment plan payments and AI Media Machine
            refunds are not in it). After commission: what is left after the affiliate&apos;s {Math.round((report?.commissionRate ?? 0.5) * 100)}% of each order
            ClickBank credited to an affiliate. An order ClickBank sold directly (no affiliate on it) pays none, so the No affiliate row and the Total keep those
            in full. ClickBank&apos;s own fees are not taken off.
          </p>
          <p>
            Not counted: {(report?.excluded.emails ?? ['contact@bluefx.net', 'sziliblue@gmail.com', 'support@bluefx.net']).join(', ')} (also with a +tag or
            Gmail dots), test leads and your own test sign-ups
            {report && report.excluded.leadsInRange > 0 ? ` (${plural(report.excluded.leadsInRange, 'lead')} left out in this range)` : ''}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface CountCellsProps {
  counts: CbReportCounts;
}

/** The number columns of one row (an affiliate's or the total), in the header's order. */
function CountCells({ counts }: CountCellsProps) {
  return (
    <>
      <td className={NUM}>
        <div>{counts.leads}</div>
        <div className={cn(SUB, 'font-normal')}>{people(counts.people)}</div>
      </td>
      <td className={NUM}>{counts.blocked}</td>
      <td className="py-2 pr-3 whitespace-nowrap">{countriesText(counts.countries)}</td>
      <td className={NUM}>{counts.videosMade}</td>
      <td className={NUM}>{usd(counts.videoCostUsd)}</td>
      <td className={NUM}>{counts.opened}</td>
      <td className={NUM}>{counts.played}</td>
      <td className={NUM}>
        <div>{counts.unlocks}</div>
        <div className={cn(SUB, 'font-normal')}>{usd(counts.unlockUsd)}</div>
      </td>
      <td className={NUM}>{counts.refunds}</td>
      <td className={NUM}>
        <div>{counts.aimmSales}</div>
        <div className={cn(SUB, 'font-normal')}>{usd(counts.aimmUsd)}</div>
        {counts.aimmUnpriced > 0 && <div className={cn(SUB, 'font-normal')}>{counts.aimmUnpriced} with no amount</div>}
      </td>
      <td className={NUM}>{usd(counts.moneyInUsd)}</td>
      <td className={NUM}>{usd(counts.afterCommissionUsd)}</td>
      <td className={NUM}>{counts.costPerLeadUsd === null ? '-' : usd(counts.costPerLeadUsd)}</td>
      <td className="py-2 whitespace-nowrap">{counts.lastLeadAt ? day(counts.lastLeadAt) : '-'}</td>
    </>
  );
}

interface AffiliateSwitchProps {
  nickname: string;
  row: CbReportRow;
  onChanged: () => void;
  /** The dev preview: the switch opens, but saves nothing (no admin sign-in there). */
  preview?: boolean;
}

/**
 * The block switch of one affiliate (cb-affiliates.ts): Block stops new leads from their link getting a video ad and
 * turns away their leads still waiting; Unblock lets new leads through again. An optional note says why.
 */
function AffiliateSwitch({ nickname, row, onChanged, preview = false }: AffiliateSwitchProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(row.note ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const blocking = row.status !== 'blocked';

  const run = async () => {
    if (preview) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/clickbank-funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, status: blocking ? 'blocked' : 'active', note: note.trim() || null }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const turnedAway = typeof result.rejected === 'number' ? result.rejected : 0;
        const done = blocking ? `Blocked. ${turnedAway === 1 ? '1 waiting lead was' : `${turnedAway} waiting leads were`} turned away.` : 'Unblocked.';
        setMessage(result.warning ? `${done} ${result.warning}` : done);
        setOpen(false);
        onChanged();
      } else {
        setMessage(result.error || 'The change was not saved');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'The change was not saved');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-[150px] max-w-[230px] text-xs">
      <Badge
        variant="outline"
        className={cn('whitespace-nowrap', row.status === 'blocked' ? 'bg-red-600/10 text-red-700 border-red-600/40' : 'bg-green-600/15 text-green-600 border-green-600/30')}
      >
        {row.status === 'blocked' ? 'Blocked' : 'Active'}
      </Badge>
      {row.statusChangedAt && <div className="mt-1 text-muted-foreground">Changed {day(row.statusChangedAt)}</div>}
      {row.note && <div className="mt-1 text-muted-foreground [overflow-wrap:anywhere]">{row.note}</div>}
      {!open ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-1 h-7 px-2 text-xs"
          onClick={() => {
            setNote(row.note ?? '');
            setMessage(null);
            setOpen(true);
          }}
        >
          {blocking ? 'Block' : 'Unblock'}
        </Button>
      ) : (
        <div className="mt-1 space-y-1 rounded border p-2">
          <div>
            {blocking
              ? `New leads from ${nickname} get no video ad, and their leads still waiting are turned away too. Both read "Today's free video ads are all taken. Please come back tomorrow." Video ads already being made or done stay.`
              : `New leads from ${nickname} get their free video ad again. Leads turned away while blocked stay turned away.`}
          </div>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={NOTE_MAX}
            placeholder="Note (optional)"
            aria-label={`Note about ${nickname}`}
            className="h-7 text-xs"
          />
          {preview && <div className="text-amber-600">Preview: nothing is saved here.</div>}
          <div className="flex gap-2">
            <Button size="sm" className="h-7 px-2 text-xs" onClick={run} disabled={busy || preview}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : blocking ? 'Block' : 'Unblock'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {message && <div className="mt-1 text-muted-foreground">{message}</div>}
    </div>
  );
}
