import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MakeVideoAdPreview } from '@/components/smart-video/make-video-ad-preview';
import { PREVIEW_STATES, type PreviewState } from '@/components/smart-video/preview-states';

/**
 * DEV ONLY: every state of Make a Video Ad from sample data, in light and in dark, inside the dashboard's own frame.
 * Nothing is uploaded, charged or made; the buttons do nothing. A 404 in production.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Make a Video Ad: every state (dev preview)',
};

interface MakeVideoAdPreviewPageProps {
  searchParams: Promise<{ state?: string; theme?: string; empty?: string; bare?: string }>;
}

export default async function MakeVideoAdPreviewPage({ searchParams }: MakeVideoAdPreviewPageProps) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { state, theme, empty, bare } = await searchParams;
  const shown = (PREVIEW_STATES.some((s) => s.id === state) ? state : 'start') as PreviewState;
  return <MakeVideoAdPreview state={shown} theme={theme === 'dark' ? 'dark' : 'light'} empty={empty === '1'} bare={bare === '1'} />;
}
