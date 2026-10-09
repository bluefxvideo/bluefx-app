import { after, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { AUTO_REPLY, findWebsite, firstNameOf, INBOUND_REPLY, parseInbound, skippedHost } from '@/lib/free-video/inbound';
import { createLead, leadsTable } from '@/lib/free-video/leads';
import { joinLeadsGroup, viewUrl } from '@/lib/free-video/notify';
import { kickQueue } from '@/lib/free-video/runner';
import { sweepWatchdog } from '@/lib/free-video/sweep';
import { displayDomain, emailKeyOf, normalizeWebsite } from '@/lib/free-video/website';
import { FREE_VIDEO_REF_PATTERN } from '@/types/free-video';

/**
 * POST /api/free-video/inbound?key=…[&ref=campaign-tag]: a free video ad asked for by REPLYING to a broadcast.
 *
 * The broadcast ("Can I make you a video?") goes out with Reply-To support@bluefx.net. A Gmail filter labels the
 * replies, the n8n workflow "Free video ad — Gmail inbound" posts each one here, sends the `reply` of this answer
 * in the same Gmail thread when it is not null, then labels the message as processed.
 *
 * Server to server, so the form's browser checks (origin, per-IP limit, bot timer, IP country gate) do not apply:
 * the gate is the shared key FREE_VIDEO_INBOUND_KEY, or a Google identity token of a GOOGLE_SENDERS account. createLead still applies the daily caps, one video per address
 * and per domain, and the website pre-check; a queued lead then runs exactly like a form lead.
 *
 * Once the key is right it always answers 200 with { ok, action, reply, link?, domain? }, so n8n never retries.
 */
export const dynamic = 'force-dynamic';

const BODY_CAP = 300_000;

/** Google accounts whose Apps Script may post here with their own identity token instead of the key. */
const GOOGLE_SENDERS = ['support@bluefx.net'];

function keyMatches(given: string | null): boolean {
  const expected = process.env.FREE_VIDEO_INBOUND_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The Gmail Apps Script sends `Authorization: Bearer <ScriptApp.getIdentityToken()>`, so the script holds no
 * secret. Google's tokeninfo checks the signature and expiry; the token must name a verified GOOGLE_SENDERS address.
 */
async function googleSenderOk(req: Request): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return false;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const t = (await res.json()) as { iss?: string; email?: string; email_verified?: string | boolean; exp?: string };
    return (
      (t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com') &&
      String(t.email_verified) === 'true' &&
      GOOGLE_SENDERS.includes(String(t.email || '').toLowerCase()) &&
      Number(t.exp) * 1000 > Date.now()
    );
  } catch {
    return false;
  }
}

type Answer = { ok: boolean; action: string; reply: string | null; link?: string; domain?: string; detail?: string };
const answer = (body: Answer, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!keyMatches(url.searchParams.get('key') ?? req.headers.get('x-inbound-key')) && !(await googleSenderOk(req))) {
    return answer({ ok: false, action: 'unauthorized', reply: null }, 401);
  }
  const refParam = (url.searchParams.get('ref') || 'email-reply').slice(0, 60);
  const ref = FREE_VIDEO_REF_PATTERN.test(refParam) ? refParam : 'email-reply';

  try {
    let payload: unknown;
    try {
      payload = JSON.parse((await req.text()).slice(0, BODY_CAP) || '{}');
    } catch {
      return answer({ ok: true, action: 'ignored', reply: null, detail: 'not json' });
    }
    const mail = parseInbound(payload);
    if (AUTO_REPLY.test(mail.subject.trim())) return answer({ ok: true, action: 'ignored', reply: null, detail: 'auto-reply' });
    if (!mail.email) return answer({ ok: true, action: 'ignored', reply: null, detail: 'no sender' });
    const first = firstNameOf(mail.name, mail.email);

    // The site: a link in the reply, else the sender's own business mail domain ("Sure!" from joe@joespizza.com).
    let website = findWebsite(mail.body);
    let fromMailDomain = false;
    if (!website) {
      const mailDomain = mail.email.split('@')[1] ?? '';
      if (mailDomain && !skippedHost(mailDomain)) {
        website = mailDomain;
        fromMailDomain = true;
      }
    }
    // Nothing to make a video from: no automatic answer, the message stays in Gmail for Szilard to read.
    if (!website) return answer({ ok: true, action: 'no-url', reply: null });

    // consent: they replied to our email asking for the video ad; the reply is the request (they are list subscribers).
    const result = await createLead(
      { firstName: first, email: mail.email, website, ref, consent: true },
      { source: 'email_reply', ip: null, userAgent: 'n8n gmail inbound' }
    );

    if (result.ok) {
      const lead = result.lead;
      // The in-thread answer already carries the watch link; no "your video is ready" email (owner 2026-10-10).
      const { error: skipError } = await leadsTable()
        .update({ email_status: 'skipped', updated_at: new Date().toISOString() })
        .eq('id', lead.id)
        .eq('email_status', 'pending');
      if (skipError) console.warn(`⚠️ [free-video inbound] Could not skip the ready email for ${lead.id}: ${skipError.message}`);
      after(async () => {
        await joinLeadsGroup(lead);
        await kickQueue();
        await sweepWatchdog();
      });
      const domain = displayDomain(lead.website_domain);
      const link = viewUrl(lead.view_token);
      console.log(`📨 [free-video inbound] Queued ${domain} for ${mail.email}${fromMailDomain ? ' (from the mail domain)' : ''}`);
      return answer({
        ok: true,
        action: fromMailDomain ? 'queued-from-mail-domain' : 'queued',
        reply: INBOUND_REPLY.queued(first, domain, link),
        link,
        domain,
      });
    }

    const typed = normalizeWebsite(website);
    const domain = displayDomain('domain' in typed ? typed.domain : website);
    switch (result.code) {
      case 'duplicateEmail': {
        const { data } = await leadsTable()
          .select('view_token')
          .eq('email_key', emailKeyOf(mail.email))
          .neq('status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(1);
        const token = data?.[0]?.view_token as string | undefined;
        if (!token) return answer({ ok: true, action: 'duplicate-email', reply: null, domain });
        const link = viewUrl(token);
        return answer({ ok: true, action: 'duplicate-email', reply: INBOUND_REPLY.already(first, link), link, domain });
      }
      case 'duplicateSite':
        return answer({ ok: true, action: 'duplicate-site', reply: INBOUND_REPLY.siteTaken(first, domain), domain });
      case 'notFound':
      case 'unreadable':
        // A site guessed from the mail domain: stay quiet rather than ask about a site they never sent.
        return answer({ ok: true, action: result.code, reply: fromMailDomain ? null : INBOUND_REPLY.cantRead(first, domain), domain });
      case 'refused':
        return answer({ ok: true, action: 'refused', reply: fromMailDomain ? null : INBOUND_REPLY.notOwnSite(first), domain });
      default:
        // closed (daily cap), paused, tooMany, generic: no automatic answer; the message stays labelled for Szilard.
        console.warn(`⚠️ [free-video inbound] ${result.code} for ${mail.email}: ${result.message}`);
        return answer({ ok: true, action: result.code, reply: null, domain, detail: result.message });
    }
  } catch (failure) {
    console.error('❌ free-video inbound', failure);
    return answer({ ok: false, action: 'error', reply: null });
  }
}
