import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { computeFunnelStats, DEFAULT_STATS_TZ, FUNNEL_CHOICES, type FunnelChoice, validTimeZone } from '@/lib/free-video/funnel-stats';

/**
 * GET /api/admin/free-video-funnel?from=<ISO>&to=<ISO>&tz=<IANA zone>: the free video ad funnel's conversion numbers
 * for the admin panel (owner 2026-10-11: "i want to know the conversion rate, except my test accounts"). Admins only.
 * from: inclusive, left out = all time. to: exclusive, default now. tz: the admin's time zone for the day rows
 * (default Europe/Bucharest). funnel-stats.ts defines every number.
 */
export const dynamic = 'force-dynamic';

const instant = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin' && user.email !== 'contact@bluefx.net') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const from = instant(params.get('from'));
    const to = instant(params.get('to')) ?? Date.now();
    if (Number.isNaN(from) || Number.isNaN(to)) return NextResponse.json({ success: false, error: 'from and to must be dates' }, { status: 400 });
    if (from !== null && from >= to) return NextResponse.json({ success: false, error: 'from must be before to' }, { status: 400 });
    const tz = validTimeZone(params.get('tz')) ?? DEFAULT_STATS_TZ;

    // funnel: all (default), app (the AI Media Machine offer) or service (Unlimited Video Ads, /free-ad).
    const asked = params.get('funnel');
    const funnel: FunnelChoice = (FUNNEL_CHOICES as readonly string[]).includes(asked ?? '') ? (asked as FunnelChoice) : 'all';
    const stats = await computeFunnelStats({ from: from === null ? null : new Date(from).toISOString(), to: new Date(to).toISOString(), tz, funnel });
    return NextResponse.json({ success: true, stats }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('❌ [admin] Free video funnel failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
