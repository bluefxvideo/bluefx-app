'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/app/supabase/client';

/**
 * App-wide generation notifications.
 *
 * Every generation webhook (replicate / fal / hedra) broadcasts a
 * `webhook_update` event on the user's realtime channel when a job finishes.
 * Tool pages subscribe while you're on them — but if you navigate away, nothing
 * told you your video/song/avatar finished. This component lives in the
 * dashboard layout and turns those broadcasts into toasts with a "View" action,
 * no matter which page you're on.
 *
 * Suppressed while you're already on the originating tool's page (it has its
 * own, richer in-place UI).
 */

const TOOL_INFO: Record<string, { label: string; route: string }> = {
  'ai-cinematographer': { label: 'Video Maker video', route: '/dashboard/ai-cinematographer' },
  'video-swap': { label: 'Video Swap', route: '/dashboard/video-swap' },
  'music-machine': { label: 'Music track', route: '/dashboard/music-maker' },
  'talking-avatar': { label: 'AI Avatar video', route: '/dashboard/talking-avatar' },
  'thumbnail-machine': { label: 'Thumbnail', route: '/dashboard/thumbnail-machine' },
  'script-to-video': { label: 'Script to Video', route: '/dashboard/script-to-video' },
  'logo-generator': { label: 'Logo', route: '/dashboard/logo-generator' },
};

export function GlobalGenerationNotifier() {
  const pathname = usePathname();
  const router = useRouter();
  // Refs so the subscription callback always sees current values without resubscribing
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`user_${user.id}_updates`)
        .on('broadcast', { event: 'webhook_update' }, ({ payload }) => {
          const p = (payload || {}) as { tool_type?: string; prediction_id?: string; status?: string };
          const info = p.tool_type ? TOOL_INFO[p.tool_type] : undefined;
          if (!info) return;

          // Terminal states only
          const ok = p.status === 'succeeded' || p.status === 'completed';
          const failed = p.status === 'failed';
          if (!ok && !failed) return;

          // De-dupe (webhooks can broadcast more than once per job)
          const key = `${p.prediction_id || ''}:${p.status}`;
          if (seenRef.current.has(key)) return;
          seenRef.current.add(key);

          // The originating tool page shows its own completion UI
          if (pathnameRef.current?.startsWith(info.route)) return;

          if (ok) {
            toast.success(`${info.label} is ready`, {
              duration: 10000,
              action: { label: 'View', onClick: () => router.push(`${info.route}/history`) },
            });
          } else {
            toast.error(`${info.label} generation failed — your credits were refunded automatically.`, {
              duration: 10000,
            });
          }
        })
        .subscribe();
    };

    setup();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
