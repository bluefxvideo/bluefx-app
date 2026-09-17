import { TalkingAvatarPage } from '@/components/talking-avatar/talking-avatar-page';

/**
 * AI Avatar Layout
 *
 * Renders TalkingAvatarPage once at the layout level so it stays mounted when
 * the user moves between Generate and History. Each route used to mount its own
 * copy, so one look at History threw away the picked avatar, the tier and the
 * typed script, and detached a video that was still rendering. Same pattern as
 * ai-cinematographer/layout.tsx.
 *
 * The page files under this segment return null: the layout provides all
 * visible content, and the hook reads the active tab from the pathname.
 */
export default function TalkingAvatarLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  return <TalkingAvatarPage />;
}
