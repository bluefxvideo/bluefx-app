/**
 * Switch offer (owner 2026-10-26): the owner moves one lead from the AI Media Machine offer to Unlimited Video Ads (the
 * $99/month done-for-you service) or back, with a button in the admin panel. Out of 100 leads maybe 2 to 5 need the
 * other offer: "I'd rather make the video ads myself" gets the AI Media Machine, "I'm not technical" gets the service.
 *
 * The lead keeps its one link (/v/<token>): every email it already has, and every follow-up email, now opens the new
 * offer. The new offer's clock starts at the switch (the 3-day bonus of the AI Media Machine page, the held $99 price
 * of the service page). A switch is a 'offer_switch' event (placement = the new offer), so no table changes; the
 * newest one wins, and the lead's ref (where the lead came from) stays as it was for the ad numbers.
 *
 * Emails: the lead always leaves the old offer's MailerLite Ready group, and both follow-up automations exit when the
 * subscriber no longer matches their trigger, so the old emails stop at once. With followUp the lead also joins the
 * new offer's Ready group, which starts that offer's sequence. The AI Media Machine automations run once per
 * subscriber (not repeatable): a lead switched back to the AI Media Machine after an earlier run gets no new emails.
 */
import { createAdminClient } from '@/app/supabase/server';
import { ML_FIELDS, ML_GROUP_READY, ML_GROUP_SERVICE_READY, ML_GROUP_VIDEO_READY, SITE_URL } from '@/lib/free-video/config';
import { isServiceRef } from '@/lib/free-video/funnel';
import { cleanCopyEarned } from '@/lib/free-video/offer';
import { displayDomain } from '@/lib/free-video/website';
import { subscribeToMailerLite } from '@/lib/mailerlite/subscribe';
import type { FreeVideoLead } from '@/types/free-video';

/** machine = the AI Media Machine page; service = the $99/month page (by hand only since 2026-10-27); video = the $49 video ad page. */
export const OFFERS = ['machine', 'service', 'video'] as const;
export type FreeVideoOffer = (typeof OFFERS)[number];

export const OFFER_SWITCH_EVENT = 'offer_switch';

// Its own handle on the events table (leads.ts imports this file, so no import back).
const eventsTable = () => (createAdminClient() as any).from('free_video_events');

export interface OfferSwitch {
  offer: FreeVideoOffer;
  /** When the owner switched: the new offer's clock starts here. */
  at: Date;
}

/** The newest switch of one lead, or null when the owner never switched it. Throws on a database error. */
export async function offerSwitchOf(leadId: string): Promise<OfferSwitch | null> {
  const { data, error } = await eventsTable()
    .select('at, placement')
    .eq('lead_id', leadId)
    .eq('event', OFFER_SWITCH_EVENT)
    .order('at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`offer_switch not read: ${error.message}`);
  const row = (data as Array<{ at: string; placement: string | null }> | null)?.[0];
  if (!row || !(OFFERS as readonly string[]).includes(row.placement ?? '')) return null;
  return { offer: row.placement as FreeVideoOffer, at: new Date(row.at) };
}

/** The newest switch of many leads at once (the admin list), by lead id. Throws on a database error. */
export async function offerSwitchesOf(leadIds: string[]): Promise<Map<string, OfferSwitch>> {
  const out = new Map<string, OfferSwitch>();
  if (!leadIds.length) return out;
  const { data, error } = await eventsTable()
    .select('lead_id, at, placement')
    .in('lead_id', leadIds)
    .eq('event', OFFER_SWITCH_EVENT)
    .order('at', { ascending: false })
    .limit(5000);
  if (error) throw new Error(`offer_switch not read: ${error.message}`);
  for (const row of (data ?? []) as Array<{ lead_id: string; at: string; placement: string | null }>) {
    if (out.has(row.lead_id) || !(OFFERS as readonly string[]).includes(row.placement ?? '')) continue;
    out.set(row.lead_id, { offer: row.placement as FreeVideoOffer, at: new Date(row.at) });
  }
  return out;
}

/**
 * The offer a lead sees: the owner's newest switch, else the funnel it came from. Funnel 2 (the 'svc-' tags, /free-ad)
 * sells the $49 video ad since 2026-10-27 (owner: "turn funnel 2 into the $49 funnel"; the $99 a month plan is sold
 * only after the $49).
 */
export const offerOf = (lead: Pick<FreeVideoLead, 'ref'>, sw: OfferSwitch | null | undefined): FreeVideoOffer =>
  sw ? sw.offer : isServiceRef(lead.ref) ? 'video' : 'machine';

export const OFFER_NAMES: Record<FreeVideoOffer, string> = { machine: 'AI Media Machine', service: 'Unlimited Video Ads', video: '$49 video ad' };

const readyGroupOf = (offer: FreeVideoOffer) => (offer === 'service' ? ML_GROUP_SERVICE_READY : offer === 'video' ? ML_GROUP_VIDEO_READY : ML_GROUP_READY);

const ML_API = 'https://connect.mailerlite.com/api';

/** Takes one address out of one MailerLite group. True when it is out (also when it was never in). */
async function leaveGroup(email: string, groupId: string): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) return { ok: false, reason: 'MailerLite is not configured on this server' };
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
  try {
    const found = await fetch(`${ML_API}/subscribers/${encodeURIComponent(email.trim().toLowerCase())}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (found.status === 404) return { ok: true };
    if (!found.ok) return { ok: false, reason: `MailerLite lookup HTTP ${found.status}` };
    const id = ((await found.json().catch(() => null)) as { data?: { id?: string } } | null)?.data?.id;
    if (!id) return { ok: false, reason: 'MailerLite returned no subscriber id' };
    const res = await fetch(`${ML_API}/subscribers/${id}/groups/${groupId}`, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    // 204 = removed; 404 = was not in the group.
    if (res.ok || res.status === 404) return { ok: true };
    return { ok: false, reason: `MailerLite remove HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'MailerLite request error' };
  }
}

