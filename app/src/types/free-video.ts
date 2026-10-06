import { z } from 'zod';
import { VALIDATION } from '@/lib/free-video/copy';
import type { SmartVideoJobStatus } from '@/types/smart-video';

// ---------------------------------------------------------------------------------------------
// Form (POST /api/free-video)
// ---------------------------------------------------------------------------------------------

/** A view token: 16 random bytes, base64url (22 characters). Checked before any query runs. */
export const FREE_VIDEO_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;
/** A newsletter or campaign tag from ?ref= (or ?utm_campaign=). */
export const FREE_VIDEO_REF_PATTERN = /^[\w.-]{0,60}$/;

export const FreeVideoLeadSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, VALIDATION.firstNameMissing)
    .max(60, VALIDATION.firstNameLong)
    .refine((v) => !/https?:|www\.|\.[a-z]{2,}\b|[<>@]/i.test(v), VALIDATION.firstNameOnly),
  email: z.string().trim().toLowerCase().max(254, VALIDATION.email).email(VALIDATION.email),
  website: z.string().trim().min(3, VALIDATION.websiteMissing).max(500, VALIDATION.websiteLong),
  // A bad tag never blocks a visitor: it is dropped (the landing page already cleans it).
  ref: z.string().trim().max(60).regex(FREE_VIDEO_REF_PATTERN).optional().catch(undefined),
  /**
   * Milliseconds between the form opening and the submit, measured in the browser
   * (Math.round(performance.now() - openedAt)). verifyHuman() drops submits faster than 1.5 s.
   * Measured on one clock, so a visitor whose computer clock is off is never mistaken for a bot.
   */
  elapsedMs: z.number().int().min(0).max(86_400_000).optional().catch(undefined),
  /** Older form: Date.now() when the form mounted, in the visitor's clock. Only used when elapsedMs is missing, and a clock running ahead never drops anyone. */
  startedAt: z.number().int().optional().catch(undefined),
  /** Honeypot: a field name no autofill knows; it must stay empty. Any odd value counts as filled. */
  fv_note: z.string().max(200).optional().catch('filled'),
  consent: z.literal(true, { errorMap: () => ({ message: VALIDATION.consent }) }),
});
/** The parsed body. */
export type FreeVideoLeadInput = z.infer<typeof FreeVideoLeadSchema>;
/** What the form sends. */
export type FreeVideoLeadBody = z.input<typeof FreeVideoLeadSchema>;

/** The `code` of an error answer from POST /api/free-video (ERRORS in copy.ts has a message for each). */
export type FreeVideoErrorCode =
  | 'invalid'
  | 'refused'
  | 'notFound'
  | 'unreadable'
  | 'duplicateEmail'
  | 'duplicateSite'
  | 'tooMany'
  | 'closed'
  | 'paused'
  | 'generic';

/** The data of a 200 answer from POST /api/free-video. token null = the silent drop for bots. */
export interface FreeVideoSubmitData {
  token: string | null;
}

// ---------------------------------------------------------------------------------------------
// Database rows (free_video_* tables; not in the generated Supabase types)
// ---------------------------------------------------------------------------------------------

export type FreeVideoLeadStatus = 'queued' | 'running' | 'held' | 'done' | 'failed' | 'rejected';
export type FreeVideoSource = 'landing' | 'fb_lead' | 'manual' | 'test';
export type FreeVideoEmailStatus = 'pending' | 'sending' | 'sent' | 'inactive' | 'failed' | 'skipped';
/** The $29 unlock on a lead row. paid: payment in, clean render not started; rendering: clean render running; ready: clean file uploaded. */
export type FreeVideoUnlockStatus = 'none' | 'paid' | 'rendering' | 'ready' | 'failed' | 'refunded';

/** What qualityGate() returns; stored in free_video_leads.gate. */
export interface FreeVideoGateResult {
  pass: boolean;
  reasons: string[];
  /** style, format, language, words, photosShown, animatedPlanned, animatedOk, drawings, lastScreen, domainShown, warnings, costUsd, probeSeconds, meanVolumeDb */
  facts: Record<string, unknown>;
  /** The file checks could not run (download or ffprobe failed on our side): the next sweep tries again for GATE.inconclusiveMinutes before holding. */
  inconclusive?: boolean;
}

/**
 * One free_video_leads row, as PostgREST returns it: timestamps are ISO strings, numeric columns
 * arrive as JSON numbers, uuid[] as string[].
 */
