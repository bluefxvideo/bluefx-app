'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Film, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { checkCloneAuto, dismissCloneAutoRun, saveCloneAutoBrief, startCloneAuto, startCloneMotion } from '@/actions/tools/clone-studio-auto';
import {
  CLONE_ANIM_CREDITS_PER_SECOND,
  CLONE_ANIM_STANDARD_CREDITS_PER_SECOND,
  CLONE_AUTO_CREDITS,
  CLONE_IMAGE_CREDITS,
  CLONE_MAX_CAST_PICTURES,
  cloneClipCredits,
  cloneClipSeconds,
  sceneClip,
  suggestsClip,
  type AutoLength,
  type AutoRun,
  type CloneAnimEngine,
  type CloneProject,
  type CloneScene,
  type FinishStage,
} from '@/types/clone-studio';

/**
 * "Do it for me": the client says who they are, the director rewrites the board, makes the
 * pictures and finishes a first version of the ad. Then the client chooses which scenes get
 * a clip, sees the price, and one more click animates them and finishes the ad again.
 */

interface AutoPanelProps {
  project: CloneProject;
  onProjectUpdate: (project: CloneProject) => void;
  /** The board's photo strip: the client's person, product, place and logo. */
  photos: ReactNode;
  /** Shows a scene's card (the board may be folded away). */
  onOpenScene?: (n: number) => void;
}

type Choice = 'picture' | CloneAnimEngine;

const FINISH_LABEL: Record<FinishStage, string> = {
  clips: 'Preparing the scenes',
  voice: 'Recording the voice and the music',
  rendering: 'Putting the ad together',
  levelling: 'Levelling the sound',
  done: 'Finished',
  failed: 'Stopped',
};
const select = 'h-8 rounded-md border border-border/60 bg-transparent text-xs px-2 text-zinc-300 disabled:opacity-50';
const label = 'font-mono text-[9px] uppercase tracking-widest text-zinc-500';
const BRIEF_EXAMPLE =
  "Nonna Rosa's Pizza is a family pizzeria at 642 Main Street. The owner is Tony. Every Friday the oven is fired up at noon and the dough sells out by eight. A margherita is 12 dollars. Open Tuesday to Sunday, noon to ten. To order, text 615-555-0199.";

/** The scenes of the source ad the director works on (a frame the client added by hand is left alone). */
const directed = (project: CloneProject) => project.scenes.filter((scene) => !scene.is_custom);
/** A scene that shows its picture in the finished ad and can get a clip. */
const canMove = (scene: CloneScene) => !scene.is_custom && Boolean(scene.edited_image_url) && scene.plan?.keep !== false && scene.finish?.picture !== 'card' && scene.finish?.picture !== 'skip';

function progressOf(run: AutoRun): { text: string; percent: number } {
  if (run.stage === 'planning') return { text: 'The director is reading the ad, your text and your photos', percent: 6 };
  if (run.stage === 'pictures') return { text: `Making the pictures: ${run.done} of ${run.total}`, percent: 12 + (run.total ? (run.done / run.total) * 38 : 0) };
  if (run.stage === 'clips') return { text: `Animating: ${run.done} of ${run.total} ${run.total === 1 ? 'clip' : 'clips'} ready`, percent: 6 + (run.total ? (run.done / run.total) * 44 : 0) };
  const finish = run.finish;
  if (!finish) return { text: 'Finishing your ad', percent: 52 };
  const within = finish.stage === 'clips' ? 4 : finish.stage === 'voice' ? 12 : finish.stage === 'rendering' ? 16 + finish.progress * 0.3 : 47;
  return { text: `${FINISH_LABEL[finish.stage]}${finish.stage === 'rendering' ? `: ${finish.progress}%` : ''}`, percent: 50 + within };
}

