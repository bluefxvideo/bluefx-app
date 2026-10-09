import { after, type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { claimFreeVideo } from '@/lib/free-video/claim';
import { hopFromSearchParams, withHop } from '@/lib/free-video/clickbank';
import { savedHopByToken } from '@/lib/free-video/clickbank-hops';
import { SITE_URL } from '@/lib/free-video/config';
import { unlockOpen } from '@/lib/free-video/cleanup';
import { clientIp, getLeadByToken, isActiveCustomerId, markClicked } from '@/lib/free-video/leads';
import { rememberCheckoutIds, requestFacts, trackCheckout } from '@/lib/free-video/meta';
import { checkoutUrl, isEmailPlacement, isPlacement, UNLOCK, unlockCheckoutUrl } from '@/lib/free-video/offer';
import { CHECKOUT_EVENT_PARAM } from '@/lib/free-video/pixel';
import { FREE_VIDEO_TOKEN_PATTERN } from '@/types/free-video';

/**
 * GET /go/<placement>?t=<view token>: every offer button of the funnel (pages and emails) goes through here.
 * - A page button of the lifetime offer (fvthank, fvpage, fvland) → 302 straight to ClickBank's checkout, the placement
 *   as the vendor tracking id (checkoutUrl). No lifetime page in between: the offer card is the pitch (owner 2026-10-08).
 *   With a valid t, the click is logged on the lead (fvland, the offer under the form's "one free video ad per business"
 *   refusal, has no lead and comes without t). Every such click is an InitiateCheckout for Facebook (meta.ts), with the
 *   button's event id from ?e= when it sent one.
 * - An email button (fvmail1-3) → 302 to the lead's own video ad page, where the offer sits under the video ad; the click
 *   is logged on the lead. Without a known lead it falls back to the checkout.
 * - 'fvunlock' (Offer 1, the $99 clean video ad) → 302 to the lead's FastSpring checkout, ONLY for a valid token of an
 *   existing lead (404 otherwise). A lead that has already paid, whose video ad will never exist, or whose unlock
 *   closed (30 days, cleanup.ts) is sent to its video ad page instead, so nobody pays twice or pays for nothing. The
 *   click saves the browser's Facebook ids on the lead, for the Purchase the payment sends later.
 * - 'claim' ("Open this video ad in the AI Media Machine") → a signed-in customer gets a copy of the finished video ad
 *   in their Phantom videos (claim.ts) and lands on it; signed out → the login page, back here after; not a customer
 *   → the lifetime offer; a video ad that is not finished → its page.
 * - Anything else → 404. Every target is built here from fixed parts: never an open redirect.
 * - A checkout link carries the affiliate's ClickBank hop (clickbank.ts): the hopId and vq ClickBank's script appended
 *   to the button's link in the same browser, else the hop saved when the lead came in (a click from the emails on
 *   another device). ClickBank credits the affiliate from the hopId on the order form.
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
    const facts = requestFacts(req, clientIp(req));
    const clicked = lead;
    after(async () => {
      await markClicked(token, UNLOCK.placement);
      await rememberCheckoutIds(clicked, facts, UNLOCK.placement);
    });
    const page = `${SITE_URL}/v/${token}`;
    if (lead.unlock_status === 'paid' || lead.unlock_status === 'rendering' || lead.unlock_status === 'ready') return redirect(page);
    if (lead.status === 'rejected' || lead.status === 'failed') return redirect(page);
    // 30 days after the video ad: the working files the clean version is made from are about to go (cleanup.ts).
    if (lead.status === 'done' && !unlockOpen(lead)) return redirect(page);
    return redirect(unlockCheckoutUrl(token));
  }

  if (placement === 'claim') {
    if (!validToken) return notFound();
    const lead = await getLeadByToken(token).catch(() => null);
    if (!lead) return notFound();
    const page = `${SITE_URL}/v/${token}`;
    if (lead.status !== 'done' || !lead.video_url) return redirect(page);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return redirect(`${SITE_URL}/login?next=${encodeURIComponent(`/go/claim?t=${token}`)}`);
    // Not a customer: back to the video ad page, whose offer is the way in.
    if (!(await isActiveCustomerId(user.id))) return redirect(page);
    try {
      const copyId = await claimFreeVideo(lead, user.id, true);
      return redirect(`${SITE_URL}/dashboard/smart-video?job=${copyId}`);
    } catch (error) {
      console.error(`❌ /go/claim for lead ${lead.id} failed:`, error);
      return redirect(page);
    }
  }

  if (!isPlacement(placement)) return notFound();

  if (isEmailPlacement(placement)) {
    const lead = validToken ? await getLeadByToken(token).catch(() => null) : null;
    if (lead) {
      after(() => markClicked(token, placement));
      return redirect(`${SITE_URL}/v/${token}`);
    }
    return redirect(withHop(checkoutUrl(placement), hopFromSearchParams(req.nextUrl.searchParams)));
  }

  const facts = requestFacts(req, clientIp(req));
  const eventId = req.nextUrl.searchParams.get(CHECKOUT_EVENT_PARAM);
  const hop = hopFromSearchParams(req.nextUrl.searchParams) ?? (validToken ? await savedHopByToken(token) : undefined);
  after(async () => {
    if (validToken) await markClicked(token, placement);
    await trackCheckout({ token: validToken ? token : null, placement, eventId, facts });
  });
  return redirect(withHop(checkoutUrl(placement), hop));
}
