import { AICinematographerPage } from '@/components/ai-cinematographer/ai-cinematographer-page';

/**
 * AI Cinematographer Layout
 *
 * Renders AICinematographerPage once at the layout level so it stays mounted
 * across all sub-route navigations. This preserves React state (including File
 * objects for reference images, animation queue, etc.) without needing
 * localStorage serialization.
 *
 * Individual page files under this segment return null — the layout provides
 * all visible content.
 */
export default function AICinematographerLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  return <AICinematographerPage />;
}
