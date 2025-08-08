import { Metadata } from 'next';
import { ThumbnailMachinePage } from '@/components/thumbnail-machine/thumbnail-machine-page';

export const metadata: Metadata = {
  title: 'Thumbnail Machine | BlueFX AI',
  description: 'Generate AI-powered YouTube thumbnails with advanced customization options.',
};

/**
 * Thumbnail Machine Tool Page - Integrated into Dashboard
 * First AI-orchestrated tool following Phase 4 standardized patterns
 */
export default function ThumbnailMachineRoute() {
  return <ThumbnailMachinePage />;
}