export interface FreeVideoLead {
  id: string;
  created_at: string;
  updated_at: string;
  source: FreeVideoSource;
  ref: string | null;
  first_name: string;
  /** Lowercased and trimmed. */
  email: string;
  /** Dedupe key: +tag cut, gmail dots removed (emailKeyOf). */
  email_key: string;
  website_url: string;
  /** Hostname without www. (normalizeWebsite). */
  website_domain: string;
  view_token: string;
  status: FreeVideoLeadStatus;
  reason: string | null;
  attempts: number;
  not_before: string | null;
  /** The current or last smart_video_jobs id; every claim makes a new one. */
  job_id: string | null;
  job_ids: string[];
  claimed_at: string | null;
  finished_at: string | null;
  video_url: string | null;
  /** Content plus the 1 s end card. */
  duration_seconds: number | null;
  look: string | null;
  gate: FreeVideoGateResult | null;
  /** P1: up to 4 photo urls for the status page. */
  photos: string[] | null;
  /** What the running job has made so far, for the live status page (FreeVideoLive). null until the job starts. */
  live: FreeVideoLive | null;
  /** API spend of every attempt, failed ones included. */
  est_cost_usd: number;
  /** The reserve a running attempt holds against daily_usd until its real cost is known. */
  reserved_usd: number;
  email_status: FreeVideoEmailStatus;
  email_claimed_at: string | null;
  email_attempts: number;
  emailed_at: string | null;
  /** The MailerLite subscriber status from the delivery upsert (active, unsubscribed, bounced, junk, unconfirmed). */
  ml_status: string | null;
  first_viewed_at: string | null;
  played_at: string | null;
  clicked_at: string | null;
  bought_at: string | null;
  sale_ref: string | null;
  is_customer: boolean;
  ip: string | null;
  user_agent: string | null;
  consent_at: string | null;
  /** Offer 1, the $29 unlock: 'none' until a FastSpring order for the video-ad-unlock product arrives. */
  unlock_status: FreeVideoUnlockStatus;
  /** FastSpring order id; unique, so a webhook delivered twice unlocks once. */
  unlock_order_id: string | null;
  unlock_amount: number | null;
  unlock_currency: string | null;
  /** When the payment arrived. */
  unlocked_at: string | null;
  /** The clean render (no watermark, no end card) at an unguessable file name. */
  clean_video_url: string | null;
  clean_attempts: number;
  clean_claimed_at: string | null;
  clean_ready_at: string | null;
  unlock_emailed_at: string | null;
}

/** A patch for transitionLead(); id and created_at never change. */
export type FreeVideoLeadPatch = Partial<Omit<FreeVideoLead, 'id' | 'created_at'>>;

/** The one free_video_settings row (id = 1): every runtime knob of the funnel. */
export interface FreeVideoSettings {
  id: number;
  /** false: the form says "come back tomorrow". */
  accepting: boolean;
  /** false: nothing new starts, running jobs finish (the kill switch). */
  starting: boolean;
  /** true: every passing video ad waits for the owner's release. */
  review_mode: boolean;
  max_running: number;
  /** Starts per rolling 24 h. */
  daily_starts: number;
  /** API spend per rolling 24 h, failed attempts included. */
  daily_usd: number;
  /** Accepted signups per rolling 24 h. */
  daily_leads: number;
  per_ip_daily: number;
  /** No free start while this many paying Phantom jobs work; 0 = off. */
  paid_busy_limit: number;
  /** Reserved per running attempt until its real cost is known. */
  est_usd: number;
  /** Owns every free job; null = nothing starts. */
  system_user_id: string | null;
  last_sweep_at: string | null;
  updated_at: string;
}

/**
 * One free_video_alerts row. key dedupes, one alert per attempt: 'held:<lead id>:<job id>', 'failed:<lead id>:<job id>',
 * 'rejected:<lead id>:<job id>', 'email:<lead id>:<job id>', 'stuck:<date-2h>', 'cap:<date>', 'breaker:<settings updated_at>',
 * 'cron-silent:<date-hour>', and the unlock's 'unlock-<kind>:<order or lead id>'.
 */
export interface FreeVideoAlert {
  key: string;
  created_at: string;
  subject: string;
  body: string | null;
  sent: boolean;
  error: string | null;
}

/** Who and where a lead came from, as createLead() receives it. ip is null on the later Facebook path. */
export type LeadMeta = { source: FreeVideoSource; ip: string | null; userAgent: string | null };

// ---------------------------------------------------------------------------------------------
// The status page (GET /api/free-video/<token>); never carries the email, ip, reason, gate or cost
// ---------------------------------------------------------------------------------------------

/** queued/running → queued/making, done → ready, held → checking, rejected → unreadable, failed → failed. */
export type FreeVideoState = 'queued' | 'making' | 'ready' | 'checking' | 'unreadable' | 'failed';

