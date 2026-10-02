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
  | 'finishing'
  | 'directing'
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
  /** Project-wide reference URLs the user removed from THIS scene only. */
  excluded_project_ref_urls?: string[];
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
  /** How this scene goes into the finished ad. Filled in by "Finish the ad", editable there. */
  finish?: SceneFinish;
  /** What the director decided for this scene ("Do it for me"). */
  plan?: ScenePlan;
  /** The director's own look at the scene's picture. */
  check?: SceneCheck;
  /** The engine the scene's current clip was ordered on. Absent = best. */
  anim_engine?: CloneAnimEngine;
  /** The saved voice the scene's current clip speaks with (the narrator's, see CloneAuto.voice). Absent = a voice of the engine's own choosing. */
  anim_voice?: string | null;
  credits_spent: number;
}

// ---------------------------------------------------------------------------
// "Do it for me": the director that fills in the board and runs it
// ---------------------------------------------------------------------------

/** best = the engine that makes people talk (1080p, with sound); standard = moving footage (720p, no sound). */
export type CloneAnimEngine = 'best' | 'standard';

export interface ScenePlan {
  /** False when a shorter cut leaves this scene out. */
  keep: boolean;
  /** video = live action, still = a motionless shot, card = text typed by the editor. */
  treatment: 'video' | 'still' | 'card';
  /** on_camera = a person in the frame says the line. */
  speaker: 'on_camera' | 'narrator' | 'none';
  /**
   * The words heard during this scene belong to a phrase of the scene before or after it:
   * the scene has no words of its own and is shown over that scene's voice, as in the source ad.
   */
  over?: 'previous' | 'next';
  /** The person who speaks here is the ad's main speaker, the one the narrator stands in for: their clips speak with the narrator's voice. */
  lead?: boolean;
  /** The run that made this scene's picture and looked at it. */
  pictured?: string;
}

export interface SceneCheck {
  /** The picture this verdict is about. */
  picture_url: string;
  pass: boolean;
  /** One short sentence; shown on the card when the picture did not pass. */
  why: string;
  /** Remakes the director already made of this scene, at no charge. */
  remakes: number;
}

/** The whole ad, or a cut of about 30 or 15 seconds. */
export const AUTO_LENGTHS = ['full', '30', '15'] as const;
export type AutoLength = (typeof AUTO_LENGTHS)[number];

export type AutoStage = 'planning' | 'pictures' | 'clips' | 'finishing' | 'done' | 'failed';

/** The run the page watches. Costs are never written here: this row is readable by its owner. */
export interface AutoRun {
  id: string;
  /** draft = plan, pictures and a first finished ad; motion = clips for the chosen scenes and the ad finished again. */
  kind: 'draft' | 'motion';
  stage: AutoStage;
  /** Pictures or clips ready, of how many. */
  done: number;
  total: number;
  /** The finishing step inside the run. */
  finish?: { stage: FinishStage; progress: number };
  /** Motion run: the scenes that get a clip, and on which engine. */
  picks?: { n: number; engine: CloneAnimEngine }[];
  /** Draft run: the director's plan is on the board. */
  planned?: boolean;
  error?: string;
  started_at: string;
  /** Times a run whose server process died was picked up again. */
  resumed?: number;
}

/** A "Do it for me" run that has shown no sign of life for this long died with its server process (a deploy takes about five minutes). */
export const CLONE_AUTO_STALE_MS = 3 * 60 * 1000;
/** A dead run is picked up again this many times before it is given up. */
export const CLONE_AUTO_RESUMES = 3;

export interface CloneAuto {
  /** What the client told the director about their business. */
  brief: string;
  /** A page the client's facts were read from. */
  link?: string;
  length: AutoLength;
  /** Who and what the director replaces, in plain words. `photo` is the picture that stands in. */
  cast?: { source: string; becomes: string; photo?: string }[];
  /** What the client should know: facts the ad needs that the brief lacks, photos that could not be used. */
  notes?: string[];
  /** True once the director's plan is written into the board. */
  planned?: boolean;
  /** The narrator's voice as saved with the video engine: the main speaker's clips are ordered with it, so the ad has one voice. */
  voice?: { id: string; gender: 'female' | 'male' };
  run?: AutoRun;
}

