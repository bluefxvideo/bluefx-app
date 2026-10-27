import { alertOwner } from '@/lib/free-video/alerts';
import { SITE_URL } from '@/lib/free-video/config';
import { eventsTable, recordEvent } from '@/lib/free-video/leads';
import { unlockPagePath } from '@/lib/free-video/offer';
import { displayDomain } from '@/lib/free-video/website';
import type { FreeVideoLead } from '@/types/free-video';

/**
 * Changes an unlock buyer asks for on the unlock page (owner 2026-10-27: pay once, changes included). Each change is a
 * change_request event on the lead plus an email to the owner, who makes the change in the Phantom and emails the
 * changed video ad back by hand. CHANGE_ROUNDS rounds within CHANGE_DAYS days of the payment.
 */
export const CHANGE_ROUNDS = 2;
export const CHANGE_DAYS = 30;
export const CHANGE_MAX_CHARS = 2000;

const PAID_STATES: ReadonlyArray<FreeVideoLead['unlock_status']> = ['paid', 'rendering', 'ready', 'failed'];

/** How many changes the lead asked for so far. Throws on a database error. */
export async function changesUsed(leadId: string): Promise<number> {
  const { count, error } = await eventsTable().select('id', { count: 'exact', head: true }).eq('lead_id', leadId).eq('event', 'change_request');
  if (error) throw new Error(`change requests not read: ${error.message}`);
  return count ?? 0;
}

export type ChangeRefusal = 'notPaid' | 'tooLate' | 'noRoundsLeft';

/** Why this lead may not ask for a change now, or null when it may. */
export function changeRefusal(lead: FreeVideoLead, used: number, now = Date.now()): ChangeRefusal | null {
  if (!PAID_STATES.includes(lead.unlock_status)) return 'notPaid';
  const paidAt = lead.unlocked_at ? Date.parse(lead.unlocked_at) : NaN;
  if (Number.isFinite(paidAt) && now - paidAt > CHANGE_DAYS * 24 * 3600 * 1000) return 'tooLate';
  if (used >= CHANGE_ROUNDS) return 'noRoundsLeft';
  return null;
}

/** Saves one change and emails the owner. Returns the rounds left. Throws on a database error. */
export async function requestChange(lead: FreeVideoLead, text: string, used: number): Promise<number> {
  const round = used + 1;
  await recordEvent({ event: 'change_request', leadId: lead.id, ref: lead.ref, meta: { text, round } });
  const domain = displayDomain(lead.website_domain);
  await alertOwner(
    [
      {
        key: `change:${lead.id}:${round}`,
        line: [
          `${lead.first_name} (${lead.email}) asked for change ${round} of ${CHANGE_ROUNDS} to the video ad for ${domain}:`,
          `"${text}"`,
          `Make the change in the Phantom (job ${lead.job_id ?? 'unknown'}) and email the changed video ad within 24 hours. Their page: ${SITE_URL}${unlockPagePath(lead.view_token)}?internal=1`,
        ].join('\n'),
      },
    ],
    `change ${round} for ${domain}`
  );
  return CHANGE_ROUNDS - round;
}
