import { CB_HOP_EVENT, cleanHop } from '@/lib/free-video/clickbank';
import { eventsTable, getLeadByToken, recordEvent } from '@/lib/free-video/leads';
import type { ClickBankHop } from '@/types/free-video';

/**
 * A lead's ClickBank attribution in free_video_events (clickbank.ts explains the flow). Server only, never throws:
 * attribution must never break a form or a click.
 */

/** Keeps the hop the browser held at the form submit: the affiliate in ref (nickname, or shield:<value>), the whole hop in meta. */
export async function saveHop(leadId: string, hop: ClickBankHop, placement: string): Promise<void> {
  await recordEvent({ event: CB_HOP_EVENT, leadId, placement, ref: hop.affiliate ?? (hop.shield ? `shield:${hop.shield}` : null), meta: hop });
}

/** The newest saved hop of a lead, for a checkout click from another browser (the emails). */
export async function savedHop(leadId: string): Promise<ClickBankHop | undefined> {
  try {
    const { data, error } = await eventsTable().select('meta').eq('lead_id', leadId).eq('event', CB_HOP_EVENT).order('at', { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    const meta = ((data ?? []) as { meta: Record<string, unknown> | null }[])[0]?.meta;
    return meta ? cleanHop(meta) : undefined;
  } catch (error) {
    console.warn('⚠️ [free-video] ClickBank hop not read:', error);
    return undefined;
  }
}

/** The newest saved hop of the lead behind a view token; undefined for an unknown token. */
export async function savedHopByToken(token: string): Promise<ClickBankHop | undefined> {
  const lead = await getLeadByToken(token).catch(() => null);
  return lead ? savedHop(lead.id) : undefined;
}

/** The newest saved hop per lead, for the admin list. */
export async function savedHops(leadIds: string[]): Promise<Map<string, ClickBankHop>> {
  const hops = new Map<string, ClickBankHop>();
  if (!leadIds.length) return hops;
  try {
    const { data, error } = await eventsTable()
      .select('lead_id, meta')
      .eq('event', CB_HOP_EVENT)
      .in('lead_id', leadIds)
      .order('at', { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { lead_id: string; meta: Record<string, unknown> | null }[]) {
      if (hops.has(row.lead_id) || !row.meta) continue;
      const hop = cleanHop(row.meta);
      if (hop) hops.set(row.lead_id, hop);
    }
  } catch (error) {
    console.warn('⚠️ [free-video] ClickBank hops not read:', error);
  }
  return hops;
}
