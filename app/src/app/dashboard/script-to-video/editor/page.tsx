import { Metadata } from 'next';
import { ScriptToVideoPage } from '@/components/script-to-video/script-to-video-page';

export const metadata: Metadata = {
  title: 'Script to Video Editor | BlueFX AI',
  description: 'Edit and customize your AI-generated videos with intelligent editing tools.',
};

/**
 * Script to Video Editor Tab Route
 * Smart editing with minimal regeneration
 */
export default function ScriptToVideoEditorRoute() {
  return <ScriptToVideoPage />;
}