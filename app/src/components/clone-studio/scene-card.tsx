'use client';

import { useRef, useState } from 'react';
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

  const duration = (scene.end - scene.start).toFixed(1);
  const suggestedSeconds = Math.min(15, Math.max(3, Math.ceil(scene.end - scene.start)));
  const [animSecondsInput, setAnimSecondsInput] = useState(
    String(scene.anim_seconds ?? suggestedSeconds)
  );
  const animSeconds = Math.min(15, Math.max(3, parseInt(animSecondsInput, 10) || suggestedSeconds));
  const animCredits = animSeconds * CLONE_ANIM_CREDITS_PER_SECOND;
  const animGenerating = scene.anim?.status === 'generating';

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
    const selected = Array.from(files || []).slice(0, slots);
    if (!selected.length) return;
    if ((files?.length || 0) > slots) {
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

  return (
    <Card id={`clone-scene-${scene.n}`} className="p-4 space-y-3 scroll-mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge>Scene {scene.n}</Badge>
          {scene.is_custom ? (
            <Badge variant="secondary" className="text-[10px] uppercase">custom</Badge>
          ) : (
            scene.analysis?.purpose && (
              <Badge variant="secondary" className="text-[10px] uppercase">{scene.analysis.purpose}</Badge>
            )
          )}
          <span className="text-xs text-zinc-500">
            {scene.is_custom ? `${duration}s` : `${scene.start.toFixed(1)}–${scene.end.toFixed(1)}s · ${duration}s`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {scene.credits_spent > 0 && (
            <span className="text-xs text-zinc-500">{scene.credits_spent} cr</span>
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

      {scene.analysis?.dialog && (
        <p className="text-xs italic text-zinc-400 border-l-2 border-primary/40 pl-2">
          &ldquo;{scene.analysis.dialog}&rdquo;
        </p>
      )}

      {/* Original vs yours — letterboxed (object-contain) so portrait ads
          aren't cropped; click opens the full-size file for saving. Animated
          scenes show THREE panels: original, your image, the video — the
          image never gets buried behind the clip. */}
      <div className={`grid grid-cols-2 gap-2 ${scene.anim?.status === 'completed' && scene.anim.video_url ? 'lg:grid-cols-3' : ''}`}>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Original</p>
          <div className="relative h-56 lg:h-80">
            {showOriginalClip && project.source_video_url && !scene.is_custom ? (
              // Media fragment plays exactly this scene's slice of the source
              <video
                src={`${project.source_video_url}#t=${scene.start},${scene.end}`}
                controls
                autoPlay
                className="w-full h-full object-contain rounded-md border border-border/50 bg-black"
              />
            ) : (
              <a
                href={scene.keyframe_url}
                target="_blank"
                rel="noreferrer"
                className="block h-full rounded-md border border-border/50 bg-black/40 overflow-hidden"
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
            {project.source_video_url && !scene.is_custom && (
              <button
                className="absolute bottom-1.5 left-1.5 px-2 py-1.5 rounded-md bg-black/70 text-zinc-300 hover:bg-primary hover:text-white transition-colors text-[10px] flex items-center gap-1"
                onClick={() => setShowOriginalClip((v) => !v)}
                title={showOriginalClip ? 'Back to the frame' : 'Play this scene from the original ad'}
              >
                {showOriginalClip ? <ImagePlus className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {showOriginalClip ? 'Frame' : 'Play original'}
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
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Your image</p>
          {scene.edited_image_url ? (
            <div className="relative h-56 lg:h-80">
              <a
                href={scene.edited_image_url}
                target="_blank"
                rel="noreferrer"
                className="block h-full rounded-md border border-primary/40 bg-black/40 overflow-hidden"
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
                <div className="absolute inset-0 rounded-md bg-black/60 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-[10px] text-zinc-300">Animating…</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-56 lg:h-80 rounded-md border border-dashed border-border/60 flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Animated clip — its own full panel, never replacing the image */}
        {scene.anim?.status === 'completed' && scene.anim.video_url && (
          <div className="space-y-1 col-span-2 lg:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Animated clip</p>
            <div className="relative h-56 lg:h-80">
              <video
                src={scene.anim.video_url}
                poster={scene.edited_image_url || undefined}
                controls
                preload="metadata"
                className="w-full h-full object-contain rounded-md border border-primary/40 bg-black"
              />
              {/* Supabase storage: ?download= sets Content-Disposition attachment
                  (the download attribute is ignored on cross-origin links) */}
              <a
                href={`${scene.anim.video_url}?download=scene-${scene.n}.mp4`}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/70 text-zinc-300 hover:bg-primary hover:text-white transition-colors"
                title="Download this clip"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Version history — full list in stable order, current highlighted.
          Clicking selects; nothing appears or reorders. */}
      {(() => {
        const history = scene.image_versions || [];
        const strip = scene.edited_image_url && !history.includes(scene.edited_image_url)
          ? [scene.edited_image_url, ...history]
          : history;
        if (strip.length < 2) return null;
        return (
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500">
              Versions — the highlighted one is current (used for Animate); click to switch:
            </p>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {strip.map((url) => {
                const isCurrent = url === scene.edited_image_url;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={isCurrent ? 'Current version' : 'Version'}
                    className={`h-14 w-auto object-contain bg-black/40 rounded shrink-0 ${
                      isCurrent
                        ? 'border-2 border-primary'
                        : 'border border-border/50 cursor-pointer hover:border-primary'
                    }`}
                    onClick={() => !isCurrent && handleRestore(url)}
                    title={isCurrent ? 'Current image' : 'Switch to this version'}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Swap instructions */}
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onBlur={saveInstruction}
        placeholder='e.g. "Replace the man with the woman from my reference photo. Swap the Pringles can for my product (second reference)."'
        className="text-sm min-h-[64px]"
        disabled={generating}
      />

      {/* References */}
      <div className="flex items-center gap-2 flex-wrap">
        {(scene.user_ref_urls || []).map((url) => (
          <div key={url} className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Reference" className="w-10 h-10 object-cover rounded border border-border/50" />
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
          className="h-10 text-xs"
          onClick={() => refInputRef.current?.click()}
          disabled={uploadingRef || (scene.user_ref_urls || []).length >= 6}
        >
          {uploadingRef ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
          Reference
        </Button>
      </div>

      {/* Generate — allowed even while an animation runs (the in-flight
          animation keeps the frame it was started with) */}
      <Button className="w-full" size="sm" onClick={handleGenerate} disabled={generating}>
        {generating ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 mr-2" />
        )}
        {generating
          ? 'Generating — usually 15-40s'
          : `${scene.edited_image_url ? 'Regenerate' : 'Generate'} · ${CLONE_IMAGE_CREDITS} cr`}
      </Button>

      {/* Video prompt — ALWAYS visible right above Animate so a bad prompt
          can't slip through unseen (it is exactly what the model receives) */}
      {scene.edited_image_url && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium">
              Video prompt — exactly what Animate will use
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
              Reset to suggestion
            </Button>
          </div>
          <Textarea
            value={motionPrompt}
            onChange={(e) => setMotionPrompt(e.target.value)}
            onBlur={saveMotionPrompt}
            className="text-sm min-h-[96px]"
            disabled={animating || animGenerating}
          />
          <button
            className="w-full flex items-center justify-between text-[10px] text-zinc-500 hover:text-zinc-300"
            onClick={() => setShowNegative((v) => !v)}
          >
            <span>Negative prompt (what the video must avoid)</span>
            {showNegative ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showNegative && (
            <Textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              onBlur={saveNegativePrompt}
              className="text-xs min-h-[48px]"
              disabled={animating || animGenerating}
            />
          )}
        </div>
      )}

      {/* Animate (Kling O3 Pro, audio on) — clip length editable, pre-filled
          with the original cut length; assembly still trims to the original
          cut so longer clips are extra footage for manual editing */}
      {scene.edited_image_url && (
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 shrink-0"
            title={`Clip length (3-15s). Suggested: ${suggestedSeconds}s to cover the original ${duration}s cut. The assembled video still uses the original cut timing.`}
          >
            <Input
              type="number"
              min={3}
              max={15}
              value={animSecondsInput}
              onChange={(e) => setAnimSecondsInput(e.target.value)}
              onBlur={saveAnimSeconds}
              className="w-16 h-8 text-xs text-center"
              disabled={animating || animGenerating}
            />
            <span className="text-xs text-zinc-500">s</span>
          </div>
          <Button
            variant={scene.anim?.status === 'completed' ? 'outline' : 'secondary'}
            size="sm"
            className="flex-1"
            onClick={handleAnimate}
            disabled={animating || animGenerating || generating}
          >
            {animating || animGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Clapperboard className="w-4 h-4 mr-2" />
            )}
            {animGenerating
              ? 'Animating — 2-4 min'
              : scene.anim?.status === 'completed'
                ? `Re-animate ${animSeconds}s · ${animCredits} cr`
                : scene.anim?.status === 'failed'
                  ? `Retry animation ${animSeconds}s · ${animCredits} cr`
                  : `Animate ${animSeconds}s with sound · ${animCredits} cr`}
          </Button>
        </div>
      )}

    </Card>
  );
}
