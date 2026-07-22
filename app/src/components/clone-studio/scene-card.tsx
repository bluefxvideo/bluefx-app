'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clapperboard, Download, ImagePlus, Loader2, Play, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  updateSceneInput,
  uploadCloneReference,
  generateSceneImage,
  restoreSceneImageVersion,
  restoreSceneClipVersion,
  animateScene,
  removeCustomScene,
} from '@/actions/tools/clone-studio';
import {
  CLONE_ANIM_CREDITS_PER_SECOND,
  CLONE_ANIM_NEGATIVE_PROMPT,
  CLONE_IMAGE_CREDITS,
  composeMotionPrompt,
  type CloneProject,
  type CloneScene,
} from '@/types/clone-studio';

interface SceneCardProps {
  project: CloneProject;
  scene: CloneScene;
  onProjectUpdate: (project: CloneProject) => void;
}

export function SceneCard({ project, scene, onProjectUpdate }: SceneCardProps) {
  const [instruction, setInstruction] = useState(scene.user_instruction || '');
  const [generating, setGenerating] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [showNegative, setShowNegative] = useState(false);
  const [showOriginalClip, setShowOriginalClip] = useState(false);
  const [motionPrompt, setMotionPrompt] = useState(
    scene.motion_prompt ?? composeMotionPrompt(scene.analysis)
  );
  const [negativePrompt, setNegativePrompt] = useState(
    scene.negative_prompt ?? CLONE_ANIM_NEGATIVE_PROMPT
  );
  const refInputRef = useRef<HTMLInputElement>(null);
  const [animating, setAnimating] = useState(false);
  const [refDragOver, setRefDragOver] = useState(false);

  const duration = (scene.end - scene.start).toFixed(1);
  const suggestedSeconds = Math.min(15, Math.max(3, Math.ceil(scene.end - scene.start)));
  const [animSecondsInput, setAnimSecondsInput] = useState(
    String(scene.anim_seconds ?? suggestedSeconds)
  );
  const animSeconds = Math.min(15, Math.max(3, parseInt(animSecondsInput, 10) || suggestedSeconds));
  const animCredits = animSeconds * CLONE_ANIM_CREDITS_PER_SECOND;
  const animGenerating = scene.anim?.status === 'generating';

  // Server-side updates (Apply to all scenes, other tabs) must show up live —
  // but never clobber a box the user is actively typing in
  const focusedFields = useRef<Record<string, boolean>>({});
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!focusedFields.current.instruction) setInstruction(scene.user_instruction || '');
  }, [scene.user_instruction]);
  useEffect(() => {
    if (!focusedFields.current.motion) setMotionPrompt(scene.motion_prompt ?? composeMotionPrompt(scene.analysis));
  }, [scene.motion_prompt]);
  useEffect(() => {
    if (!focusedFields.current.negative) setNegativePrompt(scene.negative_prompt ?? CLONE_ANIM_NEGATIVE_PROMPT);
  }, [scene.negative_prompt]);
  useEffect(() => {
    if (!focusedFields.current.seconds) setAnimSecondsInput(String(scene.anim_seconds ?? suggestedSeconds));
  }, [scene.anim_seconds]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const saveAnimSeconds = async () => {
    const parsed = parseInt(animSecondsInput, 10);
    const clamped = Number.isFinite(parsed) ? Math.min(15, Math.max(3, parsed)) : suggestedSeconds;
    setAnimSecondsInput(String(clamped));
    const override = clamped === suggestedSeconds ? null : clamped;
    if ((scene.anim_seconds ?? null) === override) return;
    const result = await updateSceneInput(project.id, scene.n, { anim_seconds: override });
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const saveInstruction = async () => {
    if (instruction === (scene.user_instruction || '')) return;
    const result = await updateSceneInput(project.id, scene.n, { user_instruction: instruction });
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const saveMotionPrompt = async () => {
    const current = scene.motion_prompt ?? composeMotionPrompt(scene.analysis);
    if (motionPrompt === current) return;
    const result = await updateSceneInput(project.id, scene.n, { motion_prompt: motionPrompt });
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const saveNegativePrompt = async () => {
    const current = scene.negative_prompt ?? CLONE_ANIM_NEGATIVE_PROMPT;
    if (negativePrompt === current) return;
    const result = await updateSceneInput(project.id, scene.n, { negative_prompt: negativePrompt });
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const handleAddRefs = async (files: FileList | null) => {
    const existing = scene.user_ref_urls || [];
    const slots = 6 - existing.length;
    const images = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    const selected = images.slice(0, slots);
    if (!selected.length) return;
    if (images.length > slots) {
      toast.info(`Max 6 references per scene — uploading the first ${slots}`);
    }
    setUploadingRef(true);
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const upload = await uploadCloneReference(project.id, file);
        if (upload.success && upload.url) uploaded.push(upload.url);
        else toast.error(upload.error || `Upload failed for ${file.name}`);
      }
      if (uploaded.length) {
        const urls = [...existing, ...uploaded].slice(0, 6);
        const result = await updateSceneInput(project.id, scene.n, { user_ref_urls: urls });
        if (result.success && result.project) onProjectUpdate(result.project);
      }
    } catch (error) {
      console.error('reference upload threw:', error);
      toast.error('Reference upload did not complete — try again');
    } finally {
      setUploadingRef(false);
      if (refInputRef.current) refInputRef.current.value = '';
    }
  };

  const handleRemoveRef = async (url: string) => {
    const urls = (scene.user_ref_urls || []).filter((u) => u !== url);
    const result = await updateSceneInput(project.id, scene.n, { user_ref_urls: urls });
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Persist any unsaved instruction edit before generating with it
      await saveInstruction();
      const result = await generateSceneImage(project.id, scene.n);
      if (!result.success || !result.project) {
        toast.error(result.error || 'Generation failed — credits refunded');
        return;
      }
      onProjectUpdate(result.project);
      toast.success(`Scene ${scene.n} image ready`);
    } catch (error) {
      // Never fail silently — a dropped connection or server error lands here
      console.error('generateSceneImage threw:', error);
      toast.error('Generation did not complete — check your connection and try again');
    } finally {
      setGenerating(false);
    }
  };

  const handleRestore = async (url: string) => {
    const result = await restoreSceneImageVersion(project.id, scene.n, url);
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const handleRestoreClip = async (url: string) => {
    const result = await restoreSceneClipVersion(project.id, scene.n, url);
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const handleAnimate = async () => {
    setAnimating(true);
    try {
      const result = await animateScene(project.id, scene.n, {
        seconds: animSeconds,
        prompt: motionPrompt,
        negative_prompt: negativePrompt,
      });
      if (!result.success || !result.project) {
        toast.error(result.error || 'Animation failed to start');
        return;
      }
      onProjectUpdate(result.project);
      toast.success(`Scene ${scene.n} animating — usually 2-4 minutes`);
    } catch (error) {
      console.error('animateScene threw:', error);
      toast.error('Animation request did not complete — try again');
    } finally {
      setAnimating(false);
    }
  };

  const hasVideo = scene.anim?.status === 'completed' && !!scene.anim.video_url;
  // Film-edge state color: the card's left border tells you where the scene is
  const stateEdge = hasVideo
    ? 'border-l-green-500/70'
    : animGenerating
      ? 'border-l-amber-500/70'
      : scene.edited_image_url
        ? 'border-l-primary/70'
        : 'border-l-zinc-700';

  return (
    <Card
      id={`clone-scene-${scene.n}`}
      className={`p-0 overflow-hidden scroll-mt-4 border-l-4 ${stateEdge}`}
    >
      <div className="flex flex-col xl:flex-row">
        {/* ——— MEDIA ZONE ——— */}
        <div className="flex-1 min-w-0 p-4 flex flex-col gap-2.5">
          {/* Slate header */}
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="font-mono text-xl font-bold text-white tracking-tight shrink-0">
                SC&thinsp;{String(scene.n).padStart(2, '0')}
              </span>
              <span className="font-mono text-[11px] text-zinc-500 tabular-nums shrink-0">
                {scene.is_custom ? `${duration}s` : `${scene.start.toFixed(1)}–${scene.end.toFixed(1)}s · ${duration}s`}
              </span>
              {(scene.is_custom || scene.analysis?.purpose) && (
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 shrink-0">
                  {scene.is_custom ? 'custom' : scene.analysis.purpose}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {scene.credits_spent > 0 && (
                <span className="font-mono text-[11px] text-zinc-600 tabular-nums">{scene.credits_spent} cr</span>
              )}
              {scene.is_custom && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-500 hover:text-red-400"
                  title="Remove this custom scene"
                  onClick={async () => {
                    if (!window.confirm(`Remove custom scene ${scene.n}?`)) return;
                    const result = await removeCustomScene(project.id, scene.n);
                    if (result.success && result.project) onProjectUpdate(result.project);
                    else toast.error(result.error || 'Could not remove the scene');
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Panels — labels overlaid like monitor tags */}
          <div className={`grid grid-cols-2 gap-2 flex-1 ${hasVideo ? '2xl:grid-cols-3' : ''}`}>
            {/* Original */}
            <div className="relative h-full min-h-[13rem] rounded-md overflow-hidden bg-black/50 border border-border/40">
              {showOriginalClip && project.source_video_url && !scene.is_custom ? (
                <video
                  src={`${project.source_video_url}#t=${scene.start},${scene.end}`}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <a
                  href={scene.keyframe_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full h-full"
                  title="Click to view full size"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scene.keyframe_url}
                    alt={`Scene ${scene.n} original`}
                    className="w-full h-full object-contain"
                  />
                </a>
              )}
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 font-mono text-[9px] uppercase tracking-widest text-zinc-400 pointer-events-none">
                Original
              </span>
              {project.source_video_url && !scene.is_custom && (
                <button
                  className="absolute bottom-1.5 left-1.5 px-2 py-1.5 rounded-md bg-black/70 text-zinc-300 hover:bg-primary hover:text-white transition-colors text-[10px] flex items-center gap-1"
                  onClick={() => setShowOriginalClip((v) => !v)}
                  title={showOriginalClip ? 'Back to the frame' : 'Play this scene from the original ad'}
                >
                  {showOriginalClip ? <ImagePlus className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {showOriginalClip ? 'Frame' : 'Play'}
                </button>
              )}
              {!showOriginalClip && (
                <a
                  href={`${scene.keyframe_url}?download=scene-${scene.n}-original.jpg`}
                  className="absolute bottom-1.5 right-1.5 p-1.5 rounded-md bg-black/70 text-zinc-300 hover:bg-primary hover:text-white transition-colors"
                  title="Download this frame"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Your image */}
            <div className="relative h-full min-h-[13rem] rounded-md overflow-hidden bg-black/50 border border-border/40">
              {scene.edited_image_url ? (
                <>
                  <a
                    href={scene.edited_image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full h-full"
                    title="Click to view full size"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={scene.edited_image_url}
                      alt={`Scene ${scene.n} edited`}
                      className="w-full h-full object-contain"
                    />
                  </a>
                  {!animGenerating && (
                    <a
                      href={`${scene.edited_image_url}?download=scene-${scene.n}-image.jpg`}
                      className="absolute bottom-1.5 right-1.5 p-1.5 rounded-md bg-black/70 text-zinc-300 hover:bg-primary hover:text-white transition-colors"
                      title="Download this image"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {animGenerating && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-[10px] text-zinc-300">Animating…</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 border border-dashed border-border/60 rounded-md">
                  <ImagePlus className="w-5 h-5 text-zinc-600" />
                  <span className="text-[10px] text-zinc-600">Generate to fill</span>
                </div>
              )}
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 font-mono text-[9px] uppercase tracking-widest text-primary/90 pointer-events-none">
                Yours
              </span>
            </div>

            {/* Animated clip */}
            {hasVideo && (
              <div className="relative h-full min-h-[13rem] col-span-2 2xl:col-span-1 rounded-md overflow-hidden bg-black border border-border/40">
                <video
                  src={scene.anim!.video_url!}
                  poster={scene.edited_image_url || undefined}
                  controls
                  preload="metadata"
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 font-mono text-[9px] uppercase tracking-widest text-green-400/90 pointer-events-none">
                  Clip
                </span>
                <a
                  href={`${scene.anim!.video_url!}?download=scene-${scene.n}.mp4`}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/70 text-zinc-300 hover:bg-primary hover:text-white transition-colors"
                  title="Download this clip"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Dialog — subtitle style, like the dailies monitor */}
          {scene.analysis?.dialog && (
            <p className="text-center text-[13px] italic text-amber-200/80">
              &ldquo;{scene.analysis.dialog}&rdquo;
            </p>
          )}

          {/* Clip takes — every animation kept, click to make one current
              (assembly uses the current clip) */}
          {(() => {
            if (!hasVideo) return null;
            const history = scene.anim_versions || [];
            const strip = scene.anim?.video_url && !history.includes(scene.anim.video_url)
              ? [scene.anim.video_url, ...history]
              : history;
            if (strip.length < 1) return null;
            return (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 shrink-0">Clip takes</span>
                {strip.map((url) => {
                  const isCurrent = url === scene.anim?.video_url;
                  return (
                    <video
                      key={url}
                      src={url}
                      preload="metadata"
                      muted
                      playsInline
                      className={`h-14 w-auto object-contain bg-black rounded shrink-0 transition-transform ${
                        isCurrent
                          ? 'border-2 border-green-500/80'
                          : 'border border-border/50 cursor-pointer hover:border-green-400 hover:scale-105'
                      }`}
                      onClick={() => !isCurrent && handleRestoreClip(url)}
                      title={isCurrent ? 'Current clip (used in assembly)' : 'Switch to this take'}
                    />
                  );
                })}
                {strip.length === 1 && (
                  <span className="text-[10px] text-zinc-600">
                    Re-animate to add takes — every clip is kept, click one to use it
                  </span>
                )}
              </div>
            );
          })()}

          {/* Versions */}
          {(() => {
            const history = scene.image_versions || [];
            const strip = scene.edited_image_url && !history.includes(scene.edited_image_url)
              ? [scene.edited_image_url, ...history]
              : history;
            if (strip.length < 2) return null;
            return (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 shrink-0">Takes</span>
                {strip.map((url) => {
                  const isCurrent = url === scene.edited_image_url;
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt={isCurrent ? 'Current version' : 'Version'}
                      className={`h-12 w-auto object-contain bg-black/40 rounded shrink-0 transition-transform ${
                        isCurrent
                          ? 'border-2 border-primary'
                          : 'border border-border/50 cursor-pointer hover:border-primary hover:scale-105'
                      }`}
                      onClick={() => !isCurrent && handleRestore(url)}
                      title={isCurrent ? 'Current image (used for Animate)' : 'Switch to this take'}
                    />
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ——— ACTION RAIL ——— */}
        <div className="xl:w-[330px] xl:shrink-0 border-t xl:border-t-0 xl:border-l border-border/40 bg-muted/20 p-4 space-y-2.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Swap</p>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onFocus={() => { focusedFields.current.instruction = true; }}
            onBlur={() => { focusedFields.current.instruction = false; saveInstruction(); }}
            placeholder='e.g. "Replace the man with the woman from my reference photo."'
            className="text-sm min-h-[64px]"
            disabled={generating}
          />
          <div
            className={`flex items-center gap-1.5 flex-wrap rounded-md transition-colors ${
              refDragOver ? 'ring-2 ring-primary bg-primary/10 p-1' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setRefDragOver(true); }}
            onDragLeave={() => setRefDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setRefDragOver(false);
              handleAddRefs(e.dataTransfer.files);
            }}
          >
            {/* Project-wide refs are sent with every scene's generation — show
                them here (read-only) so it's clear they're already included */}
            {(project.analysis_summary?.project_ref_urls || []).map((url) => (
              <div key={`proj-${url}`} className="relative" title="Project reference — included in every scene">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Project reference" className="w-9 h-9 object-cover rounded border border-primary/40 opacity-80" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-0.5 rounded bg-primary/80 text-white text-[7px] font-mono uppercase leading-tight">all</span>
              </div>
            ))}
            {(scene.user_ref_urls || []).map((url) => (
              <div key={url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Reference" className="w-9 h-9 object-cover rounded border border-border/50" />
                <button
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center"
                  onClick={() => handleRemoveRef(url)}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <input
              ref={refInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAddRefs(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => refInputRef.current?.click()}
              disabled={uploadingRef || (scene.user_ref_urls || []).length >= 6}
            >
              {uploadingRef ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
              Ref
            </Button>
            <span className="text-[10px] text-zinc-600">or drop images here</span>
          </div>
          <Button className="w-full" size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {generating
              ? 'Generating — 15-40s'
              : `${scene.edited_image_url ? 'Regenerate' : 'Generate'} · ${CLONE_IMAGE_CREDITS} cr`}
          </Button>

          {(
            <>
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                  Motion — sent verbatim
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-zinc-500"
                  onClick={() => {
                    setMotionPrompt(composeMotionPrompt(scene.analysis));
                    setNegativePrompt(CLONE_ANIM_NEGATIVE_PROMPT);
                  }}
                  title="Restore the AI-suggested prompt and default negative prompt"
                >
                  Reset
                </Button>
              </div>
              <Textarea
                value={motionPrompt}
                onChange={(e) => setMotionPrompt(e.target.value)}
                onFocus={() => { focusedFields.current.motion = true; }}
                onBlur={() => { focusedFields.current.motion = false; saveMotionPrompt(); }}
                className="text-sm min-h-[84px]"
                disabled={animating || animGenerating}
              />
              <button
                className="w-full flex items-center justify-between text-[10px] text-zinc-500 hover:text-zinc-300"
                onClick={() => setShowNegative((v) => !v)}
              >
                <span>Negative prompt</span>
                {showNegative ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showNegative && (
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  onFocus={() => { focusedFields.current.negative = true; }}
                  onBlur={() => { focusedFields.current.negative = false; saveNegativePrompt(); }}
                  className="text-xs min-h-[48px]"
                  disabled={animating || animGenerating}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1 shrink-0"
                  title={`Clip length (3-15s). Suggested: ${suggestedSeconds}s to cover the original ${duration}s cut.`}
                >
                  <Input
                    type="number"
                    min={3}
                    max={15}
                    value={animSecondsInput}
                    onChange={(e) => setAnimSecondsInput(e.target.value)}
                    onFocus={() => { focusedFields.current.seconds = true; }}
                    onBlur={() => { focusedFields.current.seconds = false; saveAnimSeconds(); }}
                    className="w-14 h-9 text-xs text-center font-mono"
                    disabled={animating || animGenerating}
                  />
                  <span className="text-xs text-zinc-500">s</span>
                </div>
                <Button
                  variant={hasVideo ? 'outline' : 'secondary'}
                  size="sm"
                  className="flex-1 h-9"
                  onClick={handleAnimate}
                  disabled={animating || animGenerating || generating || !scene.edited_image_url}
                  title={!scene.edited_image_url ? 'Generate an image first — Animate uses your current image' : undefined}
                >
                  {animating || animGenerating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Clapperboard className="w-4 h-4 mr-2" />
                  )}
                  {animGenerating
                    ? 'Animating — 2-4 min'
                    : hasVideo
                      ? `Re-animate ${animSeconds}s · ${animCredits} cr`
                      : scene.anim?.status === 'failed'
                        ? `Retry ${animSeconds}s · ${animCredits} cr`
                        : `Animate ${animSeconds}s · ${animCredits} cr`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
