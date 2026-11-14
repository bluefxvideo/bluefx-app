/**
 * Offline checks for the ClickBank affiliate funnel's core (docs/cb-affiliate-funnel.md sections 1, 2 and 8): the funnel
 * tags (funnel.ts funnelRef, ownerTestRef, isOwnerTestRef, funnelOf, cbAffiliateNick, cbRefFor, affiliateOfRef), the
 * offer (offer-switch.ts offerOf), the tag the browser sends (use-free-video-beacon.ts refTagFromUrl), the view fields
 * (leads.ts toView), the block switch (cb-affiliates.ts), createLead's blocked-affiliate branch and the Facebook gate
 * (meta.ts). The three old funnels are compared with a verbatim copy of the code before this change: every tag without
 * 'cbaff-' must get exactly the old answer.
 *
 * No database and no network: no .env file is read, the Supabase address is a fake one, every fetch is answered here
 * and DNS answers "not found".
 *
 * Run from app/:  npx tsx src/scripts/cb-funnel-ref-checks.ts
 */
import dns from 'node:dns';
import Module, { createRequire } from 'node:module';
import type { FreeVideoLead, FreeVideoLeadInput } from '@/types/free-video';

// Fake endpoints and keys only: nothing in this run may reach a real service.
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://offline-check.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'offline-check-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'offline-check-service-key',
});
for (const key of ['META_TEST_EVENT_CODE', 'META_CAPI_TOKEN', 'MAILERLITE_API_KEY', 'CLICKBANK_CLERK_KEY', 'APP_CLICKBANK_CLERK_KEY']) delete process.env[key];

// The website pre-check resolves names with dns.promises.Resolver (safe-fetch.ts): every answer is "not found".
const noDns = async () => {
  throw Object.assign(new Error('offline check: no DNS'), { code: dns.NOTFOUND });
};
dns.promises.Resolver.prototype.resolve4 = noDns as any;
dns.promises.Resolver.prototype.resolve6 = noDns as any;

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}
const section = (title: string) => console.log(`\n== ${title}`);
const show = (value: unknown) => (value === undefined ? 'undefined' : JSON.stringify(value));

// ---------------------------------------------------------------------------------------------
// Every fetch is answered here
// ---------------------------------------------------------------------------------------------

interface Call {
  url: URL;
  method: string;
  body: any;
  accept: string;
  prefer: string;
}
type Handler = (call: Call) => Response | undefined;
const calls: Call[] = [];
let handler: Handler = () => undefined;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers = new Headers(init?.headers);
  let body: any = null;
  try {
    body = init?.body ? JSON.parse(String(init.body)) : null;
  } catch {
    body = init?.body ?? null;
  }
  const call: Call = { url: new URL(href), method: (init?.method ?? 'GET').toUpperCase(), body, accept: headers.get('accept') ?? '', prefer: headers.get('prefer') ?? '' };
  calls.push(call);
  return handler(call) ?? json(404, { message: `offline check: no answer for ${call.method} ${href}` });
}) as typeof fetch;

const onTable = (call: Call, table: string) => call.url.pathname === `/rest/v1/${table}`;
const isRpc = (call: Call) => call.url.pathname === '/rest/v1/rpc/create_free_video_lead';
const reset = (next: Handler = () => undefined) => {
  calls.length = 0;
  handler = next;
};

// ---------------------------------------------------------------------------------------------
// The code before the ClickBank funnel (origin/main 1c845d01), copied verbatim: the reference for "unchanged"
// ---------------------------------------------------------------------------------------------

const LEGACY = {
  isServiceRef: (ref: string | null | undefined): boolean => typeof ref === 'string' && ref.startsWith('svc-'),
  ownerTestRef: (ref: string | null | undefined): string => (LEGACY.isServiceRef(ref) ? 'svc-owner-test' : 'owner-test'),
  isOwnerTestRef: (ref: string | null | undefined): boolean => {
    const tag = ref?.trim();
    return tag === 'owner-test' || tag === 'svc-owner-test';
  },
  isServiceLandingPath: (pathname: string): boolean => pathname === '/free-ad' || pathname.startsWith('/free-ad/'),
  funnelRef(raw: string | undefined, pathname: string): string | undefined {
    const clean = raw && LEGACY.isServiceRef(raw) ? raw.slice('svc-'.length) : raw;
    if (!LEGACY.isServiceLandingPath(pathname)) return clean || undefined;
    return `svc-${clean || 'direct'}`.slice(0, 60);
  },
  offerOf: (ref: string | null | undefined, sw: { offer: string } | null | undefined): string => (sw ? sw.offer : LEGACY.isServiceRef(ref) ? 'video' : 'machine'),
};

/** Deterministic random tags (mulberry32), heavy on the letters of both prefixes so near-misses come up often. */
function randomTags(count: number, seed: number): string[] {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const heads = ['', '', '', 'svc-', 'cbaff-', 'svc-svc-', 'svc-cbaff-', 'cbaff-svc-', 'cbaff-cbaff-', 'svc-cbaff-cbaff-', 'CBAFF-', 'cbaff', 'cbaf-', 'svc', ' ', 'owner-test', 'fb-'];
  const letters = 'cbafsv-_.x19ABZ ';
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let tag = heads[Math.floor(next() * heads.length)];
    const length = Math.floor(next() * 64);
    for (let j = 0; j < length; j++) tag += letters[Math.floor(next() * letters.length)];
    out.push(tag);
  }
  return out;
}

