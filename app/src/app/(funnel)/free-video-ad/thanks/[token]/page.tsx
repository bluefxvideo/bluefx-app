import type { Metadata } from 'next';
import { FreeVideoStatusPage } from '@/components/free-video/free-video-status-page';
import { PAGE_META } from '@/lib/free-video/copy';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: PAGE_META.thanksTitle,
};

interface FreeVideoThanksPageProps {
  params: Promise<{ token: string }>;
}

/** Right after the form: the live status of the visitor's video ad, then the video ad and the two offers. */
export default async function FreeVideoThanksPage({ params }: FreeVideoThanksPageProps) {
  const { token } = await params;
  return <FreeVideoStatusPage token={token} placement="fvthank" />;
}
