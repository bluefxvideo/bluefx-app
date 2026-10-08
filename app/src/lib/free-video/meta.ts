/**
 * Free video ad funnel → Meta Conversions API, the server half of the BlueFx pixel (Facebook ads test, owner 2026-10-08:
 * "Fire Lead when someone requests a video, from the browser and the Conversions API, deduplicated. Make sure the $99
 * unlock reaches Facebook as a Purchase with the click ID. Track a click on the lifetime offer as InitiateCheckout.").
 *
 * - Lead: POST /api/free-video, once the request is queued. Same event id as the browser's (pixel.ts leadEventId).
 * - InitiateCheckout: /go/<placement> for the lifetime offer. The page's button sends its event id as ?e=; an email
 *   click has none and is server only.
 * - Purchase: the FastSpring webhook, when a $99 unlock is paid. No browser twin.
 *
 * The click id: the visitor's _fbc cookie (the pixel writes it when the address carries ?fbclid=), else one built from
 * the fbclid the form sends, plus the _fbp cookie. Saved per lead as a 'meta_ids' row in free_video_events, so the
 * Purchase that arrives days later from FastSpring (no browser) still carries the click id of the ad that brought the
 * lead. The /go/fvunlock click saves the cookies of the browser that goes to the checkout too.
 *
 * Who is skipped: visitors from the EU/EEA, the UK and Switzerland (they would need a cookie banner first; the ads do not
 * target them), the owner's own tests, and every server but the live one. META_TEST_EVENT_CODE sends every event to
 * Events Manager → Test events instead (then a local server sends too, its test leads and the owner's tests included).
 * Every send leaves a 'capi' row (ok, or the error) in free_video_events.
 *
 * Server only: no 'server-only' import on purpose (the tsx scripts import it). Never throws: measurement must never
 * break a form, a click or a payment.
 *
 * Env: META_CAPI_TOKEN (Events Manager → the pixel → Settings → Conversions API → Generate access token).
 * Optional: META_TEST_EVENT_CODE, META_API_VERSION (default v26.0, as the 24-Hour Video Ad sender on bluefx.net).
 */

import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import { isLive, OWNER_TEST_EMAILS, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { countryOfIp } from '@/lib/free-video/geo';
import { eventsTable, getLeadByToken, recordEvent } from '@/lib/free-video/leads';
import { UNLOCK } from '@/lib/free-video/offer';
import { CHECKOUT_EVENT_ID, europeanTimeZone, leadEventId, META_PIXEL_ID, PIXEL_DATA, purchaseEventId } from '@/lib/free-video/pixel';
import type { FreeVideoLead } from '@/types/free-video';

const API_VERSION = process.env.META_API_VERSION?.trim() || 'v26.0';
const TIMEOUT_MS = 10_000;

/** The browser and click ids Facebook matches an event with. */
export interface MetaIds {
  fbc?: string;
  fbp?: string;
}

/** What the request itself says about the visitor. */
export interface RequestFacts {
  ip: string | null;
  userAgent: string | null;
  /** The page the request came from (the Referer header), or null. */
  referer: string | null;
  ids: MetaIds;
}

/** _fbc: fb.<subdomain index>.<creation ms>.<fbclid>; _fbp: fb.<subdomain index>.<creation ms>.<random number>. */
const FBC = /^fb\.[0-9]\.\d{10,13}\.[\w.-]{10,500}$/;
const FBP = /^fb\.[0-9]\.\d{10,13}\.\d{4,20}$/;
/** The shape the form accepts for ?fbclid= (FreeVideoLeadSchema). */
export const CLICK_ID = /^[\w.-]{10,500}$/;

/** EU and EEA members, the UK and Switzerland: no pixel and no Conversions API without a cookie banner. */
const CONSENT_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
]);

/** False for a visitor from a country that needs a cookie banner (by IP or by the browser's time zone). */
export function trackable(ip: string | null, timeZone?: string | null): boolean {
  if (europeanTimeZone(timeZone)) return false;
  const country = countryOfIp(ip);
  return !(country && CONSENT_COUNTRIES.has(country));
}

/** The test code from the environment, or ''. */
const testEventCode = () => process.env.META_TEST_EVENT_CODE?.trim() || '';

