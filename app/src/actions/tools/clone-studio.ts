'use server';

import { promises as fs } from 'fs';
import { createClient, createAdminClient } from '@/app/supabase/server';
import { uploadVideoToStorage } from '@/actions/supabase-storage';
import { deductCredits } from '@/actions/database/cinematographer-database';
import { refundFailedGeneration } from '@/lib/credits/refund';
import { ingestSourceVideo } from '@/lib/clone-studio/ingest';
import {
  makeWorkDir,
  cleanupWorkDir,
  probeVideo,
  segmentVideo,
  fitForInlineAnalysis,
} from '@/lib/clone-studio/segmentation';
import { analyzeScenes } from '@/lib/clone-studio/analysis';
import {
  CLONE_INGEST_CREDITS,
  CLONE_MAX_SOURCE_SECONDS,
  type CloneProject,
  type CloneProjectResponse,
  type CloneScene,
  type CreateCloneProjectRequest,
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
 * Ingest a source ad and build the scene board: download → store a copy →
 * ffmpeg cut detection + keyframes → structured Gemini analysis. Runs
 * synchronously (1-2 min for a typical ad); status is written to the row at
 * each stage so the UI can poll getCloneProject for progress display.
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

    // 3) Structured per-scene analysis aligned to the detected cuts
    const fittedPath = await fitForInlineAnalysis(ingest.filePath);
    const analysis = await analyzeScenes(fittedPath, segmented);

    const scenes: CloneScene[] = segmented.map((s) => ({
      n: s.n,
      start: s.start,
      end: s.end,
      keyframe_url: s.keyframe_url,
      analysis: analysis.scenes.get(s.n)!,
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
