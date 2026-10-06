/**
 * Free video funnel: a fetch that only reaches public web servers.
 *
 * The funnel reads a website a stranger types into a public form, plus every photo that page links to.
 * The app container can reach the Remotion server, the editor, the rough-cut worker and the cloud
 * metadata address, and page text can come out in a public video ad, so a plain fetch would let anyone
 * read those services. Every hop here:
 * - refuses IP literals, internal and own host names, credentials and ports other than 80/443
 * - resolves the name ONCE, through c-ares with a hard time limit (never libuv's 4 shared threads, which a
 *   few slow name servers could fill for the whole app), and refuses it when any address is private,
 *   loopback, link-local, CGNAT, multicast, reserved or this server's own public address; the socket
 *   connects to the address that was checked (pinned), so a DNS answer that changes between the check and
 *   the connect cannot slip through
 * - follows redirects by hand, at most LIMITS.redirects, and checks every new address the same way
 * - caps the body (gzip, deflate and br are unpacked and counted after unpacking) and the total time; a
 *   caller that only needs the status (the intake pre-check) never reads the body of an error answer, and a
 *   caller that wants a picture never reads a body that is not one
 * - refuses pages crafted to make the page reader's regular expressions run for minutes (sanityCheckHtml)
 *
 * Built on node:http and node:https, so the global fetch (and Next's patched fetch) is never involved.
 * Server only.
 */

import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { Transform } from 'node:stream';
import zlib from 'node:zlib';

import { isInternalHost, LIMITS, OWN_IPS } from '@/lib/free-video/config';
import { BROWSER_UA, type PageFetch } from '@/lib/smart-video/sources';

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

// ---------- addresses ----------

const BLOCKED = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata (169.254.169.254)
  ['172.16.0.0', 12], // private, Docker networks
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
] as const)
  BLOCKED.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 96], // unspecified, loopback and the deprecated IPv4-compatible block
  ['100::', 64], // discard
  ['64:ff9b:1::', 48], // local-use NAT64
  ['2001::', 32], // Teredo
  ['2001:2::', 48], // benchmarking
  ['2001:10::', 28], // ORCHID
  ['2001:20::', 28], // ORCHIDv2
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (wraps an IPv4 address)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated)
  ['ff00::', 8], // multicast
] as const)
  BLOCKED.addSubnet(address, prefix, 'ipv6');
// The server's own public address: its ports 3000 and 3001 answer from outside the Docker network.
for (const ip of OWN_IPS) BLOCKED.addAddress(ip, net.isIPv6(ip) ? 'ipv6' : 'ipv4');

/** The eight 16-bit words of an IPv6 address that net.isIPv6 accepted. */
function ipv6Words(ip: string): number[] {
  let text = ip.toLowerCase();
  const dotted = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [left, right] = text.includes('::') ? text.split('::') : [text, null];
  const head = left ? left.split(':') : [];
  const tail = right ? right.split(':') : [];
  const fill = right === null ? [] : Array<string>(Math.max(0, 8 - head.length - tail.length)).fill('0');
  return [...head, ...fill, ...tail].map((word) => parseInt(word, 16) || 0);
}

/** The IPv4 address inside an IPv4-mapped (::ffff:a.b.c.d), IPv4-translated or NAT64 (64:ff9b::a.b.c.d) address. */
function embeddedIpv4(words: number[]): string | null {
  const zero = (from: number, to: number) => words.slice(from, to).every((w) => w === 0);
  const mapped = zero(0, 5) && words[5] === 0xffff;
  const translated = zero(0, 4) && words[4] === 0xffff && words[5] === 0;
  const nat64 = words[0] === 0x64 && words[1] === 0xff9b && zero(2, 6);
  if (!mapped && !translated && !nat64) return null;
  return [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join('.');
}

/** True only for an address on the public internet. Anything net.isIP rejects counts as not public. */
export function isPublicAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return !BLOCKED.check(ip, 'ipv4');
  // A zone index (fe80::1%eth0) only exists on local links.
  if (family !== 6 || ip.includes('%')) return false;
  const inner = embeddedIpv4(ipv6Words(ip));
  if (inner) return net.isIPv4(inner) && !BLOCKED.check(inner, 'ipv4');
  return !BLOCKED.check(ip, 'ipv6');
}

