/**
 * Offline checks for the free video ad's Facebook events (lib/free-video/meta.ts and pixel.ts): the click ids read from
 * a request, who is skipped (Europe, the owner's tests, test leads), and the exact Conversions API payloads of Lead,
 * InitiateCheckout and Purchase. It runs as the LIVE server would (NODE_ENV production, app.bluefx.net) with every
 * network call answered here: nothing reaches Facebook or the database.
 *
 * Run from app/:  npx tsx src/scripts/free-video-meta-checks.ts
 */
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env.local') });
// The live server's view of itself, with a fake token. No real token or test code may leak into this run.
Object.assign(process.env, { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://app.bluefx.net', META_CAPI_TOKEN: 'offline-check-token' });
delete process.env.META_TEST_EVENT_CODE;

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}

const sha = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex');

// ---------------------------------------------------------------------------------------------
// Every fetch is answered here
// ---------------------------------------------------------------------------------------------

interface Call {
  url: string;
  method: string;
  body: any;
}
const calls: Call[] = [];
let graphAnswer: { status: number; body: unknown } = { status: 200, body: { events_received: 1, fbtrace_id: 'offline' } };
let savedRows: { meta: Record<string, unknown> }[] = [];
let leadRow: Record<string, unknown> | null = null;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? 'GET').toUpperCase();
  let body: any = null;
  try {
    body = init?.body ? JSON.parse(String(init.body)) : null;
  } catch {
    body = init?.body ?? null;
  }
  calls.push({ url, method, body });
  if (url.startsWith('https://graph.facebook.com/')) return json(graphAnswer.status, graphAnswer.body);
  if (url.includes('/rest/v1/free_video_events') && method === 'POST') return json(201, null);
  if (url.includes('/rest/v1/free_video_events')) return json(200, savedRows);
  if (url.includes('/rest/v1/free_video_leads')) {
    const accept = new Headers(init?.headers).get('accept') ?? '';
    if (accept.includes('vnd.pgrst.object')) return leadRow ? json(200, leadRow) : json(406, { code: 'PGRST116', message: 'no rows' });
    return json(200, leadRow ? [leadRow] : []);
  }
  return json(404, { message: `offline check: no answer for ${method} ${url}` });
}) as typeof fetch;

const graphCalls = () => calls.filter((c) => c.url.startsWith('https://graph.facebook.com/'));
const inserts = (event: string) => calls.filter((c) => c.method === 'POST' && c.url.includes('/rest/v1/free_video_events') && JSON.stringify(c.body).includes(`"event":"${event}"`));
const reset = () => {
  calls.length = 0;
  graphAnswer = { status: 200, body: { events_received: 1, fbtrace_id: 'offline' } };
  savedRows = [];
  leadRow = null;
};

// ---------------------------------------------------------------------------------------------

const US_IP = '8.8.8.8';
const LEAD_ID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS]';
const FBCLID = 'IwZXh0bgNhZW0CMTAAAR2abcDEF_ghi-JKL123';
const COOKIE_FBC = 'fb.1.1791400000000.IwAR0oldclickid_abcdef';
const COOKIE_FBP = 'fb.1.1791300000000.1234567890';

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: LEAD_ID,
    created_at: '2026-10-08T10:00:00Z',
    updated_at: '2026-10-08T10:00:00Z',
    source: 'landing',
    ref: 'fb-FV-dave',
    first_name: 'Mary-Ann',
    email: 'Mary@Example.com'.toLowerCase(),
    email_key: 'mary@example.com',
    website_url: 'https://example.com/',
    website_domain: 'example.com',
    view_token: TOKEN,
    status: 'queued',
    ip: US_IP,
    user_agent: UA,
    unlock_status: 'none',
    ...overrides,
  } as any;
}

function request(cookies: string, extra: Record<string, string> = {}): Request {
  return new Request('https://app.bluefx.net/api/free-video', {
    method: 'POST',
    headers: { cookie: cookies, 'user-agent': UA, referer: `https://app.bluefx.net/free-video-ad?ref=fb-FV-dave&fbclid=${FBCLID}`, ...extra },
  });
}

