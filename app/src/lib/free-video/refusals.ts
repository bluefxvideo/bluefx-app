import { isLive } from '@/lib/free-video/config';
import { recordEvent } from '@/lib/free-video/leads';
import { FREE_VIDEO_REF_PATTERN, type FreeVideoErrorCode } from '@/types/free-video';

/**
 * Every free video ad form send that did not become a free video ad, kept as one 'form_refused' row in
 * free_video_events (owner 2026-10-18, "y": Daniel tried three times from an Instagram ad, saw no error he could act on,
 * and left no trace anywhere). The row says why (placement = the code) and what the visitor typed (meta: first name,
 * email, website), so the admin funnel panel counts them and support can write to the person. Server only, never throws.
 *
 * Not kept: a POST from another origin or without the visitor's IP (not the form). A browser marked internal is kept with
 * ref 'owner-test' and a local dev server's with meta.test, so the panel leaves both out.
 */

/** Why a send was turned away: the form's own error codes, the bot check's silent drop, or a crash in the route. */
export type RefusalCode = FreeVideoErrorCode | 'bot' | 'error';

/** Which check refused it, when a code has more than one: the bot check's two tests. */
export type RefusalCheck = 'honeypot' | 'tooFast';

/** What the visitor typed, as far as it can be read. */
export interface RefusalFields {
  firstName?: string;
  email?: string;
  website?: string;
  ref?: string;
}

export interface Refusal extends RefusalFields {
  code: RefusalCode;
  check?: RefusalCheck;
  /** The form field a 400 points at. */
  field?: string;
  /** The bot check's measured time (ms between the page opening and the send). */
  elapsedMs?: number;
  /** The rejected lead row a refused or unreadable website leaves (leads.ts), so the two can be matched. */
  leadId?: string;
}

/** The event row's name (free_video_events.event, at most 30 characters). */
export const REFUSAL_EVENT = 'form_refused';

/** Rows one IP may leave in a day (the same as INTAKE.perIpPerDay), and rows one app process may write in a day. */
export const REFUSAL_LIMITS = { perIpPerDay: 20, perProcessPerDay: 2000 } as const;

const DAY_MS = 24 * 60 * 60_000;
const logByIp = new Map<string, number[]>();
let processDay = { start: 0, count: 0 };

/** One more row from this IP today? A script hammering the form fills at most REFUSAL_LIMITS rows, then nothing. */
export function takeRefusalLog(ip: string, now = Date.now()): boolean {
  if (now - processDay.start >= DAY_MS) processDay = { start: now, count: 0 };
  if (processDay.count >= REFUSAL_LIMITS.perProcessPerDay) return false;
  const recent = (logByIp.get(ip) ?? []).filter((at) => now - at < DAY_MS);
  if (recent.length >= REFUSAL_LIMITS.perIpPerDay) {
    logByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  logByIp.set(ip, recent);
  processDay.count++;
  if (logByIp.size > 5000) for (const [key, times] of logByIp) if (!times.length || now - times[times.length - 1] > DAY_MS) logByIp.delete(key);
  return true;
}

const clip = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, max);
  return text || undefined;
};

/** The typed fields of a raw form body, even one the schema refuses: strings only, trimmed and cut to the schema's sizes. */
export function refusalFieldsOf(body: unknown): RefusalFields {
  let value = body;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const fields: RefusalFields = {
    firstName: clip(raw.firstName, 60),
    email: clip(raw.email, 254)?.toLowerCase(),
    website: clip(raw.website, 500),
    // The same tags the schema keeps (a bad one is dropped there too).
    ref: [clip(raw.ref, 60)].find((tag) => tag && FREE_VIDEO_REF_PATTERN.test(tag)),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as RefusalFields;
}

/** Saves one refused send (call it in after(), so the answer never waits). Never throws. */
export async function noteRefusal(ip: string | null, refusal: Refusal, internal = false): Promise<void> {
  try {
    if (!takeRefusalLog(ip ?? 'local')) return;
    const { code, check, field, elapsedMs, leadId, firstName, email, website, ref } = refusal;
    const meta = Object.fromEntries(
      Object.entries({
        first_name: firstName,
        email,
        website,
        check,
        field,
        elapsed_ms: elapsedMs,
        lead_id: leadId,
        test: isLive() ? undefined : true,
      }).filter(([, v]) => v !== undefined)
    );
    await recordEvent({ event: REFUSAL_EVENT, placement: code, ref: internal ? 'owner-test' : (ref ?? null), meta });
  } catch (error) {
    console.warn('⚠️ [free-video] Refused send not saved:', String(error).slice(0, 160));
  }
}
