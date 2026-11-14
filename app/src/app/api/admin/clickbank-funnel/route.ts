import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { rejectQueuedLeadsOf, setAffiliateStatus, type CbAffiliateStatus } from '@/lib/free-video/cb-affiliates';
import { computeCbFunnelReport } from '@/lib/free-video/cb-funnel-stats';
import { cbAffiliateNick } from '@/lib/free-video/funnel';
import { DEFAULT_STATS_TZ, validTimeZone } from '@/lib/free-video/funnel-stats';

/**
 * The ClickBank affiliate funnel's admin tab (owner 2026-11-14: a per-affiliate report and a block switch). Admins only.
 * GET ?from=<ISO>&to=<ISO>&tz=<IANA zone>: one row per affiliate for the leads of the range (cb-funnel-stats.ts defines
 * every number). from: inclusive, left out = all time. to: exclusive, default now. tz: the admin's time zone, sent back
 * with the report (default Europe/Bucharest).
 * POST { nickname, status: 'active' | 'blocked', note? }: sets one affiliate's switch (cb-affiliates.ts). A note left out
 * keeps the saved one; null or empty clears it. Blocking also turns away that affiliate's leads still waiting in the
 * queue (a video ad already being made finishes).
 */
export const dynamic = 'force-dynamic';

const STATUSES: readonly CbAffiliateStatus[] = ['active', 'blocked'];
/** The note column's limit (migration 20261114000000). */
const NOTE_MAX = 500;

const instant = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
};

/** The signed-in admin, or the error response to send (the same rule as the free video admin routes). */
async function requireAdmin(): Promise<{ user: { id: string; email?: string } } | { response: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && user.email !== 'contact@bluefx.net') {
    return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ('response' in auth) return auth.response;

    const params = request.nextUrl.searchParams;
    const from = instant(params.get('from'));
    const to = instant(params.get('to')) ?? Date.now();
    if (Number.isNaN(from) || Number.isNaN(to)) return NextResponse.json({ success: false, error: 'from and to must be dates' }, { status: 400 });
    if (from !== null && from >= to) return NextResponse.json({ success: false, error: 'from must be before to' }, { status: 400 });
    const tz = validTimeZone(params.get('tz')) ?? DEFAULT_STATS_TZ;

    const report = await computeCbFunnelReport({ from: from === null ? null : new Date(from).toISOString(), to: new Date(to).toISOString(), tz });
    return NextResponse.json({ success: true, report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('❌ [admin] ClickBank funnel report failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ('response' in auth) return auth.response;

    const body = (await request.json().catch(() => null)) as { nickname?: unknown; status?: unknown; note?: unknown } | null;
    const nickname = cbAffiliateNick(typeof body?.nickname === 'string' ? body.nickname : null);
    const status = body?.status as CbAffiliateStatus;
    if (!nickname || !STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'nickname (a ClickBank nickname) and status (active or blocked) are required' }, { status: 400 });
    }
    const rawNote = body?.note;
    if (rawNote !== undefined && rawNote !== null && typeof rawNote !== 'string') {
      return NextResponse.json({ success: false, error: 'note must be text' }, { status: 400 });
    }
    if (typeof rawNote === 'string' && rawNote.trim().length > NOTE_MAX) {
      return NextResponse.json({ success: false, error: `The note can be at most ${NOTE_MAX} characters` }, { status: 400 });
    }
    const note = rawNote === undefined ? undefined : typeof rawNote === 'string' ? rawNote : null;
    const by = auth.user.email ?? auth.user.id;

    const affiliate = await setAffiliateStatus(nickname, status, { note, by });
    // The switch is saved first; a failed queue sweep is reported, not undone (new leads are blocked either way).
    let rejected = 0;
    let warning: string | null = null;
    if (status === 'blocked') {
      try {
        rejected = await rejectQueuedLeadsOf(nickname);
      } catch (error) {
        console.error(`❌ [admin] Waiting leads of ClickBank affiliate ${nickname} not turned away:`, error);
        warning = `The waiting leads were not turned away (${error instanceof Error ? error.message : 'error'}). Block again to retry.`;
      }
    }
    console.log(`✅ [admin] ClickBank affiliate ${nickname} set to ${status} by ${by}${status === 'blocked' ? `, ${rejected} waiting leads turned away` : ''}`);
    return NextResponse.json({ success: true, affiliate, rejected, warning });
  } catch (error) {
    console.error('❌ [admin] ClickBank affiliate switch failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
