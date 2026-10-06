import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveReplay } from '@/components/free-video/live-replay';

/**
 * DEV ONLY: the live thank-you page as a visitor sees it, playing the record of a real run (live-demo.ts)
 * sped up to about 35 seconds, then the ready page. A 404 in production.
 */

export const metadata: Metadata = {
  title: 'Free video ad: live replay (dev preview)',
};

export default function LiveReplayPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LiveReplay />;
}
