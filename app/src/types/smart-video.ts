import { z } from 'zod';
import { cleanLink } from '@/lib/smart-video/link';
import { VIDEO_FORMATS, VIDEO_LENGTHS, type VideoFormat, type VideoLength } from '@/lib/smart-video/types';

export const SMART_VIDEO_MAX_FILES = 15;
export const SMART_VIDEO_MAX_FILE_MB = 100;

export const SmartVideoUploadRequestSchema = z.object({
  files: z
    .array(z.object({ name: z.string().min(1).max(200), size: z.number().positive().max(SMART_VIDEO_MAX_FILE_MB * 1024 * 1024) }))
    .max(SMART_VIDEO_MAX_FILES),
});

export const SmartVideoStartSchema = z.object({
  jobId: z.string().uuid(),
  brief: z.string().max(8000),
  length: z.enum(VIDEO_LENGTHS).default('auto'),
  format: z.enum(VIDEO_FORMATS).default('vertical'),
  // Cleaned first: tracking parameters are dropped, so length limits apply to the real link.
  link: z.preprocess((value) => (typeof value === 'string' ? cleanLink(value) : value), z.string().url('That link does not look right').max(500, 'That link is too long').optional().or(z.literal(''))),
  uploads: z.array(z.object({ name: z.string(), path: z.string() })).max(SMART_VIDEO_MAX_FILES),
});

export const SmartVideoReviseSchema = z.object({
  jobId: z.string().uuid(),
  note: z.string().trim().min(3).max(1500),
});

export type SmartVideoStartInput = z.input<typeof SmartVideoStartSchema>;

export type SmartVideoJobStatus = 'reading' | 'directing' | 'producing' | 'rendering' | 'finishing' | 'done' | 'failed';

/** Job state, kept as job.json next to the job's files (admin-only trial: no table yet). */
export interface SmartVideoJob {
  id: string;
  userId: string;
  status: SmartVideoJobStatus;
  /** 0-100 within the rendering stage. */
  renderProgress?: number;
  brief: string;
  link?: string;
  length?: VideoLength;
  format?: VideoFormat;
  /** A revision: the job it changes and the client's note. */
  parentId?: string;
  note?: string;
  creditsUsed?: number;
  createdAt: string;
  updatedAt: string;
  videoUrl?: string;
  durationSeconds?: number;
  summary?: { format: string; style: string; styleReason: string; language: string; scenes: number; captions: boolean };
  /** What is said and what is shown, scene by scene: lets the client write precise edits. */
  script?: SmartVideoScriptScene[];
  /** API spend per step. Saved for analysis; the server never sends it to the page. */
  usage?: { step: string; usd: number; detail: string }[];
  /** Notes for the client about things only they can fix. */
  warnings?: string[];
  error?: string;
}

export interface SmartVideoScriptScene {
  /** The spoken words of the scene. */
  say: string;
  /** The texts that appear on screen. */
  show: string[];
  /** True when a person in the client's clip says it, not the narrator. */
  speaker: boolean;
}

export interface SmartVideoUploadSlot {
  name: string;
  path: string;
  uploadUrl: string;
}
