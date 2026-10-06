/**
 * Free video ad funnel: alerts to the owner, by Brevo email. Nothing here throws.
 *
 * Every alert is a row in free_video_alerts whose key dedupes it (one per lead attempt or per event,
 * see FreeVideoAlert), so each one is stored once. Every call emails, in ONE message, every row of the last
 * 24 h that has not gone out yet: the new ones and any that an earlier send could not deliver (Brevo down,
 * key missing; review F3). At most ALERTS_PER_DAY rows are emailed per rolling 24 h: Brevo's free plan sends
 * 300 emails a day, shared with buyers' password mails. Rows over the cap wait (the cron JSON counts them).
 */

import { createAdminClient } from '@/app/supabase/server';
import { ALERT_FROM, ALERTS_PER_DAY, OWNER_ALERT_EMAIL } from '@/lib/free-video/config';

export const alertsTable = () => (createAdminClient() as any).from('free_video_alerts');

export interface AlertItem {
  /** The dedupe key; the same key is stored (and emailed) once. */
  key: string;
  /** One line for the email: what happened and what to do. */
  line: string;
}

/** Unsent rows one email carries at most (the rest wait for the next call). */
const BATCH = 40;

const dayAgo = () => new Date(Date.now() - 24 * 3600_000).toISOString();

/** Alert rows emailed in the last 24 h; null when the count cannot be read. */
async function sentLastDay(): Promise<number | null> {
  const { count, error } = await alertsTable().select('key', { count: 'exact', head: true }).eq('sent', true).gt('created_at', dayAgo());
  if (error) {
    console.error('❌ [free-video] Could not count the sent alerts:', error.message);
    return null;
  }
  return count ?? 0;
}

