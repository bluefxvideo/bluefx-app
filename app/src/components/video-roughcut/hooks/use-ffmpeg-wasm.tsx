'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Lazy-loaded ffmpeg.wasm wrapper.
 *
 * Extracts a small MP3 from a video File in the browser, so multi-GB videos never
 * leave the user's computer. The file is mounted with WORKERFS, which lets ffmpeg
 * read it in pieces instead of copying the whole video into memory first.
 *
 * ffmpeg's own stream report gives us the real duration, size, rotation and frame
 * rate. The browser's <video> element can't read frame rate and fails on codecs it
 * can't play, such as ProRes.
 *
 * Uses the single-thread core: it needs no cross-origin isolation headers, which
 * would break images and embeds elsewhere in the dashboard. MP3 encoding is
 * single-threaded anyway.
 */

type LogEvent = { type: string; message: string };

type FFmpegInstance = {
  load(options: { coreURL: string; wasmURL: string }): Promise<boolean>;
  exec(args: string[]): Promise<number>;
  readFile(path: string): Promise<string | Uint8Array>;
  deleteFile(path: string): Promise<boolean>;
  createDir(path: string): Promise<boolean>;
  mount(fsType: string, options: { files: File[] }, mountPoint: string): Promise<boolean>;
  unmount(mountPoint: string): Promise<boolean>;
  on(event: 'progress', cb: (evt: { progress: number }) => void): void;
  on(event: 'log', cb: (evt: LogEvent) => void): void;
  off(event: 'log', cb: (evt: LogEvent) => void): void;
};

export interface ProbedMetadata {
  duration?: number;
  width?: number;
  height?: number;
  frameRate?: number;
}

export interface ExtractAudioResult {
  blob: Blob;
  hash: string;
  probed: ProbedMetadata;
}

const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
const MOUNT_POINT = '/input';
const OUTPUT_PATH = '/output.mp3';

/** Snap measured rates (29.98, 30.01 from phones) to the standard rate they represent. */
const STANDARD_RATES = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
function snapFrameRate(fps: number): number {
  const nearest = STANDARD_RATES.reduce((a, b) => (Math.abs(b - fps) < Math.abs(a - fps) ? b : a));
  return Math.abs(nearest - fps) / nearest < 0.01 ? nearest : Math.round(fps * 1000) / 1000;
}

/** Parse ffmpeg's input report ("Duration: 00:24:24.22", "1920x1080", "30 fps", "rotation of -90.00"). */
export function parseFfmpegReport(lines: string[]): ProbedMetadata {
  const out: ProbedMetadata = {};
  let rotation = 0;
  let sawVideo = false;
  for (const line of lines) {
    const d = line.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (d && out.duration === undefined) out.duration = +d[1] * 3600 + +d[2] * 60 + +d[3];

    if (!sawVideo && /Stream #\d+:\d+.*Video:/.test(line)) {
      sawVideo = true;
      const size = line.match(/\b(\d{2,5})x(\d{2,5})\b/);
      if (size) {
        out.width = +size[1];
        out.height = +size[2];
      }
      const fps = line.match(/(\d+(?:\.\d+)?)\s*fps/);
      if (fps) out.frameRate = snapFrameRate(+fps[1]);
    }
    const rot = line.match(/rotation of (-?\d+(?:\.\d+)?)/);
    if (rot) rotation = Math.round(+rot[1]);
  }
  if (Math.abs(rotation) % 180 === 90 && out.width && out.height) {
    [out.width, out.height] = [out.height, out.width];
  }
  return out;
}

export function useFfmpegWasm() {
  const ffmpegRef = useRef<FFmpegInstance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (ffmpegRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const ffmpeg = new FFmpeg() as unknown as FFmpegInstance;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpeg.on('progress', (evt) => {
        setProgress(Math.round(Math.max(0, Math.min(1, evt.progress)) * 100));
      });
      ffmpegRef.current = ffmpeg;
      setLoaded(true);
    } catch (err: unknown) {
      console.error('❌ ffmpeg load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ffmpeg');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /** Extract 16 kHz mono 64 kbps MP3 (about 480 KB per minute) from any video or audio file. */
  const extractAudio = useCallback(
    async (file: File): Promise<ExtractAudioResult> => {
      await load();
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg) throw new Error('ffmpeg not loaded');

      setProgress(0);
      setError(null);

      const report: string[] = [];
      const onLog = (evt: LogEvent) => report.push(evt.message);
      ffmpeg.on('log', onLog);

      try {
        await ffmpeg.createDir(MOUNT_POINT).catch(() => undefined);
        await ffmpeg.mount('WORKERFS', { files: [file] }, MOUNT_POINT);

        const code = await ffmpeg.exec([
          '-i', `file:${MOUNT_POINT}/${file.name}`,
          '-vn',
          '-acodec', 'libmp3lame',
          '-ar', '16000',
          '-ac', '1',
          '-b:a', '64k',
          OUTPUT_PATH,
        ]);
        if (code !== 0) {
          throw new Error('Could not read the audio from this file. Try exporting it as MP3 and uploading that.');
        }

        const out = await ffmpeg.readFile(OUTPUT_PATH);
        const bytes = typeof out === 'string' ? new TextEncoder().encode(out) : out;
        const blob = new Blob([bytes as BlobPart], { type: 'audio/mpeg' });

        const hashBuf = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
        const hash = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        setProgress(100);
        return { blob, hash, probed: parseFfmpegReport(report) };
      } finally {
        ffmpeg.off('log', onLog);
        await ffmpeg.unmount(MOUNT_POINT).catch(() => undefined);
        await ffmpeg.deleteFile(OUTPUT_PATH).catch(() => undefined);
      }
    },
    [load],
  );

  /** Fallback size and duration from a <video> element, for files ffmpeg didn't describe. */
  const readVideoMetadata = useCallback(
    (file: File): Promise<ProbedMetadata> =>
      new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.src = url;
        const done = (meta: ProbedMetadata) => {
          URL.revokeObjectURL(url);
          video.removeAttribute('src');
          resolve(meta);
        };
        video.onloadedmetadata = () =>
          done({
            width: video.videoWidth || undefined,
            height: video.videoHeight || undefined,
            duration: Number.isFinite(video.duration) ? video.duration : undefined,
          });
        video.onerror = () => done({});
      }),
    [],
  );

  return { load, extractAudio, readVideoMetadata, progress, loaded, loading, error };
}