/**
 * A stand-in for a package this checkout's node_modules does not have yet (true when one was put in). Used for maxmind,
 * which geo.ts loads at import (meta.ts imports geo.ts): every lead in these checks has ip null, so countryOfIp answers
 * before any lookup and the stand-in is never called. With the package installed, the real one loads.
 */
function standInWhenMissing(name: string, standIn: Record<string, unknown>): boolean {
  try {
    createRequire(`${process.cwd()}/`).resolve(name);
    return false;
  } catch {
    const loader = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
    const load = loader._load;
    loader._load = function (this: unknown, request: string, ...rest: unknown[]) {
      return request === name ? standIn : load.call(this, request, ...rest);
    };
    return true;
  }
}

function stripCb(tag: string): string {
  let out = tag;
  while (out.startsWith('cbaff-')) out = out.slice('cbaff-'.length);
  return out;
}

function leadRow(overrides: Partial<FreeVideoLead>): FreeVideoLead {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    created_at: '2026-11-14T10:00:00.000Z',
    updated_at: '2026-11-14T10:00:00.000Z',
    source: 'landing',
    ref: null,
    first_name: 'Joe',
    email: 'joe@example.com',
    email_key: 'joe@example.com',
    website_url: 'https://joes-plumbing-offline-check.com/',
    website_domain: 'joes-plumbing-offline-check.com',
    view_token: 'AbCdEfGhIjKlMnOpQrStUv',
    status: 'rejected',
    reason: null,
    attempts: 0,
    not_before: null,
    job_id: null,
    job_ids: [],
    claimed_at: null,
    finished_at: null,
    video_url: null,
    duration_seconds: null,
    look: null,
    gate: null,
    photos: null,
    live: null,
    est_cost_usd: 0,
    reserved_usd: 0,
    email_status: 'pending',
    email_claimed_at: null,
    email_attempts: 0,
    emailed_at: null,
    ml_status: null,
    first_viewed_at: null,
    played_at: null,
    clicked_at: null,
    bought_at: null,
    sale_ref: null,
    is_customer: false,
    ip: null,
    user_agent: null,
    consent_at: null,
    unlock_status: 'none',
    unlock_order_id: null,
    unlock_amount: null,
    unlock_currency: null,
    unlocked_at: null,
    clean_video_url: null,
    clean_attempts: 0,
    clean_claimed_at: null,
    clean_ready_at: null,
    unlock_emailed_at: null,
    ...overrides,
  };
}

