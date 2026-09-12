'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Repeat, Loader2, Download, AlertCircle, Upload, X, History, Check, Film } from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ElapsedTimer } from '@/components/tools/elapsed-timer';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { InsufficientCreditsNotice } from '@/components/ui/insufficient-credits-notice';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import {
  executeVideoSwap,
  getVideoSwapStatus,
  getVideoSwapHistory,
  cancelVideoSwapJob,
} from '@/actions/tools/video-swap';
import {
  VIDEO_SWAP_CREDITS_PER_SECOND,
  VIDEO_SWAP_MAX_SECONDS,
  videoSwapCredits,
  type VideoSwapOrientation,
} from '@/lib/video-swap/pricing';

/**
 * Video Swap: the person from a photo performs the motion of the person in a
 * video (Kling 2.6 Pro motion control on fal). Same page shape as Video
 * Maker and Image Maker: inputs on the left, result on the right, History
 * tab. The controls are exactly the engine's inputs.
 */

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const POLL_MS = 10_000;

type JobView = {
  id: string;
  status: string;
  result_video_url?: string | null;
  error_message?: string | null;
};

type HistoryJob = {
  id: string;
  status: string;
  source_video_url: string;
  character_image_url: string;
  result_video_url?: string | null;
  created_at: string | null;
};

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
        active ? 'bg-primary text-white border-primary' : 'bg-card text-zinc-400 border-border hover:text-foreground'
      )}
    >
      {active && <Check className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Could not read this video. Use an MP4 or WebM file.'));
    };
    video.src = URL.createObjectURL(file);
  });
}

async function uploadSwapFile(file: File, type: 'video' | 'image', jobId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  formData.append('jobId', jobId);
  const response = await fetch('/api/upload/video-swap', { method: 'POST', body: formData });
  return response.json();
}

function DropBox({
  accept,
  onFile,
  children,
  className,
}: {
  accept: string;
  onFile: (file: File) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={cn(
          'w-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-zinc-400 transition-colors',
          dragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-zinc-400',
          className
        )}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </>
  );
}

