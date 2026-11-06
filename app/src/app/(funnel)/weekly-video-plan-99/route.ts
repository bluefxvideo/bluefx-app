import { NextResponse } from 'next/server';
import { renderPublicServicePage } from '@/lib/free-video/service-public';

/**
 * GET /weekly-video-plan-99: the Weekly Video Plan at $99 a month with no deadline (owner 2026-10-27), for the owner to
 * send by hand or in a list email whenever he wants to sell the service. The public page (/unlimited-video-ads) at $99,
 * with "Regular price $599" struck out. Not linked anywhere and kept out of search engines.
 */
export const dynamic = 'force-static';
export const revalidate = 3600;

export function GET() {
  return new NextResponse(renderPublicServicePage(99), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