/** The host name the way DNS sees it: lowercased, without IPv6 brackets or a trailing dot. */
export function hostOf(url: URL): string {
  return url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '');
}

/** The checks that need no DNS. Throws BlockedUrlError unless the address is a public domain on port 80 or 443. */
export function assertPublicUrl(u: URL): void {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new BlockedUrlError(`Only web pages can be read, not ${u.protocol}`);
  if (u.username || u.password) throw new BlockedUrlError('An address with a user name or password is refused');
  if (u.port && u.port !== '80' && u.port !== '443') throw new BlockedUrlError(`Port ${u.port} is refused`);
  const host = hostOf(u);
  // URL has already turned decimal, hex and short IPv4 forms (2130706433, 0x7f000001, 127.1) into dotted ones.
  if (net.isIP(host)) throw new BlockedUrlError('An IP address is refused; use the domain name');
  if (!host.includes('.')) throw new BlockedUrlError(`${host || 'An empty host'} is not a public domain`);
  // Docker service names, .local/.internal names and this app's own hosts (config.ts).
  if (isInternalHost(host)) throw new BlockedUrlError(`${host} is an internal address`);
}

type Resolved = { address: string; family: 4 | 6 };

const dnsError = (message: string, code: string, hostname: string) => Object.assign(new Error(message), { code, hostname });

/**
 * Every address of a host name, IPv4 first, from ONE c-ares query per family (dns.Resolver). Not
 * getaddrinfo: that runs on libuv's 4 shared threads, so a few name servers that answer slowly would stall
 * every fs, zlib and DNS call of the app (review SEC-1). Gives up after LIMITS.dnsTimeoutMs.
 * Throws with code ENOTFOUND when the name does not exist, ETIMEOUT when the name servers are too slow.
 */
async function resolveHost(hostname: string, family: 0 | 4 | 6 = 0): Promise<Resolved[]> {
  const resolver = new dns.promises.Resolver({ timeout: LIMITS.dnsTryMs, tries: 2 });
  const timer = setTimeout(() => resolver.cancel(), LIMITS.dnsTimeoutMs);
  try {
    const [v4, v6] = await Promise.allSettled([
      family === 6 ? Promise.resolve([] as string[]) : resolver.resolve4(hostname),
      family === 4 ? Promise.resolve([] as string[]) : resolver.resolve6(hostname),
    ]);
    const found: Resolved[] = [
      ...(v4.status === 'fulfilled' ? v4.value.map((address) => ({ address, family: 4 as const })) : []),
      ...(v6.status === 'fulfilled' ? v6.value.map((address) => ({ address, family: 6 as const })) : []),
    ];
    if (found.length) return found;
    const codes = [v4, v6].flatMap((r) => (r.status === 'rejected' ? [String((r.reason as NodeJS.ErrnoException)?.code ?? '')] : []));
    if (codes.every((code) => code === dns.NOTFOUND || code === dns.NODATA)) throw dnsError(`${hostname} was not found`, 'ENOTFOUND', hostname);
    if (codes.some((code) => code === dns.TIMEOUT || code === dns.CANCELLED)) {
      throw dnsError(`The name servers of ${hostname} took too long to answer`, 'ETIMEOUT', hostname);
    }
    const code = codes.find((c) => c !== dns.NOTFOUND && c !== dns.NODATA) || 'ENOTFOUND';
    throw dnsError(`${hostname} could not be resolved (${code})`, code, hostname);
  } finally {
    clearTimeout(timer);
  }
}

const familyOf = (family: unknown): 0 | 4 | 6 => (family === 4 || family === 'IPv4' ? 4 : family === 6 || family === 'IPv6' ? 6 : 0);

/**
 * The lookup every socket uses: one DNS answer, refused when ANY address in it is not public, and the
 * socket then connects to exactly those checked addresses. Answers in the shape Node asked for (an array
 * when `all` is set, which Node's autoSelectFamily does).
 */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  resolveHost(hostname, familyOf(options.family)).then(
    (addresses) => {
      const blocked = addresses.find((a) => !isPublicAddress(a.address));
      if (blocked) return callback(new BlockedUrlError(`${hostname} points to a private address (${blocked.address})`), '');
      if (options.all) return callback(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    },
    (error: NodeJS.ErrnoException) => callback(error, '')
  );
};