/** Flat credits for "Do it for me": the plan, the picture checks and the finished ad. Pictures and clips are priced as on the board. */
export const CLONE_AUTO_CREDITS = 30;
/** Credits per second of a standard clip: moving footage without sound, 720p. */
export const CLONE_ANIM_STANDARD_CREDITS_PER_SECOND = 5;
/** Pictures the director may make of people and products the client has no photo of. */
export const CLONE_MAX_CAST_PICTURES = 3;
/** Remakes of a picture that did not pass the director's own look, at no charge. */
export const CLONE_FREE_REMAKES = 2;
/** The project photos a board can hold: the client's own plus the ones the director made. */
export const CLONE_MAX_PROJECT_REFS = 12;

/** How long the clip of a scene is ordered: what the card says, or the scene's cut in the source ad; the engine makes 3 to 15 seconds. */
export const cloneClipSeconds = (scene: Pick<CloneScene, 'anim_seconds' | 'start' | 'end'>) =>
  Math.min(15, Math.max(3, Math.round(scene.anim_seconds ?? Math.ceil(scene.end - scene.start))));

/**
 * Whether a scene is worth a clip by default: a person says a whole phrase to the camera.
 * In a fast-cut ad a sentence is spread over many cuts ("paprika," / "seven" / "spice,");
 * a 3-second clip for one word buys nothing, so those scenes stay pictures under the narrator.
 */
export const suggestsClip = (scene: Pick<CloneScene, 'plan' | 'finish'>) =>
  scene.plan?.speaker === 'on_camera' && (scene.finish?.line || '').split(/\s+/).filter(Boolean).length >= 4;

/** Credits for a clip of this length on this engine. */
export const cloneClipCredits = (seconds: number, engine: CloneAnimEngine = 'best') =>
  seconds * (engine === 'standard' ? CLONE_ANIM_STANDARD_CREDITS_PER_SECOND : CLONE_ANIM_CREDITS_PER_SECOND);

// ---------------------------------------------------------------------------
// "Finish the ad": the editor that turns the board into a finished ad
// ---------------------------------------------------------------------------

/** What the scene shows: its clip, its picture with a slow zoom, a typed card, or nothing (left out). */
export type FinishPicture = 'clip' | 'still' | 'card' | 'skip';
/** Where the scene's voice comes from: the person talking in the clip, the narrator, or nobody. */
export type FinishSound = 'clip' | 'narrator' | 'none';

export interface SceneFinish {
  picture: FinishPicture;
  sound: FinishSound;
  /** The words of this scene: what the narrator says, or how the caption spells what the person in the clip says. */
  line: string;
  /** Text typed on screen, one item per line; the first line is the headline. */
  text: string;
  /** What was heard in the clip when it was last checked, and which clip that was. */
  heard?: string;
  checked_clip_url?: string | null;
}

export const FINISH_LOOKS = ['clean', 'bold', 'elegant', 'playful'] as const;
export type FinishLook = (typeof FINISH_LOOKS)[number];

export interface FinishSettings {
  voice: 'female' | 'male';
  /** The narrator's recording is converted to the voice of the person who talks on camera. */
  match_voice: boolean;
  captions: boolean;
  look: FinishLook;
  /** Colour of the typed text's accents, e.g. "#D7261E"; empty = the look's own. */
  accent: string;
  music: boolean;
}

export const DEFAULT_FINISH_SETTINGS: FinishSettings = {
  voice: 'female',
  match_voice: true,
  captions: true,
  look: 'clean',
  accent: '',
  music: true,
};

export type FinishStage = 'clips' | 'voice' | 'rendering' | 'levelling' | 'done' | 'failed';

/** The run the page watches. Costs are never written here: this row is readable by its owner. */
export interface FinishRun {
  id: string;
  stage: FinishStage;
  /** Render progress, 0-100. */
  progress: number;
  error?: string;
  started_at: string;
}

