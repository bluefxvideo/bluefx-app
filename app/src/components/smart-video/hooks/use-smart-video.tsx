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
import { cleanLink } from '@/lib/smart-video/link';
import { isStalePageError } from '@/lib/stale-page';
import { phantomCredits } from '@/lib/smart-video/pricing';
import type { PhantomExample } from '@/lib/smart-video/examples';
import { urlToFile } from '@/lib/url-to-file';
import type { VideoFormat, VideoLook } from '@/lib/smart-video/types';
import { SMART_VIDEO_MAX_FILE_MB, SMART_VIDEO_MAX_FILES, type SmartVideoJob } from '@/types/smart-video';

const POLL_MS = 4000;
const isRunning = (job?: SmartVideoJob | null) => Boolean(job && job.status !== 'done' && job.status !== 'failed');

export function useSmartVideo() {
  const queryClient = useQueryClient();
  const [brief, setBrief] = useState('');
  const [link, setLink] = useState('');
  const [exactWords, setExactWords] = useState(false);
  const [format, setFormat] = useState<VideoFormat>('vertical');
  const [look, setLook] = useState<VideoLook>('auto');
  // The soundtrack: a narrator and music, each of which the client can switch off
  const [voiceOver, setVoiceOver] = useState(true);
  const [music, setMusic] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);

  const { data: job, error: jobError } = useQuery({
    queryKey: ['smart-video-job', jobId],
    queryFn: () => getSmartVideoJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (isRunning(query.state.data) || !query.state.data ? POLL_MS : false),
    // People switch tabs while they wait; the job should still be followed to its end.
    refetchIntervalInBackground: true,
  });

  const { data: history = [], error: historyError } = useQuery({
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
      toast.error('Write what the video is about, or paste a link');
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
        format,
        look,
        voiceOver,
        music,
        link: cleanLink(link),
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
  }, [brief, link, exactWords, format, look, voiceOver, music, files, queryClient]);

  // "Leave a note": the change becomes a new job that reuses the finished video's files.
  const [revising, setRevising] = useState(false);
  const revise = useCallback(
    async (note: string, added: File[] = [], sound?: { voiceOver: boolean; music: boolean }) => {
      if (!jobId) return false;
      setRevising(true);
      try {
        let uploadJobId: string | undefined;
        let uploads: { name: string; path: string }[] = [];
        if (added.length) {
          const requested = await requestSmartVideoUploads({ files: added.map((f) => ({ name: f.name, size: f.size })) });
          if (!requested.success) throw new Error(requested.error);
          for (const [i, slot] of requested.data.slots.entries()) {
            const res = await fetch(slot.uploadUrl, { method: 'PUT', headers: { 'Content-Type': added[i].type || 'application/octet-stream' }, body: added[i] });
            if (!res.ok) throw new Error(`Uploading ${added[i].name} failed`);
          }
          uploadJobId = requested.data.jobId;
          uploads = requested.data.slots.map((slot) => ({ name: slot.name, path: slot.path }));
        }
        const revised = await reviseSmartVideoJob({ jobId, note, ...sound, uploadJobId, uploads });
        if (!revised.success) throw new Error(revised.error);
        setJobId(revised.data.jobId);
        queryClient.invalidateQueries({ queryKey: ['smart-video-jobs'] });
        queryClient.invalidateQueries({ queryKey: ['user-credits'] });
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not start the edit');
        return false;
      } finally {
        setRevising(false);
      }
    },
    [jobId, queryClient],
  );

  // A failed edit is run again as it was asked: same video, same note, same sound choices.
  // (Files that came with the failed edit are not sent again; the note box is the place for those.)
  const retryEdit = useCallback(
    async (failed: SmartVideoJob) => {
      if (!failed.parentId) return false;
      setRevising(true);
      try {
        const revised = await reviseSmartVideoJob({ jobId: failed.parentId, note: failed.note || '', voiceOver: failed.voiceOver, music: failed.music, uploads: [] });
        if (!revised.success) throw new Error(revised.error);
        setJobId(revised.data.jobId);
        queryClient.invalidateQueries({ queryKey: ['smart-video-jobs'] });
        queryClient.invalidateQueries({ queryKey: ['user-credits'] });
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not start the edit');
        return false;
      } finally {
        setRevising(false);
      }
    },
    [queryClient],
  );

  // A failed new video: back to the form, with the text it was made from (the files have to be added again).
  const tryAgain = useCallback((failed: SmartVideoJob) => {
    setBrief((current) => current || failed.brief || '');
    setLink((current) => current || failed.link || '');
    setJobId(null);
  }, []);

  // "Try this example": the form gets exactly what made the example video, photos and clip included,
  // so the structure is there to copy before the user swaps in their own business.
  const [loadingExample, setLoadingExample] = useState<string | null>(null);
  const loadExample = useCallback(async (example: PhantomExample) => {
    setLoadingExample(example.id);
    setBrief(example.brief);
    setLink(example.link ?? '');
    setFormat(example.format);
    setLook(example.look);
    setExactWords(false);
    setVoiceOver(true);
    setMusic(true);
    setFiles([]);
    try {
      const loaded = await Promise.all(
        example.files.map((file) => urlToFile(file.url, file.name, file.kind === 'clip' ? 'video/mp4' : 'image/jpeg')),
      );
      setFiles(loaded.slice(0, SMART_VIDEO_MAX_FILES));
      toast.success('Example loaded. Swap in your own text and photos, then summon the Phantom.');
    } catch {
      toast.error('The example photos could not be loaded. The text is filled in, so add your own photos.');
    } finally {
      setLoadingExample(null);
    }
  }, []);

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
    format,
    setFormat,
    look,
    setLook,
    voiceOver,
    setVoiceOver,
    music,
    setMusic,
    files,
    addFiles,
    removeFile,
    job: job ?? null,
    history,
    // The app was updated while this tab was open: its requests no longer reach the server until a reload.
    stalePage: isStalePageError(jobError?.message) || isStalePageError(historyError?.message),
    uploading,
    credits: phantomCredits(brief, exactWords),
    revise,
    revising,
    isBusy: Boolean(uploading) || revising || isRunning(job) || (Boolean(jobId) && !job),
    start,
    reset,
    retryEdit,
    tryAgain,
    openJob: setJobId,
    loadExample,
    loadingExample,
  };
}
