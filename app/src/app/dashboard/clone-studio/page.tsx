import { Metadata } from 'next';
import { CloneStudioPage } from '@/components/clone-studio/clone-studio-page';

export const metadata: Metadata = {
  title: 'Clone Studio (Beta) | BlueFX AI',
  description: 'Scene-by-scene ad cloning: swap people and products in a real ad, then reshoot it with AI.',
};

export default function CloneStudioRoute() {
  return <CloneStudioPage />;
}
