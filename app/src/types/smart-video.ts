import { z } from 'zod';

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
  link: z.string().url().max(500).optional().or(z.literal('')),
  uploads: z.array(z.object({ name: z.string(), path: z.string() })).max(SMART_VIDEO_MAX_FILES),
});

export type SmartVideoStartInput = z.infer<typeof SmartVideoStartSchema>;

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
  createdAt: string;
  updatedAt: string;
  videoUrl?: string;
  durationSeconds?: number;
  summary?: { format: string; style: string; styleReason: string; language: string; scenes: number; captions: boolean };
  usage?: { step: string; usd: number; detail: string }[];
  error?: string;
}

export interface SmartVideoUploadSlot {
  name: string;
  path: string;
  uploadUrl: string;
}
