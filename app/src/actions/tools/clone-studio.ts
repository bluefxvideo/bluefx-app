'use server';

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { createClient, createAdminClient } from '@/app/supabase/server';
import {
  uploadVideoToStorage,
  uploadImageToStorage,
  downloadAndUploadImage,
} from '@/actions/supabase-storage';
import { deductCredits } from '@/actions/database/cinematographer-database';
import { refundFailedGeneration } from '@/lib/credits/refund';
import { ensureFalCompatibleImage } from '@/lib/fal-image-guard';
import { generateWithFalNanaBanana2, type NanoBananaAspectRatio } from '@/actions/models/fal-nano-banana-2';
import { editWithGptImage2 } from '@/actions/models/fal-gpt-image-2';
import { imageEngine } from '@/lib/image-engine';
import {
  submitKlingO3ProImageToVideo,
  getKlingQueueStatus,
  getKlingResult,
} from '@/actions/models/fal-kling-video';
import { finalizeCloneAnimation, failCloneAnimation } from '@/lib/clone-studio/animation';
import { mutateProject, type ProjectPatch } from '@/lib/clone-studio/store';
import { assembleClips } from '@/lib/clone-studio/assembly';
import { detectTempo } from '@/lib/clone-studio/tempo';
import { generateLyriaInstrumental } from '@/actions/models/gemini-lyria';
import { ingestSourceVideo } from '@/lib/clone-studio/ingest';
import { CLONE_STUDIO_EXAMPLES } from '@/lib/clone-studio/examples';
import {
  makeWorkDir,
  cleanupWorkDir,
  probeVideo,
  segmentVideo,
  fitForInlineAnalysis,
  downloadToFile,
  buildAnalysisKeyframes,
  extractSceneClips,
} from '@/lib/clone-studio/segmentation';
import { analyzeCloneScenes, buildSoundtrackPromptOptions, contextualizeSwapInstruction, reconcileSceneDialogWithTranscript, rewriteMotionPromptsForSwap, transcribeCloneVideo, type AnalyzeCloneScenesResult } from '@/actions/tools/video-analyzer';
import {
  CLONE_ANIM_CREDITS_PER_SECOND,
  CLONE_ANIM_NEGATIVE_PROMPT,
  CLONE_IMAGE_CREDITS,
  CLONE_INGEST_CREDITS,
  CLONE_MAX_IMAGE_VERSIONS,
  CLONE_MAX_SOURCE_SECONDS,
  CLONE_MUSIC_CREDITS,
  composeMotionPrompt,
  type CloneAnalysisSummary,
  type CloneImageEngine,
  type CloneProject,
  type CloneProjectResponse,
  type CloneScene,
  type CreateCloneProjectRequest,
  type SceneAnalysis,
} from '@/types/clone-studio';

function closestAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio >= 1.4) return '16:9';
  if (ratio <= 0.72) return '9:16';
  return '1:1';
}

/**
 * Create the project row and deduct the ingest fee. Returns immediately so
 * the UI has a projectId to poll; the client then calls processCloneProject
 * to run the 1-2 min pipeline while polling getCloneProject for stage display.
 */
export async function createCloneProject(
  request: CreateCloneProjectRequest
): Promise<CloneProjectResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Authentication required' };
  }

  if (!request.source_url && !request.video_url) {
    return { success: false, error: 'Provide an ad URL or upload a video file' };
  }

  const admin = createAdminClient();
  const { data: created, error: insertError } = await admin
    .from('ad_clone_projects')
    .insert({
      user_id: user.id,
      title: request.title || null,
      source_url: request.source_url || null,
      status: 'pending',
      credits_spent: CLONE_INGEST_CREDITS,
    })
    .select()
    .single();
  if (insertError || !created) {
    console.error('Clone Studio: failed to create project row:', insertError);
    return { success: false, error: 'Could not create the project' };
  }
  const projectId = created.id as string;

  const deduction = await deductCredits(
    user.id,
    CLONE_INGEST_CREDITS,
    'clone_studio_ingest',
    { batch_id: projectId }
  );
  if (!deduction.success) {
    await admin.from('ad_clone_projects').delete().eq('id', projectId);
    return { success: false, error: deduction.error || 'Insufficient credits' };
  }

  return { success: true, project: created as unknown as CloneProject };
}

/**
 * Run the ingest pipeline for a freshly created project: download → store a
 * copy → ffmpeg cut detection + keyframes → structured Gemini analysis.
 * Status is written to the row at each stage; failures refund the ingest fee.
 * The upload-path video URL is passed again because it is not stored on the
 * row until the pipeline stores our own copy.
 */
