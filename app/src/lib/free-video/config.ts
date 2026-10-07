/**
 * Free video ad funnel: server-side constants and environment helpers. No secrets live here.
 *
 * Server code only (routes, lib/free-video/*, the tsx scripts). Client components import offer.ts
 * and copy.ts instead. There is no 'server-only' import on purpose: the tsx test scripts import
 * this file outside Next.js, where that package throws.
 *
 * Runtime knobs (caps, kill switch, review mode, system user) are NOT here: they live in the
 * free_video_settings row and change with one SQL update, never a deploy.
 */

import { isGoogleMapsLink } from '@/lib/smart-video/link';
import type { FreeVideoSettings } from '@/types/free-video';

export { PHANTOM_PATH } from './offer';

// ---------------------------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------------------------

export const PROD_SITE_URL = 'https://app.bluefx.net';
/** The app's public origin, without a trailing slash. The local end-to-end run sets NEXT_PUBLIC_SITE_URL=http://localhost:3005 in the shell. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || PROD_SITE_URL).replace(/\/+$/, '');
/** A production build. Next inlines NODE_ENV at build time, so a laptop's `npm run build && npm start` is "production" too: see isLive(). */
export const IS_PROD = process.env.NODE_ENV === 'production';

const hostnameOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/**
 * The live funnel worker: a production build that serves app.bluefx.net. Only the live server claims
 * real leads, mails real visitors and alerts on a silent cron. A local production build (which points at
 * the PROD database and inlines SITE_URL = http://localhost:3000 from .env.local) is NOT live, so it can
 * never claim a real visitor's lead or email them a localhost link (review F8).
 */
export const IS_LIVE = IS_PROD && hostnameOf(SITE_URL) === hostnameOf(PROD_SITE_URL);
export function isLive(): boolean {
  return IS_LIVE;
}

/** Same as The Phantom's STALE_AFTER_MS (12 min): a job whose heartbeat is older counts as dead. */
export const STALE_MINUTES_DEFAULT = 12;

/** Minutes after which a job without a heartbeat is dead. FREE_VIDEO_STALE_MINUTES works only off the live server (the $0 tests use 1). */
export function staleMinutes(): number {
  const local = Number(process.env.FREE_VIDEO_STALE_MINUTES);
  return !IS_LIVE && local > 0 ? local : STALE_MINUTES_DEFAULT;
}

/** The live server always starts jobs. Anything else (dev server, local build) only with FREE_VIDEO_LOCAL_START=1, and then claims only source='test' leads. */
export function localStartAllowed(): boolean {
  return IS_LIVE || process.env.FREE_VIDEO_LOCAL_START === '1';
}

/** Only the live server claims, settles and emails real leads; every other server only source='test' ones (the claim's p_test). */
export function claimsTestLeads(): boolean {
  return !IS_LIVE;
}

/** The $0 state-machine tests: a fake job instead of the paid pipeline. Never on the live server. */
export function fakeMode(): boolean {
  return !IS_LIVE && process.env.FREE_VIDEO_FAKE === '1';
}

export type FakeFailMode = 'dead' | 'error' | 'unreadable' | 'gate';
const FAKE_FAIL_MODES: readonly FakeFailMode[] = ['dead', 'error', 'unreadable', 'gate'];

/** FREE_VIDEO_FAKE_FAIL in fake mode, else null. */
export function fakeFailMode(): FakeFailMode | null {
  const mode = process.env.FREE_VIDEO_FAKE_FAIL as FakeFailMode | undefined;
  return fakeMode() && mode && FAKE_FAIL_MODES.includes(mode) ? mode : null;
}

/** Off the live server, the only inbox anything may be mailed to (the owner's; plus-tags allowed). Always null on the live server. */
export function testInbox(): string | null {
  return IS_LIVE ? null : process.env.FREE_VIDEO_TEST_EMAIL?.trim().toLowerCase() || null;
}

