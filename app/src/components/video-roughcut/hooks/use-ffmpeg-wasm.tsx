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
 *
 * ffmpeg.wasm is loaded from its prebuilt files in /public/ffmpeg (@ffmpeg/ffmpeg 0.12.15,
 * MIT) with a script tag, not imported from npm: its worker loads the core with a dynamic
 * import() that both Next.js bundlers rewrite and break ("expression is too dynamic").
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
  /** False for audio-only files (cover art does not count as video). */
  hasVideo?: boolean;
  /** Channel count of each audio stream, in file order, e.g. [2] for one stereo stream. */
  audioStreams?: number[];
  audioSampleRate?: number;
}

/** ffmpeg prints a layout name for standard layouts and "N channels" for the rest. */
const CHANNELS_BY_LAYOUT: Record<string, number> = {
  mono: 1, stereo: 2, downmix: 2, '2.1': 3, '3.0': 3, '3.0(back)': 3, '3.1': 4, '4.0': 4, quad: 4,
  'quad(side)': 4, '4.1': 5, '5.0': 5, '5.0(side)': 5, '5.1': 6, '5.1(side)': 6, '6.0': 6,
  '6.1': 7, '7.0': 7, '7.1': 8, '7.1(wide)': 8,
};

export interface ExtractAudioResult {
  blob: Blob;
  hash: string;
  probed: ProbedMetadata;
}

const FFMPEG_SCRIPT_URL = '/ffmpeg/ffmpeg.js';
/** The 32 MB core comes from a CDN; the second is the fallback when the first is down. */
const CORE_BASE_URLS = [
  'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd',
];

type FFmpegGlobal = { FFmpegWASM?: { FFmpeg: new () => FFmpegInstance } };

let scriptPromise: Promise<void> | null = null;
function loadFfmpegScript(): Promise<void> {
  if ((window as unknown as FFmpegGlobal).FFmpegWASM) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = FFMPEG_SCRIPT_URL;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      el.remove();
      reject(new Error('Could not load the audio extractor. Check your connection and try again.'));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/** Download a file and hand it to the worker as a same-origin blob URL. */
async function toBlobURL(url: string, mimeType: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: mimeType }));
}

async function fetchCore(): Promise<{ coreURL: string; wasmURL: string }> {
  let lastError: unknown;
  for (const base of CORE_BASE_URLS) {
    try {
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      return { coreURL, wasmURL };
    } catch (err) {
      lastError = err;
      console.warn(`ffmpeg core not available from ${base}:`, err);
    }
  }
  throw new Error(
    `Could not download the audio extractor. Check your connection and try again. (${lastError instanceof Error ? lastError.message : 'network error'})`,
  );
}
const MOUNT_POINT = '/input';
const OUTPUT_PATH = '/output.mp3';

/** Snap measured rates (29.98, 30.01 from phones) to the standard rate they represent. */
const STANDARD_RATES = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
function snapFrameRate(fps: number): number {
  const nearest = STANDARD_RATES.reduce((a, b) => (Math.abs(b - fps) < Math.abs(a - fps) ? b : a));
  return Math.abs(nearest - fps) / nearest < 0.01 ? nearest : Math.round(fps * 1000) / 1000;
}

/**
 * Parse ffmpeg's input report ("Duration: 00:24:24.22", "1920x1080", "30 fps",
 * "rotation of -90.00", "Audio: aac, 48000 Hz, stereo"). The audio layout matters:
 * Premiere will not relink a file whose channels differ from what the XML describes.
 */
export function parseFfmpegReport(lines: string[]): ProbedMetadata {
  const out: ProbedMetadata = {};
  let rotation = 0;
  let sawVideo = false;
  const audioStreams: number[] = [];
  for (const line of lines) {
    // Everything after this describes the MP3 we are writing, not the source.
    if (/^\s*Output #\d/.test(line)) break;

    const audio = line.match(/Stream #\d+:\d+.*Audio:.*?(\d+) Hz,\s*([^,]+)/);
    if (audio) {
      const layout = audio[2].trim();
      const counted = layout.match(/^(\d+) channels/);
      audioStreams.push(counted ? +counted[1] : (CHANNELS_BY_LAYOUT[layout] ?? 2));
      out.audioSampleRate ??= +audio[1];
    }

    const d = line.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (d && out.duration === undefined) out.duration = +d[1] * 3600 + +d[2] * 60 + +d[3];

    if (!sawVideo && /Stream #\d+:\d+.*Video:/.test(line) && !/attached pic/.test(line)) {
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
  if (out.duration !== undefined) out.hasVideo = sawVideo;
  if (audioStreams.length > 0) out.audioStreams = audioStreams;
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
      await loadFfmpegScript();
      const FFmpeg = (window as unknown as FFmpegGlobal).FFmpegWASM?.FFmpeg;
      if (!FFmpeg) throw new Error('The audio extractor did not start. Reload the page and try again.');
      const ffmpeg = new FFmpeg();
      await ffmpeg.load(await fetchCore());
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
