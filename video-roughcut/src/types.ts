/**
 * Shared types for the video roughcut worker service.
 * Mirrors the original CLI types, adapted for HTTP/async job model.
 */

export interface VideoMetadata {
  /** Original video filename (for XML pathurl — path-free) */
  fileName: string;
  /** Seconds */
  duration: number;
  /** Source frame rate as detected in the browser, e.g. 29.97, 30, 25, 60. Defaults to 29.97. */
  frameRate: number;
  width: number;
  height: number;
  /** False for audio-only uploads (MP3, WAV): the XML then has no video track. Defaults to true. */
  hasVideo?: boolean;
  /**
   * Channel count of each audio stream in the source file, as ffmpeg reported it in the
   * browser, e.g. [2] for a stereo recording. Premiere will not relink a file whose
   * channels differ from the XML. Defaults to [2].
   */
  audioStreams?: number[];
  /** Source audio sample rate in Hz. Defaults to 48000. */
  audioSampleRate?: number;
  /**
   * The rate the file is built on (ffmpeg's "tbr"), e.g. exactly 30 for a recording whose
   * measured average reads 29.98. The DaVinci Resolve XML uses it. Defaults to frameRate.
   */
  nominalFrameRate?: number;
}

export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface TranscriptSegment {
  id: number;
  text: string;
  start: number; // seconds
  end: number;   // seconds
  words: WordTiming[];
}

export interface Transcript {
  fullText: string;
  segments: TranscriptSegment[];
  words: WordTiming[];
  duration: number;
  language: string;
}

/** A segment of video to KEEP in the final edit */
export interface KeepSegment {
  id: number;
  /** Start time in the source video (seconds) — precise, for ffmpeg render */
  sourceIn: number;
  /** Start time compensated for Premiere Pro's ~150ms late start */
  sourceInPremiere: number;
  /** End time in the source video (seconds) */
  sourceOut: number;
  /** Start time in the output timeline (seconds) */
  recordIn: number;
  /** End time in the output timeline (seconds) */
  recordOut: number;
  /** The transcript text for this segment */
  text: string;
}

export interface EditDecision {
  segments: KeepSegment[];
  totalSourceDuration: number;
  totalOutputDuration: number;
  removedDuration: number;
  removedCount: number;
  /**
   * Details of what was cut, for the "what was cut" UI display.
   * Each entry is a removed segment or group with timestamp + text + reason.
   */
  removals: RemovalDetail[];
}

export interface RemovalDetail {
  /** Timestamp in source video (seconds) where this removal starts */
  start: number;
  /** Timestamp in source video (seconds) where this removal ends */
  end: number;
  /** The transcribed text that was removed */
  text: string;
  /** Claude's reason for removing it */
  reason: string;
}

export interface SilenceGap {
  start: number;
  end: number;
  duration: number;
}

/**
 * A job request arriving at the worker's POST /jobs endpoint.
 * The audio has already been extracted in the browser and uploaded to Supabase Storage.
 */
export interface JobRequest {
  jobId: string;          // UUID for this job
  userId: string;         // for storage partitioning
  /** Short-lived signed Supabase Storage URL for the extracted MP3 audio */
  audioUrl: string;
  /** SHA-256 of the audio bytes — cache key for transcriptions */
  audioHash: string;
  /** Original video filename (used in XML pathurl; path-free) */
  videoFilename: string;
  /** Video metadata read in the browser */
  videoMetadata: VideoMetadata;
  /** URL to POST progress/completion updates back to the Next.js app */
  callbackUrl: string;
}

export type JobStatus =
  | 'queued'
  | 'transcribing'
  | 'analyzing'
  | 'generating'
  | 'done'
  | 'failed';

export interface JobRecord {
  jobId: string;
  status: JobStatus;
  progress: number;          // 0-100
  startedAt: number;         // epoch ms
  finishedAt?: number;
  error?: string;
  xmlPath?: string;
  transcriptPath?: string;
  removals?: RemovalDetail[];
  segmentsRemoved?: number;
  timeSavedSeconds?: number;
}

/**
 * Callback payload POSTed to the Next.js app when the job completes or fails.
 * The webhook route at /api/webhooks/video-roughcut consumes this.
 */
export interface CallbackPayload {
  jobId: string;
  status: JobStatus;
  progress: number;
  /** Storage path of the XML in the private video-roughcut bucket */
  xmlPath?: string;
  /** Storage path of the transcript JSON in the private video-roughcut bucket */
  transcriptPath?: string;
  removals?: RemovalDetail[];
  segmentsRemoved?: number;
  timeSavedSeconds?: number;
  error?: string;
}
