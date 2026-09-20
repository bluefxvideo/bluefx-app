'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getSmartVideoJob,
  listSmartVideoJobs,
  requestSmartVideoUploads,
  reviseSmartVideoJob,
  startSmartVideo,
} from '@/actions/tools/smart-video';
import { phantomCredits } from '@/lib/smart-video/pricing';
import { SMART_VIDEO_MAX_FILE_MB, SMART_VIDEO_MAX_FILES, type SmartVideoJob } from '@/types/smart-video';

const POLL_MS = 4000;
const isRunning = (job?: SmartVideoJob | null) => Boolean(job && job.status !== 'done' && job.status !== 'failed');

export function useSmartVideo() {
  const queryClient = useQueryClient();
  const [brief, setBrief] = useState('');
  const [link, setLink] = useState('');
  const [exactWords, setExactWords] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);

  const { data: job } = useQuery({
    queryKey: ['smart-video-job', jobId],
    queryFn: () => getSmartVideoJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (isRunning(query.state.data) || !query.state.data ? POLL_MS : false),
    // People switch tabs while they wait; the job should still be followed to its end.
    refetchIntervalInBackground: true,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['smart-video-jobs'],
    queryFn: () => listSmartVideoJobs(),
  });

  // The list shows each job's status, so it is refreshed when the open job finishes.
  useEffect(() => {
    if (job?.status === 'done' || job?.status === 'failed') queryClient.invalidateQueries({ queryKey: ['smart-video-jobs'] });
  }, [job?.status, queryClient]);

  const addFiles = useCallback((added: File[]) => {
    const tooBig = added.filter((f) => f.size > SMART_VIDEO_MAX_FILE_MB * 1024 * 1024);
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(', ')}: over ${SMART_VIDEO_MAX_FILE_MB} MB`);
    setFiles((current) => [...current, ...added.filter((f) => !tooBig.includes(f))].slice(0, SMART_VIDEO_MAX_FILES));
  }, []);

  const removeFile = useCallback((index: number) => setFiles((current) => current.filter((_, i) => i !== index)), []);

  const start = useCallback(async () => {
    if (!brief.trim() && !link.trim()) {
      toast.error('Write what the video is about, or paste a Zillow or Amazon link');
      return;
    }
    try {
      setUploading({ done: 0, total: files.length });
      const requested = await requestSmartVideoUploads({ files: files.map((f) => ({ name: f.name, size: f.size })) });
      if (!requested.success) throw new Error(requested.error);

      // Files go straight to storage; a server action would cap them at 1 MB of text.
      for (const [i, slot] of requested.data.slots.entries()) {
        const res = await fetch(slot.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': files[i].type || 'application/octet-stream' },
          body: files[i],
        });
        if (!res.ok) throw new Error(`Uploading ${files[i].name} failed`);
        setUploading({ done: i + 1, total: files.length });
      }

      const started = await startSmartVideo({
        jobId: requested.data.jobId,
        brief,
        length: exactWords ? 'script' : 'auto',
        link: link.trim(),
        uploads: requested.data.slots.map((slot) => ({ name: slot.name, path: slot.path })),
      });
      if (!started.success) throw new Error(started.error);
      setJobId(started.data.jobId);
      queryClient.invalidateQueries({ queryKey: ['smart-video-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start the video');
    } finally {
      setUploading(null);
    }
  }, [brief, link, exactWords, files, queryClient]);

  // "Leave a note": the change becomes a new job that reuses the finished video's files.
  const [revising, setRevising] = useState(false);
  const revise = useCallback(
    async (note: string) => {
      if (!jobId) return false;
      setRevising(true);
      try {
        const revised = await reviseSmartVideoJob({ jobId, note });
        if (!revised.success) throw new Error(revised.error);
        setJobId(revised.data.jobId);
        queryClient.invalidateQueries({ queryKey: ['smart-video-jobs'] });
        queryClient.invalidateQueries({ queryKey: ['user-credits'] });
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not send the note');
        return false;
      } finally {
        setRevising(false);
      }
    },
    [jobId, queryClient],
  );

  const reset = useCallback(() => {
    setJobId(null);
    setBrief('');
    setLink('');
    setFiles([]);
    queryClient.invalidateQueries({ queryKey: ['smart-video-jobs'] });
  }, [queryClient]);

  return {
    brief,
    setBrief,
    link,
    setLink,
    exactWords,
    setExactWords,
    files,
    addFiles,
    removeFile,
    job: job ?? null,
    history,
    uploading,
    credits: phantomCredits(brief, exactWords),
    revise,
    revising,
    isBusy: Boolean(uploading) || revising || isRunning(job) || (Boolean(jobId) && !job),
    start,
    reset,
    openJob: setJobId,
  };
}
