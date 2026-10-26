import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/app/supabase/server';
import { hopLabel } from '@/lib/free-video/clickbank';
import { savedHops } from '@/lib/free-video/clickbank-hops';
import { OWNER_TEST_EMAILS } from '@/lib/free-video/config';
import { isServiceRef } from '@/lib/free-video/funnel';
import { isLive } from '@/lib/free-video/config';
import { getLead } from '@/lib/free-video/leads';
import { OFFERS, offerOf, offerSwitchesOf, switchOffer, type FreeVideoOffer } from '@/lib/free-video/offer-switch';

/**
 * The free video ads people asked for, newest first, for the admin panel (owner 2026-10-07: "where can I see these
 * ads being created/requested?" "and who made it etc"). Admins only. ?status= narrows the list; the summary counts
 * the last 24 hours and the last 7 days.
 */
const STATUSES = ['queued', 'running', 'done', 'held', 'failed', 'rejected'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type LeadRow = {
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
  video_url: string | null;
  duration_seconds: number | null;
  est_cost_usd: number | null;
  email_status: string;
  first_viewed_at: string | null;
  played_at: string | null;
  clicked_at: string | null;
  is_customer: boolean;
  bought_at: string | null;
  unlock_status: string;
  unlocked_at: string | null;
};

/** The signed-in admin, or the error response to send. */
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
    const status = params.get('status');
    const limit = Math.min(500, Math.max(1, Number.parseInt(params.get('limit') || '200', 10) || 200));
    const admin = createAdminClient() as any;

    let query = admin
      .from('free_video_leads')
      .select(
        'id, created_at, finished_at, status, reason, source, ref, first_name, email, website_domain, website_url, view_token, video_url, duration_seconds, est_cost_usd, email_status, first_viewed_at, played_at, clicked_at, is_customer, bought_at, unlock_status, unlocked_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const leads = (data ?? []) as LeadRow[];

    // Which free video ads are in an AI Media Machine account (claim.ts copies them in).
    const copied = new Set<string>();
    if (leads.length) {
      const { data: copies, error: copiesError } = await admin
        .from('smart_video_jobs')
        .select('job->>freeLeadId')
        .in(
          'job->>freeLeadId',
          leads.map((lead) => lead.id)
        );
      if (copiesError) console.warn('⚠️ [admin] Free video copies not read:', copiesError.message);
      for (const copy of (copies ?? []) as { freeLeadId: string | null }[]) if (copy.freeLeadId) copied.add(copy.freeLeadId);
    }

    // The owner's offer switches (offer-switch.ts): which offer each lead's page shows now.
    const switches = await offerSwitchesOf(leads.map((lead) => lead.id));

    // Which affiliate sent each lead (ClickBank Direct Offer Tracking, clickbank-hops.ts).
    const hops = await savedHops(leads.map((lead) => lead.id));

    // Unlimited Video Ads members: every paid service order (service-order.ts 'service_paid', a small table), with its amount.
    const servicePaid = new Map<string, number | null>();
    {
      const { data: paid, error: paidError } = await admin.from('free_video_events').select('lead_id, meta').eq('event', 'service_paid').limit(5000);
      if (paidError) console.warn('⚠️ [admin] Service orders not read:', paidError.message);
      for (const row of (paid ?? []) as { lead_id: string | null; meta: { amount?: number | null } | null }[]) {
        if (row.lead_id && !servicePaid.has(row.lead_id)) servicePaid.set(row.lead_id, typeof row.meta?.amount === 'number' ? row.meta.amount : null);
      }
    }

    // The summary covers every lead of the last 7 days, whatever the filter shows.
    const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const { data: week, error: weekError } = await admin
      .from('free_video_leads')
      .select('id, created_at, status, source, ref, email, est_cost_usd, bought_at, unlock_status')
      .gt('created_at', weekAgo)
      .limit(5000);
    if (weekError) throw new Error(weekError.message);
    const summarize = (rows: Pick<LeadRow, 'id' | 'status' | 'ref' | 'est_cost_usd' | 'bought_at' | 'unlock_status'>[]) => ({
      requests: rows.length,
      done: rows.filter((row) => row.status === 'done').length,
      waiting: rows.filter((row) => row.status === 'queued' || row.status === 'running').length,
      problems: rows.filter((row) => row.status === 'held' || row.status === 'failed').length,
      refused: rows.filter((row) => row.status === 'rejected').length,
      bought: rows.filter((row) => row.bought_at).length,
      // A service member's clean video ad also sets unlock_status; only a $99 unlock purchase counts here.
      unlocked: rows.filter((row) => row.unlock_status !== 'none' && !servicePaid.has(row.id)).length,
      joined: rows.filter((row) => servicePaid.has(row.id)).length,
      serviceRequests: rows.filter((row) => isServiceRef(row.ref)).length,
      costUsd: Math.round(rows.reduce((sum, row) => sum + (Number(row.est_cost_usd) || 0), 0) * 100) / 100,
    });
    const real = ((week ?? []) as (LeadRow & { email: string })[]).filter((row) => row.source !== 'test' && !OWNER_TEST_EMAILS.includes(row.email));
    const dayAgo = Date.now() - DAY_MS;

    return NextResponse.json({
      success: true,
      summary: {
        day: summarize(real.filter((row) => Date.parse(row.created_at) > dayAgo)),
        week: summarize(real),
      },
      leads: leads.map((lead) => ({
        ...lead,
        test: lead.source === 'test' || OWNER_TEST_EMAILS.includes(lead.email),
        inAccount: copied.has(lead.id),
        affiliate: hopLabel(hops.get(lead.id)),
        funnel: isServiceRef(lead.ref) ? 'service' : 'app',
        offer: offerOf(lead, switches.get(lead.id)),
        switchedAt: switches.get(lead.id)?.at.toISOString() ?? null,
        servicePaid: servicePaid.has(lead.id) ? { amount: servicePaid.get(lead.id) ?? null } : null,
      })),
    });
  } catch (error) {
    console.error('❌ [admin] Free video leads failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

/**
 * Switch offer (offer-switch.ts): POST { leadId, to: 'machine' | 'service', followUp: boolean }. Moves one finished
 * lead's page to the other offer, starts that offer's clock now, stops the old offer's emails and, with followUp,
 * starts the new offer's follow-up emails. Admins only. Off the live server MailerLite is left alone.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ('response' in auth) return auth.response;
    const body = (await request.json().catch(() => null)) as { leadId?: unknown; to?: unknown; followUp?: unknown } | null;
    const leadId = typeof body?.leadId === 'string' ? body.leadId : '';
    const to = body?.to as FreeVideoOffer;
    if (!leadId || !(OFFERS as readonly string[]).includes(String(to))) {
      return NextResponse.json({ success: false, error: 'leadId and to (machine or service) are required' }, { status: 400 });
    }
    const lead = await getLead(leadId);
    if (!lead) return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    if (lead.status !== 'done' || !lead.video_url) {
      return NextResponse.json({ success: false, error: 'Only a finished video ad can switch offer' }, { status: 409 });
    }
    const result = await switchOffer(lead, to, { followUp: body?.followUp === true, mail: isLive(), by: auth.user.email ?? auth.user.id });
    console.log(`🔀 [admin] Lead ${lead.id} switched to ${to} by ${auth.user.email ?? auth.user.id}: ${result.emails}${result.error ? ` (${result.error})` : ''}`);
    return NextResponse.json({ success: !result.error, ...result }, { status: result.error ? 500 : 200 });
  } catch (error) {
    console.error('❌ [admin] Offer switch failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