export interface CloneFinish {
  settings: FinishSettings;
  /** ISO 639 code heard in the clips ("eng"); the narrator speaks it. */
  language?: string;
  run?: FinishRun;
  /** Finished ads this board already got. The first one carries the full price. */
  made?: number;
  /** A paid run ended without its finished ad: the next finishing is free. */
  owed?: boolean;
}

/** Flat credits for finishing an ad: voice, captions, typed text, music and the render. */
export const CLONE_FINISH_CREDITS = 30;
/** Finishing the same board again after a change to its words, text, music or scenes. */
export const CLONE_REFINISH_CREDITS = 10;
/** What the next "Finish the ad" on this board costs. */
export const cloneFinishCredits = (summary: CloneAnalysisSummary | null | undefined) =>
  summary?.finish?.owed ? 0 : (summary?.finish?.made || 0) > 0 ? CLONE_REFINISH_CREDITS : CLONE_FINISH_CREDITS;
/** A finishing run that has shown no sign of life for this long died with its server process. */
export const CLONE_FINISH_STALE_MS = 12 * 60 * 1000;

/** The words the client put into a scene's video prompt between quotes, or '' when there are none. */
export function spokenLineOf(motionPrompt: string | null | undefined): string {
  const quoted = /["“]([^"”]{2,})["”]/.exec(motionPrompt || '');
  return quoted ? quoted[1].trim() : '';
}

/** The scene's current clip, or null while it has none. */
export const sceneClip = (scene: CloneScene): string | null =>
  scene.anim?.status === 'completed' && scene.anim.video_url ? scene.anim.video_url : null;

/** A scene whose finish proposal is still good: it was made for the clip the scene has now. */
export const finishIsCurrent = (scene: CloneScene): boolean =>
  Boolean(scene.finish) && (scene.finish?.checked_clip_url ?? null) === sceneClip(scene);

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
    parts.push(spokenSentence(analysis.dialog));
  }
  parts.push(CLONE_ANIM_AUDIO_DIRECTIVE);
  return parts.join(' ');
}

/** The sentence that makes a person in the clip say a line. The line sits between quotes: spokenLineOf reads it back. */
export const spokenSentence = (line: string) => `The person says, lips in sync: "${line.trim().replace(/["“”]/g, "'")}"`;

/** Closes every video prompt: the clip brings the sound of its scene, the music comes from the editor. */
export const CLONE_ANIM_AUDIO_DIRECTIVE = 'Audio: natural diegetic sound for the scene only — no background music, no soundtrack.';

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
  /**
   * Verbatim transcript of the source video's spoken audio with rough
   * [m:ss] line timestamps. Display-only (board reference panel) — never
   * fed into image/video generation. '' = transcribed, no speech found;
   * undefined = not yet transcribed (legacy projects backfill on open).
   */
  transcript?: string;
  /**
   * True once per-scene dialog has been corrected against the full
   * transcript (fragment transcriptions mishear words). Legacy projects
   * backfill on open; new scans set it during analysis.
   */
  dialog_reconciled?: boolean;
  /**
   * User-editable soundtrack prompt — SENT to the music engine on assemble
   * (plus an automatic target-length suffix). Defaults from music_brief;
   * the board's Soundtrack panel is the single source of truth.
   */
  music_prompt?: string;
  /**
   * Tempo of the original soundtrack, MEASURED from the audio by
   * autocorrelation (see lib/clone-studio/tempo.ts) — never model-guessed.
   * Absent when no steady pulse was found (speech-only ads).
   */
  music_bpm?: number;
  /**
   * Three ready-to-paste soundtrack prompts (Faithful / Bolder / Modern),
   * built from music_brief + the measured BPM. Picking one loads it into the
   * editable music_prompt; they are also copyable into Music Maker.
   */
  music_prompt_options?: Array<{ label: string; prompt: string }>;
  /** "Finish the ad": the settings the client chose and the run in progress. */
  finish?: CloneFinish;
  /** "Do it for me": what the client told the director, what the director decided, and the run in progress. */
  auto?: CloneAuto;
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