/** Whether a host name resolves, and only to public addresses. ENOTFOUND and ENODATA mean not_found; other DNS errors are thrown. */
export async function resolvePublic(hostname: string): Promise<'ok' | 'not_found' | 'blocked'> {
  try {
    const addresses = await resolveHost(hostname);
    return addresses.every((a) => isPublicAddress(a.address)) ? 'ok' : 'blocked';
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') return 'not_found';
    throw error;
  }
}

// ---------- the fetch ----------

/** Headers a caller may not set: the request line, the connection and the unpacking belong to this module. */
const DROPPED_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'content-length',
  'transfer-encoding',
  'accept-encoding',
  'te',
  'upgrade',
  'expect',
  'proxy-authorization',
  'proxy-connection',
]);
const NULL_BODY_STATUS = new Set([101, 103, 204, 205, 304]);
const BINARY_TYPE = /^(image|video|audio|font)\//;

type Hop = { location: string } | { response: Response };

function requestHeaders(input?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = { 'user-agent': BROWSER_UA, accept: '*/*' };
  new Headers(input).forEach((value, key) => {
    if (!DROPPED_HEADERS.has(key)) headers[key] = value;
  });
  headers['accept-encoding'] = 'gzip, deflate, br';
  return headers;
}

const tooLarge = (cap: number) => new Error(`The answer is too large (over ${Math.round(cap / 1_000_000)} MB)`);

const abortReason = (signal: AbortSignal) =>
  signal.reason instanceof Error ? signal.reason : new DOMException('The request was aborted', 'AbortError');

/** gzip, br or deflate; a deflate body may come with or without its zlib header, so the first byte decides. */
function unpackerFor(encoding: string, firstByte: number): Transform | null {
  if (encoding === 'gzip' || encoding === 'x-gzip') return zlib.createGunzip({ finishFlush: zlib.constants.Z_SYNC_FLUSH });
  if (encoding === 'br') return zlib.createBrotliDecompress({ finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH });
  if (encoding === 'deflate')
    return (firstByte & 0x0f) === 0x08
      ? zlib.createInflate({ finishFlush: zlib.constants.Z_SYNC_FLUSH })
      : zlib.createInflateRaw({ finishFlush: zlib.constants.Z_SYNC_FLUSH });
  return null;
}

function toResponse(res: http.IncomingMessage, body: Buffer, url: URL, redirected: boolean): Response {
  const status = res.statusCode ?? 0;
  if (status < 200 || status > 599) throw new Error(`The page answered with status ${status}`);
  const headers = new Headers();
  for (let i = 0; i + 1 < res.rawHeaders.length; i += 2) {
    const key = res.rawHeaders[i].toLowerCase();
    // The body handed on is already unpacked, so its encoding and length headers would lie.
    if (key === 'content-encoding' || key === 'content-length' || key === 'transfer-encoding') continue;
    try {
      headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
    } catch {
      /* a header value fetch itself would refuse */
    }
  }
  // Response copies the bytes itself, so the Buffer is handed over without a copy of our own.
  const content = NULL_BODY_STATUS.has(status) ? null : (body as unknown as Uint8Array<ArrayBuffer>);
  let response: Response;
  try {
    response = new Response(content, { status, statusText: res.statusMessage || '', headers });
  } catch {
    response = new Response(content, { status, headers });
  }
  Object.defineProperty(response, 'url', { value: url.href });
  Object.defineProperty(response, 'redirected', { value: redirected });
  return response;
}

/**
 * How one fetch reads its answer. safeFetch's defaults suit sources.ts; the funnel's own readers ask for more.
 */
