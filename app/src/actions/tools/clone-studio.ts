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
import {
  submitKlingO3ProImageToVideo,
  getKlingQueueStatus,
  getKlingResult,
} from '@/actions/models/fal-kling-video';
import { finalizeCloneAnimation, failCloneAnimation } from '@/lib/clone-studio/animation';
import { assembleClips } from '@/lib/clone-studio/assembly';
import { generateLyriaInstrumental } from '@/actions/models/gemini-lyria';
import { ingestSourceVideo } from '@/lib/clone-studio/ingest';
import {
  makeWorkDir,
  cleanupWorkDir,
  probeVideo,
  segmentVideo,
  fitForInlineAnalysis,
  downloadToFile,
  buildAnalysisKeyframes,
} from '@/lib/clone-studio/segmentation';
import { analyzeCloneScenes, type AnalyzeCloneScenesResult } from '@/actions/tools/video-analyzer';
import {
  CLONE_ANIM_CREDITS_PER_SECOND,
  CLONE_IMAGE_CREDITS,
  CLONE_INGEST_CREDITS,
  CLONE_MAX_IMAGE_VERSIONS,
  CLONE_MAX_SOURCE_SECONDS,
  CLONE_MUSIC_CREDITS,
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
 * Clone Studio is in beta: gated to admins while the owner tests the flow on
 * real ads in production. Flip this to a beta flag, then remove, per rollout.
 */
async function assertCloneStudioAccess(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (profile?.role !== 'admin') {
    return 'Clone Studio is in private beta and not available on your account yet.';
  }
  return null;
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

  const accessError = await assertCloneStudioAccess(user.id);
  if (accessError) {
    return { success: false, error: accessError };
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
    const sceneKeyframes = await buildAnalysisKeyframes(segmented);

    let analysis: AnalyzeCloneScenesResult | null = null;
    if (ingest.platform === 'youtube' && request.source_url) {
      const videoId = request.source_url.match(/(?:v=|youtu\.be\/|shorts\/)([^&?/]+)/)?.[1];
      if (videoId) {
        analysis = await analyzeCloneScenes({
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          sceneRanges: segmented,
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
      analysis = await analyzeCloneScenes({ videoBase64, sceneRanges: segmented, sceneKeyframes });
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
      credits_spent: 0,
    }));

    await updateProject({
      status: 'board_ready',
      scenes,
      analysis_summary: analysis.summary,
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

async function saveScenes(
  projectId: string,
  scenes: CloneScene[],
  extraFields: Record<string, unknown> = {}
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('ad_clone_projects')
    .update({ scenes, ...extraFields, updated_at: new Date().toISOString() })
    .eq('id', projectId);
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
  }
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const animSeconds =
    input.anim_seconds == null
      ? input.anim_seconds
      : Math.min(15, Math.max(3, Math.round(input.anim_seconds)));

  const scenes = loaded.project.scenes.map((s) =>
    s.n === sceneN
      ? {
          ...s,
          ...(input.user_instruction !== undefined ? { user_instruction: input.user_instruction } : {}),
          ...(input.user_ref_urls !== undefined ? { user_ref_urls: input.user_ref_urls.slice(0, 6) } : {}),
          ...(input.analysis !== undefined ? { analysis: input.analysis } : {}),
          ...(input.anim_seconds !== undefined ? { anim_seconds: animSeconds } : {}),
        }
      : s
  );
  await saveScenes(projectId, scenes);
  return { success: true, project: { ...loaded.project, scenes } };
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
 * description (it would fight the user's swap instruction). It anchors on the
 * frame itself + background-lock language, and carries the invariants so gag
 * states survive the edit (keyframe-state rule).
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
    'If the frame shows a physically impossible or comedic state (for example a hand stuck inside a container), that state must remain true in the edited frame.'
  );
  const invariants = scene.analysis?.action_arc?.invariants || [];
  if (invariants.length > 0) {
    parts.push(`Hard rules: ${invariants.join(' ')}`);
  }
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
    const refs: string[] = [];
    for (const [i, url] of (scene.user_ref_urls || []).entries()) {
      const guarded = await ensureFalCompatibleImage(url, attemptId, `scene${sceneN}-ref${i + 1}`);
      if (guarded) refs.push(guarded);
    }

    const prompt = buildSceneEditPrompt(scene, refs.length);
    const engine: CloneImageEngine = options.engine || 'nb2';

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

    // Re-read right before writing to shrink the read-modify-write window
    // (parallel generations on other scenes update the same jsonb column)
    const fresh = await loadOwnedProject(projectId);
    const freshProject = fresh.ok ? fresh.project : project;
    const scenes = freshProject.scenes.map((s) => {
      if (s.n !== sceneN) return s;
      const versions = s.edited_image_url
        ? [s.edited_image_url, ...(s.image_versions || [])].slice(0, CLONE_MAX_IMAGE_VERSIONS)
        : s.image_versions || [];
      return {
        ...s,
        edited_image_url: stored.url!,
        image_versions: versions,
        credits_spent: (s.credits_spent || 0) + CLONE_IMAGE_CREDITS,
      };
    });
    await saveScenes(projectId, scenes, {
      credits_spent: (freshProject.credits_spent || 0) + CLONE_IMAGE_CREDITS,
    });

    return { success: true, project: { ...freshProject, scenes } };
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

  const accessError = await assertCloneStudioAccess(user.id);
  if (accessError) return { success: false, error: accessError };

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

/**
 * Motion prompt per the action-arc rule: beats + LOCKED end state + invariants
 * repeated verbatim, camera language, spoken dialog (Kling audio-on lip-syncs
 * quoted speech), and a no-music audio directive (the music bed is added at
 * assembly).
 */
function buildSceneMotionPrompt(scene: CloneScene): string {
  const arc = scene.analysis?.action_arc;
  const parts: string[] = [];
  if (arc?.action) parts.push(arc.action);
  if (arc?.end_state) parts.push(`End state: ${arc.end_state}`);
  if (arc?.invariants?.length) parts.push(arc.invariants.join(' '));
  if (scene.analysis?.camera) parts.push(`Camera: ${scene.analysis.camera}.`);
  if (scene.analysis?.dialog?.trim()) {
    parts.push(`The person says, lips in sync: "${scene.analysis.dialog.trim()}"`);
  }
  parts.push('Audio: natural diegetic sound for the scene only — no background music, no soundtrack.');
  return parts.join(' ');
}

const CLONE_ANIM_NEGATIVE_PROMPT =
  'morphing, warping, distorted faces, extra fingers, deformed hands, text, subtitles, captions, watermark, background music, soundtrack';

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
  options: { seconds?: number } = {}
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

  const submit = await submitKlingO3ProImageToVideo({
    prompt: buildSceneMotionPrompt(scene),
    image_url: imageUrl || scene.edited_image_url,
    duration: durationSeconds,
    aspect_ratio: (project.aspect_ratio || '16:9') as '16:9' | '9:16' | '1:1',
    negative_prompt: CLONE_ANIM_NEGATIVE_PROMPT,
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

  const fresh = await loadOwnedProject(projectId);
  const freshProject = fresh.ok ? fresh.project : project;
  const scenes = freshProject.scenes.map((s) =>
    s.n === sceneN
      ? {
          ...s,
          anim: {
            request_id: submit.request_id!,
            video_url: null,
            status: 'generating' as const,
            attempt_id: attemptId,
          },
          anim_seconds: durationSeconds,
          credits_spent: (s.credits_spent || 0) + credits,
        }
      : s
  );
  await saveScenes(projectId, scenes, {
    credits_spent: (freshProject.credits_spent || 0) + credits,
  });

  return { success: true, project: { ...freshProject, scenes } };
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
  options: { withMusic?: boolean } = {}
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
      const brief = project.analysis_summary?.music_brief?.trim();
      const totalSeconds = Math.ceil(clips.reduce((sum, c) => sum + c.durationSeconds, 0));
      const musicPrompt = brief
        ? `${brief} Instrumental only, no vocals unless the brief asks for them. About ${totalSeconds + 5} seconds.`
        : `Upbeat, modern, positive instrumental ad track, about ${totalSeconds + 5} seconds.`;
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

/** Swap a previous version back in as the scene's current image. */
export async function restoreSceneImageVersion(
  projectId: string,
  sceneN: number,
  versionUrl: string
): Promise<CloneProjectResponse> {
  const loaded = await loadOwnedProject(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const scenes = loaded.project.scenes.map((s) => {
    if (s.n !== sceneN) return s;
    const others = (s.image_versions || []).filter((v) => v !== versionUrl);
    const versions = s.edited_image_url
      ? [s.edited_image_url, ...others].slice(0, CLONE_MAX_IMAGE_VERSIONS)
      : others;
    return { ...s, edited_image_url: versionUrl, image_versions: versions };
  });
  await saveScenes(projectId, scenes);
  return { success: true, project: { ...loaded.project, scenes } };
}
