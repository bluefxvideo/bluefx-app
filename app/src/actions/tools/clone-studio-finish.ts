'use server';

import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { createAdminClient, createClient } from '@/app/supabase/server';
import { deductCredits } from '@/actions/database/cinematographer-database';
import { refundFailedGeneration, refundSentence } from '@/lib/credits/refund';
import { proposeFinish } from '@/lib/clone-studio/finish';
import { finishCloneAd, logCloneRun } from '@/lib/clone-studio/render';
import { mutateProject } from '@/lib/clone-studio/store';
import { trackUsage, type UsageEntry } from '@/lib/smart-video/usage';
import {
  CLONE_FINISH_STALE_MS,
  cloneFinishCredits,
  DEFAULT_FINISH_SETTINGS,
  FINISH_LOOKS,
  finishIsCurrent,
  sceneClip,
  type CloneAnalysisSummary,
  type CloneFinish,
  type CloneProject,
  type CloneProjectResponse,
  type CloneScene,
  type FinishRun,
  type FinishSettings,
  type FinishStage,
  type SceneFinish,
} from '@/types/clone-studio';

/**
 * Clone Studio, "Finish the ad": the step that replaces downloading the clips and
 * editing them somewhere else. The page first asks for a proposal (who talks in each
 * scene, what is said), the client adjusts it, and one click starts the paid run.
 *
 * The run works after the response is sent (the proxy cuts requests at ~55 s). What the
 * page needs to follow it sits in the project row: status "finishing", and the stage in
 * analysis_summary.finish.run. The row is readable by its owner, so API costs never go
 * there: they go to clone_finish_runs, which only the server can read.
 */

const EMPTY_SUMMARY: CloneAnalysisSummary = { summary: '', characters: [], products: [], visual_style: '', music_brief: '' };
const PICTURES = ['clip', 'still', 'card', 'skip'] as const;
const SOUNDS = ['clip', 'narrator', 'none'] as const;
const DEAD_RUN = 'The job stopped unexpectedly (the server restarted during an update). Please run it again.';

/** Fetch a project through the user client so RLS enforces ownership. */
async function owned(projectId: string): Promise<{ ok: true; userId: string; project: CloneProject } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Authentication required' };
  const { data, error } = await supabase.from('ad_clone_projects').select('*').eq('id', projectId).single();
  if (error || !data) return { ok: false, error: 'Project not found' };
  return { ok: true, userId: user.id, project: data as unknown as CloneProject };
}

const finishOf = (summary: CloneAnalysisSummary | null): CloneFinish => summary?.finish || { settings: DEFAULT_FINISH_SETTINGS };
const withFinish = (project: CloneProject, finish: CloneFinish) => ({ ...(project.analysis_summary || EMPTY_SUMMARY), finish });

/** A run still shows life while its row keeps being touched (the run touches it every 45 s). */
const isDead = (project: CloneProject) => project.status === 'finishing' && Date.now() - Date.parse(project.updated_at) > CLONE_FINISH_STALE_MS;

/**
 * Proposes how each scene goes into the finished ad: listens to every clip that was not
 * checked yet, tells a person talking on camera from words that need a narrator, and
 * writes the proposal into the scenes, where the panel shows it for editing. Free.
 */
export async function prepareCloneFinish(projectId: string): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const todo = loaded.project.scenes.filter((scene) => !finishIsCurrent(scene));
  const proposals = new Map<string, { finish: SceneFinish; language?: string }>();
  // Six clips at a time: enough to finish a long board inside one request.
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(
      todo.slice(i, i + 6).map(async (scene) => {
        try {
          proposals.set(scene.keyframe_url, await proposeFinish(scene));
        } catch (error) {
          // A clip nobody could listen to keeps its own sound, and the client can still choose otherwise.
          console.warn(`Clone Studio: scene ${scene.n} could not be checked:`, String(error).slice(0, 160));
          const clip = sceneClip(scene);
          proposals.set(scene.keyframe_url, {
            finish: { picture: clip ? 'clip' : scene.edited_image_url ? 'still' : 'skip', sound: clip ? 'clip' : 'none', line: '', text: scene.finish?.text ?? '', checked_clip_url: clip },
          });
        }
      })
    );
  }

  const heard = [...proposals.values()].map((p) => p.language).filter(Boolean) as string[];
  const project = await mutateProject(projectId, (fresh) => {
    const finish = finishOf(fresh.analysis_summary);
    return {
      scenes: fresh.scenes.map((scene) => {
        const proposal = proposals.get(scene.keyframe_url);
        // A clip that changed again while this one was being listened to is checked next time.
        const stillThatClip = proposal && (proposal.finish.checked_clip_url ?? null) === sceneClip(scene);
        return proposal && stillThatClip && !finishIsCurrent(scene) ? { ...scene, finish: proposal.finish } : scene;
      }),
      analysis_summary: withFinish(fresh, { ...finish, language: finish.language || heard[0] }),
    };
  });
  return project ? { success: true, project } : { success: false, error: 'Project not found' };
}

