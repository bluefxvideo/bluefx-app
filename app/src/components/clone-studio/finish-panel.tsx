'use client';

import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { checkCloneFinish, prepareCloneFinish, saveCloneFinish, startCloneFinish } from '@/actions/tools/clone-studio-finish';
import {
  cloneFinishCredits,
  DEFAULT_FINISH_SETTINGS,
  FINISH_LOOKS,
  finishIsCurrent,
  sceneClip,
  type CloneProject,
  type CloneScene,
  type FinishLook,
  type FinishPicture,
  type FinishSettings,
  type FinishSound,
  type FinishStage,
  type SceneFinish,
} from '@/types/clone-studio';

/**
 * "Finish the ad": the board's last step. Every scene shows how it goes into the finished
 * ad (its picture, who speaks, the words, the text on screen), proposed by listening to the
 * clips and editable here. One click then makes the ad: one voice, captions, typed text, music.
 */

interface FinishPanelProps {
  project: CloneProject;
  onProjectUpdate: (project: CloneProject) => void;
}

const STAGE_LABEL: Record<FinishStage, string> = {
  clips: 'Preparing the clips',
  voice: 'Recording the voice and the music',
  rendering: 'Putting the ad together',
  levelling: 'Levelling the sound',
  done: 'Finished',
  failed: 'Stopped',
};
const LOOK_LABEL: Record<FinishLook, string> = { clean: 'Clean', bold: 'Bold', elegant: 'Elegant', playful: 'Playful' };
const select = 'h-8 rounded-md border border-border/60 bg-transparent text-xs px-2 text-zinc-300 disabled:opacity-50';
const label = 'font-mono text-[9px] uppercase tracking-widest text-zinc-500';

