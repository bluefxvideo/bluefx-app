import { NextResponse } from 'next/server';
import { blockedCountry } from '@/lib/free-video/geo';
import { clientIp } from '@/lib/free-video/leads';

/**
 * GET /api/free-video/country?tz=<the browser's time zone>: is the free video ad offered where this visitor is?
 * The landing page asks once when it opens, so a visitor in a country on BLOCKED_COUNTRIES (config.ts) hears it at
 * step 1 instead of after typing a name and an email. POST /api/free-video checks the same two signals again.
 * Answers { blocked: "India" } or { blocked: null }. Nothing is stored.
 */
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const tz = new URL(req.url).searchParams.get('tz')?.slice(0, 64) ?? null;
  const country = blockedCountry(clientIp(req), tz);
  return NextResponse.json({ blocked: country?.name ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
