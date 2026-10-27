import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { UnlockPage } from '@/components/free-video/unlock-page';
import { loadLead } from '@/components/free-video/free-video-status-page';
import { CHANGE_ROUNDS, changesUsed } from '@/lib/free-video/change-requests';
import { isLive } from '@/lib/free-video/config';
import { readSettings, toView } from '@/lib/free-video/leads';
import { UNLOCK_PAGE } from '@/lib/free-video/unlock-page';
import { displayDomain } from '@/lib/free-video/website';

export const dynamic = 'force-dynamic';

interface UnlockRouteProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}

/** Local preview only (never on the live site): ?preview=paid|ready|failed|closed shows that display on any finished lead. */
const PREVIEWS = { paid: 'paid', ready: 'ready', failed: 'failed', closed: 'unavailable' } as const;

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
  const { preview } = await searchParams;
  const lead = await loadLead(token);
  if (!lead) notFound();
  const view = await toView(lead, await readSettings());
  if (view.state !== 'ready' || !view.videoUrl) redirect(`/v/${token}`);
  const shown = !isLive() && preview && preview in PREVIEWS ? PREVIEWS[preview as keyof typeof PREVIEWS] : null;
  if (shown) {
    view.unlock = shown === 'ready' ? { state: 'ready', cleanVideoUrl: view.videoUrl, cleanDownloadUrl: view.downloadUrl ?? view.videoUrl } : { state: shown };
  }
  const used = await changesUsed(lead.id).catch(() => 0);
  return <UnlockPage token={token} initial={view} changesLeft={Math.max(0, CHANGE_ROUNDS - used)} preview={Boolean(shown)} />;
}
