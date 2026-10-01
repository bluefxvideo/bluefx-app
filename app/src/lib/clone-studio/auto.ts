import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/app/supabase/server';
import { createKlingVoice, getKlingQueueStatus, getKlingResult, submitKlingO3ProImageToVideo, submitKlingO3ProVoiceClip } from '@/actions/models/fal-kling-video';
import { uploadImageToStorage } from '@/actions/supabase-storage';
import { refundSentence } from '@/lib/credits/refund';
import { ensureFalCompatibleImage } from '@/lib/fal-image-guard';
import { downloadLinkPhotos, fromLink } from '@/lib/smart-video/sources';
import { alignScript } from '@/lib/smart-video/timing';
import { trackUsage, usage, type UsageEntry } from '@/lib/smart-video/usage';
import {
  CLONE_ANIM_NEGATIVE_PROMPT,
  CLONE_FREE_REMAKES,
  CLONE_IMAGE_CREDITS,
  DEFAULT_FINISH_SETTINGS,
  cloneClipCredits,
  cloneClipSeconds,
  composeMotionPrompt,
  sceneClip,
  spokenLineOf,
  type AutoRun,
  type CloneAnalysisSummary,
  type CloneAnimEngine,
  type CloneAuto,
  type CloneProject,
  type CloneScene,
  type FinishStage,
  type SceneCheck,
} from '@/types/clone-studio';
import { failCloneAnimation, finalizeCloneAnimation } from './animation';
import type { CloneCredits } from './credits';
import { castForClient, castPicturePrompt, castToPicture, composeBoard, directShots, directedScenes, finishSettingsOf, planCloneAd, type DirectorPhoto } from './director';
import { isOwnFile, publicLink } from './files';
import { hear, narratorSample, proposeFinish, soundOf } from './finish';
import { checkScenePicture, makeCastPicture, makeScenePicture, sceneReferences, withPicture, type PictureVerdict } from './picture';
import { finishCloneAd, logCloneRun } from './render';
import { mutateProject, type ProjectPatch } from './store';

/**
 * Clone Studio, "Do it for me": the runs that carry out the director's plan.
 *
 * The draft run writes the plan into the board, makes the pictures (each one checked, and
 * remade at no charge when it does not pass), and finishes a first version of the ad from
 * the pictures. The motion run animates the scenes the client chose, listens to the clips
 * and finishes the ad again.
 *
 * Both runs work from the project row and save every result the moment it exists, so a run
 * whose server process died (a deploy) is picked up where it stopped. Credits follow the
 * work: a picture is charged when it lands on the board, a clip when it is ordered (and its
 * order is written down first), so picking a run up again charges nothing twice. What the
 * page shows is in analysis_summary.auto.run; API costs go to the private run log only.
 */

const PICTURES_AT_ONCE = 4;
const DIRECTOR_PHOTOS = 8; // the client's photos the director looks at
const LINK_PHOTOS = 4; // photos taken from the client's page when they gave few of their own
const CLIP_POLL_MS = 8_000;
const CLIP_WAIT_MS = 15 * 60 * 1000;
const SAID_ENOUGH = 0.5; // share of a line's words a talking clip must be heard to say

const EMPTY_SUMMARY: CloneAnalysisSummary = { summary: '', characters: [], products: [], visual_style: '', music_brief: '' };

export interface RunContext {
  projectId: string;
  userId: string;
  runId: string;
  credits: CloneCredits;
  /** How often the run had been picked up again when this worker started. A worker from before the last pick-up stops writing. */
  epoch?: number;
}

/** A credit reference names one thing once: letters, digits and hyphens only (the refund looks references up with the database's filter language). */
const reference = (runId: string, ...parts: (string | number)[]) => [runId, ...parts.map((part) => String(part).replace(/[^A-Za-z0-9]/g, '')), randomBytes(4).toString('hex')].join('-');

export const autoOf = (summary: CloneAnalysisSummary | null | undefined): CloneAuto => summary?.auto || { brief: '', length: 'full' };
const withAuto = (project: CloneProject, auto: CloneAuto): CloneAnalysisSummary => ({ ...(project.analysis_summary || EMPTY_SUMMARY), auto });

/** Where a project rests when no run is working on it. */
export const restingStatus = (project: CloneProject) => (project.final_video_url ? 'completed' : 'board_ready') as CloneProject['status'];

async function readProject(projectId: string): Promise<CloneProject> {
  const { data, error } = await createAdminClient().from('ad_clone_projects').select('*').eq('id', projectId).single();
  if (error || !data) throw new Error('Project not found');
  return data as unknown as CloneProject;
}

class Superseded extends Error {}