/** Saves what the client changed in the panel: a setting of the ad, or one scene's choices. */
export async function saveCloneFinish(
  projectId: string,
  input: { settings?: Partial<FinishSettings>; scene?: { n: number; finish: Partial<Pick<SceneFinish, 'picture' | 'sound' | 'line' | 'text'>> } }
): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };

  const s = input.settings || {};
  const settings: Partial<FinishSettings> = {
    ...(s.voice === 'female' || s.voice === 'male' ? { voice: s.voice } : {}),
    ...(typeof s.match_voice === 'boolean' ? { match_voice: s.match_voice } : {}),
    ...(typeof s.captions === 'boolean' ? { captions: s.captions } : {}),
    ...(typeof s.music === 'boolean' ? { music: s.music } : {}),
    ...(s.look && FINISH_LOOKS.includes(s.look) ? { look: s.look } : {}),
    ...(typeof s.accent === 'string' && (s.accent === '' || /^#[0-9a-f]{6}$/i.test(s.accent)) ? { accent: s.accent } : {}),
  };
  const f = input.scene?.finish || {};
  const sceneChange: Partial<SceneFinish> = {
    ...(f.picture && PICTURES.includes(f.picture) ? { picture: f.picture } : {}),
    ...(f.sound && SOUNDS.includes(f.sound) ? { sound: f.sound } : {}),
    ...(typeof f.line === 'string' ? { line: f.line.slice(0, 600) } : {}),
    ...(typeof f.text === 'string' ? { text: f.text.slice(0, 400) } : {}),
  };

  const project = await mutateProject(projectId, (fresh) => {
    const finish = finishOf(fresh.analysis_summary);
    return {
      ...(input.scene
        ? { scenes: fresh.scenes.map((scene) => (scene.n === input.scene?.n && scene.finish ? { ...scene, finish: { ...scene.finish, ...sceneChange } } : scene)) }
        : {}),
      ...(input.settings ? { analysis_summary: withFinish(fresh, { ...finish, settings: { ...finish.settings, ...settings } }) } : {}),
    };
  });
  return project ? { success: true, project } : { success: false, error: 'Project not found' };
}

/** Starts the paid run. Returns at once; the page then follows the project row. */
export async function startCloneFinish(projectId: string): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { userId, project } = loaded;

  if (project.status === 'finishing' && !isDead(project)) return { success: false, error: 'This ad is already being finished' };
  if (project.status === 'directing') return { success: false, error: 'The director is working on this ad. Please wait until it is done.' };
  if (project.aspect_ratio !== '9:16' && project.aspect_ratio !== '16:9') {
    return { success: false, error: 'Only vertical and horizontal ads can be finished here for now. Use "Assemble video" for this one.' };
  }
  if (project.scenes.some((scene) => !finishIsCurrent(scene))) return { success: false, error: 'Some clips changed. Press "Check the scenes" first.' };
  const shows = (scene: CloneScene) =>
    scene.finish && ((scene.finish.picture === 'clip' && sceneClip(scene)) || (scene.finish.picture !== 'skip' && scene.finish.picture !== 'card' && scene.edited_image_url));
  if (!project.scenes.some(shows)) return { success: false, error: 'No scene has a clip or a picture to show yet' };

  // A run whose process died is settled first, so its credits are back before a new run is paid for.
  const dead = project.analysis_summary?.finish?.run;
  if (isDead(project) && dead) await failRun(userId, projectId, dead.id, DEAD_RUN);

  // The project is claimed before anything is charged: of two clicks at the same moment only one gets it.
  const runId = randomUUID();
  const run: FinishRun = { id: runId, stage: 'clips', progress: 0, started_at: new Date().toISOString() };
  const claimed = await mutateProject(projectId, (fresh) =>
    fresh.status === 'finishing' || fresh.status === 'directing' ? null : { status: 'finishing', error_message: null, analysis_summary: withFinish(fresh, { ...finishOf(fresh.analysis_summary), run }) }
  );
  if (!claimed) return { success: false, error: 'Project not found' };
  if (claimed.analysis_summary?.finish?.run?.id !== runId) return { success: false, error: 'This ad is already being finished' };

  // A run that was paid for and ended without its ad left this finishing owed: nothing is charged for it.
  const credits = cloneFinishCredits(claimed.analysis_summary);
  if (credits > 0) {
    const charge = await deductCredits(userId, credits, 'clone_studio_finish', { batch_id: runId, project_id: projectId });
    if (!charge.success) {
      const error = charge.error || 'Insufficient credits';
      await writeRun(projectId, runId, { stage: 'failed', error }, restingStatus);
      return { success: false, error };
    }
  }
  const started = await mutateProject(projectId, (fresh) => ({ credits_spent: (fresh.credits_spent || 0) + credits }));
  after(() => runFinish(userId, projectId, runId));
  return { success: true, project: started || claimed };
}