export interface SafeFetchMode {
  /** Bytes an HTML page may have (LIMITS.htmlBytes by default). */
  htmlBytes?: number;
  /** Cut an HTML page at htmlBytes and hand on what arrived, instead of failing with "too large". */
  truncateHtml?: boolean;
  /**
   * Answers outside 2xx come back with an empty body, unread: their status and headers are all the intake
   * pre-check needs, so a site cannot make it download and check megabytes of a 404 page (review SEC-1).
   */
  skipErrorBody?: boolean;
}

/** What the readers in sources.ts may do with a body decides which checks it needs. A picture the caller asked for (Accept: image/*) needs none. */
function checkBody(body: Buffer, contentType: string, readAsPage: boolean, wantsImage: boolean): void {
  if (wantsImage) return;
  // Response.json() skips a UTF-8 byte order mark, so the JSON test does too.
  const bom = body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf ? 3 : 0;
  const first = body.subarray(bom).find((byte) => byte > 32);
  const looksLikeJson = first === 0x7b || first === 0x5b; // { or [
  if (!readAsPage && BINARY_TYPE.test(contentType) && !looksLikeJson) return;
  const text = body.toString('utf8', bom);
  // fetchHtml reads any answer as a page, whatever its content type says.
  sanityCheckHtml(text);
  // A Shopify .js answer is parsed as JSON and its description goes through the page reader.
  if (looksLikeJson) sanityCheckJsonStrings(text);
}

function requestOnce(target: URL, headers: Record<string, string>, signal: AbortSignal, redirected: boolean, mode: SafeFetchMode): Promise<Hop> {
  return new Promise<Hop>((resolve, reject) => {
    if (signal.aborted) return reject(abortReason(signal));
    let done = false;
    let res: http.IncomingMessage | undefined;
    let unpack: Transform | null = null;

    const settle = (error: unknown, hop?: Hop) => {
      if (done) return;
      done = true;
      signal.removeEventListener('abort', onAbort);
      if (hop && !error) return resolve(hop);
      unpack?.destroy();
      res?.destroy();
      req.destroy();
      reject(error);
    };
    const onAbort = () => settle(abortReason(signal));

    const client = target.protocol === 'https:' ? https : http;
    const req = client.request(
      target,
      // agent:false: a fresh socket per request, never one pooled by code that skipped this guard.
      { method: 'GET', headers, agent: false, lookup: guardedLookup, timeout: LIMITS.timeoutMs },
      (response) => {
        res = response;
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          settle(null, { location });
          response.destroy();
          return;
        }

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        const wantsImage = /^image\//.test(headers.accept || '');
        // The status and headers without the body: the socket is closed before anything more is read.
        const unread = () => {
          try {
            settle(null, { response: toResponse(response, Buffer.alloc(0), target, redirected) });
          } catch (error) {
            settle(error);
          }
          response.destroy();
        };
        if (mode.skipErrorBody && (status < 200 || status > 299)) return unread();
        // downloadLinkPhotos drops anything that is not a picture; reading it first would only cost memory and time (review SEC-6).
        if (wantsImage && !contentType.startsWith('image/')) return unread();

        const readAsPage = !wantsImage && (/text\/html/.test(headers.accept || '') || contentType.includes('text/html'));
        const cap = readAsPage ? (mode.htmlBytes ?? LIMITS.htmlBytes) : LIMITS.imageBytes;
        const truncate = readAsPage && Boolean(mode.truncateHtml);
        if (!truncate && Number(response.headers['content-length']) > cap) return settle(tooLarge(cap));
        const encoding = String(response.headers['content-encoding'] || '')
          .trim()
          .toLowerCase();
        if (encoding && encoding !== 'identity' && !['gzip', 'x-gzip', 'br', 'deflate'].includes(encoding))
          return settle(new Error(`The page used an unknown content encoding (${encoding})`));

        const chunks: Buffer[] = [];
        let packed = 0;
        let size = 0;
        let ended = false;
        let cut = false;
        const finish = () => {
          if (done) return;
          try {
            const body = Buffer.concat(chunks);
            chunks.length = 0;
            checkBody(body, contentType, readAsPage, wantsImage);
            const answer = toResponse(response, body, target, redirected);
            if (cut) answer.headers.set('x-safe-fetch-truncated', '1');
            settle(null, { response: answer });
          } catch (error) {
            settle(error);
          }
          // A cut page: the rest is never read.
          if (cut) {
            unpack?.destroy();
            response.destroy();
          }
        };
        const finishCut = () => {
          cut = true;
          finish();
        };
        const take = (chunk: Buffer) => {
          if (done) return;
          if (size + chunk.length > cap) {
            if (!truncate) return settle(tooLarge(cap));
            chunks.push(chunk.subarray(0, cap - size));
            size = cap;
            return finishCut();
          }
          size += chunk.length;
          chunks.push(chunk);
        };

        response.on('data', (chunk: Buffer) => {
          if (done) return;
          packed += chunk.length;
          // Packed bytes never outgrow what they unpack to; a cut page may still have some waiting in the unpacker.
          if (packed > (truncate ? cap * 2 : cap)) return truncate ? finishCut() : settle(tooLarge(cap));
          if (encoding && encoding !== 'identity' && !unpack) {
            unpack = unpackerFor(encoding, chunk[0]);
            unpack?.on('data', take);
            unpack?.on('end', finish);
            unpack?.on('error', (error) => settle(error));
          }
          if (unpack) unpack.write(chunk);
          else take(chunk);
        });
        response.on('end', () => {
          ended = true;
          if (unpack) unpack.end();
          else finish();
        });
        response.on('error', (error) => settle(error));
        response.on('close', () => {
          if (!ended) settle(new Error('The connection closed before the page arrived'));
        });
      },
    );
    signal.addEventListener('abort', onAbort, { once: true });
    req.on('timeout', () => settle(new Error(`${target.hostname} took too long to answer`)));
    req.on('error', (error) => settle(error));
    req.end();
  });
}

