/**
 * Free video ad funnel: the visitor's emails, through MailerLite only. Nothing here throws.
 *
 * The visitor's email is sent by the MailerLite automation 'Free Video Ad', which starts when the
 * subscriber joins the 'Free Video - Ready' group. deliverLead() makes that join in ONE upsert that also
 * sets the fields the email prints ({$free_video_url} and so on), so the email can never go out with an
 * empty link. The $99 clean version works the same way with the 'Free Video - Unlocked' group and
 * {$free_video_clean_url} (deliverUnlock). No resubscribe: someone who unsubscribed earlier gets the
 * video ad on the page only.
 *
 * A visitor's typing never renames a subscriber (review SEC-3): the first name is sent only for an address
 * MailerLite does not know yet, or knows without a name. Rejected leads never reach MailerLite at all.
 *
 * Off the live server nobody is mailed except FREE_VIDEO_TEST_EMAIL (the owner's inbox, plus-tags allowed).
 */

import {
  EMAIL_MAX_ATTEMPTS,
  EMAIL_RECLAIM_MINUTES,
  isLive,
  ML_FIELDS,
  ML_GROUP_BOUGHT,
  ML_GROUP_LEADS,
  ML_GROUP_READY,
  ML_GROUP_UNLOCKED,
  SITE_URL,
  testInbox,
} from '@/lib/free-video/config';
import { getLead, leadsTable } from '@/lib/free-video/leads';
import { displayDomain, emailKeyOf } from '@/lib/free-video/website';
import { subscribeToMailerLite } from '@/lib/mailerlite/subscribe';
import type { FreeVideoEmailStatus, FreeVideoLead } from '@/types/free-video';

const ML_API = 'https://connect.mailerlite.com/api';

/** The live server mails every lead; any other server only the owner's test inbox (review F8). */
export function mailAllowed(email: string): boolean {
  if (isLive()) return true;
  const inbox = testInbox();
  return Boolean(inbox && emailKeyOf(email) === emailKeyOf(inbox));
}

/** The link the emails carry: the video ad page. */
export const viewUrl = (token: string) => `${SITE_URL}/v/${token}`;

/**
 * Whether MailerLite already has this address, and with a first name. One read-only GET; null when it
 * cannot tell (no key, an error), and then no name is sent.
 */
async function knownSubscriber(email: string): Promise<{ exists: boolean; named: boolean } | null> {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${ML_API}/subscribers/${encodeURIComponent(email.trim().toLowerCase())}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 404) return { exists: false, named: false };
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { data?: { fields?: { name?: unknown } } } | null;
    const name = data?.data?.fields?.name;
    return { exists: true, named: typeof name === 'string' && name.trim().length > 0 };
  } catch {
    return null;
  }
}

/** The first name to send with an upsert: only for a new subscriber or one without a name (review SEC-3). */
async function nameFor(lead: Pick<FreeVideoLead, 'email' | 'first_name'>): Promise<string | undefined> {
  const known = await knownSubscriber(lead.email);
  return known && (!known.exists || !known.named) ? lead.first_name : undefined;
}

/**
 * A queued signup joins 'Free Video - Leads' (no automation hangs on this group). A rejected lead (an
 * unreadable or refused website) never does: the row already keeps the email, and the form must not be a
 * way to add strangers' addresses to the list (review SEC-3). Called from the POST's after().
 * Returns true when MailerLite took the subscriber.
 */
export async function joinLeadsGroup(lead: Pick<FreeVideoLead, 'email' | 'first_name' | 'website_domain' | 'status'>): Promise<boolean> {
  try {
    if (lead.status === 'rejected' || !mailAllowed(lead.email)) return false;
    if (!ML_GROUP_LEADS) {
      console.warn('⚠️ [free-video] ML_GROUP_LEADS is not set yet; the lead was not added to MailerLite');
      return false;
    }
    const result = await subscribeToMailerLite({
      email: lead.email,
      fullName: await nameFor(lead),
      groups: [ML_GROUP_LEADS],
      fields: { [ML_FIELDS.site]: displayDomain(lead.website_domain) },
    });
    return result.ok;
  } catch (error) {
    console.error('❌ [free-video] joinLeadsGroup failed:', error);
    return false;
  }
}

