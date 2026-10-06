import { after } from 'next/server';
import { isLive, PROD_SITE_URL, SITE_URL } from '@/lib/free-video/config';
import { clientIp, getLeadByToken, markPlayed, recordEvent } from '@/lib/free-video/leads';
import { FREE_VIDEO_REF_PATTERN, FREE_VIDEO_TOKEN_PATTERN, FreeVideoEventSchema, type FreeVideoEvent } from '@/types/free-video';

/**
 * POST /api/free-video/event: the funnel pages' sendBeacon target (P1 measurement).
 * Body (at most 1 KB, JSON): { e: 'landing_view' | 'form_start' | 'video_play' | 'video_complete' | 'download',
 * t?: view token, v?: visitor id, ref?: newsletter tag }.
 * Always answers 204 with no body, whatever happens: a beacon never shows an error. Allow-listed events only;
 * bots, foreign origins and more than EVENTS_PER_MINUTE events a minute from one IP are dropped. An event about
 * a video ad needs a valid token; landing_view and form_start may come without one. video_play also sets the
 * lead's played_at (once).
 */
export const dynamic = 'force-dynamic';

const BODY_BYTES = 1024;
const EVENTS_PER_MINUTE = 60;
const BOT = /bot|crawler|spider|preview|scan|headless/i;
const WITHOUT_TOKEN: readonly FreeVideoEvent[] = ['landing_view', 'form_start'];

const recent = new Map<string, number[]>();

/** Counts one event from this IP; false past EVENTS_PER_MINUTE in the last minute. */
function allowed(ip: string): boolean {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((at) => now - at < 60_000);
  const ok = times.length < EVENTS_PER_MINUTE;
  if (ok) times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) for (const [key, list] of recent) if (!list.length || now - list[list.length - 1] > 60_000) recent.delete(key);
  return ok;
}

function sameOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.origin === new URL(SITE_URL).origin || url.origin === new URL(PROD_SITE_URL).origin) return true;
    return !isLive() && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

/** The body as text, read no further than BODY_BYTES; null when it is longer. */
async function readSmall(req: Request): Promise<string | null> {
  if (Number(req.headers.get('content-length')) > BODY_BYTES) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req.headers.get('origin'))) return noContent();
    if (BOT.test(req.headers.get('user-agent') || '')) return noContent();
    if (!allowed(clientIp(req) ?? 'local')) return noContent();
    const text = await readSmall(req);
    if (text === null) return noContent();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return noContent();
    }
    const parsed = FreeVideoEventSchema.safeParse(body);
    if (!parsed.success) return noContent();
    const { e, t, v, ref } = parsed.data;
    const token = t && FREE_VIDEO_TOKEN_PATTERN.test(t) ? t : null;
    if (!token && !WITHOUT_TOKEN.includes(e)) return noContent();

    after(async () => {
      const lead = token ? await getLeadByToken(token).catch(() => null) : null;
      if (token && !lead) return;
      await recordEvent({
        event: e,
        leadId: lead?.id ?? null,
        visitorId: v && /^[\w-]{1,40}$/.test(v) ? v : null,
        ref: ref && FREE_VIDEO_REF_PATTERN.test(ref) ? ref : (lead?.ref ?? null),
      });
      if (e === 'video_play' && lead && !lead.played_at) await markPlayed(lead.id);
    });
  } catch (error) {
    console.warn('⚠️ [free-video] Event not taken:', String(error).slice(0, 160));
  }
  return noContent();
}