/** The owner's own test leads (OWNER_TEST_EMAILS, stored with ref 'owner-test'). */
const isOwnerTest = (lead: Pick<FreeVideoLead, 'email' | 'ref'>) => OWNER_TEST_EMAILS.includes(lead.email) || lead.ref === 'owner-test';

/** A lead whose events may go to Facebook: a visitor's, or with a test code any lead (they land in Test events only). */
const sendableLead = (lead: Pick<FreeVideoLead, 'email' | 'ref' | 'source'>) =>
  Boolean(testEventCode()) || (lead.source !== 'test' && !isOwnerTest(lead));

// ---------------------------------------------------------------------------------------------
// The ids
// ---------------------------------------------------------------------------------------------

/** One cookie's value from a Cookie header, or null. */
function cookieValue(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 0 || part.slice(0, at).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The ids of this request: the _fbc and _fbp cookies, which the pixel sets on bluefx.net and so reach app.bluefx.net.
 * A fresh fbclid from the page wins over an older _fbc (no pixel ran, or the cookie is from an earlier ad).
 */
export function metaIdsOf(req: Request, fbclid?: string | null): MetaIds {
  const header = req.headers.get('cookie') ?? '';
  const cookieFbc = cookieValue(header, '_fbc');
  const cookieFbp = cookieValue(header, '_fbp');
  const fbcOk = cookieFbc && FBC.test(cookieFbc) ? cookieFbc : undefined;
  const fresh = fbclid && CLICK_ID.test(fbclid) && !fbcOk?.endsWith(`.${fbclid}`) ? `fb.1.${Date.now()}.${fbclid}` : undefined;
  return {
    fbc: fresh ?? fbcOk,
    fbp: cookieFbp && FBP.test(cookieFbp) ? cookieFbp : undefined,
  };
}

/** The visitor facts of a request: IP (the caller's own reading), user agent, referer and the ids. */
export function requestFacts(req: Request, ip: string | null, fbclid?: string | null): RequestFacts {
  return {
    ip,
    userAgent: req.headers.get('user-agent')?.slice(0, 400) || null,
    referer: req.headers.get('referer'),
    ids: metaIdsOf(req, fbclid),
  };
}

/** Saves the ids on the lead (a 'meta_ids' event) for its later server events. Nothing to save, nothing written. */
async function saveIds(leadId: string, ids: MetaIds, placement: string): Promise<void> {
  if (!ids.fbc && !ids.fbp) return;
  await recordEvent({ event: 'meta_ids', leadId, placement, meta: { ...(ids.fbc ? { fbc: ids.fbc } : {}), ...(ids.fbp ? { fbp: ids.fbp } : {}) } });
}

/** The newest saved fbc and fbp of a lead (each from the newest row that has it). Never throws. */
async function savedIds(leadId: string): Promise<MetaIds> {
  try {
    const { data, error } = await eventsTable().select('meta').eq('lead_id', leadId).eq('event', 'meta_ids').order('at', { ascending: false }).limit(10);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as { meta: Record<string, unknown> | null }[]).map((row) => row.meta ?? {});
    const fbc = rows.map((m) => m.fbc).find((v): v is string => typeof v === 'string' && FBC.test(v));
    const fbp = rows.map((m) => m.fbp).find((v): v is string => typeof v === 'string' && FBP.test(v));
    return { ...(fbc ? { fbc } : {}), ...(fbp ? { fbp } : {}) };
  } catch (error) {
    console.warn('⚠️ [free-video] Meta ids of the lead not read:', String(error).slice(0, 160));
    return {};
  }
}

// ---------------------------------------------------------------------------------------------
// The event
// ---------------------------------------------------------------------------------------------

interface MetaUser {
  emails: (string | null | undefined)[];
  firstName?: string | null;
  /** The lead id: the same person on Lead, InitiateCheckout and Purchase. */
  externalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  ids: MetaIds;
}

interface MetaServerEvent {
  name: 'Lead' | 'InitiateCheckout' | 'Purchase';
  id: string;
  sourceUrl: string;
  user: MetaUser;
  custom: Record<string, unknown>;
  /** For the 'capi' row. */
  leadId?: string | null;
  placement?: string | null;
}

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const lower = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