export function AutoPanel({ project, onProjectUpdate, photos, onOpenScene }: AutoPanelProps) {
  const auto = project.analysis_summary?.auto;
  const run = auto?.run;
  const running = project.status === 'directing';
  const supported = project.aspect_ratio === '9:16' || project.aspect_ratio === '16:9';
  const scenes = directed(project);

  const [brief, setBrief] = useState(auto?.brief || '');
  const [link, setLink] = useState(auto?.link || '');
  const [length, setLength] = useState<AutoLength>(auto?.length || 'full');
  const [starting, setStarting] = useState(false);
  // The form shows until the director has made a plan; "Start over" brings it back.
  const [editing, setEditing] = useState(false);
  const focused = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!focused.current.brief) setBrief(auto?.brief || '');
  }, [auto?.brief]);
  useEffect(() => {
    if (!focused.current.link) setLink(auto?.link || '');
  }, [auto?.link]);

  // While the director works the row is the only source of truth: follow it.
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      const result = await checkCloneAuto(project.id);
      if (!result.success || !result.project) return;
      onProjectUpdate(result.project);
      const ended = result.project.status === 'directing' ? undefined : result.project.analysis_summary?.auto?.run;
      if (ended?.stage === 'done') toast.success(ended.kind === 'motion' ? 'Your ad is finished, now with motion' : 'The first version of your ad is ready');
      else if (ended?.stage === 'failed') toast.error(ended.error || 'The director could not finish', { duration: 12000 });
    }, 4000);
    return () => clearInterval(interval);
  }, [running, project.id, onProjectUpdate]);

  const save = async (input: Parameters<typeof saveCloneAutoBrief>[1]) => {
    const result = await saveCloneAutoBrief(project.id, input);
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const ceiling = CLONE_AUTO_CREDITS + (scenes.length + CLONE_MAX_CAST_PICTURES) * CLONE_IMAGE_CREDITS;
  const worked = project.scenes.some((scene) => scene.user_instruction?.trim() || scene.edited_image_url);

  const start = async () => {
    if (!brief.trim() && !link.trim()) {
      toast.error('Write a few lines about your business, or paste a link to your website');
      return;
    }
    if (worked && !window.confirm('The director rewrites the instruction of every scene and makes new pictures. Your current pictures and clips stay in the history of each scene. Go on?')) return;
    setStarting(true);
    try {
      const result = await startCloneAuto(project.id, { brief, link, length });
      if (result.success && result.project) {
        onProjectUpdate(result.project);
        setEditing(false);
        toast.success('The director is at work. You can keep this page open or come back later.');
      } else toast.error(result.error || 'Could not start', { duration: 10000 });
    } catch {
      toast.error('Could not start. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  // ----- motion: which scenes get a clip -----
  const movable = useMemo(() => project.scenes.filter(canMove), [project.scenes]);
  const suggested = (scene: CloneScene): Choice => (!sceneClip(scene) && suggestsClip(scene) ? 'best' : 'picture');
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const choiceOf = (scene: CloneScene): Choice => choices[scene.n] ?? suggested(scene);
  const picked = movable.filter((scene) => choiceOf(scene) !== 'picture').map((scene) => ({ n: scene.n, engine: choiceOf(scene) as CloneAnimEngine }));
  type MotionPick = { n: number; engine: CloneAnimEngine };
  const creditsOf = (picks: MotionPick[]) => picks.reduce((sum, pick) => sum + cloneClipCredits(cloneClipSeconds(movable.find((scene) => scene.n === pick.n)!), pick.engine), 0);
  const motionCredits = creditsOf(picked);
  // The two ready choices, for the scenes that are still pictures: a person who talks gets a clip with sound, other footage moves without.
  const still = movable.filter((scene) => !sceneClip(scene));
  const talks = (scene: CloneScene) => scene.plan?.speaker === 'on_camera' && Boolean(scene.finish?.line?.trim());
  const everything: MotionPick[] = still.map((scene) => ({ n: scene.n, engine: talks(scene) ? 'best' : 'standard' }));
  const talkers: MotionPick[] = still.filter(suggestsClip).map((scene) => ({ n: scene.n, engine: 'best' }));
  const [choosing, setChoosing] = useState(false);
  const [showFlagged, setShowFlagged] = useState(false);

  const startMotion = async (picks: MotionPick[]) => {
    setStarting(true);
    try {
      const result = await startCloneMotion(project.id, picks);
      if (result.success && result.project) {
        onProjectUpdate(result.project);
        setChoices({});
        toast.success('Animating your scenes. This takes a few minutes.');
      } else toast.error(result.error || 'Could not start', { duration: 10000 });
    } catch {
      toast.error('Could not start. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const failed = !running && run?.stage === 'failed';
  const planned = Boolean(auto?.planned) && !editing;
  const flagged = scenes.filter((scene) => scene.plan?.keep !== false && scene.check && !scene.check.pass && (scene.check.picture_url === scene.edited_image_url || !scene.check.picture_url));
  const progress = run && running ? progressOf(run) : null;

  return (
    <Card className="p-4 space-y-4 border-primary/40">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" /> Do it for me
          </p>
          <p className="text-xs text-zinc-500">
            {!planned
              ? 'Tell the director about your business. The director rewrites every scene for you, makes the pictures and finishes a first version of your ad. After that you make it move.'
              : project.scenes.some((scene) => sceneClip(scene))
                ? 'The director remade every scene for your business.'
                : 'The director remade every scene for your business. The first version is made of pictures: now make it move.'}
          </p>
        </div>
        {planned && !running && (
          <button className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 shrink-0" onClick={() => setEditing(true)}>
            Start over with other text or photos
          </button>
        )}
      </div>

      {!supported && <p className="text-xs text-zinc-400">Only vertical and horizontal ads can be made automatically for now. Work on this one scene by scene below.</p>}

      {progress && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-200 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            {progress.text}
          </p>
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(98, progress.percent)}%` }} />
          </div>
          <p className="text-[11px] text-zinc-500">
            {run?.kind === 'motion' ? 'A clip takes 1 to 4 minutes, the finished ad a few more.' : 'The first version takes about 10 minutes.'} You can leave this page: the work goes on.
          </p>
        </div>
      )}

      {failed && run?.error && (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p className="flex-1">{run.error}</p>
          <button
            className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 shrink-0"
            onClick={async () => {
              const result = await dismissCloneAutoRun(project.id);
              if (result.success && result.project) onProjectUpdate(result.project);
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* The form: who the client is, their photos, the length */}
      {supported && !running && !planned && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className={label}>1 · Your business</p>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onFocus={() => {
                focused.current.brief = true;
              }}
              onBlur={() => {
                focused.current.brief = false;
                if (brief !== (auto?.brief || '')) void save({ brief });
              }}
              placeholder={`What you sell, to whom, your offer, prices and how to reach you. For example: ${BRIEF_EXAMPLE}`}
              className="text-sm min-h-[96px]"
              disabled={starting}
            />
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onFocus={() => {
                focused.current.link = true;
              }}
              onBlur={() => {
                focused.current.link = false;
                if (link !== (auto?.link || '')) void save({ link });
              }}
              placeholder="Or paste a link: your website, Google Maps page or product page"
              className="text-sm"
              disabled={starting}
            />
            <p className="text-[10px] text-zinc-600">Only facts you give are used: the director invents no prices, phone numbers or claims.</p>
          </div>

          <div className="space-y-1.5">
            <p className={label}>2 · Your photos</p>
            <p className="text-xs text-zinc-400">The person who appears in the ad, your product, your place, your logo. A person or product without a photo is invented by the director.</p>
            {photos}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="space-y-1.5">
              <p className={label}>3 · Length</p>
              <select
                className={select}
                value={length}
                disabled={starting}
                onChange={(e) => {
                  const next = e.target.value as AutoLength;
                  setLength(next);
                  void save({ length: next });
                }}
              >
                <option value="full">The whole ad ({Math.round(project.video_duration_seconds || 0)} seconds)</option>
                <option value="30">A cut of about 30 seconds</option>
                <option value="15">A cut of about 15 seconds</option>
              </select>
            </div>
            <div className="flex-1 text-[11px] text-zinc-500 sm:text-right">
              {CLONE_AUTO_CREDITS} credits for the plan and the finished ad, {CLONE_IMAGE_CREDITS} for each picture.
              <br />A scene the director leaves out or types as a card costs nothing.
            </div>
            <Button onClick={start} disabled={starting} size="lg" className="h-11 px-6 font-medium">
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Make my ad · up to {ceiling} credits
            </Button>
          </div>
          {editing && (
            <button className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2" onClick={() => setEditing(false)}>
              Keep the ad as it is
            </button>
          )}
        </div>
      )}

      {/* After the plan: what the director did, and the motion step */}
      {supported && !running && planned && (
        <div className="space-y-4">
          {auto?.cast && auto.cast.length > 0 && (
            <div className="space-y-1.5">
              <p className={label}>Who and what was replaced</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {auto.cast.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2 py-1.5 text-xs text-zinc-300 min-w-0">
                    {row.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.photo} alt="" className="w-8 h-8 object-cover rounded border border-border/50 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="text-zinc-500">{row.source}</span> <span className="text-zinc-600">→</span> <span className="text-white">{row.becomes}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {auto?.notes && auto.notes.length > 0 && (
            <div className="space-y-1">
              <p className={label}>Notes from the director</p>
              <ul className="space-y-0.5 text-xs text-amber-200/80 list-disc pl-4">
                {auto.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {flagged.length > 0 && (
            <div className="space-y-1">
              <button className="text-xs text-amber-200/80 hover:text-amber-100 text-left" onClick={() => setShowFlagged((open) => !open)}>
                {flagged.length} of {scenes.filter((scene) => scene.edited_image_url).length} pictures did not pass the director&apos;s check. <span className="underline underline-offset-2">{showFlagged ? 'Hide' : 'Show which'}</span>
              </button>
              {showFlagged && (
                <ul className="space-y-0.5 text-xs text-amber-200/80">
                  {flagged.map((scene) => (
                    <li key={scene.n}>
                      <button className="underline underline-offset-2 hover:text-amber-100" onClick={() => onOpenScene?.(scene.n)}>
                        Scene {scene.n}
                      </button>
                      : {scene.check?.why}
                    </li>
                  ))}
                  <li className="text-zinc-500">Open a scene to change its instruction and make the picture again.</li>
                </ul>
              )}
            </div>
          )}

          {movable.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-primary" /> Make it move
                </p>
                <p className="text-xs text-zinc-500">
                  A person who talks gets a clip with sound ({CLONE_ANIM_CREDITS_PER_SECOND} credits a second). Other scenes move without sound ({CLONE_ANIM_STANDARD_CREDITS_PER_SECOND} credits a second). The ad is finished again at no extra
                  charge.
                </p>
              </div>
              {still.length === 0 ? (
                <p className="text-xs text-zinc-400">Every scene has its clip.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={() => startMotion(everything)} disabled={starting} size="lg" className="h-11 px-5 font-medium flex-1">
                    {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
                    Everything moves · {creditsOf(everything)} credits
                  </Button>
                  {talkers.length > 0 && talkers.length < everything.length && (
                    <Button onClick={() => startMotion(talkers)} disabled={starting} size="lg" variant="outline" className="h-11 px-5 font-medium flex-1">
                      Only the {talkers.length === 1 ? 'scene' : `${talkers.length} scenes`} where a person talks · {creditsOf(talkers)} credits
                    </Button>
                  )}
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="flex-1 text-[11px] text-zinc-500">A clip that cannot be made is refunded and the scene keeps its picture. A talking clip that misses its line is taken once more at no charge.</p>
                <button className="text-[11px] text-zinc-400 hover:text-zinc-200 underline underline-offset-2 shrink-0" onClick={() => setChoosing((open) => !open)}>
                  {choosing ? 'Hide the scenes' : 'Choose scene by scene'}
                </button>
              </div>
              {choosing && (
                <>
                  <div className="space-y-1.5">
                    {movable.map((scene) => {
                      const seconds = cloneClipSeconds(scene);
                      const clip = sceneClip(scene);
                      const speaker = scene.plan?.speaker;
                      const over = scene.plan?.over;
                      // How the director wants the shot played: the video prompt up to its camera note.
                      const played = (scene.motion_prompt || '').split(' Camera:')[0].trim();
                      return (
                        <div key={scene.n} className="flex items-center gap-3 rounded-md border border-border/40 bg-muted/20 p-2">
                          <span className="font-mono text-xs font-bold text-white w-10 shrink-0">SC&thinsp;{String(scene.n).padStart(2, '0')}</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={scene.edited_image_url as string} alt={`Scene ${scene.n}`} className="h-12 w-9 object-cover rounded border border-border/50 bg-black/40 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-300 truncate">{scene.finish?.line || (over ? `Shown while the scene ${over === 'previous' ? 'before' : 'after'} it speaks` : 'No words in this scene')}</p>
                            <p className="text-[10px] text-zinc-600">
                              {speaker === 'on_camera' ? 'A person talks to the camera' : speaker === 'narrator' ? 'The narrator speaks' : 'Nobody speaks'}
                              {clip ? ' · has a clip' : ''}
                            </p>
                            {played && (
                              <p className="text-[10px] text-zinc-500 truncate" title={scene.motion_prompt || undefined}>
                                The shot: {played}
                              </p>
                            )}
                          </div>
                          <select className={`${select} w-[290px] max-w-[45%] shrink-0`} value={choiceOf(scene)} onChange={(e) => setChoices((current) => ({ ...current, [scene.n]: e.target.value as Choice }))}>
                            <option value="picture">{clip ? 'Keep the clip it has' : 'Stay a picture'}</option>
                            <option value="best">
                              {clip ? 'New clip' : 'Clip'} with sound, {seconds} s · {cloneClipCredits(seconds, 'best')} credits
                            </option>
                            <option value="standard">
                              {clip ? 'New clip' : 'Clip'} without sound, {seconds} s · {cloneClipCredits(seconds, 'standard')} credits
                            </option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => startMotion(picked)} disabled={starting || picked.length === 0} size="lg" variant="outline" className="h-11 px-6 font-medium">
                      {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
                      {picked.length === 0 ? 'Choose scenes to animate' : `Add motion to ${picked.length} ${picked.length === 1 ? 'scene' : 'scenes'} · ${motionCredits} credits`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
