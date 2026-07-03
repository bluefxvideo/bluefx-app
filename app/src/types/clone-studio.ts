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

export interface SceneAnalysis {
  action_arc: SceneActionArc;
  /** Spoken words during this scene, verbatim. Empty string if none. */
  dialog: string;
  /** Framing + camera movement, e.g. "medium close-up, slow push-in". */
  camera: string;
  /** Text overlays shown in this scene (re-typed in the editor, never generated). */
  on_screen_text: string;
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
  credits_spent: number;
}

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

/** Flat credits for ingest + segmentation + structured analysis. */
export const CLONE_INGEST_CREDITS = 5;
/** Credits per keyframe-edit attempt (nb2 ≈ $0.04-0.06, gpt-2 ≈ $0.10-0.25 COGS). */
export const CLONE_IMAGE_CREDITS = 4;
/** Credits per second of Kling O3 Pro animation, audio on (≈$0.14/s COGS → ~2-3x margin). */
export const CLONE_ANIM_CREDITS_PER_SECOND = 5;
/** Version history depth per scene (mirrors the editor's previousVersions UX). */
export const CLONE_MAX_IMAGE_VERSIONS = 8;

export type CloneImageEngine = 'nb2' | 'gpt2';
/** Longest source ad we accept, seconds (cost guard). */
export const CLONE_MAX_SOURCE_SECONDS = 180;
/** Scenes shorter than this get merged into the previous scene, seconds. */
export const CLONE_MIN_SCENE_SECONDS = 0.4;
/** Hard cap on scene count (cost guard; ads never legitimately exceed this). */
export const CLONE_MAX_SCENES = 30;