export interface SwitchResult {
  ok: boolean;
  offer: FreeVideoOffer;
  at: string;
  /** What happened with the emails, in plain words for the admin panel. */
  emails: string;
  error?: string;
}

/**
 * Switches one finished lead to `to`. The event is written first (the page changes even if MailerLite is down);
 * then the old Ready group is left and, with followUp, the new one joined with the lead's fields. `mail` false
 * (any server but live) skips MailerLite entirely and says so.
 */
export async function switchOffer(
  lead: FreeVideoLead,
  to: FreeVideoOffer,
  options: { followUp: boolean; mail: boolean; by?: string | null }
): Promise<SwitchResult> {
  const current = offerOf(lead, await offerSwitchOf(lead.id));
  const at = new Date();
  const { error } = await eventsTable().insert({
    event: OFFER_SWITCH_EVENT,
    lead_id: lead.id,
    placement: to,
    ref: lead.ref,
    at: at.toISOString(),
    meta: { from: current, followUp: options.followUp, by: options.by ?? null },
  });
  if (error) return { ok: false, offer: current, at: at.toISOString(), emails: 'nothing changed', error: `switch not saved: ${error.message}` };

  if (!options.mail) {
    return { ok: true, offer: to, at: at.toISOString(), emails: 'not this server: MailerLite left as it was (only the live server changes emails)' };
  }

  const notes: string[] = [];
  // A second click on the same offer restarts its clock; the lead leaves and (with followUp) rejoins that group.
  const oldGroup = readyGroupOf(current);
  const left = oldGroup ? await leaveGroup(lead.email, oldGroup) : { ok: true };
  notes.push(left.ok ? `old ${OFFER_NAMES[current]} emails stopped` : `old emails NOT stopped (${(left as { reason?: string }).reason})`);

  if (options.followUp && !readyGroupOf(to)) {
    notes.push(`no ${OFFER_NAMES[to]} follow-up yet (its MailerLite group is not set up)`);
  } else if (options.followUp) {
    const joined = await subscribeToMailerLite({
      email: lead.email,
      groups: [readyGroupOf(to)],
      fields: {
        [ML_FIELDS.url]: `${SITE_URL}/v/${lead.view_token}`,
        [ML_FIELDS.site]: displayDomain(lead.website_domain),
        [ML_FIELDS.token]: lead.view_token,
      },
    });
    if (!joined.ok) notes.push(`new follow-up NOT started (${joined.reason || joined.status})`);
    else if (joined.subscriber?.status !== 'active') notes.push(`new follow-up not sent: MailerLite status ${joined.subscriber?.status ?? 'unknown'}`);
    else notes.push(`${OFFER_NAMES[to]} follow-up started`);
  } else {
    notes.push('no new follow-up');
  }
  return { ok: left.ok, offer: to, at: at.toISOString(), emails: notes.join('; ') };
}

/**
 * Whether a buyer gets this video ad in the account clean (offer.ts cleanCopyEarned), with the 3-day bonus counted
 * from the owner's switch when the lead was switched to the AI Media Machine. A failed read counts for the buyer.
 */
export async function bonusEarned(lead: FreeVideoLead): Promise<boolean> {
  let sw: OfferSwitch | null = null;
  try {
    sw = await offerSwitchOf(lead.id);
  } catch (error) {
    console.warn('⚠️ [free-video] offer_switch read for the bonus failed, the buyer gets the clean copy:', error);
    return true;
  }
  return cleanCopyEarned(sw?.offer === 'machine' ? { ...lead, finished_at: sw.at.toISOString() } : lead);
}