export type DeliverResult = 'sent' | 'inactive' | 'failed' | 'skipped' | 'none';

/**
 * Emails a finished lead, at most once, crash-safe:
 * 1. Claim with an optimistic guarded update: status 'done', emailed_at null, email_attempts and
 *    email_status still as read (pending or failed, or 'sending' whose claim is older than 5 min),
 *    attempts below EMAIL_MAX_ATTEMPTS. No row back = someone else holds the claim → 'none'.
 * 2. Not allowed to mail this address (not the live server) → 'skipped'.
 * 3. ONE MailerLite upsert: the 4 fields and the Ready group in the same call.
 * 4. Not ok → 'failed' (the cron retries; the attempt counter stops it at 5).
 * 5. ok and the subscriber is active → 'sent'. 6. ok but not active (unsubscribed, bounced, junk,
 *    unconfirmed) → 'inactive': MailerLite will not send, the page is the only delivery.
 * A crash between 1 and 5 leaves 'sending' with no emailed_at; the sweep reclaims it after 5 minutes.
 */
export async function deliverLead(leadId: string): Promise<DeliverResult> {
  try {
    const lead = await getLead(leadId);
    if (!lead || lead.status !== 'done' || lead.emailed_at) return 'none';
    if (lead.email_attempts >= EMAIL_MAX_ATTEMPTS) return 'none';
    const reclaimBefore = Date.now() - EMAIL_RECLAIM_MINUTES * 60_000;
    const claimable =
      lead.email_status === 'pending' ||
      lead.email_status === 'failed' ||
      (lead.email_status === 'sending' && (!lead.email_claimed_at || Date.parse(lead.email_claimed_at) < reclaimBefore));
    if (!claimable) return 'none';

    const allowed = mailAllowed(lead.email);
    // The Ready group is what sends the email: without its id there is nothing to deliver yet.
    // Not claiming keeps the attempts for when the id is in config.ts (the sweep raises an alert).
    if (allowed && !ML_GROUP_READY) {
      console.error(`❌ [free-video] ML_GROUP_READY is not set: lead ${lead.id} waits for its email`);
      return 'none';
    }

    // 1. The claim. Every claim raises email_attempts and every outcome changes email_status, so
    // "both still as read" means nobody claimed or settled since (the staleness was checked above).
    const attempt = lead.email_attempts + 1;
    const { data: claimed, error: claimError } = await leadsTable()
      .update({ email_status: 'sending', email_claimed_at: new Date().toISOString(), email_attempts: attempt, updated_at: new Date().toISOString() })
      .eq('id', lead.id)
      .eq('status', 'done')
      .is('emailed_at', null)
      .eq('email_attempts', lead.email_attempts)
      .lt('email_attempts', EMAIL_MAX_ATTEMPTS)
      .eq('email_status', lead.email_status)
      .select('id');
    if (claimError) {
      console.error(`❌ [free-video] Email claim of lead ${lead.id} failed:`, claimError.message);
      return 'none';
    }
    if (!claimed?.length) return 'none';

    // Every later write is guarded by our own claim.
    const settle = async (status: FreeVideoEmailStatus, patch: Record<string, unknown> = {}) => {
      const { error } = await leadsTable()
        .update({ email_status: status, ...patch, updated_at: new Date().toISOString() })
        .eq('id', lead.id)
        .eq('email_status', 'sending')
        .eq('email_attempts', attempt);
      if (error) console.error(`❌ [free-video] Email status of lead ${lead.id} not saved:`, error.message);
    };

    // 2. Off the live server only the owner's test inbox is mailed.
    if (!allowed) {
      await settle('skipped');
      console.log(`⚠️ [free-video] Lead ${lead.id}: email skipped (not the live server, not the test inbox)`);
      return 'skipped';
    }

    // 3. One upsert: the fields and the group travel together.
    const result = await subscribeToMailerLite({
      email: lead.email,
      fullName: await nameFor(lead),
      groups: [ML_GROUP_READY],
      fields: {
        [ML_FIELDS.url]: viewUrl(lead.view_token),
        [ML_FIELDS.site]: displayDomain(lead.website_domain),
        [ML_FIELDS.token]: lead.view_token,
        [ML_FIELDS.customer]: lead.is_customer ? 'yes' : 'no',
      },
    });

    // 4.
    if (!result.ok) {
      await settle('failed', { reason: `email: ${result.reason || `HTTP ${result.status ?? '?'}`}`.slice(0, 300) });
      return 'failed';
    }
    const mlStatus = result.subscriber?.status ?? null;
    // 5.
    if (mlStatus === 'active') {
      await settle('sent', { emailed_at: new Date().toISOString(), ml_status: mlStatus });
      console.log(`✅ [free-video] Lead ${lead.id}: joined the Ready group, the email is on its way`);
      return 'sent';
    }
    // 6.
    await settle('inactive', { ml_status: mlStatus ?? 'unknown' });
    console.warn(`⚠️ [free-video] Lead ${lead.id}: MailerLite status ${mlStatus ?? 'unknown'}, the page is the only delivery`);
    return 'inactive';
  } catch (error) {
    console.error(`❌ [free-video] deliverLead ${leadId} failed:`, error);
    return 'none';
  }
}

