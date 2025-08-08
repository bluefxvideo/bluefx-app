import { Metadata } from 'next';
import { ScriptToVideoPage } from '@/components/script-to-video/script-to-video-page';

export const metadata: Metadata = {
  title: 'Script to Video History | BlueFX AI',
  description: 'View and manage your script-to-video generation history.',
};

/**
 * Script to Video History Tab Route
 * Shows previous generations with filtering and search
 */
export default function ScriptToVideoHistoryRoute() {
  return <ScriptToVideoPage />;
}