async function main(): Promise<void> {
  const config = await import('@/lib/free-video/config');
  const geo = await import('@/lib/free-video/geo');
  const meta = await import('@/lib/free-video/meta');
  const pixel = await import('@/lib/free-video/pixel');

  console.log('== setup');
  check('runs as the live server', config.isLive());
  const countries = { [US_IP]: geo.countryOfIp(US_IP), '81.2.69.142': geo.countryOfIp('81.2.69.142'), '88.198.0.1': geo.countryOfIp('88.198.0.1') };
  console.log('      countries:', JSON.stringify(countries));
  check('8.8.8.8 is the US', countries[US_IP] === 'US');

  console.log('== click ids from a request');
  let ids = meta.metaIdsOf(request(`a=1; _fbc=${COOKIE_FBC}; _fbp=${COOKIE_FBP}`));
  check('the _fbc and _fbp cookies are read', ids.fbc === COOKIE_FBC && ids.fbp === COOKIE_FBP, JSON.stringify(ids));
  ids = meta.metaIdsOf(request(`_fbc=${COOKIE_FBC}; _fbp=${COOKIE_FBP}`), FBCLID);
  check('a fresh fbclid wins over an older _fbc', ids.fbc?.startsWith('fb.1.') === true && ids.fbc.endsWith(`.${FBCLID}`), JSON.stringify(ids));
  ids = meta.metaIdsOf(request(`_fbc=fb.1.1791400000000.${FBCLID}`), FBCLID);
  check('the same fbclid keeps the pixel cookie (its creation time)', ids.fbc === `fb.1.1791400000000.${FBCLID}`, JSON.stringify(ids));
  ids = meta.metaIdsOf(request('_fbc=junk; _fbp=fb.1.123.x'));
  check('malformed cookies are dropped', !ids.fbc && !ids.fbp, JSON.stringify(ids));
  ids = meta.metaIdsOf(request(''), 'short');
  check('a malformed fbclid is dropped', !ids.fbc, JSON.stringify(ids));

  console.log('== who is tracked');
  check('a US visitor', meta.trackable(US_IP, 'America/Chicago'));
  check('a European time zone is not', !meta.trackable(US_IP, 'Europe/London'));
  if (countries['81.2.69.142']) check(`an IP in ${countries['81.2.69.142']} is not`, !meta.trackable('81.2.69.142'));
  if (countries['88.198.0.1']) check(`an IP in ${countries['88.198.0.1']} is not`, !meta.trackable('88.198.0.1'));
  check('browser: Europe/Bucharest and Atlantic/Canary count as Europe', pixel.europeanTimeZone('Europe/Bucharest') && pixel.europeanTimeZone('Atlantic/Canary'));
  check('browser: America/New_York and Australia/Sydney do not', !pixel.europeanTimeZone('America/New_York') && !pixel.europeanTimeZone('Australia/Sydney'));
  check('the lifetime value is 297', pixel.LIFETIME_VALUE_USD === 297);

  console.log('== Lead');
  reset();
  let facts = meta.requestFacts(request(`_fbp=${COOKIE_FBP}`), US_IP, FBCLID);
  await meta.trackLead(lead(), facts, 'America/Chicago');
  let sent = graphCalls();
  check('one event to the pixel', sent.length === 1 && sent[0].url.includes(`/${pixel.META_PIXEL_ID}/events?access_token=`), String(sent.length));
  let event = sent[0]?.body?.data?.[0];
  check('Lead with the browser event id', event?.event_name === 'Lead' && event?.event_id === pixel.leadEventId(LEAD_ID), JSON.stringify(event?.event_id));
  check('website source, landing URL without a token', event?.action_source === 'website' && event?.event_source_url === 'https://app.bluefx.net/free-video-ad', event?.event_source_url);
  check('email and first name hashed the Meta way', event?.user_data?.em?.[0] === sha('mary@example.com') && event?.user_data?.fn?.[0] === sha('maryann'));
  check('country, external id, IP, user agent', event?.user_data?.country?.[0] === sha('us') && event?.user_data?.external_id?.[0] === sha(LEAD_ID) && event?.user_data?.client_ip_address === US_IP && event?.user_data?.client_user_agent === UA);
  check('click id from the fbclid, browser id from the cookie', event?.user_data?.fbc?.endsWith(`.${FBCLID}`) && event?.user_data?.fbp === COOKIE_FBP, JSON.stringify(event?.user_data));
  check('no test code on the live server', sent[0]?.body?.test_event_code === undefined);
  check('custom data', event?.custom_data?.content_name === 'Free video ad');
  check('the ids are saved on the lead', inserts('meta_ids').length === 1 && inserts('meta_ids')[0].body?.lead_id === LEAD_ID);
  check('the send is logged as a capi row', inserts('capi').length === 1 && inserts('capi')[0].body?.meta?.ok === true);

  reset();
  await meta.trackLead(lead(), facts, 'Europe/London');
  check('a European visitor: nothing sent, nothing saved', graphCalls().length === 0 && calls.length === 0);
  reset();
  await meta.trackLead(lead({ email: 'contact@bluefx.net', ref: 'owner-test' }), facts);
  check("the owner's test: nothing sent", graphCalls().length === 0);
  reset();
  await meta.trackLead(lead({ source: 'test' }), facts);
  check('a test lead: nothing sent', graphCalls().length === 0);
  reset();
  process.env.META_TEST_EVENT_CODE = 'TEST12345';
  await meta.trackLead(lead({ email: 'contact@bluefx.net', ref: 'owner-test' }), facts);
  sent = graphCalls();
  check("with a test code the owner's test goes to Test events", sent.length === 1 && sent[0].body?.test_event_code === 'TEST12345');
  delete process.env.META_TEST_EVENT_CODE;

  console.log('== InitiateCheckout');
  reset();
  leadRow = lead({ status: 'done' });
  savedRows = [{ meta: { fbc: `fb.1.1791400000000.${FBCLID}`, fbp: COOKIE_FBP } }];
  const browserId = pixel.newCheckoutEventId();
  facts = meta.requestFacts(request('', { referer: `https://app.bluefx.net/v/${TOKEN}` }), US_IP);
  await meta.trackCheckout({ token: TOKEN, placement: 'fvpage', eventId: browserId, facts });
  sent = graphCalls();
  event = sent[0]?.body?.data?.[0];
  check('InitiateCheckout with the button event id', sent.length === 1 && event?.event_name === 'InitiateCheckout' && event?.event_id === browserId, JSON.stringify(event?.event_id));
  check('the page URL leaves the view token out', event?.event_source_url === 'https://app.bluefx.net/v', event?.event_source_url);
  check('the saved click id fills in (an email click has no cookie)', event?.user_data?.fbc === `fb.1.1791400000000.${FBCLID}` && event?.user_data?.fbp === COOKIE_FBP);
  check('value 297 USD and the placement', event?.custom_data?.value === 297 && event?.custom_data?.currency === 'USD' && event?.custom_data?.placement === 'fvpage');
  check('the lead email goes along', event?.user_data?.em?.[0] === sha('mary@example.com'));

  reset();
  facts = meta.requestFacts(request(`_fbp=${COOKIE_FBP}`), US_IP);
  await meta.trackCheckout({ token: null, placement: 'fvland', eventId: 'fvic-<script>', facts });
  event = graphCalls()[0]?.body?.data?.[0];
  check('without a lead: still sent, a bad ?e= replaced by a new id', /^fvic-[0-9a-f-]{36}$/.test(event?.event_id ?? '') && !event?.user_data?.em, JSON.stringify(event?.event_id));

  reset();
  leadRow = lead({ status: 'done', email: 'contact@bluefx.net', ref: 'owner-test' });
  await meta.trackCheckout({ token: TOKEN, placement: 'fvpage', eventId: browserId, facts });
  check("the owner's test lead's click: nothing sent", graphCalls().length === 0);

  console.log('== the $99 unlock click and the Purchase');
  reset();
  facts = meta.requestFacts(request(`_fbc=${COOKIE_FBC}; _fbp=${COOKIE_FBP}`), US_IP);
  await meta.rememberCheckoutIds(lead({ status: 'done' }), facts, 'fvunlock');
  check('the unlock click saves the checkout browser ids', inserts('meta_ids').length === 1 && inserts('meta_ids')[0].body?.meta?.fbc === COOKIE_FBC && graphCalls().length === 0);

  reset();
  savedRows = [{ meta: { fbc: COOKIE_FBC } }, { meta: { fbc: `fb.1.1791300000000.${FBCLID}`, fbp: COOKIE_FBP } }];
  await meta.trackPurchase(lead({ status: 'done', unlock_status: 'paid' }), { id: 'BLU261008-1234-56789', amount: 99, currency: 'USD', email: 'billing@example.com', ip: '8.8.4.4' });
  sent = graphCalls();
  event = sent[0]?.body?.data?.[0];
  check('Purchase with the order id as event id', sent.length === 1 && event?.event_name === 'Purchase' && event?.event_id === 'fvunlock-BLU261008-1234-56789', JSON.stringify(event?.event_id));
  check('value 99 USD, order id, product', event?.custom_data?.value === 99 && event?.custom_data?.currency === 'USD' && event?.custom_data?.order_id === 'BLU261008-1234-56789' && event?.custom_data?.content_ids?.[0] === 'video-creation');
  check('the newest saved click id, the older browser id', event?.user_data?.fbc === COOKIE_FBC && event?.user_data?.fbp === COOKIE_FBP, JSON.stringify(event?.user_data));
  check('both emails, the checkout IP, the lead user agent', event?.user_data?.em?.length === 2 && event?.user_data?.client_ip_address === '8.8.4.4' && event?.user_data?.client_user_agent === UA);
  check('the purchase is logged', inserts('capi').length === 1 && inserts('capi')[0].body?.placement === 'fvunlock');

  console.log('== failures stay quiet');
  reset();
  graphAnswer = { status: 400, body: { error: { message: 'Invalid parameter', code: 100 } } };
  const ok = await meta.sendMetaEvent({ name: 'Lead', id: 'fvlead-x', sourceUrl: 'https://app.bluefx.net/free-video-ad', user: { emails: [], ids: {} }, custom: {} });
  check('a refusal returns false and is logged with the reason', !ok && inserts('capi')[0]?.body?.meta?.ok === false && String(inserts('capi')[0]?.body?.meta?.error).includes('Invalid parameter'));
  reset();
  delete process.env.META_CAPI_TOKEN;
  const noToken = await meta.sendMetaEvent({ name: 'Lead', id: 'fvlead-y', sourceUrl: 'https://app.bluefx.net/free-video-ad', user: { emails: [], ids: {} }, custom: {} });
  check('no token: nothing sent, logged once as a capi row', !noToken && graphCalls().length === 0 && String(inserts('capi')[0]?.body?.meta?.error).includes('META_CAPI_TOKEN'));

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