export async function processCloneProject(
  projectId: string,
  request: CreateCloneProjectRequest
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const user = { id: loaded.userId };
  if (loaded.project.status !== 'pending') {
    return { success: false, error: `Project is already ${loaded.project.status}` };
  }

  const admin = createAdminClient();
  const updateProject = async (fields: Record<string, unknown>) => {
    await admin
      .from('ad_clone_projects')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', projectId);
  };

  const workDir = await makeWorkDir('clone-studio-');
  try {
    // 1) Ingest
    await updateProject({ status: 'downloading' });
    const ingest = await ingestSourceVideo(workDir, request);
    const probe = await probeVideo(ingest.filePath);
    if (probe.duration > CLONE_MAX_SOURCE_SECONDS) {
      throw new Error(
        `This video is ${Math.round(probe.duration)}s long — Clone Studio supports ads up to ${CLONE_MAX_SOURCE_SECONDS}s.`
      );
    }

    // Store our own copy: platform CDN URLs expire
    const sourceBuffer = await fs.readFile(ingest.filePath);
    const storedSource = await uploadVideoToStorage(
      new Blob([new Uint8Array(sourceBuffer)], { type: 'video/mp4' }),
      {
        bucket: 'videos',
        folder: 'clone-studio',
        filename: `${projectId}-source.mp4`,
        contentType: 'video/mp4',
      }
    );
    if (!storedSource.success || !storedSource.url) {
      throw new Error(`Could not store the source video: ${storedSource.error}`);
    }

    await updateProject({
      status: 'segmenting',
      source_platform: ingest.platform,
      source_video_url: storedSource.url,
      video_duration_seconds: Math.round(probe.duration * 100) / 100,
      video_width: probe.width,
      video_height: probe.height,
      aspect_ratio: closestAspectRatio(probe.width, probe.height),
      title: request.title || ingest.title || `Cloned ${ingest.platform} ad`,
    });

    // 2) Shot segmentation + keyframes
    const segmented = await segmentVideo(ingest.filePath, projectId, probe);
    await updateProject({ status: 'analyzing' });

    // 3) Structured per-scene analysis aligned to the detected cuts — shared
    // finetuned analyzer. YouTube goes native (Gemini ingests the URL, the
    // Video Analyzer's proven path); anything else, and any native failure,
    // uses the inline video bytes.
    // Per-scene clips give exact attribution (each scene analyzed from its
    // own cut); keyframes are only needed by the single-pass fallback
    const sceneClips = await extractSceneClips(ingest.filePath, segmented);
    const sceneKeyframes = sceneClips.length === segmented.length
      ? []
      : await buildAnalysisKeyframes(segmented);

    let analysis: AnalyzeCloneScenesResult | null = null;
    if (ingest.platform === 'youtube' && request.source_url) {
      const videoId = request.source_url.match(/(?:v=|youtu\.be\/|shorts\/)([^&?/]+)/)?.[1];
      if (videoId) {
        analysis = await analyzeCloneScenes({
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          sceneRanges: segmented,
          sceneClips,
          sceneKeyframes,
        });
        if (!analysis.success) {
          console.warn('Clone Studio: native YouTube analysis failed, retrying inline:', analysis.error);
        }
      }
    }
    if (!analysis?.success) {
      const fittedPath = await fitForInlineAnalysis(ingest.filePath);
      const videoBase64 = (await fs.readFile(fittedPath)).toString('base64');
      analysis = await analyzeCloneScenes({ videoBase64, sceneRanges: segmented, sceneClips, sceneKeyframes });
    }
    if (!analysis.success || !analysis.scenes || !analysis.summary) {
      throw new Error(analysis.error || 'Scene analysis failed');
    }
    const analyzedScenes = analysis.scenes;

    const scenes: CloneScene[] = segmented.map((s) => ({
      n: s.n,
      start: s.start,
      end: s.end,
      keyframe_url: s.keyframe_url,
      analysis: analyzedScenes[s.n],
      user_instruction: '',
      user_ref_urls: [],
      edited_image_url: null,
      image_versions: [],
      anim: { request_id: null, video_url: null, status: 'idle' },
      motion_prompt: composeMotionPrompt(analyzedScenes[s.n]),
      credits_spent: 0,
    }));

    // Tempo is MEASURED from the audio, not asked of the model (LLM BPM
    // guesses vary by 20+ between runs on the same clip). Non-fatal.
    let musicBpm: number | undefined;
    try {
      const tempo = await detectTempo(ingest.filePath);
      if (tempo) musicBpm = tempo.bpm;
    } catch (error) {
      console.warn('Clone Studio: tempo detection failed (non-fatal):', error);
    }

    // Three paste-ready soundtrack prompts, built with the measured BPM.
    let musicOptions: Array<{ label: string; prompt: string }> | undefined;
    if (analysis.summary.music_brief) {
      const opts = await buildSoundtrackPromptOptions(analysis.summary.music_brief, musicBpm);
      if (opts.success && opts.options?.length) musicOptions = opts.options;
      else if (opts.error) console.warn('Clone Studio: soundtrack options failed (non-fatal):', opts.error);
    }

    await updateProject({
      status: 'board_ready',
      scenes,
      analysis_summary: {
        ...analysis.summary,
        ...(musicBpm ? { music_bpm: musicBpm } : {}),
        ...(musicOptions ? { music_prompt_options: musicOptions } : {}),
      },
    });

    const { data: project } = await admin
      .from('ad_clone_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    console.log(`🎬 Clone Studio: project ${projectId} board ready — ${scenes.length} scenes`);
    return { success: true, project: project as unknown as CloneProject };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingest failed';
    console.error(`Clone Studio: project ${projectId} failed:`, error);
    await updateProject({ status: 'failed', error_message: message });
    await refundFailedGeneration({
      userId: user.id,
      referenceIds: [projectId],
      operation: 'clone studio ingest',
    });
    return { success: false, error: message };
  } finally {
    await cleanupWorkDir(workDir);
  }
}

export async function getCloneProject(projectId: string): Promise<CloneProjectResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data, error } = await supabase
    .from('ad_clone_projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (error || !data) {
    return { success: false, error: 'Project not found' };
  }
  return { success: true, project: data as unknown as CloneProject };
}

