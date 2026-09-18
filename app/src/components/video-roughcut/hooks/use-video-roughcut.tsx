'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/app/supabase/client';
import {
  requestRoughcutUpload,
  startRoughcutJob,
} from '@/actions/tools/video-roughcut';
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
 *   → startRoughcutJob → subscribe to realtime job row updates
 */
export function useVideoRoughcut() {
  const { extractAudio, readVideoMetadata, progress: ffmpegProgress } =
    useFfmpegWasm();

  const [currentJob, setCurrentJob] = useState<RoughcutJob | null>(null);
  const [stage, setStage] = useState<RoughcutStage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>['channel']
  > | null>(null);

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

  const teardownChannel = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const subscribeToJob = useCallback(
    (jobId: string) => {
      teardownChannel();
      const supabase = createClient();
      const channel = supabase
        .channel(`roughcut_${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_roughcut_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const updated = payload.new as RoughcutJob;
            setCurrentJob(updated);
            if (updated.status === 'done' || updated.status === 'failed') {
              setStage('idle');
              if (updated.status === 'failed') {
                setError(updated.status_reason || 'Job failed');
              }
            }
          },
        )
        .subscribe();

      channelRef.current = channel;
    },
    [teardownChannel],
  );

  const reset = useCallback(() => {
    teardownChannel();
    setCurrentJob(null);
    setStage('idle');
    setProgress(0);
    setError(null);
  }, [teardownChannel]);

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

        // 5. Subscribe to the job row before starting, so no update is missed.
        subscribeToJob(reqRes.jobId);

        // 6. Charge credits and hand the job to the worker.
        setStage('processing');
        setProgress(0);
        const startRes = await startRoughcutJob({
          jobId: reqRes.jobId,
          uploadPath: reqRes.uploadPath,
        });
        if (!startRes.success) {
          throw new Error(startRes.error || 'Could not start job');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStage('idle');
      }
    },
    [extractAudio, readVideoMetadata, reset, subscribeToJob],
  );

  useEffect(() => {
    return () => {
      teardownChannel();
    };
  }, [teardownChannel]);

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