/**
 * Emails the $99 clean version once it is ready: ONE upsert that sets free_video_clean_url (the clean file)
 * plus the page link, site and token, and joins 'Free Video - Unlocked', whose 1-email automation sends it.
 * Then unlock_emailed_at is set (also for a subscriber MailerLite will not mail: 'inactive', the owner is
 * alerted and the page shows the download). Skipped while the group id is empty. A second call is harmless:
 * the automation starts once per group join. Returns what happened; the sweep retries 'failed' and 'none'.
 */
export async function deliverUnlock(leadId: string): Promise<DeliverResult> {
  try {
    const lead = await getLead(leadId);
    if (!lead || lead.unlock_status !== 'ready' || !lead.clean_video_url || lead.unlock_emailed_at) return 'none';
    if (!mailAllowed(lead.email)) {
      console.log(`⚠️ [free-video] Lead ${lead.id}: clean video email skipped (not the live server, not the test inbox)`);
      return 'skipped';
    }
    if (!ML_GROUP_UNLOCKED) {
      console.error(`❌ [free-video] ML_GROUP_UNLOCKED is not set: the clean video of lead ${lead.id} waits for its email (the page shows it)`);
      return 'none';
    }
    const result = await subscribeToMailerLite({
      email: lead.email,
      fullName: await nameFor(lead),
      groups: [ML_GROUP_UNLOCKED],
      fields: {
        [ML_FIELDS.cleanUrl]: lead.clean_video_url,
        [ML_FIELDS.url]: viewUrl(lead.view_token),
        [ML_FIELDS.site]: displayDomain(lead.website_domain),
        [ML_FIELDS.token]: lead.view_token,
      },
    });
    if (!result.ok) {
      console.error(`❌ [free-video] Clean video email of lead ${lead.id} failed: ${result.reason || result.status}`);
      return 'failed';
    }
    const { error } = await leadsTable()
      .update({ unlock_emailed_at: new Date().toISOString(), ml_status: result.subscriber?.status ?? lead.ml_status, updated_at: new Date().toISOString() })
      .eq('id', lead.id)
      .is('unlock_emailed_at', null);
    if (error) console.error(`❌ [free-video] unlock_emailed_at of lead ${lead.id} not saved:`, error.message);
    if (result.subscriber?.status !== 'active') {
      console.warn(`⚠️ [free-video] Lead ${lead.id}: MailerLite status ${result.subscriber?.status ?? 'unknown'}, the page is the only delivery of the clean video`);
      return 'inactive';
    }
    console.log(`✅ [free-video] Lead ${lead.id}: joined the Unlocked group, the clean video email is on its way`);
    return 'sent';
  } catch (error) {
    console.error(`❌ [free-video] deliverUnlock ${leadId} failed:`, error);
    return 'none';
  }
}

/** P1: a buyer joins 'Free Video - Bought', the automation's exit condition, so upsell emails stop. Returns true when MailerLite took it. */
export async function addToBoughtGroup(email: string): Promise<boolean> {
  try {
    if (!mailAllowed(email) || !ML_GROUP_BOUGHT) return false;
    const result = await subscribeToMailerLite({ email, groups: [ML_GROUP_BOUGHT] });
    return result.ok;
  } catch (error) {
    console.error('❌ [free-video] addToBoughtGroup failed:', error);
    return false;
  }
}