export async function listCloneProjects(): Promise<{
  success: boolean;
  projects?: CloneProject[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const { data, error } = await supabase
    .from('ad_clone_projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, projects: (data || []) as unknown as CloneProject[] };
}

/**
 * "Try this example": copy an example's saved board into the caller's own
 * projects as a fresh board_ready project — the breakdown, the photos and each
 * scene's instruction and motion prompt, with no pictures, clips or final video.
 * Free: it skips the paid breakdown. Only the examples listed in code can be
 * copied, from their fixed board.json; an earlier copy is opened again.
 */
export async function copyCloneExample(exampleId: string): Promise<CloneProjectResponse> {
  const example = CLONE_STUDIO_EXAMPLES.find((e) => e.id === exampleId);
  if (!example) return { success: false, error: 'Example not found' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required' };

  const admin = createAdminClient();
  const { data: earlier } = await admin
    .from('ad_clone_projects')
    .select('*')
    .eq('user_id', user.id)
    .eq('title', example.copyTitle)
    .order('created_at', { ascending: false })
    .limit(1);
  if (earlier?.[0]) return { success: true, project: earlier[0] as unknown as CloneProject };

  let board: Record<string, unknown>;
  try {
    const res = await fetch(example.boardUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`board ${res.status}`);
    board = await res.json();
  } catch (err) {
    console.error('Clone Studio: example board could not be loaded:', err);
    return { success: false, error: 'The example could not be loaded. Please try again.' };
  }

  const { data: copy, error } = await admin
    .from('ad_clone_projects')
    .insert({
      user_id: user.id,
      title: example.copyTitle,
      status: 'board_ready',
      credits_spent: 0,
      source_url: board.source_url ?? null,
      source_platform: board.source_platform ?? null,
      source_video_url: board.source_video_url ?? null,
      video_duration_seconds: board.video_duration_seconds ?? null,
      video_width: board.video_width ?? null,
      video_height: board.video_height ?? null,
      aspect_ratio: board.aspect_ratio ?? null,
      analysis_summary: board.analysis_summary ?? null,
      scenes: board.scenes ?? [],
    })
    .select()
    .single();
  if (error || !copy) {
    console.error('Clone Studio: example copy failed:', error);
    return { success: false, error: 'The example could not be loaded. Please try again.' };
  }
  return { success: true, project: copy as unknown as CloneProject };
}

// ---------------------------------------------------------------------------
// Scene board actions (stage 2): per-scene inputs, keyframe edits, versions
// ---------------------------------------------------------------------------

/** Fetch a project through the user client so RLS enforces ownership. */
async function loadOwnedProject(projectId: string): Promise<
  | { ok: true; userId: string; project: CloneProject }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Authentication required' };

  const { data, error } = await supabase
    .from('ad_clone_projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (error || !data) return { ok: false, error: 'Project not found' };
  return { ok: true, userId: user.id, project: data as unknown as CloneProject };
}

/**
 * Changes one scene of a project the caller owns. The change is made on the row as it is
 * at the moment of writing (see mutateProject), so it cannot undo what a clip, a picture
 * or another card wrote in the meantime. `extra` adds project-level columns to the same write.
 */
async function changeScene(
  projectId: string,
  sceneN: number,
  change: (scene: CloneScene) => CloneScene,
  extra: (project: CloneProject) => ProjectPatch = () => ({})
): Promise<CloneProjectResponse> {
  const project = await mutateProject(projectId, (fresh) =>
    fresh.scenes.some((s) => s.n === sceneN)
      ? { scenes: fresh.scenes.map((s) => (s.n === sceneN ? change(s) : s)), ...extra(fresh) }
      : null
  );
  return project ? { success: true, project } : { success: false, error: 'Project not found' };
}

const EMPTY_SUMMARY: CloneAnalysisSummary = { summary: '', characters: [], products: [], visual_style: '', music_brief: '' };

/** Changes the project-level notes (references, transcript, soundtrack, finish settings) the same safe way. */
async function changeSummary(
  projectId: string,
  change: (summary: CloneAnalysisSummary, project: CloneProject) => CloneAnalysisSummary | null
): Promise<CloneProjectResponse> {
  const project = await mutateProject(projectId, (fresh) => {
    const next = change(fresh.analysis_summary || EMPTY_SUMMARY, fresh);
    return next ? { analysis_summary: next } : null;
  });
  return project ? { success: true, project } : { success: false, error: 'Project not found' };
}

export async function updateSceneInput(
  projectId: string,
  sceneN: number,
  input: {
    user_instruction?: string;
    user_ref_urls?: string[];
    analysis?: SceneAnalysis;
    /** 3-15 to override the animation length; null resets to auto. */
    anim_seconds?: number | null;
    /** Verbatim video prompt; null resets to the composed default. */
    motion_prompt?: string | null;
    /** Verbatim negative prompt; null resets to the default quality guard. */
    negative_prompt?: string | null;
    /** Project-wide refs to exclude from THIS scene's generations. */
    excluded_project_ref_urls?: string[];
  }
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const animSeconds =
    input.anim_seconds == null
      ? input.anim_seconds
      : Math.min(15, Math.max(3, Math.round(input.anim_seconds)));

  return changeScene(projectId, sceneN, (s) => ({
    ...s,
    ...(input.user_instruction !== undefined ? { user_instruction: input.user_instruction } : {}),
    ...(input.user_ref_urls !== undefined ? { user_ref_urls: input.user_ref_urls.slice(0, 6) } : {}),
    ...(input.analysis !== undefined ? { analysis: input.analysis } : {}),
    ...(input.anim_seconds !== undefined ? { anim_seconds: animSeconds } : {}),
    // Custom scenes have no source timing — their assembly duration IS the chosen clip length
    ...(input.anim_seconds != null && s.is_custom ? { start: 0, end: animSeconds ?? 3 } : {}),
    ...(input.motion_prompt !== undefined ? { motion_prompt: input.motion_prompt } : {}),
    ...(input.negative_prompt !== undefined ? { negative_prompt: input.negative_prompt } : {}),
    ...(input.excluded_project_ref_urls !== undefined
      ? { excluded_project_ref_urls: input.excluded_project_ref_urls }
      : {}),
  }));
}

/** Upload one user reference image (person/product) for a scene. */
export async function uploadCloneReference(
  projectId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const extension = (file.name || 'ref.jpg').split('.').pop() || 'jpg';
  const upload = await uploadImageToStorage(file, {
    bucket: 'images',
    folder: `clone-studio/${projectId}/refs`,
    filename: `ref-${Date.now()}.${extension}`,
    contentType: file.type || 'image/jpeg',
  });
  if (!upload.success || !upload.url) {
    return { success: false, error: upload.error || 'Upload failed' };
  }
  return { success: true, url: upload.url };
}

/**
 * The edit prompt intentionally does NOT restate the original character
 * description (it would fight the user's swap instruction) and does NOT
 * carry the scene's action-arc invariants — those describe the whole scene's
 * motion and can reference objects that aren't in this frame, which makes the
 * edit model ADD them (a "the can never comes off" rule conjured a can into
 * an untouched hand). The frame itself is the only ground truth; invariants
 * stay in the animation prompt where they belong.
 */
function buildSceneEditPrompt(scene: CloneScene, refCount: number): string {
  const parts: string[] = [];
  parts.push('Edit the first image — a single frame from a video ad.');
  if (scene.user_instruction?.trim()) {
    parts.push(`Apply these changes: ${scene.user_instruction.trim()}.`);
  } else {
    parts.push('Recreate this frame faithfully with no content changes.');
  }
  if (refCount > 0) {
    parts.push(
      refCount === 1
        ? 'Use the additional reference image for the exact identity and appearance of the replacement person or product.'
        : `Use the ${refCount} additional reference images for the exact identity and appearance of the replacement people or products.`
    );
  }
  parts.push(
    "Preserve everything else from the first image EXACTLY: framing, camera angle, perspective, lens look, lighting, color grade, background, setting, all other people and objects, and the subject's pose and expression."
  );
  parts.push(
    'Do NOT add, remove, or relocate any object beyond what the requested changes require. If the frame shows a physically impossible or comedic state, that state must remain true in the edited frame.'
  );
  parts.push('Photorealistic, seamless edit. No borders, no added text, no watermark.');
  return parts.join(' ');
}

/**
 * Generate/regenerate the swapped keyframe for one scene. Always edits from
 * the ORIGINAL keyframe (fresh edits don't compound artifacts); the previous
 * result is kept in image_versions for one-click restore.
 */
export async function generateSceneImage(
  projectId: string,
  sceneN: number,
  options: { engine?: CloneImageEngine } = {}
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { userId, project } = loaded;

  const scene = project.scenes.find((s) => s.n === sceneN);
  if (!scene) return { success: false, error: `Scene ${sceneN} not found` };

  const attemptId = randomUUID();
  const deduction = await deductCredits(userId, CLONE_IMAGE_CREDITS, 'clone_studio_image', {
    batch_id: attemptId,
    project_id: projectId,
    scene: sceneN,
  });
  if (!deduction.success) {
    return { success: false, error: deduction.error || 'Insufficient credits' };
  }

  try {
    // FAL rejects images over ~5MB after base64 inflation — compress if needed
    const keyframe = (await ensureFalCompatibleImage(scene.keyframe_url, attemptId, `scene${sceneN}-key`))!;
    // Project-level refs (same person/product in every scene) come first,
    // then scene-specific ones; dedup, cap 6 total. Refs the user removed
    // from this scene's card are skipped.
    const excluded = new Set(scene.excluded_project_ref_urls || []);
    const projectRefs = (project.analysis_summary?.project_ref_urls || []).filter(
      (url) => !excluded.has(url)
    );
    const combinedRefs = [...new Set([...projectRefs, ...(scene.user_ref_urls || [])])].slice(0, 6);
    const refs: string[] = [];
    for (const [i, url] of combinedRefs.entries()) {
      const guarded = await ensureFalCompatibleImage(url, attemptId, `scene${sceneN}-ref${i + 1}`);
      if (guarded) refs.push(guarded);
    }

    const prompt = buildSceneEditPrompt(scene, refs.length);
    // GPT Image 2.5 edits by default (see src/lib/image-engine.ts); nb2 stays
    // available per scene and as the IMAGE_ENGINE=nb2 rollback.
    const engine: CloneImageEngine = options.engine || (imageEngine() === 'gpt25' ? 'gpt2' : 'nb2');

    const result =
      engine === 'gpt2'
        ? await editWithGptImage2({ prompt, image_urls: [keyframe, ...refs] })
        : await generateWithFalNanaBanana2({
            prompt,
            image_input: [keyframe, ...refs],
            aspect_ratio: (project.aspect_ratio || 'auto') as NanoBananaAspectRatio,
            output_format: 'jpeg',
          });

    if (!result.success || !result.imageUrl) {
      throw new Error(result.error || 'Image generation failed');
    }

    // Persist to our storage — fal URLs are temporary
    const stored = await downloadAndUploadImage(result.imageUrl, 'clone-studio', undefined, {
      bucket: 'images',
      folder: `clone-studio/${projectId}`,
      filename: `scene-${String(sceneN).padStart(2, '0')}-edit-${Date.now()}.jpg`,
      contentType: 'image/jpeg',
    });
    if (!stored.success || !stored.url) {
      throw new Error(`Could not store the generated image: ${stored.error}`);
    }

    // Parallel generations on other scenes write the same jsonb column: the
    // picture goes into the board as it is now, not as it was 30 seconds ago
    const url = stored.url;
    return await changeScene(
      projectId,
      sceneN,
      (s) => {
        // image_versions is the FULL history (newest first) INCLUDING the
        // current image; edited_image_url is just the selected pointer. Stable
        // order means the version strip never reshuffles on restore. Legacy
        // rows (current not in the list) converge here.
        const history = s.image_versions || [];
        const withCurrent = s.edited_image_url && !history.includes(s.edited_image_url)
          ? [s.edited_image_url, ...history]
          : history;
        return {
          ...s,
          edited_image_url: url,
          image_versions: [url, ...withCurrent].slice(0, CLONE_MAX_IMAGE_VERSIONS),
          credits_spent: (s.credits_spent || 0) + CLONE_IMAGE_CREDITS,
        };
      },
      (fresh) => ({ credits_spent: (fresh.credits_spent || 0) + CLONE_IMAGE_CREDITS })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed';
    console.error(`Clone Studio: scene ${sceneN} image generation failed:`, error);
    await refundFailedGeneration({
      userId,
      referenceIds: [attemptId],
      operation: 'clone studio image',
    });
    return { success: false, error: message };
  }
}

/** Upload a source video file (the direct-upload ingest path). */
export async function uploadCloneSource(
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required' };

  const upload = await uploadVideoToStorage(file, {
    bucket: 'videos',
    folder: 'clone-studio/uploads',
    filename: `${user.id.slice(0, 8)}-${Date.now()}.mp4`,
    contentType: file.type || 'video/mp4',
  });
  if (!upload.success || !upload.url) {
    return { success: false, error: upload.error || 'Upload failed' };
  }
  return { success: true, url: upload.url };
}

export async function deleteCloneProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Authentication required' };

  // RLS delete policy scopes to the owner; storage artifacts are left behind
  // on purpose during beta (cheap, and generated scenes may be in use in the editor)
  const { error } = await supabase
    .from('ad_clone_projects')
    .delete()
    .eq('id', projectId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Animation length: user override if set, else cover the original cut; clamped to Kling's 3-15s. */
function sceneAnimationSeconds(scene: CloneScene): number {
  const seconds = scene.anim_seconds ?? Math.ceil(scene.end - scene.start);
  return Math.min(15, Math.max(3, seconds));
}

/**
 * Animate one approved scene with Kling O3 Pro, audio ON. Completion arrives
 * via the fal-ai webhook; pollSceneAnimation is the fallback for local dev
 * and missed webhooks.
 */
export async function animateScene(
  projectId: string,
  sceneN: number,
  options: { seconds?: number; prompt?: string; negative_prompt?: string } = {}
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { userId, project } = loaded;

  const scene = project.scenes.find((s) => s.n === sceneN);
  if (!scene) return { success: false, error: `Scene ${sceneN} not found` };
  if (!scene.edited_image_url) {
    return { success: false, error: 'Generate and approve the scene image first' };
  }
  if (scene.anim?.status === 'generating') {
    return { success: false, error: 'This scene is already animating' };
  }

  // Explicit seconds beat the stored value — the UI passes them with the
  // click so a just-edited field can't race its own blur-save
  const durationSeconds = options.seconds
    ? Math.min(15, Math.max(3, Math.round(options.seconds)))
    : sceneAnimationSeconds(scene);
  const credits = durationSeconds * CLONE_ANIM_CREDITS_PER_SECOND;
  const attemptId = randomUUID();

  const deduction = await deductCredits(userId, credits, 'clone_studio_animation', {
    batch_id: attemptId,
    project_id: projectId,
    scene: sceneN,
    seconds: durationSeconds,
  });
  if (!deduction.success) {
    return { success: false, error: deduction.error || 'Insufficient credits' };
  }

  const imageUrl = await ensureFalCompatibleImage(scene.edited_image_url, attemptId, `scene${sceneN}-anim`);

  // The card shows this prompt and passes it with the click (beats a stale
  // blur-save) — what the user sees in the box is exactly what the model gets
  const motionPrompt =
    options.prompt?.trim() || scene.motion_prompt?.trim() || composeMotionPrompt(scene.analysis);
  const negativePrompt =
    options.negative_prompt?.trim() || scene.negative_prompt?.trim() || CLONE_ANIM_NEGATIVE_PROMPT;

  const submit = await submitKlingO3ProImageToVideo({
    prompt: motionPrompt,
    image_url: imageUrl || scene.edited_image_url,
    duration: durationSeconds,
    aspect_ratio: (project.aspect_ratio || '16:9') as '16:9' | '9:16' | '1:1',
    negative_prompt: negativePrompt,
    generate_audio: true, // owner requirement: per-scene diegetic audio
    webhook_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/fal-ai`,
  });

  if (!submit.success || !submit.request_id) {
    await refundFailedGeneration({
      userId,
      referenceIds: [attemptId],
      operation: 'clone studio animation',
    });
    return { success: false, error: submit.error || 'Animation submit failed — credits refunded' };
  }

  const requestId = submit.request_id;
  try {
    return await changeScene(
      projectId,
      sceneN,
      (s) => ({
        ...s,
        anim: {
          request_id: requestId,
          video_url: null,
          status: 'generating' as const,
          attempt_id: attemptId,
        },
        anim_seconds: durationSeconds,
        motion_prompt: motionPrompt,
        negative_prompt: negativePrompt,
        credits_spent: (s.credits_spent || 0) + credits,
      }),
      (fresh) => ({ credits_spent: (fresh.credits_spent || 0) + credits })
    );
  } catch (error) {
    // Without the request id on the board the clip could never be collected: give the credits back
    console.error(`Clone Studio: scene ${sceneN} animation could not be saved:`, error);
    await refundFailedGeneration({ userId, referenceIds: [attemptId], operation: 'clone studio animation' });
    return { success: false, error: 'The animation could not be started. Your credits were refunded. Please try again.' };
  }
}

/**
 * Poll fallback for scene animations (mirrors pollCinematographerFalGeneration).
 * Safe to call repeatedly; finalization is idempotent with the webhook.
 */
export async function pollSceneAnimation(
  projectId: string,
  sceneN: number
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const scene = loaded.project.scenes.find((s) => s.n === sceneN);
  if (!scene?.anim?.request_id || scene.anim.status !== 'generating') {
    return { success: true, project: loaded.project };
  }

  const status = await getKlingQueueStatus(scene.anim.request_id);
  if (status.success && status.status === 'COMPLETED') {
    const result = await getKlingResult(scene.anim.request_id);
    if (result.success && result.videoUrl) {
      if (result.billableUnits) {
        console.log(`💰 Kling scene ${sceneN}: ${result.billableUnits} billable units`);
      }
      await finalizeCloneAnimation(scene.anim.request_id, result.videoUrl);
    } else {
      await failCloneAnimation(scene.anim.request_id, result.error);
    }
    const refreshed = await loadOwnedProject(projectId);
    return refreshed.ok
      ? { success: true, project: refreshed.project }
      : { success: false, error: refreshed.error };
  }

  return { success: true, project: loaded.project };
}

/**
 * Assemble the final video: trim every animated clip back to its original
 * cut duration, concat in scene order (keeping Kling's per-scene audio), and
 * optionally mix a Lyria music bed under it. Assembly is free; the bed costs
 * CLONE_MUSIC_CREDITS. Runs synchronously (~30-90s).
 */
export async function assembleCloneProject(
  projectId: string,
  options: { withMusic?: boolean; trimToOriginal?: boolean } = {}
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { userId, project } = loaded;

  const animatedScenes = project.scenes.filter(
    (s) => s.anim?.status === 'completed' && s.anim.video_url
  );
  if (animatedScenes.length === 0) {
    return { success: false, error: 'Animate at least one scene first' };
  }

  const admin = createAdminClient();
  const updateProject = async (fields: Record<string, unknown>) => {
    await admin
      .from('ad_clone_projects')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', projectId);
  };

  let musicAttemptId: string | null = null;
  if (options.withMusic) {
    musicAttemptId = randomUUID();
    const deduction = await deductCredits(userId, CLONE_MUSIC_CREDITS, 'clone_studio_music', {
      batch_id: musicAttemptId,
      project_id: projectId,
    });
    if (!deduction.success) {
      return { success: false, error: deduction.error || 'Insufficient credits' };
    }
  }

  await updateProject({ status: 'assembling', error_message: null });

  const workDir = await makeWorkDir('clone-studio-assemble-');
  try {
    const clips = [];
    for (const scene of animatedScenes) {
      const clipPath = `${workDir}/scene-${String(scene.n).padStart(2, '0')}.mp4`;
      await downloadToFile(scene.anim.video_url!, clipPath);
      clips.push({
        filePath: clipPath,
        durationSeconds: Math.max(0.5, scene.end - scene.start),
      });
    }

    let musicFilePath: string | undefined;
    if (options.withMusic) {
      // The user-visible Soundtrack prompt is the source of truth; only the
      // computed target length is appended (disclosed in the UI). Legacy
      // fallbacks: analysis music_brief, then a generic bed.
      const userPrompt = project.analysis_summary?.music_prompt?.trim();
      const brief = project.analysis_summary?.music_brief?.trim();
      const totalSeconds = Math.ceil(clips.reduce((sum, c) => sum + c.durationSeconds, 0));
      const base =
        userPrompt ||
        (brief ? `${brief} Instrumental only, no vocals.` : 'Upbeat, modern, positive instrumental ad track.');
      const musicPrompt = `${base} About ${totalSeconds + 5} seconds.`;
      const music = await generateLyriaInstrumental(musicPrompt);
      if (music.success && music.audioUrl) {
        musicFilePath = `${workDir}/bed.mp3`;
        await downloadToFile(music.audioUrl, musicFilePath);
      } else {
        // Bed is a nice-to-have: refund it and assemble without music
        console.warn('Clone Studio: music bed failed, assembling without it:', music.error);
        if (musicAttemptId) {
          await refundFailedGeneration({
            userId,
            referenceIds: [musicAttemptId],
            operation: 'clone studio music',
          });
        }
      }
    }

    const outPath = `${workDir}/final.mp4`;
    await assembleClips({
      workDir,
      clips,
      width: project.video_width || 1920,
      height: project.video_height || 1080,
      musicFilePath,
      trimToOriginal: options.trimToOriginal === true,
      outPath,
    });

    const finalBuffer = await fs.readFile(outPath);
    const upload = await uploadVideoToStorage(
      new Blob([new Uint8Array(finalBuffer)], { type: 'video/mp4' }),
      {
        bucket: 'videos',
        folder: `clone-studio/${projectId}`,
        filename: `final-${Date.now()}.mp4`,
        contentType: 'video/mp4',
      }
    );
    if (!upload.success || !upload.url) {
      throw new Error(`Could not store the assembled video: ${upload.error}`);
    }

    await updateProject({ status: 'completed', final_video_url: upload.url });

    const refreshed = await loadOwnedProject(projectId);
    console.log(`🎬 Clone Studio: project ${projectId} assembled — ${animatedScenes.length} scenes`);
    return refreshed.ok
      ? { success: true, project: refreshed.project }
      : { success: false, error: refreshed.error };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assembly failed';
    console.error(`Clone Studio: assembly failed for ${projectId}:`, error);
    // Board stays usable — assembly can be retried
    await updateProject({ status: 'board_ready', error_message: message });
    if (musicAttemptId) {
      await refundFailedGeneration({
        userId,
        referenceIds: [musicAttemptId],
        operation: 'clone studio music',
      });
    }
    return { success: false, error: message };
  } finally {
    await cleanupWorkDir(workDir);
  }
}

/** Set the project-level reference images (auto-included in every scene). */
export async function updateProjectReferences(
  projectId: string,
  urls: string[]
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  return changeSummary(projectId, (summary) => ({ ...summary, project_ref_urls: urls.slice(0, 6) }));
}

/**
 * Backfill the full-audio transcript (and the measured tempo) for projects
 * scanned before those existed. Idempotent: once transcript is a string
 * (even ''), this is a no-op. Free — display-only reference, no credits.
 */
export async function generateProjectTranscript(projectId: string): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const project = loaded.project;

  if (typeof project.analysis_summary?.transcript === 'string') {
    return { success: true, project };
  }


  let transcript: string | undefined;
  // YouTube sources: Gemini reads the URL natively — no download needed.
  if (project.source_platform === 'youtube' && project.source_url) {
    const res = await transcribeCloneVideo({ youtubeUrl: project.source_url });
    if (res.success) transcript = res.transcript ?? '';
  }
  // Everything else (or a failed native pass): transcribe our stored copy.
  if (transcript === undefined && project.source_video_url) {
    const workDir = await makeWorkDir(`clone-transcript-${projectId.slice(0, 8)}`);
    try {
      const filePath = `${workDir}/source.mp4`;
      await downloadToFile(project.source_video_url, filePath);
      const base64 = await fitForInlineAnalysis(filePath);
      const res = await transcribeCloneVideo({ videoBase64: base64 });
      if (res.success) transcript = res.transcript ?? '';
    } catch (error) {
      console.error('Clone Studio: transcript backfill failed:', error);
    } finally {
      await cleanupWorkDir(workDir);
    }
  }
  if (transcript === undefined) {
    return { success: false, error: 'Could not transcribe the source video — try reopening the project.' };
  }

  const heard = transcript;
  return changeSummary(projectId, (summary) => ({ ...summary, transcript: heard }));
}

/**
 * Backfill the measured tempo and the three paste-ready soundtrack prompts
 * for projects scanned before those existed. Separate from the transcript
 * backfill on purpose: projects that already have a transcript would
 * otherwise never reach this. Idempotent via music_prompt_options; free.
 */
export async function ensureProjectSoundtrack(projectId: string): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const project = loaded.project;
  const summary = project.analysis_summary;

  if (!summary || summary.music_prompt_options?.length) return { success: true, project };

  // Measure tempo if we don't have it yet (~100ms once downloaded).
  let musicBpm = summary.music_bpm;
  if (musicBpm === undefined && project.source_video_url) {
    const workDir = await makeWorkDir(`clone-tempo-${projectId.slice(0, 8)}`);
    try {
      const filePath = `${workDir}/source.mp4`;
      await downloadToFile(project.source_video_url, filePath);
      const tempo = await detectTempo(filePath);
      if (tempo) musicBpm = tempo.bpm;
    } catch (error) {
      console.warn('Clone Studio: tempo backfill failed (non-fatal):', error);
    } finally {
      await cleanupWorkDir(workDir);
    }
  }

  const tempo = musicBpm;
  if (!summary.music_brief?.trim()) {
    // Nothing to build prompts from — still persist any measured tempo.
    if (tempo === undefined || tempo === summary.music_bpm) return { success: true, project };
    return changeSummary(projectId, (fresh) => ({ ...fresh, music_bpm: tempo }));
  }

  const opts = await buildSoundtrackPromptOptions(summary.music_brief, tempo);
  if (!opts.success || !opts.options?.length) {
    return { success: false, error: opts.error || 'Could not build soundtrack prompts' };
  }

  const options = opts.options;
  return changeSummary(projectId, (fresh) => ({
    ...fresh,
    ...(tempo !== undefined ? { music_bpm: tempo } : {}),
    music_prompt_options: options,
  }));
}

/** Save the user-editable soundtrack prompt (assembly sends it verbatim + length suffix). */
export async function updateProjectMusicPrompt(
  projectId: string,
  musicPrompt: string
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  return changeSummary(projectId, (summary) => ({ ...summary, music_prompt: musicPrompt.trim() }));
}

/**
 * Correct every scene's dialog against the full transcript — fragment
 * transcriptions mishear words ("swim" -> "sweat") and hallucinate repeats.
 * Backfill for projects scanned before this ran inside analysis. Idempotent
 * via analysis_summary.dialog_reconciled. Never touches a user-edited
 * motion_prompt — cards recompose their motion text from the corrected
 * dialog only where the user hasn't overridden it.
 */
export async function reconcileProjectDialog(projectId: string): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const project = loaded.project;
  const summary = project.analysis_summary;

  if (!summary || summary.dialog_reconciled) return { success: true, project };
  if (typeof summary.transcript !== 'string') {
    return { success: false, error: 'Transcript not ready yet' };
  }

  let corrected: Record<number, string> = {};
  if (summary.transcript) {
    const rec = await reconcileSceneDialogWithTranscript(
      project.scenes.map((s) => ({ n: s.n, start: s.start, end: s.end, dialog: s.analysis?.dialog || '' })),
      summary.transcript
    );
    if (!rec.success || !rec.dialog) {
      return { success: false, error: rec.error || 'Dialog reconcile failed' };
    }
    corrected = rec.dialog;
  }

  const saved = await mutateProject(projectId, (fresh) => ({
    scenes: fresh.scenes.map((s) =>
      corrected[s.n] !== undefined ? { ...s, analysis: { ...s.analysis, dialog: corrected[s.n] } } : s
    ),
    analysis_summary: { ...(fresh.analysis_summary || EMPTY_SUMMARY), dialog_reconciled: true },
  }));
  return saved ? { success: true, project: saved } : { success: false, error: 'Project not found' };
}

/**
 * Write one swap instruction into every scene AND reconcile every scene's
 * motion prompt with it (references to replaced products/people go generic,
 * so old prompts can't fight the swapped images). Each scene stays editable.
 */
export async function applyInstructionToAllScenes(
  projectId: string,
  instruction: string
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  // Tailor the instruction per scene (only the applicable parts) and
  // reconcile motion prompts — two independent AI passes, run concurrently.
  const [contextualized, rewrite] = await Promise.all([
    contextualizeSwapInstruction(
      loaded.project.scenes.map((s) => ({
        n: s.n,
        subject: s.analysis?.subject || '',
        action: s.analysis?.action_arc?.action || '',
      })),
      instruction
    ),
    rewriteMotionPromptsForSwap(
      loaded.project.scenes.map((s) => ({ n: s.n, text: s.motion_prompt?.trim() || composeMotionPrompt(s.analysis) })),
      instruction
    ),
  ]);

  // Per-scene tailored instruction; verbatim copy is the fallback so a
  // failed AI pass degrades to the old behavior instead of doing nothing.
  const instructions = contextualized.success && contextualized.instructions ? contextualized.instructions : null;
  if (!contextualized.success && contextualized.error) {
    console.warn('Clone Studio: instruction contextualize failed (applied verbatim):', contextualized.error);
  }
  const prompts = rewrite.success && rewrite.prompts ? rewrite.prompts : null;
  if (!prompts && rewrite.error) {
    console.warn('Clone Studio: motion-prompt reconcile failed (instructions still applied):', rewrite.error);
  }

  // The two passes take a while: the result goes into the board as it is now
  const saved = await mutateProject(projectId, (fresh) => ({
    scenes: fresh.scenes.map((s) => ({
      ...s,
      user_instruction: instructions ? instructions[s.n] ?? instruction : instruction,
      ...(prompts?.[s.n] ? { motion_prompt: prompts[s.n] } : {}),
    })),
  }));
  return saved ? { success: true, project: saved } : { success: false, error: 'Project not found' };
}

function emptySceneAnalysis(): SceneAnalysis {
  return {
    action_arc: { start_state: '', action: '', end_state: '', invariants: [] },
    subject: '',
    environment: '',
    lighting: '',
    dialog: '',
    camera: '',
    on_screen_text: '',
    purpose: 'story',
    swap_targets: [],
  };
}

/**
 * Insert a user-supplied frame as a new scene. Free — the frame is theirs;
 * generation/animation charge as usual. Scenes are renumbered sequentially
 * so ordering (and assembly order) stays consistent.
 */
export async function addCustomScene(
  projectId: string,
  opts: { image_url: string; afterScene?: number; durationSeconds?: number }
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const duration = Math.min(15, Math.max(1, Math.round(opts.durationSeconds ?? 3)));
  const newScene: CloneScene = {
    n: 0, // renumbered below
    start: 0,
    end: duration,
    keyframe_url: opts.image_url,
    analysis: emptySceneAnalysis(),
    user_instruction: '',
    user_ref_urls: [],
    // The uploaded frame IS the user's version — animatable immediately,
    // and still editable via Generate (which edits from keyframe_url)
    edited_image_url: opts.image_url,
    image_versions: [],
    anim: { request_id: null, video_url: null, status: 'idle' },
    anim_seconds: duration,
    motion_prompt: '',
    is_custom: true,
    credits_spent: 0,
  };

  const saved = await mutateProject(projectId, (fresh) => {
    const scenes = [...fresh.scenes];
    const insertIndex =
      opts.afterScene != null
        ? Math.max(0, Math.min(scenes.length, scenes.findIndex((s) => s.n === opts.afterScene) + 1))
        : scenes.length;
    scenes.splice(insertIndex, 0, newScene);
    return { scenes: scenes.map((s, i) => ({ ...s, n: i + 1 })) };
  });
  return saved ? { success: true, project: saved } : { success: false, error: 'Project not found' };
}

/** Remove a user-added scene (analyzed scenes from the source ad are kept). */
export async function removeCustomScene(
  projectId: string,
  sceneN: number
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const scene = loaded.project.scenes.find((s) => s.n === sceneN);
  if (!scene) return { success: false, error: `Scene ${sceneN} not found` };
  if (!scene.is_custom) {
    return { success: false, error: 'Only custom scenes can be removed' };
  }

  // The scene is found again by its frame: numbers shift when another scene was added meanwhile
  const saved = await mutateProject(projectId, (fresh) => {
    const target = fresh.scenes.find((s) => s.is_custom && s.keyframe_url === scene.keyframe_url);
    if (!target) return null;
    return { scenes: fresh.scenes.filter((s) => s !== target).map((s, i) => ({ ...s, n: i + 1 })) };
  });
  return saved ? { success: true, project: saved } : { success: false, error: 'Project not found' };
}

/** Swap a previous clip back in as the scene's current one (assembly uses it). */
export async function restoreSceneClipVersion(
  projectId: string,
  sceneN: number,
  clipUrl: string
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  return changeScene(projectId, sceneN, (s) => {
    if (s.anim?.status !== 'completed') return s;
    const history = s.anim_versions || [];
    const withCurrent = s.anim.video_url && !history.includes(s.anim.video_url)
      ? [s.anim.video_url, ...history].slice(0, 5)
      : history;
    if (!withCurrent.includes(clipUrl)) return s;
    return { ...s, anim: { ...s.anim, video_url: clipUrl }, anim_versions: withCurrent };
  });
}

/** Swap a previous version back in as the scene's current image. */
export async function restoreSceneImageVersion(
  projectId: string,
  sceneN: number,
  versionUrl: string
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  return changeScene(projectId, sceneN, (s) => {
    // Selecting a version only moves the pointer — the history list stays in
    // stable order (converging legacy rows whose current wasn't listed)
    const history = s.image_versions || [];
    const withCurrent = s.edited_image_url && !history.includes(s.edited_image_url)
      ? [s.edited_image_url, ...history].slice(0, CLONE_MAX_IMAGE_VERSIONS)
      : history;
    return { ...s, edited_image_url: versionUrl, image_versions: withCurrent };
  });
}
