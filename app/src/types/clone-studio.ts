/**
 * Clone Studio (Beta) — scene-level ad cloning.
 *
 * Pipeline: ingest source ad → ffmpeg shot segmentation → per-scene keyframes →
 * structured Gemini analysis → scene board (user swaps + image iteration) →
 * Kling O3 Pro animation (audio on) → assembly on original cut timing.
 */

export type CloneProjectStatus =
  | 'pending'
  | 'downloading'
  | 'segmenting'
  | 'analyzing'
  | 'board_ready'
  | 'animating'
  | 'assembling'
  | 'completed'
  | 'failed';

export type CloneScenePlatform = 'tiktok' | 'instagram' | 'facebook' | 'youtube' | 'upload';

/**
 * Action arc per the keyframe-state rule: the image-edit stage paints
 * `start_state` (including impossible/gag states) INTO the keyframe; the video
 * model only performs the arc. `invariants` are hard constraints the motion
 * prompt must repeat (e.g. "the bottle NEVER comes off her hand").
 */
export interface SceneActionArc {
  start_state: string;
  action: string;
  end_state: string;
  invariants: string[];
}

/**
 * Per-scene fields follow the finetuned S-E-A-L-Ca breakdown framework from
 * the Video Analyzer's storyboard_recreation prompt (subject, environment,
 * action, lighting, camera), plus the action-arc layer that i2v animation
 * requires.
 */
export interface SceneAnalysis {
  action_arc: SceneActionArc;
  /** Primary focus: who/what, appearance, expression, position in frame. */
  subject: string;
  /** Location, background elements, props, color palette. */
  environment: string;
  /** Light source, quality, contrast, mood. */
  lighting: string;
  /** Spoken words during this scene, verbatim. Empty string if none. */
  dialog: string;
  /** Shot type + angle + movement, e.g. "medium close-up, eye level, slow push-in". */
  camera: string;
  /** Text overlays shown in this scene (re-typed in the editor, never generated). */
  on_screen_text: string;
  /** Narrative role of the shot: hook | problem | solution | proof | CTA | transition. */
  purpose: string;
  /** Swappable entities visible in this scene, e.g. ["MAIN CHARACTER", "Pringles can"]. */
  swap_targets: string[];
}

export type SceneAnimStatus = 'idle' | 'generating' | 'completed' | 'failed';

export interface SceneAnim {
  request_id: string | null;
  video_url: string | null;
  status: SceneAnimStatus;
  /** Credit-ledger reference for the pending attempt — refunds match on it. */
  attempt_id?: string | null;
}

export interface CloneScene {
  /** 1-based scene number in source order. */
  n: number;
  /** Start/end in seconds within the source video. */
  start: number;
  end: number;
  /** Original frame extracted at scene midpoint (Supabase storage URL). */
  keyframe_url: string;
  analysis: SceneAnalysis;
  /** User's swap instructions for this scene ("replace the man with the woman in ref 1"). */
  user_instruction: string;
  /** User-uploaded reference images for this scene (person, product, person+product). */
  user_ref_urls: string[];
  /** Currently approved swapped keyframe (null until first generation). */
  edited_image_url: string | null;
  /** Older generated keyframes, most recent first. */
  image_versions: string[];
  anim: SceneAnim;
  /**
   * User override for animation length in seconds (3-15). Absent/null = auto
   * (original cut duration rounded up). Assembly still trims to the original
   * cut, so longer clips are extra footage for manual editing.
   */
  anim_seconds?: number | null;
  /**
   * The EXACT prompt sent to the video model — visible and editable in the
   * card, no hidden additions. Pre-filled from the scene analysis at ingest;
   * absent on older scenes, where composeMotionPrompt provides the same
   * default the card displays.
   */
  motion_prompt?: string | null;
  /** Editable negative prompt; absent/null = CLONE_ANIM_NEGATIVE_PROMPT default. */
  negative_prompt?: string | null;
  /**
   * Clip history, newest first, INCLUDING the current one — anim.video_url
   * is just the selected pointer (same stable-order pattern as
   * image_versions). Assembly uses the selected clip.
   */
  anim_versions?: string[];
  /**
   * User-added scene (uploaded frame, no source timing). Its start/end are
   * synthetic (0..duration) and assembly uses the chosen clip length.
   */
  is_custom?: boolean;
  credits_spent: number;
}