/** Writes to the board as long as this run still owns it. `change` gets the fresh row and the run as it is now. */
async function write(ctx: RunContext, change: (fresh: CloneProject, run: AutoRun, auto: CloneAuto) => (ProjectPatch & { run?: Partial<AutoRun>; auto?: Partial<CloneAuto> }) | null): Promise<CloneProject> {
  let lost = false;
  const saved = await mutateProject(ctx.projectId, (fresh) => {
    const auto = autoOf(fresh.analysis_summary);
    lost = auto.run?.id !== ctx.runId || fresh.status !== 'directing' || (auto.run.resumed || 0) !== (ctx.epoch || 0);
    if (lost || !auto.run) return null;
    const result = change(fresh, auto.run, auto);
    if (!result) return null;
    const { run, auto: autoPatch, analysis_summary, ...columns } = result;
    const summary = analysis_summary || fresh.analysis_summary || EMPTY_SUMMARY;
    return { ...columns, analysis_summary: { ...summary, auto: { ...auto, ...autoPatch, run: { ...auto.run, ...run } } } };
  });
  if (lost || !saved) throw new Superseded('Another run took over this project');
  return saved;
}

const changeScene = (scenes: CloneScene[], n: number, change: (scene: CloneScene) => CloneScene) => scenes.map((scene) => (scene.n === n && !scene.is_custom ? change(scene) : scene));

