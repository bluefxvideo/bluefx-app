'use client';

import { useCallback, useEffect, useState } from 'react';
import { listMyRoughcutJobs } from '@/actions/tools/video-roughcut';
import type { RoughcutJob } from '@/actions/database/video-roughcut-database';

const POLL_MS = 5000;
const FINISHED = ['done', 'failed'];

/**
 * The current user's rough-cut job history. While any job is still running,
 * the list refreshes every few seconds; otherwise it is loaded once.
 */
export function useRoughcutHistory() {
  const [jobs, setJobs] = useState<RoughcutJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setJobs(await listMyRoughcutJobs());
    } catch {
      // Keep the list we have; the next refresh tries again.
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const anyRunning = jobs.some((j) => !FINISHED.includes(j.status));
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(() => void refresh(true), POLL_MS);
    return () => clearInterval(timer);
  }, [anyRunning, refresh]);

  return { jobs, refresh: () => refresh(), loading };
}
