import { VideoRoughcutPage } from '@/components/video-roughcut/video-roughcut-page';

/**
 * Video Rough-Cut Editor Layout
 *
 * Renders VideoRoughcutPage once at the layout level so state (including
 * in-flight ffmpeg extraction and realtime subscriptions) survives sub-route
 * navigation. Sub-route page files return null.
 */
export default function VideoRoughcutLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  return <VideoRoughcutPage />;
}
