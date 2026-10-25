import { NextResponse } from 'next/server';
import { renderPublicServicePage } from '@/lib/free-video/service-public';

/**
 * GET /unlimited-video-ads: the official, public Unlimited Video Ads page at the public price (service-public.ts).
 * Members' delivery emails link it (#styles) for the samples; cold visitors get a link to the free sample first.
 */
export const dynamic = 'force-static';
export const revalidate = 3600;

export function GET() {
  return new NextResponse(renderPublicServicePage(), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}