/**
 * safeFetch with a reading mode (see SafeFetchMode): GET only, every hop checked, redirects followed by hand.
 * The answer is a normal Response with the body already unpacked, so ok, status, text(), json(),
 * arrayBuffer() and headers.get work unchanged. init.redirect is ignored. A request whose Accept starts with
 * image/ gets an empty body for any answer that is not a picture, and pictures skip the page checks.
 */
export async function safeFetchWith(url: string, init: RequestInit = {}, mode: SafeFetchMode = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET') throw new BlockedUrlError(`Only GET requests are allowed, not ${method}`);
  const headers = requestHeaders(init.headers);
  const deadline = AbortSignal.timeout(LIMITS.timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new BlockedUrlError('That is not a web address');
  }
  for (let hop = 0; hop <= LIMITS.redirects; hop++) {
    assertPublicUrl(current);
    const answer = await requestOnce(current, headers, signal, hop > 0, mode);
    if ('response' in answer) return answer.response;
    try {
      current = new URL(answer.location, current);
    } catch {
      throw new Error(`The page redirected to an address that is not valid (${answer.location.slice(0, 120)})`);
    }
  }
  // Not a BlockedUrlError: a redirect loop is a site that cannot be read, not an address that is refused.
  throw new Error(`The page redirected more than ${LIMITS.redirects} times`);
}

/** A drop-in for fetch in sources.ts (fetchHtml, fromShopify, downloadLinkPhotos) with the default limits. */
export const safeFetch: PageFetch = (url, init = {}) => safeFetchWith(url, init);

// ---------- pages that would stall the reader ----------

/*
 * sources.ts reads a page with regular expressions that run in the process paying users share. On a
 * crafted page several of them backtrack quadratically (measured: 80 KB of '<' alone takes 2.7 s in
 * htmlToText's last tag strip, so a 3 MB page would take about an hour). Each pattern's worst case is
 * an opening that never meets the text that would close it: the scan then runs to the end of the page,
 * once per such opening. sanityCheckHtml counts those scans in linear time and refuses the page when
 * they add up to more than STEP_BUDGET characters (about a tenth of a second of regex time).
 *
 * The patterns modelled (sources.ts):
 * - htmlToText: <(script|style|noscript|svg|nav|footer|form|iframe|template)[\s\S]*?<\/\1>, comments,
 *   <(h[1-6])[^>]*>, <li[^>]*>, <[^>]+> and ^\s*(-|##)\s*$ (m flag) over runs of blank lines
 * - fromWebsite and pageReadability: the greedy <main…</main>, <article…</article>, <body…</body> parts
 * - structuredFacts' ld+json scripts, <title[^>]*>…</title>, meta() and pageImages' tag scans
 * The text model replays htmlToText step by step; every step runs only after its own worst case was
 * counted on its own input, so the check itself stays linear.
 */

