import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { UnlockPage } from '@/components/free-video/unlock-page';
import { loadLead } from '@/components/free-video/free-video-status-page';
import { latestChangePlan, requestedChanges } from '@/lib/free-video/change-chat';
import { freeChangeOf } from '@/lib/free-video/instant-change';
import { CHANGE_ROUNDS, changesUsed } from '@/lib/free-video/change-requests';
import { UNLOCK_DAYS } from '@/lib/free-video/cleanup';
import { isLive } from '@/lib/free-video/config';
import { isClickBankRef } from '@/lib/free-video/funnel';
import { PLAN_TRIAL_PRODUCT, SERVICE } from '@/lib/free-video/offer';
import { readSettings, toView } from '@/lib/free-video/leads';
import { UNLOCK_PAGE } from '@/lib/free-video/unlock-page';
import { clickBankUnlockPrice, unlockPriceOf } from '@/lib/free-video/unlock-price';
import { displayDomain } from '@/lib/free-video/website';

export const dynamic = 'force-dynamic';

interface UnlockRouteProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string; paid?: string | string[]; r?: string | string[]; as?: string | string[] }>;
}

/** Local preview only (never on the live site): ?preview=paid|ready|failed|closed shows that display on any finished lead. */
const PREVIEWS = { paid: 'paid', ready: 'ready', failed: 'failed', closed: 'unavailable' } as const;

/**
 * Local preview only (never on the live site): ?as=cb shows any finished lead as a ClickBank funnel lead of this made-up
 * affiliate. Works with ?preview= above and with ?paid=cb&r=TEST1234 (the "confirming" display). Display only: the page
 * then never asks for news (the server would send the lead's real funnel back), and its buy button still opens the
 * lead's real checkout.
 */
const AS_CB_AFFILIATE = 'testaffiliate';

/** A ClickBank receipt as the bluefx.net thank-you page passes it on (?r=); the cb-confirm route checks the same pattern (spec §5). */
const CB_RECEIPT_PATTERN = /^[A-Za-z0-9]{6,20}(__[A-Za-z0-9_]+)?$/;

export async function generateMetadata({ params }: UnlockRouteProps): Promise<Metadata> {
  const { token } = await params;
  const lead = await loadLead(token).catch(() => null);
  return lead ? { title: UNLOCK_PAGE.meta(displayDomain(lead.website_domain)) } : {};
}

/**
 * /v/<token>/unlock (owner 2026-10-27): the lead's video ad for one payment, then the download and the change box.
 * A video ad that is not finished sends the visitor to its own page. Linked from emails only (no funnel routes here yet).
 */
export default async function UnlockRoute({ params, searchParams }: UnlockRouteProps) {
  const { token } = await params;
  const { preview, paid, r, as } = await searchParams;
  const lead = await loadLead(token);
  if (!lead) notFound();
  const view = await toView(lead, await readSettings());
  if (view.state !== 'ready' || !view.videoUrl) redirect(`/v/${token}`);
  const shown = !isLive() && preview && preview in PREVIEWS ? PREVIEWS[preview as keyof typeof PREVIEWS] : null;
  if (shown) {
    view.unlock = shown === 'ready' ? { state: 'ready', cleanVideoUrl: view.videoUrl, cleanDownloadUrl: view.downloadUrl ?? view.videoUrl } : { state: shown };
  }
  const asCb = !isLive() && as === 'cb';
  if (asCb) {
    view.funnel = 'cb';
    view.affiliate = AS_CB_AFFILIATE;
  }
  // The ClickBank affiliate funnel (spec 2026-11-14 §4): item 12's fixed $49 (the FastSpring clock is never read), no
  // FastSpring popup and no FastSpring offer flag. Every other lead gets exactly what it got before.
  const cb = isClickBankRef(lead.ref) || asCb;
  const [used, price, plan, requested, freeChange] = await Promise.all([
    changesUsed(lead.id).catch(() => 0),
    cb ? clickBankUnlockPrice() : unlockPriceOf(lead.id),
    latestChangePlan(lead.id).catch(() => null),
    requestedChanges(lead.id).catch(() => [] as string[]),
    freeChangeOf(lead).catch(() => null),
  ]);
  // The last day the video ad can be unlocked (cleanup.ts unlockOpen), shown on the offer as a true deadline.
  const finished = lead.finished_at ? Date.parse(lead.finished_at) : NaN;
  const filesUntil = Number.isFinite(finished) ? new Date(finished + UNLOCK_DAYS * 86_400_000).toISOString() : null;
  // Back from ClickBank's thank-you page (/v/<token>/unlock?paid=cb&r=<receipt>): the page confirms instead of selling again.
  const paidReturn = cb && paid === 'cb';
  const receipt = paidReturn && typeof r === 'string' && CB_RECEIPT_PATTERN.test(r) ? r : null;
  const storefront = cb ? null : isLive() ? SERVICE.popupStorefront : SERVICE.popupTestStorefront;
  const trial = !cb && (Boolean(PLAN_TRIAL_PRODUCT) || !isLive());
  const page = <UnlockPage token={token} initial={view} price={price} filesUntil={filesUntil} plan={plan} freeChange={freeChange} requested={requested} trial={trial} storefront={storefront} changesLeft={Math.max(0, CHANGE_ROUNDS - used)} preview={Boolean(shown) || asCb} paidReturn={paidReturn} receipt={receipt} />;
  // A ClickBank funnel lead's page is marked in the server HTML so the BlueFX Meta pixel stays off (meta-pixel.tsx):
  // its visitors are an affiliate's. Every other lead's page renders exactly as before.
  return cb ? (
    <>
      <span data-fv-no-pixel hidden />
      {page}
    </>
  ) : (
    page
  );
}
