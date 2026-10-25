import { type NextRequest, NextResponse } from 'next/server';
import { getLeadByToken } from '@/lib/free-video/leads';
import { renderWelcomePage } from '@/lib/free-video/welcome-page';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';

/**
 * GET /unlimited-video-ads/welcome?t=<view token>: the thank-you page after an Unlimited Video Ads order (owner
 * 2026-10-25), where FastSpring's popup cart sends a paid order (service-page.ts). Thank you + the free AI search
 * audit as a gift, the member's website and email already in the form. Without a known token: the same page, form empty.
 */
export const dynamic = 'force-dynamic';

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? '';
  const lead = FREE_VIDEO_TOKEN_PATTERN.test(token) ? await getLeadByToken(token).catch(() => null) : null;
  return new NextResponse(renderWelcomePage(lead), { status: 200, headers: HEADERS });
}