/**
 * Default video prompt composed from the scene analysis (action-arc rule:
 * beats + locked end state + invariants, camera, lip-synced dialog, no-music
 * audio directive). This is a SUGGESTION shown in the card — whatever text
 * the user leaves in the box is what the model receives, verbatim.
 */
export function composeMotionPrompt(analysis: SceneAnalysis | undefined): string {
  const parts: string[] = [];
  const arc = analysis?.action_arc;
  if (arc?.action) parts.push(arc.action);
  if (arc?.end_state) parts.push(`End state: ${arc.end_state}`);
  if (arc?.invariants?.length) parts.push(arc.invariants.join(' '));
  if (analysis?.camera) parts.push(`Camera: ${analysis.camera}.`);
  if (analysis?.dialog?.trim()) {
    parts.push(`The person says, lips in sync: "${analysis.dialog.trim()}"`);
  }
  parts.push('Audio: natural diegetic sound for the scene only — no background music, no soundtrack.');
  return parts.join(' ');
}

/**
 * Fixed quality guard sent as the NEGATIVE prompt with every animation —
 * shown in the card so nothing about the request is invisible. Content-free
 * on purpose: it can only suppress artifacts, never add objects.
 */
export const CLONE_ANIM_NEGATIVE_PROMPT =
  'morphing, warping, distorted faces, extra fingers, deformed hands, text, subtitles, captions, watermark, background music, soundtrack';

export interface CloneCharacterProfile {
  /** Stable identifier used across scene analyses, e.g. "MAIN CHARACTER". */
  id: string;
  description: string;
}

export interface CloneAnalysisSummary {
  summary: string;
  characters: CloneCharacterProfile[];
  products: string[];
  visual_style: string;
  music_brief: string;
  /**
   * Project-level reference images (person/product) automatically included
   * in EVERY scene generation — the identity-consistency fix. Lives in this
   * jsonb to avoid a schema migration.
   */
  project_ref_urls?: string[];
}

export interface CloneProject {
  id: string;
  user_id: string;
  title: string | null;
  source_url: string | null;
  source_platform: CloneScenePlatform | null;
  source_video_url: string | null;
  video_duration_seconds: number | null;
  video_width: number | null;
  video_height: number | null;
  aspect_ratio: string | null;
  status: CloneProjectStatus;
  error_message: string | null;
  scenes: CloneScene[];
  analysis_summary: CloneAnalysisSummary | null;
  credits_spent: number;
  final_video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCloneProjectRequest {
  /** Social/YouTube URL of the ad to clone. */
  source_url?: string;
  /** Already-uploaded video URL (direct file upload path). */
  video_url?: string;
  title?: string;
}

export interface CloneProjectResponse {
  success: boolean;
  project?: CloneProject;
  error?: string;
}

/**
 * Flat credits for ingest + segmentation + structured analysis. Covers the
 * worst case: big YouTube ads cost $0.30-0.40 via the Apify fallback plus
 * Gemini analysis (owner-priced 2026-07-04).
 */
export const CLONE_INGEST_CREDITS = 10;
/** Credits per keyframe-edit attempt (nb2 ≈ $0.04-0.06, gpt-2 ≈ $0.10-0.25 COGS). */
export const CLONE_IMAGE_CREDITS = 4;
/**
 * Credits per second of Kling O3 Pro animation, audio on. COGS verified at
 * $0.14/s (1 billable unit ≈ 1s on real runs) → 3.5x monthly / 1.8x yearly
 * margin at 8 cr/s — the same markup tier as Video Maker Pro (owner-priced
 * 2026-07-04; was 5 cr/s ≈ break-even for yearly subscribers).
 */
export const CLONE_ANIM_CREDITS_PER_SECOND = 8;
/** Credits for the optional Lyria music bed at assembly (assembly itself is free). */
export const CLONE_MUSIC_CREDITS = 5;
/** Version history depth per scene (mirrors the editor's previousVersions UX). */
export const CLONE_MAX_IMAGE_VERSIONS = 8;

export type CloneImageEngine = 'nb2' | 'gpt2';
/** Longest source ad we accept, seconds (cost guard). */
export const CLONE_MAX_SOURCE_SECONDS = 180;
/** Scenes shorter than this get merged into the previous scene, seconds. */
export const CLONE_MIN_SCENE_SECONDS = 0.4;
/** Hard cap on scene count (cost guard; ads never legitimately exceed this). */
export const CLONE_MAX_SCENES = 30;