/** Runs `job` on every item, a few at a time. A failure stops new items; items in flight finish first, then the failure is reported. */
async function inParallel<T>(items: T[], atOnce: number, job: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failure: unknown;
  await Promise.all(
    Array.from({ length: Math.min(atOnce, items.length) }, async () => {
      while (next < items.length && failure === undefined) {
        try {
          await job(items[next++]);
        } catch (error) {
          failure ??= error;
        }
      }
    })
  );
  if (failure !== undefined) throw failure;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs a job with the sign of life the page looks for: the row's updated_at, touched while the run is alive. */
async function alive<T>(projectId: string, job: () => Promise<T>): Promise<T> {
  const admin = createAdminClient();
  const heartbeat = setInterval(() => {
    admin.from('ad_clone_projects').update({ updated_at: new Date().toISOString() } as never).eq('id', projectId).eq('status', 'directing').then(() => undefined, () => undefined);
  }, 45_000);
  try {
    return await job();
  } finally {
    clearInterval(heartbeat);
  }
}

/** Ends a run that cannot go on: the flat fee comes back, the board is usable again, the panel says why. */
export async function failAutoRun(ctx: RunContext, reason: string): Promise<CloneProject | null> {
  const refunded = await ctx.credits.refund(ctx.runId, 'clone studio do it for me');
  const error = refunded ? `${reason} ${refundSentence(refunded)}` : reason;
  return mutateProject(ctx.projectId, (fresh) => {
    const auto = autoOf(fresh.analysis_summary);
    if (auto.run?.id !== ctx.runId) return null;
    return {
      status: restingStatus(fresh),
      error_message: null,
      credits_spent: Math.max(0, (fresh.credits_spent || 0) - refunded),
      analysis_summary: withAuto(fresh, { ...auto, run: { ...auto.run, stage: 'failed', error } }),
    };
  });
}

// ---------------------------------------------------------------------------
// The draft: plan, pictures, a first finished ad
// ---------------------------------------------------------------------------

/** The client's photos as the director gets them. Only files in our own storage count. */
const clientPhotos = (project: CloneProject): string[] =>
  [...new Set([...(project.analysis_summary?.project_ref_urls || []), ...project.scenes.flatMap((scene) => scene.user_ref_urls || [])])].filter(isOwnFile).slice(0, DIRECTOR_PHOTOS);

/** What the client wrote, with the facts of their page in front when they gave a link. Photos of the page fill the board when the client gave few. */
export async function readBrief(project: CloneProject, auto: CloneAuto): Promise<{ brief: string; photos: string[]; notes: string[] }> {
  const own = clientPhotos(project);
  if (!auto.link?.trim()) return { brief: auto.brief, photos: own, notes: [] };
  try {
    const page = await fromLink(publicLink(auto.link));
    const room = Math.max(0, Math.min(LINK_PHOTOS, 6 - own.length));
    const found = room ? (await downloadLinkPhotos(page.imageUrls.slice(0, 12))).slice(0, room) : [];
    const stored: string[] = [];
    for (const [i, photo] of found.entries()) {
      const upload = await uploadImageToStorage(new Blob([new Uint8Array(photo.data)], { type: 'image/jpeg' }), {
        bucket: 'images',
        folder: `clone-studio/${project.id}/refs`,
        filename: `link-${Date.now()}-${i + 1}.jpg`,
        contentType: 'image/jpeg',
      });
      if (upload.success && upload.url) stored.push(upload.url);
    }
    const brief = auto.brief.trim() ? `${page.brief}\n\nNOTE FROM THE CLIENT:\n${auto.brief.trim()}` : page.brief;
    return { brief, photos: [...own, ...stored], notes: [] };
  } catch (error) {
    if (!auto.brief.trim()) throw new Error(`The link could not be read (${error instanceof Error ? error.message : 'unknown reason'}). Write a few lines about your business instead.`);
    return { brief: auto.brief, photos: own, notes: ['The link could not be read, so the ad was written from your text only.'] };
  }
}

/** Step 1: the director's plan, written into the boxes of the board. */
async function plan(ctx: RunContext, project: CloneProject): Promise<CloneProject> {
  const auto = autoOf(project.analysis_summary);
  const read = await readBrief(project, auto);
  const photos: DirectorPhoto[] = read.photos.map((url, i) => ({ id: `R${i + 1}`, url }));
  const planned = await planCloneAd({ project, brief: read.brief, photos, length: auto.length });
  // The director watches the source ad and writes the shots while the cast's pictures are made.
  const shots = directShots(project, planned, read.brief);

  // People and products the client has no photo of get one picture each, used in every scene they appear in.
  const made: Record<string, string> = {};
  const charged: string[] = [];
  const notes = [...read.notes, ...(planned.warnings || [])];
  for (const row of castToPicture(planned)) {
    try {
      const url = await makeCastPicture(ctx.projectId, castPicturePrompt(row));
      usage.castPicture();
      // Charged once it exists. Without credits for it the row is painted from its description.
      const paid = reference(ctx.runId, 'cast', row.id);
      if (await ctx.credits.charge(CLONE_IMAGE_CREDITS, 'clone_studio_image', paid, { project_id: ctx.projectId, cast: row.id })) break;
      charged.push(paid);
      const id = `M${Object.keys(made).length + 1}`;
      photos.push({ id, url });
      made[row.id] = id;
    } catch (error) {
      console.warn(`Clone Studio: the picture of an invented ${row.kind} could not be made:`, String(error).slice(0, 160));
    }
  }
  const castCredits = charged.length * CLONE_IMAGE_CREDITS;

  const direction = await shots;
  const board = composeBoard(direction, project, photos, made, read.brief);
  const allPhotos = photos.map((photo) => photo.url);
  const toPicture = board.filter((scene) => scene.plan.keep && scene.plan.treatment !== 'card').length;
  return write(ctx, (fresh) => {
    const summary = fresh.analysis_summary || EMPTY_SUMMARY;
    const finish = summary.finish || { settings: DEFAULT_FINISH_SETTINGS };
    return {
      credits_spent: (fresh.credits_spent || 0) + castCredits,
      scenes: fresh.scenes.map((scene) => {
        const composed = scene.is_custom ? undefined : board.find((entry) => entry.n === scene.n);
        if (!composed) return scene;
        const clip = sceneClip(scene);
        return {
          ...scene,
          plan: composed.plan,
          user_instruction: composed.user_instruction,
          user_ref_urls: [],
          excluded_project_ref_urls: allPhotos.filter((url) => !composed.photoUrls.includes(url)),
          motion_prompt: composed.motion_prompt,
          anim_seconds: composed.anim_seconds,
          finish: composed.finish,
          check: undefined,
          // A clip made from an earlier picture no longer fits: it stays among the scene's takes.
          ...(clip ? { anim: { request_id: null, video_url: null, status: 'idle' as const }, anim_versions: [clip, ...(scene.anim_versions || []).filter((url) => url !== clip)].slice(0, 5) } : {}),
        };
      }),
      analysis_summary: {
        ...summary,
        project_ref_urls: allPhotos,
        music_prompt: direction.musicPrompt,
        finish: { ...finish, settings: finishSettingsOf(direction, finish.settings), language: direction.language },
      },
      auto: { cast: castForClient(direction, photos, made), notes, planned: true },
      run: { planned: true, stage: 'pictures', done: 0, total: toPicture },
    };
  }).catch(async (error) => {
    // Pictures that never reached the board were not delivered.
    for (const paid of charged) await ctx.credits.refund(paid, 'clone studio image');
    throw error;
  });
}

/** How bad a picture is: a picture that passed is best, then the one with the fewest failed points. */
const flaws = (verdict: PictureVerdict | null) => (!verdict || verdict.pass ? 0 : Math.max(1, verdict.failed.length));

/** Step 2, one scene: its picture is made, looked at, and remade at no charge while it does not pass. */
async function picture(ctx: RunContext, n: number): Promise<void> {
  const project = await readProject(ctx.projectId);
  const scene = project.scenes.find((s) => s.n === n && !s.is_custom);
  if (!scene || scene.plan?.pictured === ctx.runId) return;

  const refs = sceneReferences(project, scene).filter(isOwnFile);
  const takes: { url: string; verdict: PictureVerdict | null; instruction: string }[] = [];
  let instruction = scene.user_instruction;
  let problem = '';
  try {
    if (!isOwnFile(scene.keyframe_url)) throw new Error('The frame of this scene is not part of this project');
    for (let take = 0; take <= CLONE_FREE_REMAKES; take++) {
      const url = await makeScenePicture(project, { ...scene, user_instruction: instruction }, `${ctx.runId}-${n}-${take}`);
      usage.scenePicture(n, take > 0);
      const verdict = await checkScenePicture({ keyframe: scene.keyframe_url, picture: url, instruction, refs });
      takes.push({ url, verdict, instruction });
      if (!verdict || verdict.pass || !verdict.why) break;
      // The reason goes into the scene's own instruction, where the client can read and change it.
      // The same reason a second time is not written twice: saying it again changed nothing.
      const reason = verdict.why.replace(/\s+/g, ' ').slice(0, 240);
      if (instruction.includes(reason)) break;
      instruction = `${instruction} Correction: ${reason}`;
    }
  } catch (error) {
    problem = error instanceof Error ? error.message : 'unknown reason';
    console.warn(`Clone Studio: the picture of scene ${n} failed:`, problem.slice(0, 200));
  }

  const best = takes.length ? takes.reduce((a, b) => (flaws(b.verdict) < flaws(a.verdict) ? b : a)) : null;
  const check: SceneCheck = best
    ? { picture_url: best.url, pass: !best.verdict || best.verdict.pass, why: best.verdict && !best.verdict.pass ? best.verdict.why : '', remakes: takes.length - 1 }
    : { picture_url: '', pass: false, why: `The picture could not be made: ${problem.slice(0, 200)}`, remakes: 0 };
  // The picture is charged when it exists, right before it lands on the board: a run that dies while a picture is being made has charged nothing for it.
  const paid = best ? CLONE_IMAGE_CREDITS : 0;
  const charge = reference(ctx.runId, 'picture', n);
  if (best) {
    const refused = await ctx.credits.charge(CLONE_IMAGE_CREDITS, 'clone_studio_image', charge, { project_id: ctx.projectId, scene: n });
    if (refused) throw new Error(`The pictures could not all be made: ${refused}`);
  }
  try {
    await write(ctx, (fresh, run) => ({
      credits_spent: (fresh.credits_spent || 0) + paid,
      scenes: changeScene(fresh.scenes, n, (current) => {
        // Every take goes into the scene's history; the best one is the current picture.
        const withTakes = takes.reduce((s, take) => withPicture(s, take.url), current);
        return {
          // A scene without a picture is left out of the finished ad: an older picture of it would show the wrong business.
          ...(best ? withPicture(withTakes, best.url) : { ...current, finish: current.finish ? { ...current.finish, picture: 'skip' as const } : current.finish }),
          // The instruction that made the kept picture is the one that stays on the card.
          ...(best ? { user_instruction: best.instruction } : {}),
          check,
          plan: current.plan ? { ...current.plan, pictured: ctx.runId } : current.plan,
          credits_spent: (current.credits_spent || 0) + paid,
        };
      }),
      run: { done: Math.min(run.total, run.done + 1) },
    }));
  } catch (error) {
    // A picture that could not be put on the board was not delivered.
    if (best) await ctx.credits.refund(charge, 'clone studio image');
    throw error;
  }
}

interface Delivered {
  seconds: number;
  /** The timeline the renderer got, for the private run log. */
  props: unknown;
}

/** Step 3: the board as it is now becomes a finished ad. The stages show in the run. */
async function finish(ctx: RunContext): Promise<Delivered> {
  const stage = (next: FinishStage, progress = 0) => void write(ctx, () => ({ run: { stage: 'finishing', finish: { stage: next, progress } } })).catch(() => null);
  await write(ctx, () => ({ run: { stage: 'finishing', finish: { stage: 'clips', progress: 0 } } }));
  const ad = await finishCloneAd({ userId: ctx.userId, projectId: ctx.projectId, runId: ctx.runId, onStage: stage });
  await write(ctx, (fresh) => {
    const summary = fresh.analysis_summary || EMPTY_SUMMARY;
    const settings = summary.finish || { settings: DEFAULT_FINISH_SETTINGS };
    return {
      status: 'completed',
      final_video_url: ad.url,
      error_message: null,
      analysis_summary: { ...summary, finish: { ...settings, made: (settings.made || 0) + 1, owed: false } },
      run: { stage: 'done', finish: { stage: 'done', progress: 100 } },
    };
  });
  return { seconds: ad.seconds, props: ad.props };
}

/**
 * Runs a job with its API costs counted, settles a failure (the flat fee comes back, the
 * panel says why) and writes the private run log. A run another run took over is left alone.
 */
async function logged(ctx: RunContext, job: () => Promise<Delivered | null>): Promise<void> {
  let failure: string | undefined;
  const tracked = await trackUsage(async () => {
    try {
      return await job();
    } catch (error) {
      if (error instanceof Superseded) return null;
      failure = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Clone Studio: run ${ctx.runId} of project ${ctx.projectId} failed:`, error);
      await failAutoRun(ctx, failure).catch(() => null);
      return null;
    }
  });
  await logCloneRun({
    id: ctx.runId,
    project_id: ctx.projectId,
    user_id: ctx.userId,
    status: failure ? 'failed' : tracked.result ? 'done' : 'stopped',
    duration_seconds: tracked.result?.seconds ?? null,
    usage: tracked.usage as UsageEntry[],
    props: tracked.result?.props ?? null,
    ...(failure ? { error: failure } : {}),
  });
}

/** The draft run. Safe to start again after a crash: it continues from what the board already holds. */
export async function runCloneDraft(ctx: RunContext): Promise<void> {
  await alive(ctx.projectId, () =>
    logged(ctx, async () => {
      let project = await readProject(ctx.projectId);
      const run = autoOf(project.analysis_summary).run;
      if (run?.id !== ctx.runId || project.status !== 'directing') return null;
      ctx = { ...ctx, epoch: run.resumed || 0 };
      console.log(`🎬 Clone Studio: "Do it for me" on project ${ctx.projectId} (run ${ctx.runId}${run.resumed ? `, picked up again ${run.resumed}x` : ''})`);

      if (!run.planned) project = await plan(ctx, project);

      const todo = directedScenes(project).filter((scene) => scene.plan?.keep && scene.plan.treatment !== 'card' && scene.plan.pictured !== ctx.runId);
      await inParallel(todo, PICTURES_AT_ONCE, (scene) => picture(ctx, scene.n));

      project = await readProject(ctx.projectId);
      if (!directedScenes(project).some((scene) => scene.plan?.keep && scene.plan.treatment !== 'card' && scene.edited_image_url && scene.check?.picture_url === scene.edited_image_url)) {
        throw new Error('None of the pictures could be made. Check your photos and your text, then try again.');
      }
      const delivered = await finish(ctx);
      console.log(`✅ Clone Studio: "Do it for me" finished project ${ctx.projectId}`);
      return delivered;
    })
  );
}

// ---------------------------------------------------------------------------
// Motion: clips for the chosen scenes, then the ad again
// ---------------------------------------------------------------------------

/** A scene's clip was ordered in this run when its attempt carries the run's id; the attempt also says which take it is. */
const clipPrefix = (runId: string, n: number) => `${runId}-clip-${n}-`;
const orderedIn = (scene: CloneScene, runId: string) => Boolean(scene.anim?.attempt_id?.startsWith(clipPrefix(runId, scene.n)));
const takeOf = (scene: CloneScene, runId: string) => Number(scene.anim?.attempt_id?.slice(clipPrefix(runId, scene.n).length).split('-')[0]) || 1;

/** A scene in which the ad's main speaker says a line on camera: the clip that gets the narrator's voice. */
const leadTalks = (scene: CloneScene | undefined) => Boolean(scene?.plan?.lead && scene.plan.speaker === 'on_camera' && scene.finish?.line?.trim());

/**
 * The narrator's voice, saved with the video engine, so that the person on camera and the
 * narrator are one voice. The engine otherwise picks a new voice for every clip. Saved once
 * for a board and a narrator; null when it could not be saved (the clips are then made as before).
 */
async function savedVoice(ctx: RunContext, project: CloneProject): Promise<string | null> {
  const summary = project.analysis_summary;
  const gender = summary?.finish?.settings?.voice || DEFAULT_FINISH_SETTINGS.voice;
  const kept = autoOf(summary).voice;
  if (kept?.id && kept.gender === gender) return kept.id;
  try {
    const lines = project.scenes.filter((scene) => !scene.is_custom && scene.finish && scene.finish.picture !== 'skip').map((scene) => scene.finish?.line || '');
    const sample = await narratorSample(lines, summary?.finish?.language, gender);
    const voice = await createKlingVoice(`data:audio/wav;base64,${sample.toString('base64')}`);
    if (!voice.success || !voice.voiceId) throw new Error(voice.error || 'no voice id');
    usage.savedVoice();
    const id = voice.voiceId;
    await write(ctx, () => ({ auto: { voice: { id, gender } } }));
    return id;
  } catch (error) {
    if (error instanceof Superseded) throw error;
    console.warn('Clone Studio: the narrator\'s voice could not be saved, the clips get a voice of their own:', String(error).slice(0, 200));
    return null;
  }
}

/**
 * Orders one clip: the order is written on the scene, then paid, then placed with the video
 * engine. A retake after a failed check costs nothing. Written down first, an order that a
 * dying process left half done is seen by the next worker and settled (see settleHalfOrders).
 * With a saved voice, the main speaker's talking clip is ordered in that voice.
 */
async function orderClip(ctx: RunContext, n: number, engine: CloneAnimEngine, take: number, voiceId: string | null = null): Promise<void> {
  const project = await readProject(ctx.projectId);
  const scene = project.scenes.find((s) => s.n === n && !s.is_custom);
  if (!scene?.edited_image_url || !isOwnFile(scene.edited_image_url)) return;
  const seconds = cloneClipSeconds(scene);
  const attempt = reference(ctx.runId, 'clip', n, take);
  const credits = take === 1 ? cloneClipCredits(seconds, engine) : 0;
  const prompt = scene.motion_prompt?.trim() || composeMotionPrompt(scene.analysis);
  const negative = scene.negative_prompt?.trim() || CLONE_ANIM_NEGATIVE_PROMPT;
  const voice = engine === 'best' && voiceId && leadTalks(scene) && (project.aspect_ratio === '16:9' || project.aspect_ratio === '9:16') ? voiceId : null;

  await write(ctx, (fresh) => ({
    scenes: changeScene(fresh.scenes, n, (current) => ({
      ...current,
      anim: { request_id: null, video_url: null, status: 'generating', attempt_id: attempt },
      // The clip being replaced stays among the scene's takes.
      anim_versions: sceneClip(current) ? [sceneClip(current) as string, ...(current.anim_versions || []).filter((url) => url !== sceneClip(current))].slice(0, 5) : current.anim_versions,
      anim_seconds: seconds,
      anim_engine: engine,
      anim_voice: voice,
      motion_prompt: prompt,
      negative_prompt: negative,
    })),
  }));
  const giveUp = (why: string | undefined) => {
    console.warn(`Clone Studio: the clip of scene ${n} could not be ordered:`, why);
    return write(ctx, (fresh) => ({ scenes: changeScene(fresh.scenes, n, (current) => (current.anim?.attempt_id === attempt ? { ...current, anim: { ...current.anim, status: 'failed' } } : current)) }));
  };

  if (credits) {
    const refused = await ctx.credits.charge(credits, 'clone_studio_animation', attempt, { project_id: ctx.projectId, scene: n, seconds, engine });
    if (refused) {
      await giveUp(refused);
      throw new Error(`The clips could not all be ordered: ${refused}`);
    }
  }
  const image = (await ensureFalCompatibleImage(scene.edited_image_url, attempt, `scene${n}-anim`)) || scene.edited_image_url;
  const webhook_url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/fal-ai`;
  const plain = () =>
    submitKlingO3ProImageToVideo({
      prompt,
      image_url: image,
      duration: seconds,
      negative_prompt: negative,
      // Footage on the standard tier is ordered without sound: the narrator and the music carry the scene.
      generate_audio: engine === 'best',
      tier: engine === 'standard' ? 'standard' : 'pro',
      webhook_url,
    });
  let submit = voice ? await submitKlingO3ProVoiceClip({ prompt, image_url: image, duration: seconds, aspect_ratio: project.aspect_ratio as '16:9' | '9:16', voice_id: voice, webhook_url }) : await plain();
  if (voice && (!submit.success || !submit.request_id)) {
    // The saved voice was not taken (it may have expired): the clip is made the plain way rather than not at all.
    console.warn(`Clone Studio: scene ${n} could not be ordered with the saved voice (${submit.error}), ordering it without`);
    await write(ctx, (fresh) => ({ scenes: changeScene(fresh.scenes, n, (current) => (current.anim?.attempt_id === attempt ? { ...current, anim_voice: null } : current)) }));
    submit = await plain();
  }
  if (!submit.success || !submit.request_id) {
    if (credits) await ctx.credits.refund(attempt, 'clone studio animation');
    await giveUp(submit.error);
    return;
  }
  usage.clip(seconds, engine, take > 1);
  const requestId = submit.request_id;
  await write(ctx, (fresh) => ({
    credits_spent: (fresh.credits_spent || 0) + credits,
    scenes: changeScene(fresh.scenes, n, (current) =>
      current.anim?.attempt_id === attempt ? { ...current, anim: { ...current.anim, request_id: requestId }, credits_spent: (current.credits_spent || 0) + credits } : current
    ),
  }));
}

/**
 * An order a dead worker left half done (written down, perhaps paid, never placed, or placed
 * without its number written down) cannot be collected: what was paid for it comes back and
 * the scene is free to be ordered again.
 */
async function settleHalfOrders(ctx: RunContext, project: CloneProject): Promise<CloneProject> {
  const half = project.scenes.filter((scene) => !scene.is_custom && orderedIn(scene, ctx.runId) && scene.anim.status === 'generating' && !scene.anim.request_id);
  if (!half.length) return project;
  for (const scene of half) await ctx.credits.refund(scene.anim.attempt_id as string, 'clone studio animation');
  return write(ctx, (fresh) => ({
    scenes: fresh.scenes.map((scene) =>
      half.some((h) => h.n === scene.n && h.anim.attempt_id === scene.anim?.attempt_id) && !scene.is_custom ? { ...scene, anim: { request_id: null, video_url: null, status: 'idle' as const } } : scene
    ),
  }));
}

/** Waits for the ordered clips. The video engine's own callback usually lands first; asking is the fallback. */
async function awaitClips(ctx: RunContext, numbers: number[]): Promise<CloneProject> {
  const deadline = Date.now() + CLIP_WAIT_MS;
  for (;;) {
    const project = await readProject(ctx.projectId);
    const mine = project.scenes.filter((scene) => numbers.includes(scene.n) && orderedIn(scene, ctx.runId));
    const waiting = mine.filter((scene) => scene.anim.status === 'generating' && scene.anim.request_id);
    const ready = mine.filter((scene) => sceneClip(scene)).length;
    await write(ctx, (_fresh, run) => (run.done === ready ? null : { run: { done: ready } })).catch((error) => {
      if (error instanceof Superseded) throw error;
    });
    if (!waiting.length) return project;
    for (const scene of waiting) {
      const requestId = scene.anim.request_id as string;
      if (Date.now() > deadline) {
        await failCloneAnimation(requestId, 'The clip took too long');
        continue;
      }
      const status = await getKlingQueueStatus(requestId);
      if (!status.success || status.status !== 'COMPLETED') continue;
      const result = await getKlingResult(requestId);
      if (result.success && result.videoUrl) await finalizeCloneAnimation(requestId, result.videoUrl);
      else await failCloneAnimation(requestId, result.error);
    }
    await sleep(CLIP_POLL_MS);
  }
}

/** Whether the person in a finished clip says the line the scene was given. A clip nobody could listen to counts as fine. */
async function saysItsLine(scene: CloneScene, language?: string): Promise<boolean> {
  const line = spokenLineOf(scene.motion_prompt);
  const clip = sceneClip(scene);
  if (!line || !clip || !isOwnFile(clip)) return true;
  try {
    const heard = await hear(await soundOf(clip), language);
    return alignScript([line], heard.words).sceneCoverage[0] >= SAID_ENOUGH;
  } catch {
    return true;
  }
}

/** The motion run. Safe to start again after a crash: clips already ordered are waited for, never ordered twice. */
export async function runCloneMotion(ctx: RunContext): Promise<void> {
  await alive(ctx.projectId, () =>
    logged(ctx, async () => {
      let project = await readProject(ctx.projectId);
      const run = autoOf(project.analysis_summary).run;
      if (run?.id !== ctx.runId || project.status !== 'directing') return null;
      ctx = { ...ctx, epoch: run.resumed || 0 };
      const picks = run.picks || [];
      const numbers = picks.map((pick) => pick.n);
      console.log(`🎬 Clone Studio: adding motion to ${picks.length} scenes of project ${ctx.projectId} (run ${ctx.runId})`);

      // 1) Every chosen scene gets its clip ordered, once. The main speaker's clips speak with the narrator's voice.
      await write(ctx, () => ({ run: { stage: 'clips', total: picks.length } }));
      project = await settleHalfOrders(ctx, project);
      const sceneOf = (n: number) => project.scenes.find((s) => s.n === n && !s.is_custom);
      const voiceId = picks.some((pick) => pick.engine === 'best' && leadTalks(sceneOf(pick.n))) ? await savedVoice(ctx, project) : null;
      for (const pick of picks) {
        const scene = sceneOf(pick.n);
        if (scene && !orderedIn(scene, ctx.runId)) await orderClip(ctx, pick.n, pick.engine, 1, voiceId);
      }
      project = await awaitClips(ctx, numbers);

      // 2) A talking clip that does not say its line gets one more take at no charge.
      const language = project.analysis_summary?.finish?.language;
      const retakes: number[] = [];
      for (const pick of picks.filter((p) => p.engine === 'best')) {
        const scene = project.scenes.find((s) => s.n === pick.n && !s.is_custom);
        if (!scene || !sceneClip(scene) || !orderedIn(scene, ctx.runId) || takeOf(scene, ctx.runId) > 1) continue;
        if (await saysItsLine(scene, language)) continue;
        console.warn(`Clone Studio: the clip of scene ${pick.n} does not say its line, taking it again`);
        await orderClip(ctx, pick.n, pick.engine, 2, voiceId);
        retakes.push(pick.n);
      }
      if (retakes.length) {
        project = await awaitClips(ctx, retakes);
        // A second take that failed outright leaves the first take, which was paid for, as the scene's clip.
        const lost = project.scenes.filter((scene) => retakes.includes(scene.n) && !scene.is_custom && !sceneClip(scene) && scene.anim_versions?.[0]);
        if (lost.length) {
          project = await write(ctx, (fresh) => ({
            scenes: fresh.scenes.map((scene) =>
              lost.some((l) => l.n === scene.n) && !scene.is_custom && !sceneClip(scene) && scene.anim_versions?.[0]
                ? { ...scene, anim: { request_id: null, video_url: scene.anim_versions[0], status: 'completed' as const, attempt_id: reference(ctx.runId, 'clip', scene.n, 2) } }
                : scene
            ),
          }));
        }
      }

      // 3) The new clips go into the finished ad: a person who talks keeps their own voice.
      const notes: string[] = [];
      const proposals = new Map<number, Awaited<ReturnType<typeof proposeFinish>>['finish']>();
      for (const pick of picks) {
        const scene = project.scenes.find((s) => s.n === pick.n && !s.is_custom);
        if (!scene) continue;
        if (!sceneClip(scene) || !orderedIn(scene, ctx.runId)) {
          notes.push(`Scene ${pick.n}: the clip could not be made, so the picture is shown. The credits for that clip came back.`);
          continue;
        }
        if (pick.engine === 'best' && retakes.includes(pick.n) && !(await saysItsLine(scene, language))) {
          notes.push(`Scene ${pick.n}: the person in the clip does not say the line, also on the second take. The picture is shown with the narrator; the clip is on the scene's card.`);
          continue;
        }
        try {
          proposals.set(pick.n, (await proposeFinish(scene)).finish);
        } catch (error) {
          console.warn(`Clone Studio: the clip of scene ${pick.n} could not be listened to:`, String(error).slice(0, 160));
          proposals.set(pick.n, { ...(scene.finish || { line: '', text: '', sound: 'none' }), picture: 'clip', sound: pick.engine === 'best' ? 'clip' : scene.finish?.sound || 'none', checked_clip_url: sceneClip(scene) });
        }
      }
      project = await write(ctx, (fresh, _run, auto) => ({
        scenes: fresh.scenes.map((scene) => {
          const proposal = scene.is_custom ? undefined : proposals.get(scene.n);
          const clip = sceneClip(scene);
          if (proposal && (proposal.checked_clip_url ?? null) === clip) return { ...scene, finish: proposal };
          // A clip that is not used leaves the scene as it was: its picture, and a finish that matches what the scene holds.
          return numbers.includes(scene.n) && scene.finish ? { ...scene, finish: { ...scene.finish, picture: scene.finish.picture === 'clip' ? 'still' : scene.finish.picture, checked_clip_url: clip } } : scene;
        }),
        auto: { notes: [...(auto.notes || []).filter((note) => !/^Scene \d+: (the clip|the person in the clip)/.test(note)), ...notes] },
      }));

      // 4) The ad again, with the clips. It was paid for with the first version.
      try {
        const delivered = await finish(ctx);
        console.log(`✅ Clone Studio: motion added to project ${ctx.projectId}`);
        return delivered;
      } catch (error) {
        if (error instanceof Superseded) throw error;
        // The clips are made and paid; the finished ad is still owed.
        await mutateProject(ctx.projectId, (fresh) => {
          const summary = fresh.analysis_summary || EMPTY_SUMMARY;
          return { analysis_summary: { ...summary, finish: { ...(summary.finish || { settings: DEFAULT_FINISH_SETTINGS }), owed: true } } };
        });
        throw new Error(`The clips are ready, but the ad could not be put together (${error instanceof Error ? error.message : 'unknown reason'}). Open "Finish the ad" below and finish it again: it is free this time.`);
      }
    })
  );
}
