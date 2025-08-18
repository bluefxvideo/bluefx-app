import { Metadata } from 'next';
import { EditorRedirect } from '@/components/script-to-video/editor-redirect';

export const metadata: Metadata = {
  title: 'Script to Video Editor | BlueFX AI',
  description: 'Edit and customize your AI-generated videos with intelligent editing tools.',
};

/**
 * Script to Video Editor Tab Route
 * Redirects to external React video editor
 */
export default function ScriptToVideoEditorRoute() {
  return <EditorRedirect />;
}