export interface FreeVideoView {
  state: FreeVideoState;
  /** making: the job's current step (a job already 'done' shows step 5, 'Final check'). */
  step?: SmartVideoJobStatus;
  /** making: render progress 0-100 while rendering. */
  progress?: number;
  /** queued: how many queued video ads are ahead of this one (0 = next in line). */
  position?: number;
  /** queued: null when no time can be promised; etaNote then says why. */
  etaMinutes?: number | null;
  /**
   * queued, when etaMinutes is null: 'paused' = new starts are switched off for now (settings.starting = false);
   * 'capped' = today's video ads are all handed out (the rolling 24 h cap), so this one starts when a slot opens.
   */
  etaNote?: 'paused' | 'capped';
  firstName: string;
  /** The website as people read it (an international domain in its own letters, not the xn-- form). */
  domain: string;
  /** ready: the free video ad, with the BlueFX watermark in the middle and the 1 s end card. */
  videoUrl?: string;
  /** ready: the same file as a download (Content-Disposition: attachment). */
  downloadUrl?: string;
  /** An active AI Media Machine customer: Offer 2 swaps to "Open The Phantom". */
  isCustomer: boolean;
  /** Offer 1, the $29 unlock. */
  unlock: FreeVideoUnlockView;
  /** P1 */
  photos?: string[];
  /** P1: the narration, one line per scene. */
  script?: string[];
  /** making / checking: everything the job has made so far, shown the moment it exists. */
  live?: FreeVideoLive;
}

/**
 * The live status page (owner 2026-10-06: "visualize and actually show what we are building"): what the
 * running free job has made so far. The runner writes it as each piece is saved; every url is a real file
 * of this job (nothing is a stand-in), and a piece the job never makes never appears.
 */
export interface FreeVideoLive {
  /** The website photos The Phantom picked, in order (up to 8). */
  photos?: string[];
  /** The look the director chose: playful, elegant, bold, clean or whiteboard. */
  look?: string;
  /** The script, scene by scene, as soon as the director has written it. */
  scenes?: FreeVideoLiveScene[];
  /** Pictures The Phantom makes (lifestyle photos, whiteboard drawings), by the id the scenes use. */
  made?: Record<string, string>;
  /** Moving clips, by the id of the photo they animate. */
  clips?: Record<string, string>;
  voiceUrl?: string;
  musicUrl?: string;
}

export interface FreeVideoLiveScene {
  /** What the voice says. */
  say: string;
  /** The words on screen. */
  show: string[];
  /** The id of the scene's main picture: a website photo, a picture The Phantom makes, or a drawing. */
  imageId?: string;
  /** The website photo's url when the picture is one; a made picture's url arrives in made[imageId]. */
  image?: string;
  /** The scene's picture is a whiteboard drawing (a hand draws it). */
  drawing?: boolean;
}

/**
 * Offer 1 on the status page.
 * - unavailable: the video ad is not ready yet (the page shows only the teaser line).
 * - available: show the $29 offer.
 * - paid / rendering: payment received, The Phantom is making the clean version.
 * - ready: the clean download.
 * - failed: the clean render failed for good; the owner was alerted.
 */
export type FreeVideoUnlockState = 'unavailable' | 'available' | 'paid' | 'rendering' | 'ready' | 'failed';

export interface FreeVideoUnlockView {
  state: FreeVideoUnlockState;
  /** Same-origin /go/fvunlock?t=<token>: logs the click, then 302s to the FastSpring checkout. Set while state is unavailable or available. */
  checkoutPath?: string;
  /** state ready: the clean file and its download link. */
  cleanVideoUrl?: string;
  cleanDownloadUrl?: string;
}

/** The 5 progress lines of the status page, by job step (copy.ts statusSteps gives their text). */
export const FREE_VIDEO_STEP_COUNT = 5;
export const FREE_VIDEO_STEP_OF: Record<SmartVideoJobStatus, 1 | 2 | 3 | 4 | 5> = {
  reading: 1,
  directing: 2,
  producing: 3,
  rendering: 4,
  finishing: 5,
  done: 5,
  failed: 5,
};

// ---------------------------------------------------------------------------------------------
// P1 measurement (POST /api/free-video/event, the sendBeacon target)
// ---------------------------------------------------------------------------------------------

export const FREE_VIDEO_EVENTS = ['landing_view', 'form_start', 'video_play', 'video_complete', 'download'] as const;
/** A page event the browser may send. */
export type FreeVideoEvent = (typeof FREE_VIDEO_EVENTS)[number];
/** Events only the server writes (the /go route logs each offer click). */
export type FreeVideoServerEvent = FreeVideoEvent | 'cta_click';

export const FreeVideoEventSchema = z.object({
  e: z.enum(FREE_VIDEO_EVENTS),
  /** The view token, when the page has one. */
  t: z.string().max(40).optional(),
  /** The visitor id kept in localStorage 'fv_vid'. */
  v: z.string().max(40).optional(),
  ref: z.string().max(60).optional(),
});
export type FreeVideoEventInput = z.infer<typeof FreeVideoEventSchema>;

/** One free_video_events row. */
export interface FreeVideoEventRow {
  id: number;
  at: string;
  event: FreeVideoServerEvent;
  lead_id: string | null;
  visitor_id: string | null;
  placement: string | null;
  ref: string | null;
  meta: Record<string, unknown> | null;
}
