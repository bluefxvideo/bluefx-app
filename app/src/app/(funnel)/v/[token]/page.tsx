import type { Metadata } from 'next';
import { FreeVideoStatusPage, loadLead } from '@/components/free-video/free-video-status-page';
import { PAGE_META } from '@/lib/free-video/copy';
import { displayDomain } from '@/lib/free-video/website';

export const dynamic = 'force-dynamic';

interface VideoAdPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: VideoAdPageProps): Promise<Metadata> {
  const { token } = await params;
  try {
    const lead = await loadLead(token);
    return lead ? { title: PAGE_META.videoTitle(displayDomain(lead.website_domain)) } : {};
  } catch {
    return {};
  }
}

/** The video ad page the email links to (free_video_url): the same live status as the thank-you page. noindex via the layout. */
export default async function VideoAdPage({ params }: VideoAdPageProps) {
  const { token } = await params;
  return <FreeVideoStatusPage token={token} placement="fvpage" />;
}
