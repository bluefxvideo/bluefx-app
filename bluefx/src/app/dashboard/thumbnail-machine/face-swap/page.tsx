import { Metadata } from 'next';
import { ThumbnailMachinePage } from '@/components/thumbnail-machine/thumbnail-machine-page';

export const metadata: Metadata = {
  title: 'Face Swap - Thumbnail Machine | BlueFX AI',
  description: 'Replace faces in generated thumbnails with advanced AI face swapping.',
};

export default function FaceSwapPage() {
  return <ThumbnailMachinePage />;
}