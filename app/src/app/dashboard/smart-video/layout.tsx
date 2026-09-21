import { SmartVideoPage } from '@/components/smart-video/smart-video-page';

/**
 * The Phantom (Smart Video). Rendered at the layout level so a running job's
 * state survives sub-route navigation; the page file returns null. The
 * dashboard already requires a signed-in user; the actions check again.
 */
export default function SmartVideoLayout({ children: _children }: { children: React.ReactNode }) {
  return <SmartVideoPage />;
}
