'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRoughcutJobStatus,
  listMyRoughcutJobs,
  requestRoughcutUpload,
  startRoughcutJob,
} from '@/actions/tools/video-roughcut';
import { isStalePageError } from '@/lib/stale-page';
import type {
  RoughcutJob,
} from '@/actions/database/video-roughcut-database';
import { useFfmpegWasm } from './use-ffmpeg-wasm';

export type RoughcutStage =
  | 'idle'
  | 'reading'
  | 'extracting'
  | 'uploading'
  | 'processing';


/**
 * Orchestrates the full Rough-Cut flow:
 *   readVideoMetadata → extractAudio → requestRoughcutUpload → PUT signed URL
 *   → startRoughcutJob → poll the job row until it is done or failed
 *
 * Status comes from polling, not Supabase realtime: polling needs no database
 * publication setup and keeps working through dropped websocket connections.
 */
const POLL_MS = 3000;
const IN_FLIGHT = ['queued', 'transcribing', 'analyzing', 'generating'];
/** A reload picks a running job back up if it started within this window. */
const RESUME_WINDOW_MS = 30 * 60 * 1000;

export function useVideoRoughcut() {
  const { extractAudio, readVideoMetadata, progress: ffmpegProgress } =
    useFfmpegWasm();

  const [currentJob, setCurrentJob] = useState<RoughcutJob | null>(null);
  const [stage, setStage] = useState<RoughcutStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isProcessing = stage !== 'idle' && stage !== 'processing'
    ? true
    : stage === 'processing' &&
      currentJob?.status !== 'done' &&
      currentJob?.status !== 'failed';

  // Mirror ffmpeg's internal progress to our progress state while extracting
  useEffect(() => {
    if (stage === 'extracting') setProgress(ffmpegProgress);
  }, [ffmpegProgress, stage]);

  // Mirror job progress to our progress state while the worker runs
  useEffect(() => {
    if (stage === 'processing' && currentJob) {
      setProgress(currentJob.progress ?? 0);
    }
  }, [currentJob, stage]);

  const stopWatching = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const watchJob = useCallback(
    (jobId: string) => {
      stopWatching();
      let busy = false;
      const tick = async () => {
        if (busy) return;
        busy = true;
        try {
          const job = await getRoughcutJobStatus(jobId);
          if (!job) return;
          setCurrentJob(job);
          if (job.status === 'done' || job.status === 'failed') {
            stopWatching();
            setStage('idle');
            if (job.status === 'failed') setError(job.status_reason || 'Job failed');
          }
        } catch (err) {
          // A deploy while the job runs: this tab can no longer ask, but the job goes on.
          if (isStalePageError(err instanceof Error ? err.message : '')) {
            stopWatching();
            setStage('idle');
            setError('The app was updated while your video was processing. Reload the page and open History to get your XML.');
          }
          // Anything else is a network blip: the next tick tries again.
        } finally {
          busy = false;
        }
      };
      pollRef.current = setInterval(tick, POLL_MS);
      void tick();
    },
    [stopWatching],
  );

  const reset = useCallback(() => {
    stopWatching();
    setCurrentJob(null);
    setStage('idle');
    setProgress(0);
    setError(null);
  }, [stopWatching]);

  const startJob = useCallback(
    async (file: File) => {
      reset();
      setError(null);

      try {
        // 1. Load ffmpeg.wasm (first run downloads ~30 MB, then it's cached).
        setStage('reading');
        setProgress(0);
        const htmlMeta = /^video\//.test(file.type) ? await readVideoMetadata(file) : {};

        // 2. Extract a small MP3 in the browser. Works for video and audio files alike.
        setStage('extracting');
        setProgress(0);
        const { blob: audioBlob, hash: audioHash, probed } = await extractAudio(file);

        // ffmpeg's report is more reliable (frame rate, rotation, codecs the browser can't play).
        const videoMetadata = {
          width: probed.width ?? htmlMeta.width ?? 1920,
          height: probed.height ?? htmlMeta.height ?? 1080,
          duration: probed.duration ?? htmlMeta.duration ?? 0,
          frameRate: probed.frameRate ?? 29.97,
        };

        // 3. Reserve the job and get a signed upload URL.
        setStage('uploading');
        setProgress(0);
        const reqRes = await requestRoughcutUpload({
          videoFilename: file.name,
          audioHash,
          videoMetadata,
        });
        if (!reqRes.success || !reqRes.uploadUrl || !reqRes.jobId || !reqRes.uploadPath) {
          throw new Error(reqRes.error || 'Could not request upload URL');
        }

        // 4. PUT the MP3 straight to Supabase Storage.
        const putRes = await fetch(reqRes.uploadUrl, {
          method: 'PUT',
          body: audioBlob,
          headers: { 'Content-Type': 'audio/mpeg' },
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed: HTTP ${putRes.status}`);
        }
        setProgress(100);

        // 5. Charge credits and hand the job to the worker.
        setStage('processing');
        setProgress(0);
        const startRes = await startRoughcutJob({
          jobId: reqRes.jobId,
          uploadPath: reqRes.uploadPath,
          // The XML must describe the source's real audio, or Premiere refuses to relink it.
          media: {
            hasVideo: probed.hasVideo,
            audioStreams: probed.audioStreams,
            audioSampleRate: probed.audioSampleRate,
          },
        });
        if (!startRes.success) {
          throw new Error(startRes.error || 'Could not start job');
        }

        // 6. Follow the job until it is done or failed.
        watchJob(reqRes.jobId);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStage('idle');
      }
    },
    [extractAudio, readVideoMetadata, reset, watchJob],
  );

  // After a reload, pick a job that is still running back up.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const jobs = await listMyRoughcutJobs();
        const running = jobs.find(
          (j) =>
            IN_FLIGHT.includes(j.status) &&
            Date.now() - new Date(j.created_at ?? 0).getTime() < RESUME_WINDOW_MS,
        );
        if (!running || cancelled || pollRef.current) return;
        setCurrentJob(running);
        setStage('processing');
        watchJob(running.id);
      } catch {
        // History still lists the job; nothing to resume here.
      }
    })();
    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [watchJob, stopWatching]);

  return {
    currentJob,
    isProcessing: Boolean(isProcessing),
    stage,
    progress,
    error,
    startJob,
    reset,
  };
}