const REMOVED_TAGS = ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'form', 'iframe', 'template'] as const;
const REMOVED = /<(script|style|noscript|svg|nav|footer|form|iframe|template)[\s\S]*?<\/\1>/gi;
const STEP_BUDGET = 100_000_000;
const tooComplex = () => new BlockedUrlError('page too complex');

/**
 * The cost of a lazy or greedy open…close match: every opening after the last closing scans to the end.
 * Counting stops once the budget is spent, so a page made of millions of openings is refused at once.
 */
function unclosedCost(text: string, open: string, close: string): number {
  let cost = 0;
  for (let i = text.indexOf(open, text.lastIndexOf(close) + 1); i !== -1 && cost <= STEP_BUDGET; i = text.indexOf(open, i + open.length))
    cost += text.length - i;
  return cost;
}

/** The cost of `<[^>]+>` style patterns: a '<' with no '>' after it scans to the end; any other is matched and skipped. */
const unendedTagCost = (text: string) => unclosedCost(text, '<', '>');

/** The cost of `<tag[^>]+…` patterns that can fail on every tag: each opening scans to its next '>'. */
function tagScanCost(text: string, open: string): number {
  let cost = 0;
  let gt = -1;
  for (let i = text.indexOf(open); i !== -1 && cost <= STEP_BUDGET; i = text.indexOf(open, i + open.length)) {
    if (gt < i) {
      const next = text.indexOf('>', i);
      gt = next === -1 ? text.length : next;
    }
    cost += gt - i;
  }
  return cost;
}

const isSpace = (c: number) =>
  c === 32 ||
  (c >= 9 && c <= 13) ||
  c === 0xa0 ||
  c === 0x1680 ||
  (c >= 0x2000 && c <= 0x200a) ||
  c === 0x2028 ||
  c === 0x2029 ||
  c === 0x202f ||
  c === 0x205f ||
  c === 0x3000 ||
  c === 0xfeff;
const isLineEnd = (c: number) => c === 10 || c === 13 || c === 0x2028 || c === 0x2029;

/**
 * The cost of ^\s*(-|##)\s*$ with the m flag: every line start inside a run of white space scans the rest
 * of the run, and when the run ends in a '-' or '##' marker, also the white space after the marker.
 */
function blankRunCost(text: string): number {
  let cost = 0;
  let start = -1;
  let lines = 0;
  let carried = 0; // line starts of the run just before a marker that ends where this run starts
  for (let i = 0; i <= text.length; i++) {
    const c = i < text.length ? text.charCodeAt(i) : -1;
    if (c !== -1 && isSpace(c)) {
      if (start === -1) {
        start = i;
        lines = 1;
      }
      if (isLineEnd(c)) lines++;
      continue;
    }
    if (start === -1) {
      carried = 0;
      continue;
    }
    const length = i - start;
    cost += (lines + carried) * length;
    const marker = c === 45 ? 1 : c === 35 && text.charCodeAt(i + 1) === 35 ? 2 : 0; // '-' or '##'
    carried = marker && isSpace(text.charCodeAt(i + marker)) ? lines : 0;
    if (marker) i += marker - 1;
    start = -1;
  }
  return cost;
}

/** sources.ts' decode, with a code point that does not exist kept as text instead of throwing. */
const decodeLike = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (whole, code) => {
      const point = Number(code);
      return point <= 0x10ffff ? String.fromCodePoint(point) : whole;
    });