export function FinishPanel({ project, onProjectUpdate }: FinishPanelProps) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);

  const finish = project.analysis_summary?.finish;
  const saved = finish?.settings || DEFAULT_FINISH_SETTINGS;
  // The controls show a choice the moment it is made; the saved value takes over when it changes.
  const [settings, setSettings] = useState(saved);
  const savedKey = JSON.stringify(saved);
  useEffect(() => setSettings(JSON.parse(savedKey)), [savedKey]);
  const run = finish?.run;
  const running = project.status === 'finishing';
  const directing = project.status === 'directing';
  const credits = cloneFinishCredits(project.analysis_summary);
  const supported = project.aspect_ratio === '9:16' || project.aspect_ratio === '16:9';
  const unchecked = project.scenes.filter((scene) => !finishIsCurrent(scene)).length;
  const usable = project.scenes.some((scene) => sceneClip(scene) || scene.edited_image_url);
  const narrated = project.scenes.some((scene) => scene.finish?.picture !== 'skip' && scene.finish?.sound === 'narrator');
  const onCamera = project.scenes.some((scene) => scene.finish?.picture === 'clip' && scene.finish.sound === 'clip' && scene.finish.heard);

  // While the ad is being finished the row is the only source of truth: follow it.
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      const result = await checkCloneFinish(project.id);
      if (!result.success || !result.project) return;
      onProjectUpdate(result.project);
      // The run says how it ended: a project that already had a video is "completed" after a failed run too.
      const ended = result.project.status === 'finishing' ? undefined : result.project.analysis_summary?.finish?.run;
      if (ended?.stage === 'done') toast.success('Your ad is finished');
      else if (ended?.stage === 'failed') toast.error(ended.error || 'The ad could not be finished', { duration: 12000 });
    }, 4000);
    return () => clearInterval(interval);
  }, [running, project.id, onProjectUpdate]);

  const check = async () => {
    setChecking(true);
    try {
      const result = await prepareCloneFinish(project.id);
      if (result.success && result.project) onProjectUpdate(result.project);
      else toast.error(result.error || 'The scenes could not be checked');
    } catch {
      toast.error('The scenes could not be checked. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const save = async (input: Parameters<typeof saveCloneFinish>[1]) => {
    const result = await saveCloneFinish(project.id, input);
    if (result.success && result.project) onProjectUpdate(result.project);
    else toast.error(result.error || 'Could not save');
  };
  const saveSetting = (change: Partial<FinishSettings>) => {
    setSettings((current) => ({ ...current, ...change }));
    return save({ settings: change });
  };

  const start = async () => {
    setStarting(true);
    try {
      const result = await startCloneFinish(project.id);
      if (result.success && result.project) {
        onProjectUpdate(result.project);
        toast.success('Finishing your ad. You can keep this page open or come back later.');
      } else toast.error(result.error || 'Could not start', { duration: 10000 });
    } catch {
      toast.error('Could not start. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  if (!usable) return null;

  return (
    <Card className="p-4 space-y-4 border-primary/40">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-primary" /> Finish the ad
          </p>
          <p className="text-xs text-zinc-500">
            Cuts your scenes into a finished ad: one voice, word captions, your text on screen and music.
          </p>
        </div>
        {!open && !running && (
          <Button
            onClick={() => {
              setOpen(true);
              if (unchecked > 0) void check();
            }}
            disabled={!supported || directing}
            variant={project.analysis_summary?.auto?.planned ? 'outline' : 'default'}
          >
            {project.analysis_summary?.auto?.planned ? 'Change words, text or music' : 'Set up the finish'}
          </Button>
        )}
      </div>

      {!supported && (
        <p className="text-xs text-zinc-400">Only vertical and horizontal ads can be finished here for now. Use &quot;Assemble video&quot; below for this one.</p>
      )}

      {running && run && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-200 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            {STAGE_LABEL[run.stage]}
            {run.stage === 'rendering' ? `: ${run.progress}%` : ''}
          </p>
          <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${run.stage === 'clips' ? 8 : run.stage === 'voice' ? 20 : run.stage === 'rendering' ? 25 + run.progress * 0.7 : 97}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-500">This takes a few minutes. The finished ad appears at the top of this page.</p>
        </div>
      )}

      {!running && run?.stage === 'failed' && run.error && <p className="text-xs text-red-400">{run.error}</p>}

      {open && !running && !directing && supported && (
        <>
          {checking ? (
            <p className="text-xs text-zinc-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Listening to your clips to see who speaks in each scene…
            </p>
          ) : unchecked > 0 ? (
            <div className="flex items-center gap-3">
              <p className="text-xs text-amber-300/90">
                {unchecked} {unchecked === 1 ? 'scene is' : 'scenes are'} new or changed since the last check.
              </p>
              <Button variant="outline" size="sm" onClick={check}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Check the scenes
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            {project.scenes.map((scene) => (
              <FinishRow key={`${scene.n}-${scene.keyframe_url}`} scene={scene} disabled={checking} onChange={(change) => save({ scene: { n: scene.n, finish: change } })} />
            ))}
          </div>

          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 pt-3 border-t border-border/40">
            <div className="space-y-1.5">
              <p className={label}>Narrator</p>
              <div className="flex items-center gap-2">
                <select className={select} value={settings.voice} disabled={!narrated} onChange={(e) => saveSetting({ voice: e.target.value as FinishSettings['voice'] })}>
                  <option value="female">Female voice</option>
                  <option value="male">Male voice</option>
                </select>
                {!narrated && <span className="text-[10px] text-zinc-600">No scene uses the narrator</span>}
              </div>
              {narrated && onCamera && (
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <Checkbox checked={settings.match_voice} onCheckedChange={(v) => saveSetting({ match_voice: v === true })} />
                  Narrator speaks in the voice of the person on camera
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <p className={label}>Text style</p>
              <div className="flex items-center gap-2">
                <select className={select} value={settings.look} onChange={(e) => saveSetting({ look: e.target.value as FinishLook })}>
                  {FINISH_LOOKS.map((look) => (
                    <option key={look} value={look}>
                      {LOOK_LABEL[look]}
                    </option>
                  ))}
                </select>
                {/* The colour picker reports every shade it passes over; only the one it is left on is saved. */}
                <input
                  type="color"
                  value={settings.accent || '#2563eb'}
                  onChange={(e) => setSettings((current) => ({ ...current, accent: e.target.value }))}
                  onBlur={() => settings.accent !== saved.accent && save({ settings: { accent: settings.accent } })}
                  className="h-8 w-10 rounded border border-border/60 bg-transparent"
                  title="Colour of the text accents"
                />
                {settings.accent && (
                  <button className="text-[10px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2" onClick={() => saveSetting({ accent: '' })}>
                    Use the style&apos;s colour
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className={label}>Extras</p>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <Checkbox checked={settings.captions} onCheckedChange={(v) => saveSetting({ captions: v === true })} />
                Word captions
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <Checkbox checked={settings.music} onCheckedChange={(v) => saveSetting({ music: v === true })} />
                Music, from the Soundtrack text at the top of the board
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <p className="flex-1 text-xs text-zinc-500">
              Your clips and pictures are used as they are. Takes about 5 to 10 minutes.
            </p>
            <Button onClick={start} disabled={starting || checking || unchecked > 0} size="lg" className="h-11 px-6 font-medium">
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clapperboard className="w-4 h-4 mr-2" />}
              {project.final_video_url ? 'Finish again' : 'Finish the ad'} · {credits > 0 ? `${credits} credits` : 'free this time'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function FinishRow({ scene, disabled, onChange }: { scene: CloneScene; disabled: boolean; onChange: (change: Partial<Pick<SceneFinish, 'picture' | 'sound' | 'line' | 'text'>>) => void }) {
  const finish = scene.finish;
  const [line, setLine] = useState(finish?.line || '');
  const [text, setText] = useState(finish?.text || '');
  // The two choices show at once; the saved value takes over when it changes.
  const [picture, setPicture] = useState(finish?.picture);
  const [sound, setSound] = useState(finish?.sound);
  useEffect(() => setPicture(finish?.picture), [finish?.picture]);
  useEffect(() => setSound(finish?.sound), [finish?.sound]);
  // A new check (or another tab) may change the words; a box being typed in is left alone.
  const focused = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!focused.current.line) setLine(finish?.line || '');
  }, [finish?.line]);
  useEffect(() => {
    if (!focused.current.text) setText(finish?.text || '');
  }, [finish?.text]);

  const clip = sceneClip(scene);
  const thumbnail = scene.edited_image_url || scene.keyframe_url;
  const original = scene.analysis?.on_screen_text?.replace(/\s+/g, ' ').trim();
  const originalWords = scene.analysis?.dialog?.replace(/\s+/g, ' ').trim();
  const leftOut = !finish || picture === 'skip';

  return (
    <div className={`grid gap-3 rounded-md border border-border/40 bg-muted/20 p-2.5 md:grid-cols-[104px_170px_minmax(0,1fr)_minmax(0,1fr)] ${leftOut ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-xs font-bold text-white w-10 shrink-0">SC&thinsp;{String(scene.n).padStart(2, '0')}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnail} alt={`Scene ${scene.n}`} className="h-16 w-12 object-cover rounded border border-border/50 bg-black/40" />
      </div>
      {!finish ? (
        <p className="text-xs text-zinc-500 self-center md:col-span-3">Not checked yet.</p>
      ) : (
        <>
          <div className="space-y-1.5 self-center">
            <select
              className={`${select} w-full`}
              value={picture}
              disabled={disabled}
              onChange={(e) => {
                const next = e.target.value as FinishPicture;
                setPicture(next);
                // Only a clip has a sound of its own: without it the words go to the narrator.
                if (next !== 'clip' && sound === 'clip') {
                  const voice = line.trim() ? 'narrator' : 'none';
                  setSound(voice);
                  onChange({ picture: next, sound: voice });
                } else onChange({ picture: next });
              }}
              title="What this scene shows"
            >
              {clip && <option value="clip">Show the clip</option>}
              {scene.edited_image_url && <option value="still">Show the picture</option>}
              <option value="card">Show a typed card</option>
              <option value="skip">Leave this scene out</option>
            </select>
            <select
              className={`${select} w-full`}
              value={sound}
              disabled={disabled || leftOut}
              onChange={(e) => {
                setSound(e.target.value as FinishSound);
                onChange({ sound: e.target.value as FinishSound });
              }}
              title="Who speaks in this scene"
            >
              {picture === 'clip' && <option value="clip">{finish.heard ? 'Person in the clip speaks' : 'Sound of the clip'}</option>}
              <option value="narrator">Narrator speaks</option>
              <option value="none">No voice</option>
            </select>
          </div>
          <div className="space-y-1 min-w-0">
            <p className={label}>{sound === 'narrator' ? 'The narrator says' : sound === 'clip' ? 'Said in the clip (caption spelling)' : 'Words'}</p>
            <Textarea
              value={line}
              onChange={(e) => setLine(e.target.value)}
              onFocus={() => {
                focused.current.line = true;
              }}
              onBlur={() => {
                focused.current.line = false;
                if (line !== finish.line) onChange({ line });
              }}
              disabled={disabled || leftOut || sound === 'none'}
              placeholder={sound === 'none' ? 'Nobody speaks in this scene' : sound === 'narrator' ? 'Write what the narrator says here' : 'What is said in this scene'}
              className="text-xs min-h-[56px]"
            />
            {originalWords && (
              <p className="text-[10px] text-zinc-600 truncate" title={originalWords}>
                In the original: {originalWords}
              </p>
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <p className={label}>Text on screen</p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => {
                focused.current.text = true;
              }}
              onBlur={() => {
                focused.current.text = false;
                if (text !== finish.text) onChange({ text });
              }}
              disabled={disabled || leftOut}
              placeholder={'First line: the headline\nNext lines: smaller tags'}
              className="text-xs min-h-[56px]"
            />
            {original && (
              <p className="text-[10px] text-zinc-600 truncate" title={original}>
                In the original: {original}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
