import { createAdminClient } from '@/app/supabase/server';
import { downloadAndUploadVideo } from '@/actions/supabase-storage';
import { refundFailedGeneration } from '@/lib/credits/refund';
import type { CloneProject, CloneScene } from '@/types/clone-studio';

/**
 * Shared completion/failure logic for Clone Studio scene animations —
 * called from BOTH the fal-ai webhook and the pollSceneAnimation fallback,
 * so it must be idempotent (whichever fires second becomes a no-op).
 */

async function findProjectByRequestId(requestId: string): Promise<{
  project: CloneProject;
  scene: CloneScene;
} | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ad_clone_projects')
    .select('*')
    .contains('scenes', JSON.stringify([{ anim: { request_id: requestId } }]))
    .limit(1);
  if (error) {
    // Fail open so the shared fal-ai webhook keeps serving the other tools —
    // but say why (a missing ad_clone_projects migration lands here as 42P01)
    console.error('Clone Studio: ad_clone_projects lookup failed (falling through):', error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  const project = data[0] as unknown as CloneProject;
  const scene = project.scenes.find((s) => s.anim?.request_id === requestId);
  if (!scene) return null;
  return { project, scene };
}

export async function finalizeCloneAnimation(
  requestId: string,
  falVideoUrl: string
): Promise<{ handled: boolean }> {
  const found = await findProjectByRequestId(requestId);
  if (!found) return { handled: false };
  const { project, scene } = found;

  if (scene.anim.status === 'completed' && scene.anim.video_url) {
    return { handled: true }; // webhook + poll double-fire
  }

  const upload = await downloadAndUploadVideo(falVideoUrl, 'clone-studio', `anim_${requestId}`, {
    bucket: 'videos',
    folder: `clone-studio/${project.id}`,
    filename: `scene-${String(scene.n).padStart(2, '0')}-anim-${Date.now()}.mp4`,
  });
  const finalUrl = upload.success && upload.url ? upload.url : falVideoUrl;

  const supabase = createAdminClient();
  const scenes = project.scenes.map((s) => {
    if (s.n !== scene.n) return s;
    // Clip history: stable newest-first list including the current clip
    // (mirrors image_versions); the old clip stays selectable as a take
    const history = s.anim_versions || [];
    const withCurrent = s.anim?.video_url && !history.includes(s.anim.video_url)
      ? [s.anim.video_url, ...history]
      : history;
    return {
      ...s,
      anim: { ...s.anim, video_url: finalUrl, status: 'completed' as const },
      anim_versions: [finalUrl, ...withCurrent].slice(0, 5),
    };
  });
  await supabase
    .from('ad_clone_projects')
    .update({ scenes, updated_at: new Date().toISOString() })
    .eq('id', project.id);

  console.log(`✅ Clone Studio: scene ${scene.n} animation complete (project ${project.id})`);
  return { handled: true };
}

export async function failCloneAnimation(
  requestId: string,
  errorMessage?: string
): Promise<{ handled: boolean }> {
  const found = await findProjectByRequestId(requestId);
  if (!found) return { handled: false };
  const { project, scene } = found;

  if (scene.anim.status !== 'generating') {
    return { handled: true };
  }

  const supabase = createAdminClient();
  const scenes = project.scenes.map((s) =>
    s.n === scene.n ? { ...s, anim: { ...s.anim, status: 'failed' as const } } : s
  );
  await supabase
    .from('ad_clone_projects')
    .update({ scenes, updated_at: new Date().toISOString() })
    .eq('id', project.id);

  await refundFailedGeneration({
    userId: project.user_id,
    referenceIds: [scene.anim.attempt_id, requestId],
    operation: 'clone studio animation',
  });

  console.error(`❌ Clone Studio: scene ${scene.n} animation failed (project ${project.id}): ${errorMessage || 'unknown'}`);
  return { handled: true };
}