/** The worst-case regex steps htmlToText spends on `part` (lowercased), replayed one step at a time. */
function textCost(part: string, budget: number): number {
  let cost = 0;
  for (const tag of REMOVED_TAGS) cost += unclosedCost(part, `<${tag}`, `</${tag}>`);
  if (cost > budget) return cost;
  let text = part.replace(REMOVED, ' ');
  cost += unclosedCost(text, '<!--', '-->');
  if (cost > budget) return cost;
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  cost += unendedTagCost(text);
  if (cost > budget) return cost;
  text = text.replace(/<(h[1-6])[^>]*>/gi, '\n\n## ');
  cost += unendedTagCost(text);
  if (cost > budget) return cost;
  text = text.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/(p|div|section|article|h[1-6]|li|tr|br)>|<br\s*\/?>/gi, '\n');
  cost += unendedTagCost(text);
  if (cost > budget) return cost;
  text = decodeLike(text.replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ');
  return cost + blankRunCost(text);
}

/** The parts fromWebsite and pageReadability may hand to htmlToText: main, article, body, or the whole page. */
function readerParts(page: string): string[] {
  const spans: [number, number][] = [];
  for (const tag of ['main', 'article', 'body']) {
    const open = page.indexOf(`<${tag}`);
    const close = page.lastIndexOf(`</${tag}>`);
    if (open !== -1 && close > open) spans.push([open, close + tag.length + 3]);
  }
  spans.push([0, page.length]);
  const seen = new Set<string>();
  return spans.filter(([from, to]) => !seen.has(`${from}:${to}`) && seen.add(`${from}:${to}`)).map(([from, to]) => page.slice(from, to));
}

/** Openings of a tag as a real tag (followed by white space, '>' or '/'), so a custom element like <nav-menu> does not count. */
function tagOpenings(page: string, tag: string): number {
  const open = `<${tag}`;
  let count = 0;
  for (let i = page.indexOf(open); i !== -1; i = page.indexOf(open, i + open.length)) {
    const next = page.charCodeAt(i + open.length);
    if (Number.isNaN(next) || next === 62 || next === 47 || isSpace(next)) count++;
  }
  return count;
}

const occurrences = (page: string, needle: string) => {
  let count = 0;
  for (let i = page.indexOf(needle); i !== -1; i = page.indexOf(needle, i + needle.length)) count++;
  return count;
};

/**
 * Throws BlockedUrlError('page too complex') for a page that would make sources.ts' readers backtrack for
 * a long time. Linear in the page size: 5 to 30 ms on real pages of 0.2 to 0.7 MB, at most about 0.3 s
 * on a crafted 3 MB page.
 */
export function sanityCheckHtml(html: string): void {
  const page = html.toLowerCase();
  // Plain shape rules: real pages close what they open and hold one <main>.
  for (const tag of REMOVED_TAGS) if (tagOpenings(page, tag) - occurrences(page, `</${tag}>`) > 10) throw tooComplex();
  if (occurrences(page, '<main') > 20 || occurrences(page, '<article') > 400) throw tooComplex();

  // Readers that scan the whole page: ld+json scripts, the title, meta and img tags, the greedy parts.
  let cost =
    unclosedCost(page, '<script', '</script>') +
    unclosedCost(page, 'application/ld+json', '</script>') +
    tagScanCost(page, '<script') +
    unclosedCost(page, '<title', '</title>') +
    tagScanCost(page, '<title') +
    unendedTagCost(page);
  for (const tag of ['main', 'article', 'body']) cost += unclosedCost(page, `<${tag}`, `</${tag}>`);
  if (cost > STEP_BUDGET) throw tooComplex();

  for (const part of readerParts(page)) {
    cost += textCost(part, STEP_BUDGET - cost);
    if (cost > STEP_BUDGET) throw tooComplex();
  }
}

/**
 * fromShopify runs htmlToText on the description of a JSON answer: every long string in it gets the same
 * text check. Text that is not JSON passes. Exported for free-video-checks.ts.
 */
export function sanityCheckJsonStrings(text: string): void {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  let cost = 0;
  const stack: unknown[] = [data];
  while (stack.length) {
    const value = stack.pop();
    if (typeof value === 'string') {
      if (value.length < 200) continue;
      cost += textCost(value.toLowerCase(), STEP_BUDGET - cost);
      if (cost > STEP_BUDGET) throw tooComplex();
    } else if (value && typeof value === 'object') {
      for (const item of Array.isArray(value) ? value : Object.values(value)) stack.push(item);
    }
  }
}
