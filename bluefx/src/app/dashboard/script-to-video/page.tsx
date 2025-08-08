import { Metadata } from 'next';
import { ScriptToVideoPage } from '@/components/script-to-video/script-to-video-page';

export const metadata: Metadata = {
  title: 'Script to Video | BlueFX AI',
  description: 'Transform scripts into professional TikTok-style videos with AI-powered voice, visuals, and captions.',
};

/**
 * Script to Video Tool Page - AI-Orchestrated Video Creation
 * Replaces 5 legacy edge functions with intelligent workflow orchestration
 * Features: Script analysis, voice generation, image creation, timeline assembly
 */
export default function ScriptToVideoRoute() {
  return <ScriptToVideoPage />;
}