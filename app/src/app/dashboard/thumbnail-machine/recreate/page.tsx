import { Metadata } from 'next';
import { ThumbnailMachinePage } from '@/components/thumbnail-machine/thumbnail-machine-page';

export const metadata: Metadata = {
  title: 'Recreate - Thumbnail Machine | BlueFX AI',
  description: 'Recreate thumbnails from reference images with AI-powered style matching.',
};

export default function RecreatePage() {
  return <ThumbnailMachinePage />;
}