function DownloadableVideo({ url, className }: { url: string; className?: string }) {
  return (
    <div className={cn('group relative rounded-xl overflow-hidden border border-border bg-black', className)}>
      <video src={url} controls playsInline className="w-full h-full max-h-[70vh] object-contain" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-lg p-2"
        aria-label="Download video"
      >
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
}

function HistoryView() {
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVideoSwapHistory(undefined, 40, 0).then((res) => {
      if (res.success && res.jobs) setJobs(res.jobs);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (jobs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
        <History className="w-10 h-10" />
        <p className="text-sm">No swaps yet. Make your first one.</p>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-xl border border-border bg-card overflow-hidden">
            {job.status === 'completed' && job.result_video_url ? (
              <DownloadableVideo url={job.result_video_url} className="rounded-none border-0" />
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center gap-2 text-zinc-400 text-sm">
                {job.status === 'processing' || job.status === 'pending' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Still swapping…</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span>Did not complete</span>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 p-2 text-xs text-zinc-400">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={job.character_image_url} alt="Person" className="w-8 h-8 rounded object-cover border border-border" />
              <span>{job.created_at ? new Date(job.created_at).toLocaleString() : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VideoSwapPage() {
  const pathname = usePathname();
  const activeTab = pathname.includes('/history') ? 'history' : 'swap';
  const { credits: userCredits, refetch } = useCredits();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<VideoSwapOrientation>('video');
  const [keepSound, setKeepSound] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tabs = [
    { id: 'swap', label: 'Swap', icon: Repeat, path: '/dashboard/video-swap' },
    { id: 'history', label: 'History', icon: History, path: '/dashboard/video-swap/history' },
  ];

  const maxSeconds = VIDEO_SWAP_MAX_SECONDS[orientation];
  const tooLong = !!videoDuration && videoDuration > maxSeconds + 0.5;
  const cost = videoDuration ? videoSwapCredits(videoDuration) : 0;
  const billedSeconds = videoDuration ? Math.max(1, Math.ceil(videoDuration)) : 0;
  const processing = !!job && (job.status === 'processing' || job.status === 'pending');
  const available = userCredits?.available_credits;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const onVideo = async (file: File) => {
    setError(null);
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      setError('Use an MP4 or WebM video.');
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError('The video is over 100MB.');
      return;
    }
    try {
      const duration = await readVideoDuration(file);
      if (duration > VIDEO_SWAP_MAX_SECONDS.video + 0.5) {
        setError(`This clip is ${duration.toFixed(1)} s. The limit is ${VIDEO_SWAP_MAX_SECONDS.video} seconds.`);
        return;
      }
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setVideoDuration(duration);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this video.');
    }
  };

  const clearVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
    setVideoDuration(null);
  };

  const onImage = (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Use a JPG, PNG or WebP photo.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('The photo is over 10MB.');
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const pollJob = useCallback((jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const res = await getVideoSwapStatus(jobId);
      if (!res.success || !res.job) return;
      setJob(res.job);
      if (res.job.status === 'completed' || res.job.status === 'failed') {
        stopPolling();
        refetch();
        if (res.job.status === 'failed') setError(res.job.error_message || 'The swap did not complete.');
      }
    }, POLL_MS);
  }, [refetch, stopPolling]);

  const handleSwap = async () => {
    if (!videoFile || !imageFile || isStarting || tooLong) return;
    setIsStarting(true);
    setError(null);
    setJob(null);
    try {
      const uploadId = crypto.randomUUID();
      const video = await uploadSwapFile(videoFile, 'video', uploadId);
      if (!video.success || !video.url) throw new Error(video.error || 'Video upload failed.');
      const image = await uploadSwapFile(imageFile, 'image', uploadId);
      if (!image.success || !image.url) throw new Error(image.error || 'Photo upload failed.');

      const res = await executeVideoSwap({
        source_video_url: video.url,
        character_image_url: image.url,
        character_orientation: orientation,
        keep_original_sound: keepSound,
        prompt,
      });
      if (!res.success) {
        setError(res.error || 'Could not start the swap.');
        return;
      }
      setJob({ id: res.job_id, status: 'processing' });
      refetch();
      pollJob(res.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!job) return;
    const res = await cancelVideoSwapJob(job.id);
    if (res.success) {
      stopPolling();
      setJob({ ...job, status: 'failed', error_message: 'Cancelled. Credits were refunded.' });
      refetch();
    } else {
      setError(res.error || 'Could not cancel.');
    }
  };

  const inputPanel = (
    <div className="h-full flex flex-col gap-5 overflow-y-auto pr-1">
      <div>
        <label className="block text-sm font-medium mb-2">
          Video <span className="text-zinc-400 font-normal">· the motion to keep</span>
        </label>
        {videoFile && videoPreview ? (
          <div className="relative rounded-lg overflow-hidden border border-border bg-black">
            <video src={videoPreview} controls playsInline className="w-full max-h-56 object-contain" />
            <button
              type="button"
              onClick={clearVideo}
              className="absolute top-2 right-2 bg-black/70 text-white rounded p-1"
              aria-label="Remove video"
            >
              <X className="w-4 h-4" />
            </button>
            {videoDuration && (
              <span className="absolute bottom-2 left-2 text-xs bg-black/70 text-white rounded px-1.5 py-0.5">
                {videoDuration.toFixed(1)} s
              </span>
            )}
          </div>
        ) : (
          <DropBox accept="video/mp4,video/webm" onFile={onVideo} className="h-28">
            <Upload className="w-5 h-5" />
            <span className="text-sm">Drop a video or click to browse</span>
            <span className="text-xs">MP4 or WebM · up to 100MB · up to {VIDEO_SWAP_MAX_SECONDS.video} s</span>
          </DropBox>
        )}
        <p className="text-xs text-zinc-400 mt-2">
          One real person, whole or upper body in frame with the head visible, nothing covering them.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Person <span className="text-zinc-400 font-normal">· who performs it</span>
        </label>
        <div className="flex items-start gap-3">
          {imageFile && imagePreview ? (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Person" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-1 right-1 bg-black/70 text-white rounded p-0.5"
                aria-label="Remove photo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <DropBox accept="image/*" onFile={onImage} className="w-24 h-24">
              <Upload className="w-5 h-5" />
            </DropBox>
          )}
          <p className="text-xs text-zinc-400 pt-1">
            A photo with clear body proportions, nothing covering the person, and the person filling a good part of the frame. Single person only.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Character orientation</label>
        <div className="flex flex-wrap gap-2">
          <Pill active={orientation === 'video'} onClick={() => setOrientation('video')}>Follow the video</Pill>
          <Pill active={orientation === 'image'} onClick={() => setOrientation('image')}>Follow the image</Pill>
        </div>
        <p className="text-xs text-zinc-400 mt-2">
          {orientation === 'video'
            ? `The character faces the way the person in the video does. Best for complex motion. Up to ${VIDEO_SWAP_MAX_SECONDS.video} s.`
            : `The character keeps the pose and angle of the photo. Best when the camera moves. Up to ${VIDEO_SWAP_MAX_SECONDS.image} s.`}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label htmlFor="keep-sound" className="block text-sm font-medium">Keep original sound</label>
          <p className="text-xs text-zinc-400">The audio track of your video stays on the result</p>
        </div>
        <Switch id="keep-sound" checked={keepSound} onCheckedChange={setKeepSound} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Prompt <span className="text-zinc-400 font-normal">· optional</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the scene if you want to steer it, e.g. a bright kitchen, soft daylight"
          rows={3}
          className="w-full rounded-lg border border-border bg-card p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {tooLong && (
        <div className="flex items-start gap-2 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            This clip is {videoDuration!.toFixed(1)} s. Following the image allows {VIDEO_SWAP_MAX_SECONDS.image} s; switch to following the video or use a shorter clip.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-auto pt-2 space-y-3">
        <p className="text-xs text-zinc-400">
          {billedSeconds > 0
            ? `${billedSeconds} s × ${VIDEO_SWAP_CREDITS_PER_SECOND} credits per second. Takes about 2 minutes per second of video.`
            : `${VIDEO_SWAP_CREDITS_PER_SECOND} credits per second of video. Takes about 2 minutes per second.`}
        </p>
        {typeof available === 'number' && cost > 0 && available < cost && (
          <InsufficientCreditsNotice needed={cost} available={available} />
        )}
        <Button
          onClick={handleSwap}
          disabled={!videoFile || !imageFile || tooLong || isStarting || processing || (typeof available === 'number' && available < cost)}
          className="w-full h-11"
        >
          {isStarting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
          ) : (
            <><Repeat className="w-4 h-4 mr-2" /> Swap{cost > 0 ? ` · ${cost} credits` : ''}</>
          )}
        </Button>
      </div>
    </div>
  );

  const outputPanel = (
    <div className="h-full">
      {processing ? (
        <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Swapping the person in…</p>
          <ElapsedTimer typical="about 2 minutes per second of video" />
          <p className="text-xs text-zinc-400 text-center max-w-xs">
            You can leave this page. The finished video lands in History.
          </p>
          <Button variant="outline" size="sm" onClick={handleCancel}>Cancel and refund</Button>
        </div>
      ) : job?.status === 'completed' && job.result_video_url ? (
        <DownloadableVideo url={job.result_video_url} />
      ) : job?.status === 'failed' ? (
        <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <p className="text-sm text-center max-w-sm">{job.error_message || 'The swap did not complete.'}</p>
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3">
          <Film className="w-10 h-10" />
          <p className="text-sm">Your swapped video will appear here</p>
        </div>
      )}
    </div>
  );

  return (
    <StandardToolPage
      icon={Repeat}
      title="Video Swap"
      description="Put a new person into a video. The motion, timing and camera stay the same."
      iconGradient="bg-primary"
      toolName="Video Swap"
      tabs={<StandardToolTabs tabs={tabs} activeTab={activeTab} basePath="/dashboard/video-swap" />}
    >
      {activeTab === 'history' ? (
        <HistoryView />
      ) : (
        <StandardToolLayout>
          {inputPanel}
          {outputPanel}
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}

export default VideoSwapPage;
