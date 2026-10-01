'use server';

import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { createClient } from '@/app/supabase/server';
import { autoOf, failAutoRun, restingStatus, runCloneDraft, runCloneMotion, type RunContext } from '@/lib/clone-studio/auto';
import { balanceOf, creditsOf } from '@/lib/clone-studio/credits';
import { directedScenes } from '@/lib/clone-studio/director';
import { publicLink } from '@/lib/clone-studio/files';
import { mutateProject } from '@/lib/clone-studio/store';
import { cleanLink } from '@/lib/smart-video/link';
import {
  AUTO_LENGTHS,
  CLONE_AUTO_CREDITS,
  CLONE_AUTO_RESUMES,
  CLONE_AUTO_STALE_MS,
  CLONE_IMAGE_CREDITS,
  CLONE_MAX_CAST_PICTURES,
  cloneClipCredits,
  cloneClipSeconds,
  type AutoLength,
  type AutoRun,
  type CloneAnalysisSummary,
  type CloneAnimEngine,
  type CloneAuto,
  type CloneProject,
  type CloneProjectResponse,
} from '@/types/clone-studio';

/**
 * Clone Studio, "Do it for me". The client says who they are, the director rewrites the
 * board for them, makes the pictures and finishes a first version of the ad from the
 * pictures. After that the client chooses which scenes get a clip, sees the price, and one
 * more click animates them and finishes the ad again.
 *
 * Both steps run after the response is sent. What the page follows is in the project row
 * (status "directing", analysis_summary.auto.run); the page polls checkCloneAuto, which
 * also picks a run up again when its server process died.
 */

const EMPTY_SUMMARY: CloneAnalysisSummary = { summary: '', characters: [], products: [], visual_style: '', music_brief: '' };
const MAX_BRIEF = 4000;
const DEAD_RUN = 'The job stopped unexpectedly (the server restarted during an update) and could not be picked up again. Please run it again.';
const BUSY: Partial<Record<CloneProject['status'], string>> = {
  finishing: 'This ad is being finished. Please wait until it is done.',
  directing: 'The director is already working on this ad.',
  assembling: 'This ad is being assembled. Please wait until it is done.',
};

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

const withAuto = (project: CloneProject, auto: CloneAuto): CloneAnalysisSummary => ({ ...(project.analysis_summary || EMPTY_SUMMARY), auto });
const supported = (project: CloneProject) => project.aspect_ratio === '9:16' || project.aspect_ratio === '16:9';
const UNSUPPORTED = 'Only vertical and horizontal ads can be made automatically for now. Work on this one scene by scene.';

/** The link as the client typed it, cleaned; '' when there is none. Throws with a readable reason when it cannot be read. */
function linkOf(raw: string | undefined): string {
  const text = (raw || '').trim();
  if (!text) return '';
  return publicLink(cleanLink(text));
}

/** The most a first version can cost: the flat fee, a picture for every scene, and the pictures of invented cast. */
const draftCeiling = (project: CloneProject) => CLONE_AUTO_CREDITS + (directedScenes(project).length + CLONE_MAX_CAST_PICTURES) * CLONE_IMAGE_CREDITS;

/** Saves what the client typed into the panel, so a reload keeps it. */
export async function saveCloneAutoBrief(projectId: string, input: { brief?: string; link?: string; length?: AutoLength }): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const project = await mutateProject(projectId, (fresh) => {
    const auto = autoOf(fresh.analysis_summary);
    return {
      analysis_summary: withAuto(fresh, {
        ...auto,
        ...(typeof input.brief === 'string' ? { brief: input.brief.slice(0, MAX_BRIEF) } : {}),
        ...(typeof input.link === 'string' ? { link: input.link.trim().slice(0, 1200) } : {}),
        ...(input.length && AUTO_LENGTHS.includes(input.length) ? { length: input.length } : {}),
      }),
    };
  });
  return project ? { success: true, project } : { success: false, error: 'Project not found' };
}

/** Starts the first run: the plan, the pictures and a first finished ad. Returns at once; the page then follows the project row. */
export async function startCloneAuto(projectId: string, input: { brief: string; link?: string; length: AutoLength }): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { userId, project } = loaded;

  const brief = (input.brief || '').trim().slice(0, MAX_BRIEF);
  let link = '';
  try {
    link = linkOf(input.link);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'That link cannot be read' };
  }
  if (!brief && !link) return { success: false, error: 'Write a few lines about your business, or paste a link to your website' };
  const length = AUTO_LENGTHS.includes(input.length) ? input.length : 'full';
  if (BUSY[project.status]) return { success: false, error: BUSY[project.status] };
  if (!supported(project)) return { success: false, error: UNSUPPORTED };
  if (!directedScenes(project).length) return { success: false, error: 'This board has no scenes of the source ad' };
  if (project.scenes.some((scene) => scene.anim?.status === 'generating')) return { success: false, error: 'A scene is still being animated. Please wait until it is done.' };

  const ceiling = draftCeiling(project);
  const balance = await balanceOf(userId);
  if (balance < ceiling) return { success: false, error: `The first version can cost up to ${ceiling} credits and you have ${balance}. Add credits to go on.` };

  // The project is claimed before anything is charged: of two clicks at the same moment only one gets it.
  const runId = randomUUID();
  const run: AutoRun = { id: runId, kind: 'draft', stage: 'planning', done: 0, total: 0, started_at: new Date().toISOString() };
  const claimed = await mutateProject(projectId, (fresh) =>
    BUSY[fresh.status] ? null : { status: 'directing', error_message: null, analysis_summary: withAuto(fresh, { brief, link: link || undefined, length, run }) }
  );
  if (!claimed) return { success: false, error: 'Project not found' };
  if (autoOf(claimed.analysis_summary).run?.id !== runId) return { success: false, error: BUSY[claimed.status] || 'The director is already working on this ad.' };

  const ctx: RunContext = { projectId, userId, runId, credits: creditsOf(userId) };
  const refused = await ctx.credits.charge(CLONE_AUTO_CREDITS, 'clone_studio_auto', runId, { project_id: projectId });
  if (refused) {
    await failAutoRun(ctx, refused);
    return { success: false, error: refused };
  }
  const started = await mutateProject(projectId, (fresh) => ({ credits_spent: (fresh.credits_spent || 0) + CLONE_AUTO_CREDITS }));
  after(() => runCloneDraft(ctx));
  return { success: true, project: started || claimed };
}

