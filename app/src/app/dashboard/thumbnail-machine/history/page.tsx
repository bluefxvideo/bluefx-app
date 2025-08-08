import { Metadata } from 'next';
import { ThumbnailMachinePage } from '@/components/thumbnail-machine/thumbnail-machine-page';

export const metadata: Metadata = {
  title: 'History - Thumbnail Machine | BlueFX AI',
  description: 'View and manage your thumbnail generation history.',
};

export default function HistoryPage() {
  return <ThumbnailMachinePage />;
}