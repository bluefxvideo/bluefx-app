import { after, NextResponse } from 'next/server';
import { isLive, LIMITS, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { ERRORS } from '@/lib/free-video/copy';
import { saveHop } from '@/lib/free-video/clickbank-hops';
import { blockedCountry } from '@/lib/free-video/geo';
import { hasInternalCookie } from '@/lib/free-video/internal-visit';
import { attemptLimitOf, clientIp, createLead, verifyHuman } from '@/lib/free-video/leads';
import { requestFacts, trackLead } from '@/lib/free-video/meta';
import { joinLeadsGroup } from '@/lib/free-video/notify';
import { leadEventId } from '@/lib/free-video/pixel';
import { noteRefusal, refusalFieldsOf, type Refusal, type RefusalFields } from '@/lib/free-video/refusals';
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
 *    per-IP attempt limit, which counts every POST, 400 answers included (review SEC-1) → 429 tries or triesToday.
 * 3. The body: at most LIMITS.bodyBytes (413), JSON (400), FreeVideoLeadSchema (400 with the field).
 * 4. The bot checks (honeypot, the form's own timer): a silent 200 with token null, nothing stored.
 * 4b. A country on BLOCKED_COUNTRIES (config.ts), by IP or the browser's time zone (geo.ts) → 403 country, nothing stored.
 * 5. createLead (caps, duplicates, the website pre-check, the insert under one lock).
 * 5b. Any answer from 2 on that is not a free video ad on its way leaves a 'form_refused' row (refusals.ts).
 * 6. after(): a queued lead joins the MailerLite Leads group, the queue is kicked, the cron watchdog runs, the
 *    Lead goes to Facebook's Conversions API with the visitor's click id (meta.ts), and the visit's ClickBank
 *    affiliate hop, when there is one, is kept on the lead for its checkout clicks (clickbank-hops.ts).
 *
 * Answers ApiResponse<FreeVideoSubmitData>; an error carries details.code (FreeVideoErrorCode) and, for a
 * form field, details.field. A queued lead's answer carries the pixel's Lead event id, the one the server sends too.
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
  // Every answer below that is not a free video ad on its way is kept as a 'form_refused' row with what the visitor
  // typed (refusals.ts), after the answer has gone out; a POST that is not the form (step 1, no IP) is not.
  const internal = hasInternalCookie(req.headers.get('cookie'));
  let ip: string | null = null;
  let typed: RefusalFields = {};
  const refuse = (status: number, code: FreeVideoErrorCode, message: string, more: Omit<Refusal, 'code'> = {}) => {
    after(() => noteRefusal(ip, { ...typed, ...more, code }, internal));
    return error(status, code, message, more.field);
  };
  try {
    // 1.
    if (!originAllowed(req.headers.get('origin'))) return error(403, 'generic', ERRORS.generic);

    // 2. A live request always comes through the proxy, which names the visitor's IP.
    ip = clientIp(req);
    if (!ip && isLive()) return error(403, 'generic', ERRORS.generic);
    const limit = attemptLimitOf(ip ?? 'local');
    if (limit) {
      // The small capped body is still read for the row, so a person who tried too often can be written to.
      typed = refusalFieldsOf(await readCapped(req, LIMITS.bodyBytes).catch(() => null));
      return limit === 'minute' ? refuse(429, 'tries', ERRORS.tries) : refuse(429, 'triesToday', ERRORS.triesToday);
    }

    // 3.
    const text = await readCapped(req, LIMITS.bodyBytes);
    if (text === null) return refuse(413, 'invalid', ERRORS.invalid);
    typed = refusalFieldsOf(text);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return refuse(400, 'invalid', ERRORS.invalid);
    }
    const parsed = FreeVideoLeadSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return refuse(400, 'invalid', issue?.message || ERRORS.invalid, issue?.path[0] ? { field: String(issue.path[0]) } : {});
    }

    // 4. A bot gets the same neutral thank-you a person would, and nothing is stored but the refused send's row.
    if (!verifyHuman(parsed.data)) {
      console.log(`⚠️ [free-video] Silent drop (bot check) from ${ip ?? 'unknown'}`);
      const check = parsed.data.fv_note ? 'honeypot' : 'tooFast';
      after(() => noteRefusal(ip, { ...typed, code: 'bot', check, elapsedMs: parsed.data.elapsedMs }, internal));
      return NextResponse.json<Answer>(createApiSuccess({ token: null }), { headers: { 'Cache-Control': 'no-store' } });
    }

    // 4b.
    const country = blockedCountry(ip, parsed.data.tz);
    if (country) {
      console.log(`⚠️ [free-video] Country refused (${country.code}) from ${ip ?? 'unknown'}`);
      return refuse(403, 'country', ERRORS.country(country.name));
    }

    // 5. An opt-in from a browser marked internal (the owner testing with any address, internal-visit.ts) is stored with
    // ref 'owner-test', which the admin numbers leave out (funnel-stats.ts) and the Conversions API skips (meta.ts).
    const input = internal ? { ...parsed.data, ref: 'owner-test' } : parsed.data;
    const result = await createLead(input, {
      source: isLive() ? 'landing' : 'test',
      ip,
      userAgent: req.headers.get('user-agent'),
    });

    // 6. A rejected lead (unreadable or refused website) never goes to MailerLite (review SEC-3); its row keeps the email.
    // Nor to Facebook: a Lead is a request the AI Media Machine is going to make.
    const queued = result.ok ? result.lead : null;
    const facts = requestFacts(req, ip, parsed.data.fbclid);
    after(async () => {
      if (queued) {
        await Promise.all([
          trackLead(queued, facts, parsed.data.tz),
          parsed.data.cb ? saveHop(queued.id, parsed.data.cb, 'landing') : Promise.resolve(),
          (async () => {
            await joinLeadsGroup(queued);
            await kickQueue();
          })(),
        ]);
      }
      await sweepWatchdog();
    });

    if (!result.ok) return refuse(result.status, result.code, result.message, result.lead ? { leadId: result.lead.id } : {});
    return NextResponse.json<Answer>(createApiSuccess({ token: result.lead.view_token, eventId: leadEventId(result.lead.id) }), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (failure) {
    console.error('❌ free-video POST', failure);
    after(() => noteRefusal(ip, { ...typed, code: 'error' }, internal));
    return error(503, 'paused', ERRORS.paused);
  }
}
