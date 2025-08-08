import { Metadata } from 'next';
import { ThumbnailMachinePage } from '@/components/thumbnail-machine/thumbnail-machine-page';

export const metadata: Metadata = {
  title: 'Title Generator - Thumbnail Machine | BlueFX AI',
  description: 'Generate engaging YouTube titles optimized for clicks and SEO.',
};

export default function TitlesPage() {
  return <ThumbnailMachinePage />;
}