/** Meta's customer information rules: lowercase, trimmed, names without punctuation, then SHA-256. Empty fields are left out. */
function userData(user: MetaUser): Record<string, unknown> {
  const emails = [...new Set(user.emails.map(lower).filter((email) => email.includes('@')))];
  const firstName = lower(user.firstName).replace(/[\p{P}\p{S}]/gu, '');
  const ip = user.ip && net.isIP(user.ip) ? user.ip : null;
  const country = lower(countryOfIp(ip));
  const data: Record<string, unknown> = {
    em: emails.length ? emails.map(sha256) : undefined,
    fn: firstName ? [sha256(firstName)] : undefined,
    country: /^[a-z]{2}$/.test(country) ? [sha256(country)] : undefined,
    external_id: user.externalId ? [sha256(user.externalId)] : undefined,
    client_ip_address: ip ?? undefined,
    client_user_agent: user.userAgent || undefined,
    fbc: user.ids.fbc,
    fbp: user.ids.fbp,
  };
  for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
  return data;
}

/** A page of ours for event_source_url, without a view token: the status pages are private links. */
function pageUrlOf(referer: string | null, fallbackPath: string): string {
  try {
    const url = new URL(referer ?? '');
    if (url.origin !== new URL(SITE_URL).origin && url.origin !== new URL(PROD_SITE_URL).origin) throw new Error('not ours');
    if (url.pathname.startsWith('/v/')) return `${SITE_URL}/v`;
    if (url.pathname.startsWith('/free-video-ad/thanks/')) return `${SITE_URL}/free-video-ad/thanks`;
    return `${SITE_URL}${url.pathname}`;
  } catch {
    return `${SITE_URL}${fallbackPath}`;
  }
}

let warnedNoToken = false;

/**
 * Sends one event to the BlueFx pixel's Conversions API and leaves a 'capi' row with the outcome. Off the live server
 * nothing is sent unless META_TEST_EVENT_CODE is set. Never throws; true when Facebook took the event.
 */