/**
 * Starts the second run: clips for the scenes the client chose, then the ad again. Each clip
 * is charged when it is ordered and refunded when it cannot be made.
 */
export async function startCloneMotion(projectId: string, picks: { n: number; engine: CloneAnimEngine }[]): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { userId, project } = loaded;
  if (BUSY[project.status]) return { success: false, error: BUSY[project.status] };
  if (!supported(project)) return { success: false, error: UNSUPPORTED };

  const chosen = new Map<number, CloneAnimEngine>();
  for (const pick of Array.isArray(picks) ? picks.slice(0, 40) : []) {
    const scene = project.scenes.find((s) => s.n === pick?.n && !s.is_custom);
    if (!scene || !scene.edited_image_url || scene.finish?.picture === 'skip' || scene.finish?.picture === 'card') continue;
    if (scene.anim?.status === 'generating') return { success: false, error: `Scene ${scene.n} is still being animated. Please wait until it is done.` };
    chosen.set(scene.n, pick.engine === 'standard' ? 'standard' : 'best');
  }
  if (!chosen.size) return { success: false, error: 'Choose at least one scene to animate' };
  const list = [...chosen].map(([n, engine]) => ({ n, engine }));

  const total = list.reduce((sum, pick) => sum + cloneClipCredits(cloneClipSeconds(project.scenes.find((s) => s.n === pick.n && !s.is_custom)!), pick.engine), 0);
  const balance = await balanceOf(userId);
  if (balance < total) return { success: false, error: `These clips cost ${total} credits and you have ${balance}. Choose fewer scenes, or add credits.` };

  const runId = randomUUID();
  const run: AutoRun = { id: runId, kind: 'motion', stage: 'clips', done: 0, total: list.length, picks: list, started_at: new Date().toISOString() };
  const claimed = await mutateProject(projectId, (fresh) =>
    BUSY[fresh.status] ? null : { status: 'directing', error_message: null, analysis_summary: withAuto(fresh, { ...autoOf(fresh.analysis_summary), run }) }
  );
  if (!claimed) return { success: false, error: 'Project not found' };
  if (autoOf(claimed.analysis_summary).run?.id !== runId) return { success: false, error: BUSY[claimed.status] || 'The director is already working on this ad.' };

  after(() => runCloneMotion({ projectId, userId, runId, credits: creditsOf(userId) }));
  return { success: true, project: claimed };
}

/**
 * The page polls this while the director works. A run whose server process died is picked
 * up again from what the board already holds; after a few tries it is given up and the flat
 * fee comes back.
 */
export async function checkCloneAuto(projectId: string): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { userId, project } = loaded;
  const stale = (row: CloneProject) => row.status === 'directing' && Date.now() - Date.parse(row.updated_at) > CLONE_AUTO_STALE_MS;
  if (!stale(project)) return { success: true, project };

  // Of several polls that see the dead run, one picks it up: the write lands only on the row as it was read.
  let picked: AutoRun | null = null;
  const touched = await mutateProject(projectId, (fresh) => {
    picked = null;
    const auto = autoOf(fresh.analysis_summary);
    if (!stale(fresh) || !auto.run) return null;
    picked = { ...auto.run, resumed: (auto.run.resumed || 0) + 1 };
    return { analysis_summary: withAuto(fresh, { ...auto, run: picked }) };
  });
  const run = picked as AutoRun | null;
  if (!run || !touched) return { success: true, project: touched || project };

  const ctx: RunContext = { projectId, userId, runId: run.id, credits: creditsOf(userId) };
  if ((run.resumed || 0) > CLONE_AUTO_RESUMES) {
    const settled = await failAutoRun(ctx, DEAD_RUN);
    return { success: true, project: settled || touched };
  }
  console.log(`🔁 Clone Studio: picking run ${run.id} of project ${projectId} up again (${run.resumed})`);
  after(() => (run.kind === 'motion' ? runCloneMotion(ctx) : runCloneDraft(ctx)));
  return { success: true, project: touched };
}

/** Clears the director's last message (a failed run's reason) once the client has read it. */
export async function dismissCloneAutoRun(projectId: string): Promise<CloneProjectResponse> {
  const loaded = await owned(projectId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const project = await mutateProject(projectId, (fresh) => {
    const auto = autoOf(fresh.analysis_summary);
    if (fresh.status === 'directing' || !auto.run) return null;
    const { run: _run, ...rest } = auto;
    return { status: restingStatus(fresh), analysis_summary: withAuto(fresh, rest) };
  });
  return project ? { success: true, project } : { success: false, error: 'Project not found' };
}