async function main() {
  const funnel = await import('@/lib/free-video/funnel');
  const { funnelRef, ownerTestRef, isOwnerTestRef, funnelOf, cbAffiliateNick, cbRefFor, affiliateOfRef, isClickBankRef, isClickBankLandingPath, isServiceRef } = funnel;
  const { offerOf } = await import('@/lib/free-video/offer-switch');
  const { FREE_VIDEO_REF_PATTERN } = await import('@/types/free-video');

  // 1. -----------------------------------------------------------------------------------------
  section('1. funnelRef: the cases the spec names');
  const ref = (raw: string | undefined, pathname: string, affiliate?: string | null) => funnelRef(raw, pathname, affiliate);
  const cases: Array<[string, string | undefined, string | undefined]> = [
    ["(undefined, '/free-video-ad') → undefined", ref(undefined, '/free-video-ad'), undefined],
    ["('fb-1-x', '/free-video-ad') → 'fb-1-x'", ref('fb-1-x', '/free-video-ad'), 'fb-1-x'],
    ["('fb-1', '/free-ad') → 'svc-fb-1'", ref('fb-1', '/free-ad'), 'svc-fb-1'],
    ["('svc-x', '/free-video-ad') → 'x'", ref('svc-x', '/free-video-ad'), 'x'],
    ["(undefined, '/free-ad') → 'svc-direct'", ref(undefined, '/free-ad'), 'svc-direct'],
    ["('cbaff-x', '/free-video-ad') → 'x'", ref('cbaff-x', '/free-video-ad'), 'x'],
    ["CB page, ?affiliate=JohnDoe1 → 'cbaff-johndoe1'", ref(undefined, '/your-video-ad', 'JohnDoe1'), 'cbaff-johndoe1'],
    ["CB page, ?affiliate=bad-nick! → 'cbaff-no-affiliate'", ref(undefined, '/your-video-ad', 'bad-nick!'), 'cbaff-no-affiliate'],
  ];
  for (const [name, got, want] of cases) check(name, got === want, `got ${show(got)}`);

  section('1b. funnelRef: more ClickBank cases');
  const more: Array<[string, string | undefined, string | undefined]> = [
    ["CB page ignores ?ref: ('fb-1', ?affiliate=JohnDoe1) → 'cbaff-johndoe1'", ref('fb-1', '/your-video-ad', 'JohnDoe1'), 'cbaff-johndoe1'],
    ["CB page ignores ?ref: ('svc-x', no affiliate) → 'cbaff-no-affiliate'", ref('svc-x', '/your-video-ad'), 'cbaff-no-affiliate'],
    ["CB page: a hand-made ?ref=cbaff-evil does not choose the affiliate", ref('cbaff-evil', '/your-video-ad', 'JohnDoe1'), 'cbaff-johndoe1'],
    ["CB page: ?affiliate= empty → 'cbaff-no-affiliate'", ref(undefined, '/your-video-ad', ''), 'cbaff-no-affiliate'],
    ["CB page: ?affiliate= null → 'cbaff-no-affiliate'", ref(undefined, '/your-video-ad', null), 'cbaff-no-affiliate'],
    ["CB page: 31 characters → 'cbaff-no-affiliate'", ref(undefined, '/your-video-ad', 'a'.repeat(31)), 'cbaff-no-affiliate'],
    ["CB page: 30 characters kept", ref(undefined, '/your-video-ad', 'A'.repeat(30)), `cbaff-${'a'.repeat(30)}`],
    ["CB page: spaces around the nickname are trimmed", ref(undefined, '/your-video-ad', ' John_Doe1 '), 'cbaff-john_doe1'],
    ["CB page: 'john doe' → 'cbaff-no-affiliate'", ref(undefined, '/your-video-ad', 'john doe'), 'cbaff-no-affiliate'],
    ["CB page with a trailing slash counts as the CB page", ref(undefined, '/your-video-ad/', 'JohnDoe1'), 'cbaff-johndoe1'],
    ["'/your-video-adx' is not the CB page", ref('fb-1', '/your-video-adx', 'JohnDoe1'), 'fb-1'],
    ["('cbaff-x', '/free-ad') → 'svc-x'", ref('cbaff-x', '/free-ad'), 'svc-x'],
    ["('cbaff-svc-x', '/free-video-ad') → 'x'", ref('cbaff-svc-x', '/free-video-ad'), 'x'],
    ["('cbaff-cbaff-x', '/free-video-ad') → 'x'", ref('cbaff-cbaff-x', '/free-video-ad'), 'x'],
    ["('svc-cbaff-x', '/free-video-ad') → 'x' (the one tag whose old answer would now mean the ClickBank funnel)", ref('svc-cbaff-x', '/free-video-ad'), 'x'],
    ["('svc-cbaff-x', '/free-ad') → 'svc-cbaff-x' (unchanged: it stays in the service funnel)", ref('svc-cbaff-x', '/free-ad'), 'svc-cbaff-x'],
    ["('cbaff-', '/free-video-ad') → undefined", ref('cbaff-', '/free-video-ad'), undefined],
    ["('cbaff-', '/free-ad') → 'svc-direct'", ref('cbaff-', '/free-ad'), 'svc-direct'],
    ["?affiliate= is ignored off the CB page: ('fb-1', '/free-video-ad', 'JohnDoe1') → 'fb-1'", ref('fb-1', '/free-video-ad', 'JohnDoe1'), 'fb-1'],
  ];
  for (const [name, got, want] of more) check(name, got === want, `got ${show(got)}`);
  const longest = cbRefFor('z'.repeat(30));
  check(`the longest ClickBank tag (${longest.length} characters) passes the server's and the browser's ref patterns`, longest.length <= 60 && FREE_VIDEO_REF_PATTERN.test(longest) && /^[\w.-]{1,60}$/.test(longest));
  check("'cbaff-no-affiliate' and 'cbaff-owner-test' pass the ref patterns", ['cbaff-no-affiliate', 'cbaff-owner-test'].every((tag) => FREE_VIDEO_REF_PATTERN.test(tag) && /^[\w.-]{1,60}$/.test(tag)));

  // 2. -----------------------------------------------------------------------------------------
  section('2. funnelRef against the old code (every tag without cbaff-, every page but the CB page)');
  const tags = [
    ...randomTags(6000, 20261114),
    'fb-120212345678-Facebook_Mobile_Feed',
    'fb-1-x',
    'bfxhome',
    'emrescue',
    'newsletter.2026-11',
    'svc-',
    'svc-x',
    'svc-svc-x',
    'svc-direct',
    'svc-owner-test',
    'owner-test',
    'x'.repeat(60),
    `svc-${'b'.repeat(56)}`,
    'Svc-x',
    'cbaffx',
    'cb-x',
    'CBAFF-x',
    '-',
    '.',
    '_',
  ];
  const otherPages = ['/free-video-ad', '/free-ad', '/free-ad/', '/free-ad/x', '/free-adx', '/free-video-ad/thanks/AbCdEfGhIjKlMnOpQrStUv', '/v/AbCdEfGhIjKlMnOpQrStUv', '/', '', '/your-video', '/your-video-adx', '/weekly-video-plan-99'];
  const affiliates: Array<string | null | undefined> = [undefined, null, 'JohnDoe1', 'bad-nick!'];
  let compared = 0;
  let deviations = 0;
  const mismatches: string[] = [];
  for (const raw of [undefined, '', ...tags]) {
    for (const pathname of otherPages) {
      for (const affiliate of affiliates) {
        const got = funnelRef(raw, pathname, affiliate);
        if (got !== undefined && got.startsWith('cbaff-')) mismatches.push(`${show(raw)} on ${show(pathname)} → ${show(got)} (a ClickBank tag off the CB page)`);
        if (raw?.startsWith('cbaff-')) continue;
        const old = LEGACY.funnelRef(raw, pathname);
        compared++;
        // Only an old answer that starts with 'cbaff-' (a hand-made 'svc-cbaff-…' off the service page) changes: it loses that prefix.
        const want = old !== undefined && old.startsWith('cbaff-') ? stripCb(old) || undefined : old;
        if (want !== old) deviations++;
        if (got !== want) mismatches.push(`${show(raw)} on ${show(pathname)} (affiliate ${show(affiliate)}) → ${show(got)}, old code ${show(old)}`);
      }
    }
  }
  check(`${compared} answers equal the old code's (${deviations} documented 'svc-cbaff-…' cases lose the ClickBank prefix)`, mismatches.length === 0, mismatches.slice(0, 5).join(' | '));
  const cbPageWrong = [undefined, '', ...tags].filter((raw) => affiliates.some((affiliate) => funnelRef(raw, '/your-video-ad', affiliate) !== `cbaff-${cbAffiliateNick(affiliate) ?? 'no-affiliate'}`));
  check('on the CB page every ?ref gives cbRefFor(?affiliate=)', cbPageWrong.length === 0, cbPageWrong.slice(0, 3).map(show).join(', '));

  // 3. -----------------------------------------------------------------------------------------
  section('3. ownerTestRef / isOwnerTestRef');
  check("ownerTestRef('cbaff-johndoe1') → 'cbaff-owner-test'", ownerTestRef('cbaff-johndoe1') === 'cbaff-owner-test', ownerTestRef('cbaff-johndoe1'));
  check("ownerTestRef('cbaff-no-affiliate') → 'cbaff-owner-test'", ownerTestRef('cbaff-no-affiliate') === 'cbaff-owner-test');
  check("ownerTestRef('svc-x') → 'svc-owner-test'", ownerTestRef('svc-x') === 'svc-owner-test', ownerTestRef('svc-x'));
  check("ownerTestRef('fb-1') → 'owner-test'", ownerTestRef('fb-1') === 'owner-test', ownerTestRef('fb-1'));
  check("ownerTestRef(undefined) and (null) → 'owner-test'", ownerTestRef(undefined) === 'owner-test' && ownerTestRef(null) === 'owner-test');
  check("isOwnerTestRef knows all three owner test tags", ['owner-test', 'svc-owner-test', 'cbaff-owner-test', ' cbaff-owner-test '].every((tag) => isOwnerTestRef(tag)));
  check("isOwnerTestRef: 'cbaff-johndoe1', 'cbaff-no-affiliate', 'fb-1' and null are not owner tests", !['cbaff-johndoe1', 'cbaff-no-affiliate', 'fb-1', null].some((tag) => isOwnerTestRef(tag)));
  const ownerWrong = [undefined, null, '', ...tags].filter(
    (raw) => (!raw?.startsWith('cbaff-') && ownerTestRef(raw) !== LEGACY.ownerTestRef(raw)) || (raw?.trim() !== 'cbaff-owner-test' && isOwnerTestRef(raw) !== LEGACY.isOwnerTestRef(raw))
  );
  check('ownerTestRef and isOwnerTestRef equal the old code for every other tag', ownerWrong.length === 0, ownerWrong.slice(0, 3).map(show).join(', '));

  // 4. -----------------------------------------------------------------------------------------
  section('4. offerOf');
  const offerCases: Array<[string | null, string]> = [
    [null, 'machine'],
    ['fb-1', 'machine'],
    ['bfxhome', 'machine'],
    ['owner-test', 'machine'],
    ['svc-fb-1', 'video'],
    ['svc-owner-test', 'video'],
    ['cbaff-x', 'video'],
    ['cbaff-no-affiliate', 'video'],
    ['cbaff-owner-test', 'video'],
  ];
  for (const [tag, want] of offerCases) {
    const got = offerOf({ ref: tag }, null);
    check(`offerOf(${show(tag)}) → '${want}'`, got === want, `got ${got}`);
  }
  check("an owner's switch still wins for a ClickBank lead", offerOf({ ref: 'cbaff-x' }, { offer: 'machine', at: new Date() }) === 'machine');
  const switches = [null, undefined, { offer: 'machine' as const, at: new Date() }, { offer: 'service' as const, at: new Date() }, { offer: 'video' as const, at: new Date() }];
  const offerWrong = [null, '', ...tags].filter((tag) => !tag?.startsWith('cbaff-') && switches.some((sw) => offerOf({ ref: tag }, sw) !== LEGACY.offerOf(tag, sw)));
  check('offerOf equals the old code for every tag without cbaff-, with and without a switch', offerWrong.length === 0, offerWrong.slice(0, 3).map(show).join(', '));

  // 5. -----------------------------------------------------------------------------------------
  section('5. funnelOf, cbAffiliateNick, cbRefFor, affiliateOfRef, isClickBankLandingPath');
  const funnelCases: Array<[string | null | undefined, string]> = [
    [null, 'app'],
    [undefined, 'app'],
    ['fb-1', 'app'],
    ['bfxhome', 'app'],
    ['owner-test', 'app'],
    ['svc-x', 'service'],
    ['svc-owner-test', 'service'],
    ['svc-cbaff-x', 'service'],
    ['cbaff-x', 'cb'],
    ['cbaff-no-affiliate', 'cb'],
    ['cbaff-owner-test', 'cb'],
    ['CBAFF-x', 'app'],
  ];
  for (const [tag, want] of funnelCases) check(`funnelOf(${show(tag)}) → '${want}'`, funnelOf(tag) === want, `got ${funnelOf(tag)}`);
  const funnelWrong = [null, '', ...tags].filter((tag) => funnelOf(tag) !== (isClickBankRef(tag) ? 'cb' : isServiceRef(tag) ? 'service' : 'app'));
  check('funnelOf: cb before service before app for every tag', funnelWrong.length === 0, funnelWrong.slice(0, 3).map(show).join(', '));
  const nickCases: Array<[string | null | undefined, string | null]> = [
    ['JohnDoe1', 'johndoe1'],
    [' JohnDoe1 ', 'johndoe1'],
    ['john_doe', 'john_doe'],
    ['a'.repeat(30), 'a'.repeat(30)],
    ['a'.repeat(31), null],
    ['bad-nick!', null],
    ['no-affiliate', null],
    ['owner-test', null],
    ['john doe', null],
    ['', null],
    [null, null],
    [undefined, null],
  ];
  for (const [raw, want] of nickCases) check(`cbAffiliateNick(${show(raw)}) → ${show(want)}`, cbAffiliateNick(raw) === want, `got ${show(cbAffiliateNick(raw))}`);
  check("cbRefFor('JohnDoe1') → 'cbaff-johndoe1', cbRefFor(null) → 'cbaff-no-affiliate'", cbRefFor('JohnDoe1') === 'cbaff-johndoe1' && cbRefFor(null) === 'cbaff-no-affiliate');
  check('CB_NO_AFFILIATE and CB_REF_PREFIX are the spec values', funnel.CB_NO_AFFILIATE === 'no-affiliate' && funnel.CB_REF_PREFIX === 'cbaff-' && funnel.CB_LANDING_PATH === '/your-video-ad');
  const affCases: Array<[string | null | undefined, string | null]> = [
    ['cbaff-johndoe1', 'johndoe1'],
    ['cbaff-no-affiliate', null],
    ['cbaff-owner-test', null],
    ['cbaff-', null],
    ['svc-x', null],
    ['svc-cbaff-johndoe1', null],
    ['fb-1', null],
    ['johndoe1', null],
    [null, null],
    [undefined, null],
  ];
  for (const [tag, want] of affCases) check(`affiliateOfRef(${show(tag)}) → ${show(want)}`, affiliateOfRef(tag) === want, `got ${show(affiliateOfRef(tag))}`);
  check(
    'isClickBankLandingPath: /your-video-ad and below only',
    isClickBankLandingPath('/your-video-ad') && isClickBankLandingPath('/your-video-ad/') && !isClickBankLandingPath('/your-video-adx') && !isClickBankLandingPath('/free-video-ad') && !isClickBankLandingPath('/free-ad')
  );

  // 6. -----------------------------------------------------------------------------------------
  section('6. refTagFromUrl: the tag the page events and the form carry');
  const { refTagFromUrl } = await import('@/hooks/use-free-video-beacon');
  const at = (address: string) => {
    const url = new URL(address, 'https://app.bluefx.net');
    (globalThis as any).window = { location: { search: url.search, pathname: url.pathname } };
    const tag = refTagFromUrl();
    delete (globalThis as any).window;
    return tag;
  };
  const urlCases: Array<[string, string | undefined]> = [
    ['/your-video-ad?affiliate=JohnDoe1&ref=fb-1', 'cbaff-johndoe1'],
    ['/your-video-ad?affiliate=JohnDoe1&hopId=abc123&utm_campaign=x', 'cbaff-johndoe1'],
    ['/your-video-ad', 'cbaff-no-affiliate'],
    ['/your-video-ad?shield=abc123', 'cbaff-no-affiliate'],
    ['/free-video-ad?ref=fb-1-x&affiliate=bluefx01', 'fb-1-x'],
    ['/free-video-ad?affiliate=JohnDoe1', undefined],
    ['/free-video-ad?ref=cbaff-johndoe1', 'johndoe1'],
    ['/free-ad?affiliate=JohnDoe1', 'svc-direct'],
    ['/free-ad?ref=fb-9', 'svc-fb-9'],
  ];
  for (const [address, want] of urlCases) {
    const got = at(address);
    check(`${address} → ${show(want)}`, got === want, `got ${show(got)}`);
  }

  // 7. -----------------------------------------------------------------------------------------
  section('7. toView: funnel and affiliate on the view (rejected leads: no database read)');
  const { createLead, toView } = await import('@/lib/free-video/leads');
  reset();
  const viewOf = (tag: string | null) => toView(leadRow({ ref: tag }), null);
  const cbView = await viewOf('cbaff-johndoe1');
  check("'cbaff-johndoe1': funnel 'cb', affiliate 'johndoe1', the $49 page", cbView.funnel === 'cb' && cbView.affiliate === 'johndoe1' && cbView.videoOffer === true && !cbView.service, show(cbView));
  const noAffView = await viewOf('cbaff-no-affiliate');
  check("'cbaff-no-affiliate': funnel 'cb', no affiliate field", noAffView.funnel === 'cb' && !('affiliate' in noAffView) && noAffView.videoOffer === true, show(noAffView));
  const ownerView = await viewOf('cbaff-owner-test');
  check("'cbaff-owner-test': funnel 'cb', no affiliate field", ownerView.funnel === 'cb' && !('affiliate' in ownerView));
  const svcView = await viewOf('svc-fb-1');
  check("'svc-fb-1': funnel 'service', no affiliate, the $49 page as before", svcView.funnel === 'service' && !('affiliate' in svcView) && svcView.videoOffer === true);
  const appView = await viewOf('fb-1');
  check("'fb-1': funnel 'app', no affiliate, no $49 page", appView.funnel === 'app' && !('affiliate' in appView) && !('videoOffer' in appView) && !('service' in appView));
  const nullView = await viewOf(null);
  check("ref null: funnel 'app'", nullView.funnel === 'app' && !('affiliate' in nullView));
  check('the view still says unreadable for a rejected lead and carries no reason', cbView.state === 'unreadable' && !('reason' in cbView));
  check('toView of a rejected lead read nothing from the database', calls.length === 0, `${calls.length} requests`);

  // 8. -----------------------------------------------------------------------------------------
  section('8. cb-affiliates.ts: the block switch (every request answered here)');
  const cb = await import('@/lib/free-video/cb-affiliates');
  check("CB_BLOCKED_REASON_PREFIX is 'Affiliate blocked: '", cb.CB_BLOCKED_REASON_PREFIX === 'Affiliate blocked: ');
  const switchRows = new Map<string, string>();
  const switchAnswers: Handler = (call) => {
    if (!onTable(call, 'free_video_cb_affiliates')) return undefined;
    if (call.method === 'GET') {
      const nick = call.url.searchParams.get('nickname')?.replace(/^eq\./, '') ?? '';
      return json(200, switchRows.has(nick) ? [{ status: switchRows.get(nick) }] : []);
    }
    if (call.method === 'POST') {
      switchRows.set(call.body.nickname, call.body.status);
      return json(201, { note: null, created_at: '2026-11-14T09:00:00.000Z', ...call.body });
    }
    return undefined;
  };
  reset(switchAnswers);
  check('no nickname, a bad one or the no-affiliate tail is never blocked, and asks nothing', !(await cb.isAffiliateBlocked(null)) && !(await cb.isAffiliateBlocked('bad-nick!')) && !(await cb.isAffiliateBlocked('no-affiliate')) && calls.length === 0);
  switchRows.set('spammer1', 'blocked');
  const firstRead = await cb.isAffiliateBlocked('Spammer1');
  const secondRead = await cb.isAffiliateBlocked('spammer1');
  const reads = calls.filter((c) => onTable(c, 'free_video_cb_affiliates')).length;
  check('a blocked nickname is blocked (any case), and the answer is cached (one read for two asks)', firstRead && secondRead && reads === 1, `reads ${reads}`);
  check('the read asks for that lowercased nickname only', calls[0]?.url.searchParams.get('nickname') === 'eq.spammer1' && calls[0]?.url.searchParams.get('select') === 'status');
  reset(switchAnswers);
  check('an affiliate without a row is active', !(await cb.isAffiliateBlocked('goodguy1')));
  reset(() => json(404, { code: '42P01', message: 'relation "public.free_video_cb_affiliates" does not exist' }));
  check('a failed read (table missing) counts as active', !(await cb.isAffiliateBlocked('unknown_aff')));
  reset(() => json(500, { message: 'boom' }));
  check('a failed read is not cached as an answer', !(await cb.isAffiliateBlocked('unknown_aff')) && calls.length === 1, `${calls.length} requests`);

  reset(switchAnswers);
  let threw = false;
  try {
    await cb.setAffiliateStatus('bad-nick!', 'blocked', {});
  } catch {
    threw = true;
  }
  check('setAffiliateStatus refuses a bad nickname without a request', threw && calls.length === 0);
  threw = false;
  try {
    await cb.setAffiliateStatus('goodguy1', 'paused' as never, {});
  } catch {
    threw = true;
  }
  check('setAffiliateStatus refuses an unknown status without a request', threw && calls.length === 0);
  check('before the block, goodguy1 is active (and that answer is cached)', !(await cb.isAffiliateBlocked('goodguy1')));
  reset(switchAnswers);
  const saved = await cb.setAffiliateStatus('GoodGuy1', 'blocked', { note: '  sends bot traffic  ', by: 'contact@bluefx.net' });
  const upsert = calls[0];
  check('the block is an upsert on the lowercased nickname', upsert?.method === 'POST' && upsert.url.searchParams.get('on_conflict') === 'nickname' && upsert.prefer.includes('resolution=merge-duplicates'), upsert ? `${upsert.method} ${upsert.url.search} ${upsert.prefer}` : 'no request');
  check(
    'the saved row: nickname, status, trimmed note, who and when',
    upsert?.body?.nickname === 'goodguy1' && upsert.body.status === 'blocked' && upsert.body.note === 'sends bot traffic' && upsert.body.updated_by === 'contact@bluefx.net' && !Number.isNaN(Date.parse(upsert.body.updated_at)) && !('created_at' in upsert.body),
    show(upsert?.body)
  );
  check('setAffiliateStatus returns the saved row', saved.nickname === 'goodguy1' && saved.status === 'blocked');
  check('the cache is cleared: goodguy1 reads as blocked at once', await cb.isAffiliateBlocked('goodguy1'));
  reset(switchAnswers);
  await cb.setAffiliateStatus('goodguy1', 'active', { by: 'contact@bluefx.net' });
  check('a status change without a note leaves the saved note alone (no note column sent)', calls[0] && !('note' in calls[0].body));
  reset(switchAnswers);
  await cb.setAffiliateStatus('goodguy1', 'active', { note: '   ' });
  check('an empty note clears it, and no "by" saves updated_by null', calls[0]?.body?.note === null && calls[0]?.body?.updated_by === null);
  reset(switchAnswers);
  await cb.setAffiliateStatus('goodguy1', 'active', { note: 'n'.repeat(700) });
  check('a note is cut to the 500 characters the column takes', calls[0]?.body?.note?.length === 500);
  reset(() => json(400, { message: 'new row violates check constraint' }));
  threw = false;
  try {
    await cb.setAffiliateStatus('goodguy1', 'blocked', {});
  } catch {
    threw = true;
  }
  check('a failed save throws', threw);

  const pageOf = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ nickname: `aff${String(from + i).padStart(5, '0')}`, status: 'active', note: null, updated_by: null, created_at: 'x', updated_at: 'x' }));
  reset((call) => (onTable(call, 'free_video_cb_affiliates') ? json(200, call.url.searchParams.get('nickname') ? pageOf(1000, 3) : pageOf(0, 1000)) : undefined));
  const allRows = await cb.cbAffiliateRows();
  check('cbAffiliateRows reads past 1000 rows in keyset pages', allRows.length === 1003 && calls.length === 2 && calls[1].url.searchParams.get('nickname') === 'gt.aff00999', `${allRows.length} rows, ${calls.length} reads`);
  reset(() => json(500, { message: 'boom' }));
  threw = false;
  try {
    await cb.cbAffiliateRows();
  } catch {
    threw = true;
  }
  check('cbAffiliateRows throws on a database error', threw);

  const QUEUED = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];
  reset((call) => {
    if (!onTable(call, 'free_video_leads')) return undefined;
    if (call.method === 'GET') return json(200, QUEUED.map((id) => ({ id })));
    // The second lead was claimed a moment ago: the guarded update finds no queued row.
    if (call.method === 'PATCH') return json(200, call.url.searchParams.get('id') === `eq.${QUEUED[1]}` ? [] : [{ id: call.url.searchParams.get('id')?.slice(3) }]);
    return undefined;
  });
  const turned = await cb.rejectQueuedLeadsOf('GoodGuy1');
  const listRead = calls.find((c) => c.method === 'GET');
  const patches = calls.filter((c) => c.method === 'PATCH');
  check("rejectQueuedLeadsOf reads that affiliate's queued leads only", listRead?.url.searchParams.get('ref') === 'eq.cbaff-goodguy1' && listRead.url.searchParams.get('status') === 'eq.queued', listRead?.url.search);
  check(
    'each lead moves through the guarded transition from queued, with the blocked reason',
    patches.length === 3 && patches.every((c) => c.url.searchParams.get('status') === 'in.(queued)' && c.body?.status === 'rejected' && c.body?.reason === 'Affiliate blocked: goodguy1' && typeof c.body?.updated_at === 'string'),
    patches.map((c) => `${c.url.search} ${show(c.body)}`).join(' | ')
  );
  check('it counts only the leads that really moved (2 of 3)', turned === 2, `got ${turned}`);
  reset(() => json(500, { message: 'boom' }));
  threw = false;
  try {
    await cb.rejectQueuedLeadsOf('goodguy1');
  } catch {
    threw = true;
  }
  check('rejectQueuedLeadsOf throws when the queued leads cannot be read', threw);
  reset();
  threw = false;
  try {
    await cb.rejectQueuedLeadsOf('no-affiliate');
  } catch {
    threw = true;
  }
  check('rejectQueuedLeadsOf refuses a bad nickname without a request', threw && calls.length === 0);

  // 9. -----------------------------------------------------------------------------------------
  section("9. createLead: the blocked affiliate's branch (every request answered here, DNS says not found)");
  const { ERRORS } = await import('@/lib/free-video/copy');
  const SETTINGS = { id: 1, accepting: true, starting: true, review_mode: false, max_running: 1, daily_starts: 150, daily_usd: 150, daily_leads: 400, per_ip_daily: 3, paid_busy_limit: 3, est_usd: 1.3, system_user_id: null, last_sweep_at: null, updated_at: '2026-11-14T00:00:00Z' };
  const NEW_LEAD_ID = '99999999-8888-4777-8666-555555555555';
  const intake =
    (opts: { blocked?: string[]; affiliatesError?: boolean; emailTaken?: boolean; dailyLeads?: number }): Handler =>
    (call) => {
      if (onTable(call, 'free_video_settings')) return json(200, [SETTINGS]);
      if (onTable(call, 'free_video_leads') && call.method === 'HEAD') {
        const n = call.url.searchParams.get('source') === 'neq.test' ? (opts.dailyLeads ?? 0) : 0;
        return new Response(null, { status: 200, headers: { 'content-range': `*/${n}` } });
      }
      if (onTable(call, 'free_video_leads') && call.method === 'GET') return json(200, opts.emailTaken && call.url.searchParams.has('email_key') ? [{ id: 'taken' }] : []);
      if (onTable(call, 'free_video_cb_affiliates')) {
        if (opts.affiliatesError) return json(404, { code: '42P01', message: 'relation "public.free_video_cb_affiliates" does not exist' });
        const nick = call.url.searchParams.get('nickname')?.replace(/^eq\./, '') ?? '';
        return json(200, opts.blocked?.includes(nick) ? [{ status: 'blocked' }] : []);
      }
      if (isRpc(call)) {
        const p = call.body?.p_lead ?? {};
        return json(200, { outcome: 'ok', lead: { ...leadRow({}), ...p, id: NEW_LEAD_ID } });
      }
      if (onTable(call, 'profiles')) return json(200, []);
      return undefined;
    };
  const input = (tag: string | undefined, website = 'joes-plumbing-offline-check.com'): FreeVideoLeadInput =>
    ({ firstName: 'Joe', email: 'joe@example.com', website, consent: true, ...(tag ? { ref: tag } : {}) }) as FreeVideoLeadInput;
  const meta = { source: 'landing' as const, ip: null, userAgent: 'offline-check' };
  const rpcBodies = () => calls.filter(isRpc).map((c) => c.body?.p_lead ?? {});
  const affiliateReads = () => calls.filter((c) => onTable(c, 'free_video_cb_affiliates'));
  const askedProfiles = () => calls.some((c) => onTable(c, 'profiles'));

  reset(intake({ blocked: ['blockme1'] }));
  const blocked = await createLead(input('cbaff-blockme1'), meta);
  const stored = rpcBodies()[0];
  check(
    "a blocked affiliate's visitor gets 503 closed with ERRORS.closed and the stored lead",
    !blocked.ok && blocked.status === 503 && blocked.code === 'closed' && blocked.message === ERRORS.closed && blocked.lead?.id === NEW_LEAD_ID,
    show(blocked)
  );
  check(
    "the lead is stored as 'rejected' with 'Affiliate blocked: blockme1', is_customer false, its ref and a view token",
    stored?.status === 'rejected' &&
      stored.reason === 'Affiliate blocked: blockme1' &&
      stored.is_customer === false &&
      stored.ref === 'cbaff-blockme1' &&
      /^[A-Za-z0-9_-]{22}$/.test(stored.view_token ?? '') &&
      Boolean(stored.website_url),
    show(stored)
  );
  check('no pre-check and no customer check ran for it', !askedProfiles());
  check("the stored lead's reason is the one route.ts tests for", blocked.lead?.reason?.startsWith(cb.CB_BLOCKED_REASON_PREFIX) === true);

  reset(intake({ blocked: ['blockme2'], emailTaken: true }));
  const dup = await createLead(input('cbaff-blockme2'), meta);
  check('the duplicate check comes first: a blocked affiliate with a known email gets 409 duplicateEmail, nothing stored', !dup.ok && dup.status === 409 && dup.code === 'duplicateEmail' && rpcBodies().length === 0 && affiliateReads().length === 0, show(dup));
  reset(intake({ blocked: ['blockme3'], dailyLeads: 400 }));
  const capped = await createLead(input('cbaff-blockme3'), meta);
  check('the daily cap comes first: 503 closed, nothing stored, the switch not even read', !capped.ok && capped.code === 'closed' && rpcBodies().length === 0 && affiliateReads().length === 0 && !capped.lead);

  reset(intake({ blocked: ['blockme1'] }));
  const active = await createLead(input('cbaff-okaff1'), meta);
  check('an active affiliate goes on to the pre-check (here: not found, as DNS answers nothing)', !active.ok && active.code !== 'closed' && askedProfiles() && affiliateReads().length === 1 && !rpcBodies().some((p) => String(p.reason).startsWith('Affiliate blocked')), show(active));
  reset(intake({ affiliatesError: true }));
  const unread = await createLead(input('cbaff-okaff2'), meta);
  check('a switch that cannot be read never blocks: the request goes on to the pre-check', !unread.ok && unread.code !== 'closed' && askedProfiles(), show(unread));
  for (const tag of [undefined, 'fb-1', 'bfxhome', 'svc-fb-1', 'owner-test', 'svc-owner-test', 'cbaff-no-affiliate', 'cbaff-owner-test']) {
    reset(intake({ blocked: ['blockme1', 'no-affiliate', 'owner-test'] }));
    const result = await createLead(input(tag), meta);
    check(`ref ${show(tag)}: the block switch is never read and the request goes on to the pre-check`, affiliateReads().length === 0 && askedProfiles() && !result.ok && result.code !== 'closed', show(result));
  }

  // 10. ----------------------------------------------------------------------------------------
  section('10. meta.ts: no Facebook event for a ClickBank funnel lead, even with a test code');
  process.env.META_TEST_EVENT_CODE = 'TEST_OFFLINE';
  process.env.META_CAPI_TOKEN = 'offline-check-token';
  if (standInWhenMissing('maxmind', { Reader: class {} })) console.log('(maxmind is not installed in this checkout: geo.ts gets a stand-in these checks never call)');
  const metaLib = await import('@/lib/free-video/meta');
  const facebookAnswers: Handler = (call) => {
    if (call.url.hostname === 'graph.facebook.com') return json(200, { events_received: 1, fbtrace_id: 'offline' });
    if (onTable(call, 'free_video_events') && call.method === 'POST') return json(201, null);
    if (onTable(call, 'free_video_events') && call.method === 'GET') return json(200, []);
    return undefined;
  };
  const facts = { ip: null, userAgent: 'offline-check', referer: null, ids: { fbc: 'fb.1.1791400000000.IwAR0abcdefghijk', fbp: 'fb.1.1791400000000.1234567890' }, internal: false };
  const graphCalls = () => calls.filter((c) => c.url.hostname === 'graph.facebook.com');
  reset(facebookAnswers);
  await metaLib.trackLead(leadRow({ ref: 'cbaff-johndoe1', status: 'queued' }), facts);
  check('trackLead: a ClickBank lead sends nothing and saves no ids', calls.length === 0, `${calls.length} requests`);
  reset(facebookAnswers);
  await metaLib.trackLead(leadRow({ ref: 'fb-1', status: 'queued' }), facts);
  check('trackLead: an AI Media Machine funnel lead still sends its Lead (the gate is the ClickBank tag only)', graphCalls().length === 1 && graphCalls()[0].body?.data?.[0]?.event_name === 'Lead');
  reset(facebookAnswers);
  await metaLib.trackLead(leadRow({ ref: 'svc-fb-1', status: 'queued' }), facts);
  check('trackLead: a $49 FastSpring funnel lead still sends its Lead', graphCalls().length === 1);
  reset(facebookAnswers);
  await metaLib.trackPurchase(leadRow({ ref: 'cbaff-johndoe1', status: 'done' }), { id: 'cb:ABC123', amount: 49, currency: 'USD', email: 'joe@example.com', ip: null });
  check('trackPurchase: a ClickBank lead sends nothing', calls.length === 0, `${calls.length} requests`);
  reset(facebookAnswers);
  await metaLib.rememberCheckoutIds(leadRow({ ref: 'cbaff-johndoe1', status: 'done' }), facts, 'fvunlock');
  check('rememberCheckoutIds: nothing saved for a ClickBank lead', calls.length === 0, `${calls.length} requests`);
  delete process.env.META_TEST_EVENT_CODE;
  delete process.env.META_CAPI_TOKEN;

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ cb-funnel-ref-checks crashed:', error);
  process.exit(1);
});