export async function sendMetaEvent(event: MetaServerEvent): Promise<boolean> {
  const testCode = testEventCode();
  if (!isLive() && !testCode) return false;
  const audit = (ok: boolean, error?: string) =>
    recordEvent({
      event: 'capi',
      leadId: event.leadId ?? null,
      placement: event.placement ?? null,
      meta: { name: event.name, id: event.id, ok, ...(testCode ? { test: true } : {}), ...(error ? { error: error.slice(0, 300) } : {}) },
    });
  const token = process.env.META_CAPI_TOKEN?.trim();
  if (!token) {
    if (!warnedNoToken) console.warn('⚠️ [free-video] META_CAPI_TOKEN is not set: the Conversions API events are skipped');
    warnedNoToken = true;
    await audit(false, 'META_CAPI_TOKEN is not set');
    return false;
  }
  const body = {
    data: [
      {
        event_name: event.name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.id,
        action_source: 'website',
        event_source_url: event.sourceUrl,
        user_data: userData(event.user),
        custom_data: event.custom,
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const answer = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string; code?: number } };
    if (!res.ok || !answer.events_received) {
      const reason = `Facebook answered ${res.status}: ${answer.error?.message ?? JSON.stringify(answer).slice(0, 200)}`;
      console.error(`❌ [free-video] Meta ${event.name} ${event.id} not taken: ${reason}`);
      await audit(false, reason);
      return false;
    }
    console.log(`✅ [free-video] Meta ${event.name} sent (${event.id}${testCode ? ', test event' : ''})`);
    await audit(true);
    return true;
  } catch (error) {
    const reason = `request failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ [free-video] Meta ${event.name} ${event.id}: ${reason}`);
    await audit(false, reason);
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// The three funnel events
// ---------------------------------------------------------------------------------------------

/** A free video ad request was queued: Lead, with the event id the browser got (leadEventId). Saves the lead's ids first. */
export async function trackLead(lead: FreeVideoLead, facts: RequestFacts, timeZone?: string | null): Promise<void> {
  try {
    if (!sendableLead(lead) || !trackable(facts.ip, timeZone)) return;
    await saveIds(lead.id, facts.ids, 'lead');
    await sendMetaEvent({
      name: 'Lead',
      id: leadEventId(lead.id),
      sourceUrl: pageUrlOf(facts.referer, '/free-video-ad'),
      leadId: lead.id,
      user: { emails: [lead.email], firstName: lead.first_name, externalId: lead.id, ip: facts.ip, userAgent: facts.userAgent, ids: facts.ids },
      custom: { ...PIXEL_DATA.lead },
    });
  } catch (error) {
    console.warn('⚠️ [free-video] trackLead failed:', String(error).slice(0, 160));
  }
}

/**
 * The click on the $99 unlock (/go/fvunlock): saves the ids of the browser that goes to the checkout, for the Purchase.
 * No event of its own.
 */
export async function rememberCheckoutIds(lead: FreeVideoLead, facts: RequestFacts, placement: string): Promise<void> {
  try {
    if (!sendableLead(lead) || !trackable(facts.ip) || !trackable(lead.ip)) return;
    await saveIds(lead.id, facts.ids, placement);
  } catch (error) {
    console.warn('⚠️ [free-video] rememberCheckoutIds failed:', String(error).slice(0, 160));
  }
}

/**
 * A click on the lifetime offer (/go/<placement>): InitiateCheckout. eventId is the page button's (?e=), else a new one
 * (email clicks). With a view token the lead's email, name and saved ids go along.
 */
export async function trackCheckout(input: { token: string | null; placement: string; eventId: string | null; facts: RequestFacts }): Promise<void> {
  try {
    const { facts } = input;
    if (!trackable(facts.ip)) return;
    const lead = input.token ? await getLeadByToken(input.token) : null;
    if (lead && (!sendableLead(lead) || !trackable(lead.ip))) return;
    const saved = lead ? await savedIds(lead.id) : {};
    await sendMetaEvent({
      name: 'InitiateCheckout',
      id: input.eventId && CHECKOUT_EVENT_ID.test(input.eventId) ? input.eventId : `fvic-${randomUUID()}`,
      sourceUrl: pageUrlOf(facts.referer, '/free-video-ad'),
      leadId: lead?.id ?? null,
      placement: input.placement,
      user: {
        emails: [lead?.email],
        firstName: lead?.first_name,
        externalId: lead?.id,
        ip: facts.ip,
        userAgent: facts.userAgent,
        ids: { fbc: facts.ids.fbc ?? saved.fbc, fbp: facts.ids.fbp ?? saved.fbp },
      },
      custom: { ...PIXEL_DATA.checkout, placement: input.placement },
    });
  } catch (error) {
    console.warn('⚠️ [free-video] trackCheckout failed:', String(error).slice(0, 160));
  }
}

/**
 * A paid $99 unlock (the FastSpring webhook): Purchase with the order's amount, the buyer's checkout IP and the click id
 * saved on the lead. FastSpring test orders never come here on the live server (unlock.ts refuses them).
 */
export async function trackPurchase(
  lead: FreeVideoLead,
  order: { id: string; amount: number | null; currency: string | null; email: string | null; ip: string | null }
): Promise<void> {
  try {
    if (!sendableLead(lead) || !trackable(lead.ip) || !trackable(order.ip)) return;
    const ids = await savedIds(lead.id);
    await sendMetaEvent({
      name: 'Purchase',
      id: purchaseEventId(order.id),
      sourceUrl: `${SITE_URL}/free-video-ad`,
      leadId: lead.id,
      placement: 'fvunlock',
      user: { emails: [lead.email, order.email], firstName: lead.first_name, externalId: lead.id, ip: order.ip ?? lead.ip, userAgent: lead.user_agent, ids },
      custom: {
        ...PIXEL_DATA.purchase,
        value: order.amount ?? Number(UNLOCK.price.replace(/[^\d.]/g, '')),
        currency: (order.currency || 'USD').toUpperCase(),
        content_ids: [UNLOCK.product],
        order_id: order.id,
      },
    });
  } catch (error) {
    console.warn('⚠️ [free-video] trackPurchase failed:', String(error).slice(0, 160));
  }
}
