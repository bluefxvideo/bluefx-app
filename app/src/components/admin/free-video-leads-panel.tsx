'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FreeVideoLeadRow {
  id: string;
  created_at: string;
  finished_at: string | null;
  status: string;
  reason: string | null;
  source: string;
  ref: string | null;
  first_name: string;
  email: string;
  website_domain: string;
  website_url: string;
  view_token: string;
  est_cost_usd: number | null;
  first_viewed_at: string | null;
  played_at: string | null;
  clicked_at: string | null;
  is_customer: boolean;
  bought_at: string | null;
  unlock_status: string;
  test: boolean;
  inAccount: boolean;
  /** The ClickBank affiliate who sent the lead (nickname, or "shield" for an encrypted link); null without one. */
  affiliate: string | null;
}

interface Summary {
  requests: number;
  done: number;
  waiting: number;
  problems: number;
  refused: number;
  bought: number;
  unlocked: number;
  costUsd: number;
}

interface FreeVideoLeadsResponse {
  success: boolean;
  summary: { day: Summary; week: Summary };
  leads: FreeVideoLeadRow[];
  error?: string;
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'queued', label: 'Waiting' },
  { value: 'running', label: 'Being made' },
  { value: 'held', label: 'Held' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Refused' },
];

const STATUS_LOOK: Record<string, { label: string; className: string }> = {
  done: { label: 'Done', className: 'bg-green-600/15 text-green-600 border-green-600/30' },
  queued: { label: 'Waiting', className: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  running: { label: 'Being made', className: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  held: { label: 'Held', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  failed: { label: 'Failed', className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  rejected: { label: 'Refused', className: 'bg-muted text-muted-foreground' },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const minutes = (from: string, to: string | null) => (to ? Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60_000)) : null);

/**
 * The free video ads people asked for, newest first (owner 2026-10-07: "where can I see these ads being
 * created/requested?" "and who made it etc"): who asked, for which website, how far it got, what they did with the
 * video ad page, and whether it turned into a sale.
 */
export function FreeVideoLeadsPanel() {
  const [data, setData] = useState<FreeVideoLeadsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(filter === 'all' ? {} : { status: filter });
      const response = await fetch(`/api/admin/free-video-leads?${params}`);
      const result = await response.json();
      if (response.ok && result.success) setData(result);
      else setError(result.error || 'Could not load the free video ads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the free video ads');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <SummaryCard title="Last 24 hours" summary={data.summary.day} />
          <SummaryCard title="Last 7 days" summary={data.summary.week} />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-lg">Free video ads, newest first</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !data ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.leads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No free video ads here yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">When</th>
                    <th className="py-2 pr-4 font-medium">Who</th>
                    <th className="py-2 pr-4 font-medium">Website</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">What they did</th>
                    <th className="py-2 pr-4 font-medium">From</th>
                    <th className="py-2 pr-4 font-medium text-right">Cost</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((lead) => {
                    const look = STATUS_LOOK[lead.status] ?? { label: lead.status, className: '' };
                    const took = lead.status === 'done' ? minutes(lead.created_at, lead.finished_at) : null;
                    const did = [lead.first_viewed_at && 'opened the page', lead.played_at && 'played', lead.clicked_at && 'clicked an offer'].filter(Boolean);
                    return (
                      <tr key={lead.id} className="border-b align-top last:border-0">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {when(lead.created_at)}
                          {took !== null && <div className="text-xs text-muted-foreground">made in {took} min</div>}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium">{lead.first_name}</div>
                          <a href={`mailto:${lead.email}`} className="text-xs text-muted-foreground hover:underline">
                            {lead.email}
                          </a>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {lead.test && <Badge variant="outline">Test</Badge>}
                            {lead.is_customer && <Badge variant="outline">Customer</Badge>}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <a href={lead.website_url} target="_blank" rel="noreferrer" className="hover:underline">
                            {lead.website_domain}
                          </a>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className={cn('whitespace-nowrap', look.className)}>
                            {look.label}
                          </Badge>
                          {lead.reason && lead.status !== 'done' && <div className="mt-1 max-w-[220px] text-xs text-muted-foreground">{lead.reason}</div>}
                        </td>
                        <td className="py-3 pr-4 text-xs">
                          <div className="text-muted-foreground">{did.length ? did.join(', ') : '-'}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {lead.bought_at && <Badge className="bg-green-600 hover:bg-green-600">Bought lifetime</Badge>}
                            {lead.unlock_status !== 'none' && <Badge className="bg-green-600 hover:bg-green-600">$99 version</Badge>}
                            {lead.inAccount && <Badge variant="outline">In their account</Badge>}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">
                          {lead.affiliate ? <Badge variant="outline">Affiliate {lead.affiliate}</Badge> : lead.ref || lead.source}
                        </td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">${(Number(lead.est_cost_usd) || 0).toFixed(2)}</td>
                        <td className="py-3">
                          <a
                            href={`/v/${lead.view_token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-primary hover:underline"
                          >
                            Video ad page <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, summary }: { title: string; summary: Summary }) {
  const stats = [
    { label: 'Requests', value: summary.requests },
    { label: 'Done', value: summary.done },
    { label: 'Waiting', value: summary.waiting },
    { label: 'Held or failed', value: summary.problems },
    { label: 'Refused', value: summary.refused },
    { label: 'Bought lifetime', value: summary.bought },
    { label: '$99 version', value: summary.unlocked },
    { label: 'AI cost', value: `$${summary.costUsd.toFixed(2)}` },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title} (tests left out)</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="text-xl font-semibold">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