/** The page polls this while an ad is being finished. A run whose process died is settled and refunded here. */
export async function checkCloneFinish(projectId: string): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  if (!isDead(loaded.project)) return { success: true, project: loaded.project };
  const run = loaded.project.analysis_summary?.finish?.run;
  const settled = run ? await failRun(loaded.userId, projectId, run.id, DEAD_RUN) : null;
  return { success: true, project: settled || loaded.project };
}

type RunColumns = Partial<Pick<CloneProject, 'status' | 'error_message' | 'final_video_url'>>;

/** Writes the run's state into the row, as long as it is still this run. */
async function writeRun(projectId: string, runId: string, patch: Partial<FinishRun>, columns: (fresh: CloneProject) => RunColumns = () => ({})): Promise<CloneProject | null> {
  return mutateProject(projectId, (fresh) => {
    const finish = finishOf(fresh.analysis_summary);
    if (finish.run?.id !== runId) return null;
    return { ...columns(fresh), analysis_summary: withFinish(fresh, { ...finish, run: { ...finish.run, ...patch } }) };
  });
}

/** Where a project goes back to when a run ends without a new video: the board, or "completed" when an earlier video exists. */
const restingStatus = (fresh: CloneProject): RunColumns => ({ status: fresh.final_video_url ? 'completed' : 'board_ready', error_message: null });

/** Ends a run that failed: the credits come back, the board is usable again, the panel says why. */
async function failRun(userId: string, projectId: string, runId: string, reason: string): Promise<CloneProject | null> {
  const refund = await refundFailedGeneration({ userId, referenceIds: [runId], operation: 'clone studio finish' });
  const error = refund.refunded && refund.amount ? `${reason} ${refundSentence(refund.amount)}` : reason;
  return writeRun(projectId, runId, { stage: 'failed', error }, restingStatus);
}

async function runFinish(userId: string, projectId: string, runId: string): Promise<void> {
  const admin = createAdminClient();
  // The sign of life: the row's own updated_at, touched while the run is alive.
  const heartbeat = setInterval(() => {
    admin.from('ad_clone_projects').update({ updated_at: new Date().toISOString() } as never).eq('id', projectId).eq('status', 'finishing').then(() => undefined, () => undefined);
  }, 45_000);
  const stage = (next: FinishStage, progress = 0) => void writeRun(projectId, runId, { stage: next, progress }).catch(() => null);
  let usage: UsageEntry[] = [];
  try {
    console.log(`🎬 Clone Studio: finishing project ${projectId} (run ${runId})`);
    const built = await trackUsage(() => finishCloneAd({ userId, projectId, runId, onStage: stage }));
    usage = built.usage;
    const ad = built.result;

    await mutateProject(projectId, (fresh) => {
      const finish = finishOf(fresh.analysis_summary);
      if (finish.run?.id !== runId) return null;
      return {
        status: 'completed',
        final_video_url: ad.url,
        analysis_summary: withFinish(fresh, { ...finish, made: (finish.made || 0) + 1, owed: false, run: { ...finish.run, stage: 'done', progress: 100 } }),
      };
    });
    await logCloneRun({ id: runId, project_id: projectId, user_id: userId, status: 'done', duration_seconds: ad.seconds, usage, props: ad.props });
    console.log(`✅ Clone Studio: project ${projectId} finished, ${ad.seconds} s`);
  } catch (error) {
    console.error(`❌ Clone Studio: finishing project ${projectId} failed:`, error);
    const reason = error instanceof Error ? error.message : 'Unknown error';
    await failRun(userId, projectId, runId, reason).catch(() => null);
    await logCloneRun({ id: runId, project_id: projectId, user_id: userId, status: 'failed', duration_seconds: null, usage, props: null, error: reason });
  } finally {
    clearInterval(heartbeat);
  }
}
