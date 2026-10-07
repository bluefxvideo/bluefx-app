import { after, type NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/free-video/config';
import { unlockOpen } from '@/lib/free-video/cleanup';
import { getLeadByToken, markClicked } from '@/lib/free-video/leads';
import { isPlacement, offerUrl, UNLOCK, unlockCheckoutUrl } from '@/lib/free-video/offer';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';

/**
 * GET /go/<placement>?t=<view token>: every offer button of the funnel (pages and emails) goes through here.
 * - An allow-listed ClickBank placement (fvthank, fvpage, fvland, fvmail1-3) → 302 to offerUrl(placement), the
 *   lifetime page with the placement as the ClickBank tid. With a valid t, the click is logged on the lead (fvland,
 *   the offer under the form's "one free video ad per business" refusal, has no lead and comes without t).
 * - 'fvunlock' (Offer 1, the $99 clean video ad) → 302 to the lead's FastSpring checkout, ONLY for a valid token of an
 *   existing lead (404 otherwise). A lead that has already paid, whose video ad will never exist, or whose unlock
 *   closed (30 days, cleanup.ts) is sent to its video ad page instead, so nobody pays twice or pays for nothing.
 * - Anything else → 404. Every target is built here from fixed parts: never an open redirect.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

const notFound = () => new NextResponse('Not found', { status: 404, headers: NO_STORE });

const redirect = (url: string) => NextResponse.redirect(url, { status: 302, headers: NO_STORE });

export async function GET(req: NextRequest, { params }: { params: Promise<{ placement: string }> }) {
  const { placement } = await params;
  const token = req.nextUrl.searchParams.get('t') ?? '';
  const validToken = FREE_VIDEO_TOKEN_PATTERN.test(token);

  if (placement === UNLOCK.placement) {
    if (!validToken) return notFound();
    let lead;
    try {
      lead = await getLeadByToken(token);
    } catch (error) {
      console.error('❌ /go/fvunlock lead read failed:', error);
      return new NextResponse('Please try again in a minute.', { status: 503, headers: NO_STORE });
    }
    if (!lead) return notFound();
    after(() => markClicked(token, UNLOCK.placement));
    const page = `${SITE_URL}/v/${token}`;
    if (lead.unlock_status === 'paid' || lead.unlock_status === 'rendering' || lead.unlock_status === 'ready') return redirect(page);
    if (lead.status === 'rejected' || lead.status === 'failed') return redirect(page);
    // 30 days after the video ad: the working files the clean version is made from are about to go (cleanup.ts).
    if (lead.status === 'done' && !unlockOpen(lead)) return redirect(page);
    return redirect(unlockCheckoutUrl(token));
  }

  if (!isPlacement(placement)) return notFound();
  if (validToken) after(() => markClicked(token, placement));
  return redirect(offerUrl(placement));
}