/** The Remotion server renderSmartVideo talks to (the same expression as actions/services/remotion-render-service.ts). */
export function remotionServerUrl(): string {
  return process.env.APP_REMOTION_SERVICE_URL || process.env.REMOTION_SERVER_URL || 'http://localhost:3001';
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** True when the Remotion server is on this machine. */
export function rendersLocally(): boolean {
  return LOCAL_HOSTS.has(hostnameOf(remotionServerUrl()));
}

/**
 * The live server renders on production's own Remotion. Every other server may render a free video ad
 * only on a LOCAL Remotion server: .env.local points REMOTION_SERVER_URL at PROD Remotion, which must
 * never see a test render (and runs the old composition until the push).
 */
export function renderTargetAllowed(): boolean {
  return IS_LIVE || rendersLocally();
}

// ---------------------------------------------------------------------------------------------
// MailerLite
// ---------------------------------------------------------------------------------------------

/** The groups the agent creates through the API (build step 10, on the owner's yes). Bought is P1, but the group is created now. */
export const ML_GROUP_NAMES = {
  leads: 'Free Video - Leads',
  ready: 'Free Video - Ready',
  bought: 'Free Video - Bought',
  /** Joined when the clean (unlocked) video ad is ready; the owner's 1-email automation sends free_video_clean_url. */
  unlocked: 'Free Video - Unlocked',
} as const;

// The ids MailerLite returned when the groups were created (2026-10-06, main account). Empty = not created.
/** Every queued signup joins this group at submit (never a rejected one). No automation hangs on this group. */
export const ML_GROUP_LEADS: string = '200567992522638921';
/** Joining this group triggers the 'Free Video Ad' automation (E1-E3). Joined in the same upsert that sets the fields. */
export const ML_GROUP_READY: string = '200567992720819824';
/** P1: the automation's exit condition, joined when a lead buys. */
export const ML_GROUP_BOUGHT: string = '200567992985061045';
/** Joining this group triggers the 'Free Video - Unlocked' automation (1 email with the clean download link). */
export const ML_GROUP_UNLOCKED: string = '200567993198970571';

/** True once all four group ids are filled in. */
export function mailerLiteGroupsReady(): boolean {
  return Boolean(ML_GROUP_LEADS && ML_GROUP_READY && ML_GROUP_BOUGHT && ML_GROUP_UNLOCKED);
}

/** Text fields the agent creates with POST /fields. The emails use them as {$free_video_url} and so on. */
export const ML_FIELDS = {
  url: 'free_video_url',
  site: 'free_video_site',
  token: 'free_video_token',
  customer: 'free_video_customer',
  /** The clean video ad's download link, set in the same upsert that joins 'Free Video - Unlocked'. */
  cleanUrl: 'free_video_clean_url',
} as const;

// ---------------------------------------------------------------------------------------------
// Owner alerts (Brevo)
// ---------------------------------------------------------------------------------------------

/** INTERNAL_NOTIFY_EMAIL of the waas funnels (bluefx-waas/client-bluefx/.env). */
export const OWNER_ALERT_EMAIL = 'support@bluefx.net';
/** BREVO_FROM_EMAIL of the waas funnels: a sender that already sends through Brevo. */
export const ALERT_FROM = { email: 'support@bluefx.net', name: 'BlueFX Free Video' } as const;

// ---------------------------------------------------------------------------------------------
// Hosts the website reader must never touch, and hosts the free video ad refuses
// ---------------------------------------------------------------------------------------------

/** The Coolify host, where :3000 and :3001 answer publicly. */
export const OWN_IPS: readonly string[] = ['152.53.225.7'];
export const OWN_HOSTS: readonly string[] = ['app.bluefx.net', 'editor.bluefx.net'];
/** Docker service names and other names that resolve inside the container network. */
export const INTERNAL_HOSTS: readonly string[] = ['localhost', 'remotion', 'bluefx-app', 'react-video-editor', 'video-roughcut-worker', 'host.docker.internal'];
export const INTERNAL_SUFFIXES: readonly string[] = ['.local', '.localhost', '.internal', '.lan', '.home.arpa', '.corp'];

/** Lowercase, no trailing dot. */
const hostKey = (hostname: string) => hostname.trim().toLowerCase().replace(/\.+$/, '');

/** An internal name or one of our own hosts: never fetched. */
export function isInternalHost(hostname: string): boolean {
  const host = hostKey(hostname);
  return INTERNAL_HOSTS.includes(host) || OWN_HOSTS.includes(host) || INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Marketplaces, social networks and Google-hosted pages: the paid path reads them with Apify actors
 * or they hide their text behind a login, so the free video ad refuses them. Matched on whole labels
 * of the hostname (www.zillow.com and m.facebook.com match; notzillow.com does not).
 * The Google part mirrors isGoogleMapsLink, which also refuses sites.google.com in v1.
 */
export const REFUSED_HOST =
  /(^|\.)(zillow\.com|realtor\.com|tiktok\.com|facebook\.com|fb\.com|fb\.me|instagram\.com|linkedin\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|pinterest\.com|etsy\.com|linktr\.ee|goo\.gl|g\.page|g\.co)$|(^|\.)(amazon|amzn|ebay|yelp|google)\.[a-z.]+$/i;

export function isRefusedHost(hostname: string): boolean {
  const host = hostKey(hostname);
  if (!host) return false;
  if (REFUSED_HOST.test(host)) return true;
  try {
    return isGoogleMapsLink(new URL(`https://${host}/`));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------------------------

/** One automatic retry after a failure or a deploy kill, then hold and alert. */
export const MAX_ATTEMPTS = 2;
export const RETRY_DELAY_MS = 120_000;
export const MAX_FREE_PHOTOS = 8;
/** Website photos are downloaded this many at a time, and the download stops once MAX_FREE_PHOTOS usable ones are in (review SEC-6). */
export const PHOTO_BATCH = 4;
/** The end card advertises the free video ad page (owner 2026-10-07), so it stays long enough to read: 2 s. */
export const END_CARD_SECONDS = 2;
/** Minutes per video ad, for the ETA on the page (measured 2026-10-07: 3 min 46 s with the presenter on LTX 2.5 Fast; Flash and 720p take about 1.5 off). */
export const JOB_MINUTES = 3;
/**
 * The free video ads' script writer (owner 2026-10-07: "go, flash + 720p + looser rules"). The 10-website test: Pro
 * 8.6/10 in 156 s on average (rewrites cost 30-70 s each), Pro with low thinking 7.6 in 78 s, gemini-3.6-flash 8.1 in
 * 44 s. Looser rules: a photo taped to the board counts as a picture, one block carries a scene.
 */
export const FREE_DIRECTOR = { model: 'gemini-3.6-flash', looseRules: true } as const;
/** Free video ads render at 720p (2/3 of 1080p): about 40% faster and a third smaller. The $99 clean version stays at 1080p. */
export const FREE_RENDER_SCALE = 2 / 3;
/** The claim counts a freshly claimed lead as running for at least this long, even before its job row has a heartbeat. */
export const CLAIM_GRACE_MINUTES = 3;

export const EMAIL_MAX_ATTEMPTS = 5;
/** A delivery claim ('sending') older than this is taken over by the next sweep. */
export const EMAIL_RECLAIM_MINUTES = 5;
/** Brevo's free plan sends 300 a day, shared with buyers' password mails. */
export const ALERTS_PER_DAY = 20;
export const STUCK_QUEUE_MINUTES = 120;
export const WATCHDOG_MINUTES = 15;
/** Rows per sweep step (settle, deliver). */
export const SWEEP_BATCH = 25;
/** Any 10 rows from one IP in 24 h (rejected ones included) → 429, on top of settings.per_ip_daily. */
export const IP_ROWS_PER_DAY = 10;
/**
 * The owner's own test address (owner 2026-10-07: "let me do the tests for contact@bluefx.net"): no daily caps, the
 * visitor's view (never the customer one), and a new test retires his earlier finished test of the same address or
 * site. A real customer's record is never touched: a site another address holds still answers duplicateSite.
 */
export const OWNER_TEST_EMAILS: readonly string[] = ['contact@bluefx.net'];
/**
 * Countries the free video ad is not offered in (owner 2026-10-07: "limit countries where I know I won't get clients
 * from, like India, Pakistan, Russia, maybe a few more"). ISO 3166 alpha-2 code → the name the refusal says. geo.ts
 * finds the visitor's country from the IP and from the browser's time zone. Remove a line to open a country again.
 */
export const BLOCKED_COUNTRIES: Readonly<Record<string, string>> = {
  IN: 'India',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  NP: 'Nepal',
  LK: 'Sri Lanka',
  NG: 'Nigeria',
  GH: 'Ghana',
  KE: 'Kenya',
  EG: 'Egypt',
  RU: 'Russia',
  BY: 'Belarus',
  CN: 'China',
  VN: 'Vietnam',
  ID: 'Indonesia',
  PH: 'the Philippines',
};
/** readSettings() caches the settings row this long per process. */
export const SETTINGS_CACHE_MS = 20_000;
/** Circuit breaker: over the last 2 h, at least 3 bad results that are at least half of all finished ones → starting = false. */
export const BREAKER = { windowHours: 2, minBad: 3, minShare: 0.5 } as const;

/**
 * The form's own limits, counted per process before anything is read or fetched (review SEC-1): every POST
 * from one IP counts, 400 answers included, and at most `precheckSlots` website pre-checks run at once.
 * emailRowsPerDay: rows one address may leave in 24 h (rejected tries included), checked again at insert.
 */
export const INTAKE = { perIpPerMinute: 5, perIpPerDay: 20, precheckSlots: 3, emailRowsPerDay: 5 } as const;

/**
 * Hard limits on a free plan, applied between the director and the paid production step (review SEC-5):
 * page text can ask for a 3-minute video, and the free note cannot outvote it. Scenes past the limits are
 * cut (the first and the last scene always stay); lifestyle photos past the limit fall back to the real photo.
 */
export const FREE_PLAN = { maxScenes: 8, maxWords: 95, minScenes: 4, maxLifestyleShots: 1 } as const;

/**
 * The $99 clean render: attempts before 'failed' + an owner alert, when a 'rendering' claim counts as dead,
 * and how many clean renders one server runs at once.
 */
export const CLEAN_RENDER = { maxAttempts: 3, staleMinutes: 15, maxParallel: 2 } as const;

/** The clean video ad's email: retried by the sweep this long after the file is ready, and the owner is told when it is still not out after `alertAfterMinutes`. */
export const UNLOCK_EMAIL = { retryHours: 6, alertAfterMinutes: 30 } as const;

/**
 * The Remotion props every free video ad renders with: the big see-through BlueFX mark in the middle and an end card
 * (SmartVideo.jsx CenterWatermark + EndCard). The $99 clean version re-renders the saved props without this key.
 */
export const WATERMARK = { label: 'BlueFX', endCardSeconds: END_CARD_SECONDS } as const;

/** Quality gate. Lengths include the end card (END_CARD_SECONDS). */
export const GATE = {
  minSeconds: 22,
  maxSeconds: 52,
  probeTolerance: 0.5,
  minMeanVolumeDb: -35,
  minBytes: 300_000,
  maxDownloadBytes: 60_000_000,
  downloadTimeoutMs: 60_000,
  /** A file check that failed on the infrastructure (download, ffprobe start) is tried again by the next sweeps for this long before the lead is held (review F4). */
  inconclusiveMinutes: 15,
} as const;

/** Fetch and request limits. */
export const LIMITS = {
  bodyBytes: 4096,
  /** A page the job reads: longer pages are cut here, never refused. */
  htmlBytes: 3_000_000,
  /** The intake pre-check reads at most this much of a page (review SEC-1). */
  precheckHtmlBytes: 1_000_000,
  /** One picture (review SEC-6: was 15 MB). */
  imageBytes: 8_000_000,
  imagePixels: 40_000_000,
  redirects: 5,
  timeoutMs: 25_000,
  precheckTimeoutMs: 8_000,
  /** DNS through c-ares, never libuv's 4 shared threads: per try, and in all. */
  dnsTryMs: 2_000,
  dnsTimeoutMs: 5_000,
} as const;

/** Error prefix for a website the reader could not use. Such a failure happens before any paid call, so it costs $0 and frees the lead's keys. */
export const UNREADABLE = 'Website not readable: ';

/**
 * The free_video_settings defaults the migration creates (for tests and docs; the live values are in the row).
 * Owner's recommended path: max_running 1, then 2 after the smoke test; soft launch at 100 starts and $100.
 */
export const SETTINGS_DEFAULTS = {
  accepting: true,
  starting: false,
  review_mode: false,
  max_running: 1,
  daily_starts: 150,
  daily_usd: 150,
  daily_leads: 400,
  per_ip_daily: 3,
  paid_busy_limit: 3,
  est_usd: 1.3,
} as const satisfies Partial<FreeVideoSettings>;

/**
 * The NOTE FROM THE CLIENT every free job sends to the director, after the website text.
 * - About 80 words clears checkPlan's 65-word floor on the first try, so no extra director call is paid for
 *   (2026-10-06: "around 70" came back as 54 to 61 words in 2 of 4 whiteboard tests, one redo $0.10 to $0.12 each).
 *   FREE_PLAN.maxWords (95) stays above it.
 * - A length written in the client's text wins (director.ts:137).
 * - The visitor's name never goes into the brief.
 * `domain` is the address as people read it (displayDomain: Unicode, not the xn-- form).
 */
export function freeNote(domain: string): string {
  return [
    'Make a vertical video ad of about 35 seconds for this business: around 80 words of narration in total, 5 to 7 scenes.',
    'Write the narration and every text on screen in the language of the website.',
    'Lead with what a customer gets. Use only facts from the website.',
    'Make every line specific to this business: its services, places, numbers, prices and names from the website. No empty phrases such as expert guidance, ready to help, look no further, at your service, trusted partner, top-notch or world-class.',
    'If the website offers something concrete (a free estimate or inspection, a discount, a first-visit price, a free consultation), it is the reason to act: name it in the middle of the video and close on it in the last scene with a clear action (call, book, order, claim).',
    "Write scene 1 as one short hook of 6 to 12 words that this business's customer can't scroll past: their specific problem or wish, or a concrete fact only this business has (a number, a year, a place, the offer). Never a stock opener such as 'Looking for…?', 'Need a…?', 'Craving…?', 'Want a…?' or 'Welcome to…'. Examples of the tone: 'This is the storm damage most homeowners never see.' 'Imagine never spending another Saturday cleaning your house.' 'Okay, these might be the best tacos in Austin.'",
    `The last scene shows the website address ${domain} as the highlight.`,
    'Tape only real photos of the business to the board: its people, place, products or work. Never use a picture that is mostly text, such as a YouTube thumbnail, a banner, a flyer, a screenshot or an ad.',
    'Give every scene that shows no photo its own drawing, so the board is never empty. When the website has no logo, the last scene gets a drawing too, of something that fits the call to action.',
  ].join('\n');
}
