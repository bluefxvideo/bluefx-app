'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/app/supabase/client';
import { listMyRoughcutJobs } from '@/actions/tools/video-roughcut';
import type { RoughcutJob } from '@/actions/database/video-roughcut-database';

/**
 * Returns the current user's rough-cut job history and keeps it in sync
 * via Supabase realtime (INSERT + UPDATE on video_roughcut_jobs).
 */
export function useRoughcutHistory() {
  const [jobs, setJobs] = useState<RoughcutJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMyRoughcutJobs();
      setJobs(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id || null;
      if (!userId) return;

      channel = supabase
        .channel(`roughcut_history_${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'video_roughcut_jobs',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as RoughcutJob;
              setJobs((prev) => [row, ...prev.filter((j) => j.id !== row.id)]);
            } else if (payload.eventType === 'UPDATE') {
              const row = payload.new as RoughcutJob;
              setJobs((prev) => prev.map((j) => (j.id === row.id ? row : j)));
            } else if (payload.eventType === 'DELETE') {
              const row = payload.old as { id?: string };
              if (row?.id) {
                setJobs((prev) => prev.filter((j) => j.id !== row.id));
              }
            }
          },
        )
        .subscribe();
    })();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { jobs, refresh, loading };
}