/** Alert rows of the last 24 h that were never emailed (over the cap, or the email failed). null when unreadable. */
export async function unsentAlerts(): Promise<number | null> {
  try {
    const { count, error } = await alertsTable().select('key', { count: 'exact', head: true }).eq('sent', false).gt('created_at', dayAgo());
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

const RUNBOOK = [
  'Runbook (Supabase SQL editor, no deploy needed):',
  'Release a held video ad (the cron emails it within 3 minutes):',
  "  update free_video_leads set status = 'done', email_status = 'pending', updated_at = now() where id = '<lead id>' and status = 'held';",
  'Make a new video ad instead:',
  "  update free_video_leads set status = 'queued', attempts = 0, reason = null, not_before = null, updated_at = now() where id = '<lead id>' and status in ('held','failed');",
  'Render the $99 clean version again (after a failed clean render):',
  "  update free_video_leads set unlock_status = 'paid', clean_attempts = 0, updated_at = now() where id = '<lead id>' and unlock_status = 'failed';",
  'Pause new starts (running jobs finish):',
  '  update free_video_settings set starting = false, updated_at = now() where id = 1;',
  'Start again after a fix:',
  '  update free_video_settings set starting = true, updated_at = now() where id = 1;',
  'The whole funnel at a glance:',
  '  select * from free_video_funnel;',
].join('\n');

/**
 * Stores every item (one row per key, by construction), then emails the owner every unsent row of the last
 * 24 h in one message, within the daily cap. Returns the number of NEW rows (0 = everything was already known).
 * Called with no items it only retries what is still unsent; the cron does that every run.
 *
 * The cap holds under races: rows are claimed (sent = true) first, then the 24 h count is read again; if that
 * count is over the cap the claim is undone and nothing is sent. Whichever caller counts last sees every
 * claim, so the total never passes ALERTS_PER_DAY.
 */
export async function alertOwner(items: AlertItem[], subject: string): Promise<number> {
  const unique = [...new Map(items.filter((i) => i.key).map((i) => [i.key.slice(0, 200), i.line.slice(0, 2000)])).entries()];
  try {
    let fresh = 0;
    if (unique.length) {
      const { data, error } = await alertsTable()
        .upsert(
          unique.map(([key, line]) => ({ key, subject: subject.slice(0, 200), body: line })),
          { onConflict: 'key', ignoreDuplicates: true }
        )
        .select('key, body');
      if (error) {
        // Without the table there is no dedupe, so nothing is emailed (the cron would repeat it every 3 minutes).
        console.error(`❌ [free-video] ${subject} (alert not stored: ${error.message}):`, unique.map(([, line]) => line).join(' | '));
        return 0;
      }
      const stored = (data ?? []) as { key: string; body: string }[];
      fresh = stored.length;
      if (fresh) console.error(`❌ [free-video] ${subject}: ${stored.map((row) => row.body).join(' | ')}`);
    }

    // Brevo is not set up yet: the rows wait, unsent, and the next call tries again.
    if (!process.env.BREVO_API_KEY) {
      if (fresh) console.error('❌ [free-video] Alert email not sent: BREVO_API_KEY is not set');
      return fresh;
    }

    const { data: pendingRows, error: pendingError } = await alertsTable()
      .select('key, body, created_at')
      .eq('sent', false)
      .gt('created_at', dayAgo())
      .order('created_at', { ascending: true })
      .limit(BATCH);
    if (pendingError) {
      console.error('❌ [free-video] Unsent alerts not read:', pendingError.message);
      return fresh;
    }
    const pending = (pendingRows ?? []) as { key: string; body: string | null }[];
    if (!pending.length) return fresh;

    const sent = await sentLastDay();
    const room = sent === null ? 0 : ALERTS_PER_DAY - sent;
    if (room <= 0) {
      if (fresh) console.error(`❌ [free-video] Alert email not sent: ${sent === null ? 'the sent count is unreadable' : `${ALERTS_PER_DAY} alerts already went out in 24 h`}`);
      return fresh;
    }
    const take = pending.slice(0, room);
    const { data: claimedRows, error: claimError } = await alertsTable()
      .update({ sent: true, error: null })
      .in(
        'key',
        take.map((row) => row.key)
      )
      .eq('sent', false)
      .select('key');
    if (claimError || !claimedRows?.length) {
      if (claimError) console.error('❌ [free-video] Alert claim failed:', claimError.message);
      return fresh;
    }
    const claimed = new Set((claimedRows as { key: string }[]).map((row) => row.key));
    const lines = take.filter((row) => claimed.has(row.key));
    const claimedKeys = lines.map((row) => row.key);

    const after = await sentLastDay();
    if (after === null || after > ALERTS_PER_DAY) {
      await alertsTable().update({ sent: false, error: 'daily alert cap' }).in('key', claimedKeys);
      console.error('❌ [free-video] Alert email not sent: the daily cap was reached at the same moment');
      return fresh;
    }

    const waiting = pending.length - lines.length;
    const text = [
      ...lines.map((row) => `- ${row.body || row.key}`),
      ...(waiting > 0 ? [`- ${waiting} more alert(s) are stored in free_video_alerts (daily email cap).`] : []),
      '',
      RUNBOOK,
    ].join('\n');
    const title = fresh ? subject : 'alerts that could not be sent earlier';
    const result = await sendBrevo(lines.length > 1 ? `${title} (${lines.length})` : title, text);
    if (!result.ok) {
      await alertsTable()
        .update({ sent: false, error: (result.error || 'send failed').slice(0, 300) })
        .in('key', claimedKeys);
      console.error('❌ [free-video] Alert email failed (the next call tries again):', result.error);
    }
    return fresh;
  } catch (error) {
    console.error(`❌ [free-video] ${subject} (alert failed):`, error);
    return 0;
  }
}

/** One plain-text email to the owner through Brevo's transactional API (10 s timeout). */
export async function sendBrevo(subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: 'BREVO_API_KEY not set' };
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: ALERT_FROM,
        to: [{ email: OWNER_ALERT_EMAIL }],
        subject: `[Free video] ${subject}`,
        textContent: text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Brevo ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
