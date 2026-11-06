import { type NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/free-video/config';
import { unlockPagePath } from '@/lib/free-video/offer';
import { hasInternalCookie } from '@/lib/free-video/internal-visit';
import { getLeadByToken, toView } from '@/lib/free-video/leads';
import { renderServicePage, serviceClockStart, servicePhaseAt } from '@/lib/free-video/service-page';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';

/**
 * GET /v/<token>/unlimited: the Unlimited Video Ads page (done-for-you service, owner 2026-10-25) made for one lead:
 * the service funnel's result page and the link in its emails. A full HTML page of its own (the owner-approved design,
 * service-page.ts), not a React page. A video ad that is not finished sends the visitor to its own page. The price is
 * the lead's current phase ($99 for 3 days, $299 for 5 days, then $599). ?internal=1 or the owner's fv_internal
 * cookie: the page never starts the lead's clock.
 */
export const dynamic = 'force-dynamic';

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!FREE_VIDEO_TOKEN_PATTERN.test(token)) return new NextResponse('Not found', { status: 404 });

  let lead;
  let start: Date | null;
  try {
    lead = await getLeadByToken(token);
    if (!lead) return new NextResponse('Not found', { status: 404 });
    start = await serviceClockStart(lead);
  } catch (error) {
    console.error('❌ [free-video] Service page could not read the lead:', error);
    return new NextResponse('Please try again in a minute.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const view = await toView(lead, null).catch(() => null);
  if (!view || view.state !== 'ready' || !view.videoUrl) return NextResponse.redirect(`${SITE_URL}/v/${token}`, 302);

  const internal = req.nextUrl.searchParams.get('internal') === '1' || hasInternalCookie(req.headers.get('cookie'));
  // Owner 2026-10-27: the $99 a month page is for leads switched to it by hand only. Funnel 2 sells the $49 video ad
  // (old emails still link here), and a lead switched to the AI Media Machine gets its own page.
  const keep = internal ? '?internal=1' : '';
  if (view.videoOffer) return NextResponse.redirect(`${SITE_URL}${unlockPagePath(token)}${keep}`, 302);
  if (!view.service) return NextResponse.redirect(`${SITE_URL}/v/${token}${keep}`, 302);
  const html = renderServicePage({
    token,
    lead,
    videoUrl: view.videoUrl,
    poster: view.poster ?? null,
    nextAds: view.nextAds ?? null,
    now: servicePhaseAt(start),
    internal,
  });
  return new NextResponse(html, { status: 200, headers: HEADERS });
}
