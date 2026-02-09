import { Metadata } from 'next';
import { ThumbnailMachinePage } from '@/components/thumbnail-machine/thumbnail-machine-page';

export const metadata: Metadata = {
  title: 'Pro - Thumbnail Machine | BlueFX AI',
  description: 'Generate high-quality thumbnails with nano-banana-pro model, resolution control, and format selection.',
};

export default function ProPage() {
  return <ThumbnailMachinePage />;
}
