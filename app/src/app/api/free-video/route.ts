import { after, NextResponse } from 'next/server';
import { isLive, LIMITS, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { ERRORS } from '@/lib/free-video/copy';
import { clientIp, createLead, takeAttempt, verifyHuman } from '@/lib/free-video/leads';
import { joinLeadsGroup } from '@/lib/free-video/notify';
import { kickQueue } from '@/lib/free-video/runner';
import { sweepWatchdog } from '@/lib/free-video/sweep';
import { FreeVideoLeadSchema, type FreeVideoErrorCode, type FreeVideoSubmitData } from '@/types/free-video';
import { createApiError, createApiSuccess, type ApiResponse } from '@/types/validation';

/**
 * POST /api/free-video: the free video ad form (app.bluefx.net/free-video-ad).
 *
 * A Route Handler, not a server action: a deploy changes action ids and would break every open form.
 * Same origin only (no CORS). Order of the checks, cheapest first:
 * 1. Origin: the app's own origin (any http://localhost:<port> off the live server), else 403.
 * 2. The visitor's IP (the live server refuses a request without one: it skipped the proxy) and the
 *    per-IP attempt limit, which counts every POST, 400 answers included (review SEC-1) → 429.
 * 3. The body: at most LIMITS.bodyBytes (413), JSON (400), FreeVideoLeadSchema (400 with the field).
 * 4. The bot checks (honeypot, the form's own timer): a silent 200 with token null, nothing stored.
 * 5. createLead (caps, duplicates, the website pre-check, the insert under one lock).
 * 6. after(): a queued lead joins the MailerLite Leads group, the queue is kicked, the cron watchdog runs.
 *
 * Answers ApiResponse<FreeVideoSubmitData>; an error carries details.code (FreeVideoErrorCode) and, for a
 * form field, details.field.
 */
export const dynamic = 'force-dynamic';

type Answer = ApiResponse<FreeVideoSubmitData>;

const error = (status: number, code: FreeVideoErrorCode, message: string, field?: string) =>
  NextResponse.json<Answer>(createApiError(message, { code, ...(field ? { field } : {}) }), { status, headers: { 'Cache-Control': 'no-store' } });

/** The origins a browser may send this form from. */
function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const allowed = new Set([new URL(SITE_URL).origin, new URL(PROD_SITE_URL).origin]);
  if (allowed.has(url.origin)) return true;
  return !isLive() && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

/** The body as text, read no further than `cap` bytes; null when it is longer. */
async function readCapped(req: Request, cap: number): Promise<string | null> {
  if (Number(req.headers.get('content-length')) > cap) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function POST(req: Request) {
  try {
    // 1.
    if (!originAllowed(req.headers.get('origin'))) return error(403, 'generic', ERRORS.generic);

    // 2. A live request always comes through the proxy, which names the visitor's IP.
    const ip = clientIp(req);
    if (!ip && isLive()) return error(403, 'generic', ERRORS.generic);
    if (!takeAttempt(ip ?? 'local')) return error(429, 'tooMany', ERRORS.tooMany);

    // 3.
    const text = await readCapped(req, LIMITS.bodyBytes);
    if (text === null) return error(413, 'invalid', ERRORS.invalid);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return error(400, 'invalid', ERRORS.invalid);
    }
    const parsed = FreeVideoLeadSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return error(400, 'invalid', issue?.message || ERRORS.invalid, issue?.path[0] ? String(issue.path[0]) : undefined);
    }

    // 4. A bot gets the same neutral thank-you a person would, and nothing is stored.
    if (!verifyHuman(parsed.data)) {
      console.log(`⚠️ [free-video] Silent drop (bot check) from ${ip ?? 'unknown'}`);
      return NextResponse.json<Answer>(createApiSuccess({ token: null }), { headers: { 'Cache-Control': 'no-store' } });
    }

    // 5.
    const result = await createLead(parsed.data, {
      source: isLive() ? 'landing' : 'test',
      ip,
      userAgent: req.headers.get('user-agent'),
    });

    // 6. A rejected lead (unreadable or refused website) never goes to MailerLite (review SEC-3); its row keeps the email.
    const queued = result.ok ? result.lead : null;
    after(async () => {
      if (queued) {
        await joinLeadsGroup(queued);
        await kickQueue();
      }
      await sweepWatchdog();
    });

    if (!result.ok) return error(result.status, result.code, result.message);
    return NextResponse.json<Answer>(createApiSuccess({ token: result.lead.view_token }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (failure) {
    console.error('❌ free-video POST', failure);
    return error(503, 'paused', ERRORS.paused);
  }
}
