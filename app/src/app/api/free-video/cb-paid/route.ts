import { type NextRequest, NextResponse } from 'next/server';
import { CB_RECEIPT_PATTERN, cbPaidTokenOfReceipt } from '@/lib/free-video/clickbank-video-ad';
import { clientIp } from '@/lib/free-video/leads';

/**
 * POST /api/free-video/cb-paid with the JSON body { r: <receipt>, e: <buyer email> }: ClickBank item 12's thank-you page
 * on bluefx.net, when it has no view token (no fvt in its address, no bfx_fv cookie), asks which lead the receipt paid
 * for, to send the buyer on to /v/<token>/unlock?paid=cb&r=<receipt>. e is cemail from the thank-you address. { token }
 * once the payment is applied, and only for the buyer's own email within minutes of the payment; { token: null } until
 * then and otherwise (the page asks again for a few minutes). Read only (clickbank-video-ad.ts cbPaidTokenOfReceipt).
 * The page sends the body as text/plain, so the browser sends no preflight; application/json works too. A POST keeps the
 * email out of addresses and logs. CORS for https://bluefx.net only.
 */
export const dynamic = 'force-dynamic';

const HEADERS = {
  'Access-Control-Allow-Origin': 'https://bluefx.net',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '600',
  'Cache-Control': 'no-store',
};

const answer = (token: string | null, status = 200) => NextResponse.json({ token }, { status, headers: HEADERS });

/** Lookups per IP in the last minute, this process only: the page asks every few seconds, guessing receipts needs far more. */
const LOOKUPS_PER_MINUTE = 60;
const lookups = new Map<string, number[]>();
/** A real body is under 400 characters (a receipt and an email). */
const BODY_MAX = 2000;
const EMAIL_MAX = 255;

function takeLookup(ip: string, now = Date.now()): boolean {
  const recent = (lookups.get(ip) ?? []).filter((at) => now - at < 60_000);
  if (recent.length >= LOOKUPS_PER_MINUTE) return false;
  recent.push(now);
  lookups.set(ip, recent);
  if (lookups.size > 5000) for (const [key, times] of lookups) if (!times.some((at) => now - at < 60_000)) lookups.delete(key);
  return true;
}

/** The body as an object, whatever its content type says (text/plain or JSON); null for anything else. Never throws. */
async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (!text || text.length > BODY_MAX) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}

export async function POST(req: NextRequest) {
  const body = await readBody(req);
  const receipt = typeof body?.r === 'string' ? body.r.trim() : '';
  const email = typeof body?.e === 'string' ? body.e.trim().slice(0, EMAIL_MAX) : '';
  if (receipt.length > 60 || !CB_RECEIPT_PATTERN.test(receipt) || !email.includes('@')) return answer(null, 400);
  if (!takeLookup(clientIp(req) ?? 'unknown')) return answer(null, 429);
  try {
    return answer(await cbPaidTokenOfReceipt(receipt, email));
  } catch (error) {
    console.error('❌ [free-video] ClickBank receipt lookup failed:', error);
    return answer(null, 503);
  }
}
