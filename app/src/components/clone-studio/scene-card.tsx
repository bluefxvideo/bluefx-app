'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clapperboard, Download, ImagePlus, Loader2, Plus, Sparkles, X } from 'lucide-react';
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
  const [showDetails, setShowDetails] = useState(false);
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

  const handleAddRef = async (file: File | undefined) => {
    if (!file) return;
    setUploadingRef(true);
    try {
      const upload = await uploadCloneReference(project.id, file);
      if (!upload.success || !upload.url) {
        toast.error(upload.error || 'Reference upload failed');
        return;
      }
      const urls = [...(scene.user_ref_urls || []), upload.url].slice(0, 6);
      const result = await updateSceneInput(project.id, scene.n, { user_ref_urls: urls });
      if (result.success && result.project) onProjectUpdate(result.project);
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
    <Card className="p-4 space-y-3">
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
          aren't cropped; click opens the full-size file for saving */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Original</p>
          <a
            href={scene.keyframe_url}
            target="_blank"
            rel="noreferrer"
            className="block h-56 rounded-md border border-border/50 bg-black/40 overflow-hidden"
            title="Open full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={scene.keyframe_url}
              alt={`Scene ${scene.n} original`}
              className="w-full h-full object-contain"
            />
          </a>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Your version{scene.anim?.status === 'completed' ? ' · animated' : ''}
          </p>
          {scene.anim?.status === 'completed' && scene.anim.video_url ? (
            <div className="space-y-1">
              <video
                src={scene.anim.video_url}
                poster={scene.edited_image_url || undefined}
                controls
                preload="metadata"
                className="w-full h-56 object-contain rounded-md border border-primary/40 bg-black"
              />
              <div className="flex items-center gap-1.5">
                {/* The generated image stays reachable after animation — it's
                    still the input for Regenerate/Re-animate */}
                {scene.edited_image_url && (
                  <a
                    href={scene.edited_image_url}
                    target="_blank"
                    rel="noreferrer"
                    title="The image this clip was animated from — open full size (right-click to save)"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={scene.edited_image_url}
                      alt={`Scene ${scene.n} source image`}
                      className="h-9 w-auto object-contain bg-black/40 rounded border border-border/50 hover:border-primary"
                    />
                  </a>
                )}
                {/* Supabase storage: ?download= sets Content-Disposition attachment
                    (the download attribute is ignored on cross-origin links) */}
                <a href={`${scene.anim.video_url}?download=scene-${scene.n}.mp4`} className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full h-9 text-xs text-zinc-400">
                    <Download className="w-3 h-3 mr-1.5" /> Download clip
                  </Button>
                </a>
              </div>
            </div>
          ) : scene.edited_image_url ? (
            <div className="relative h-56">
              <a
                href={scene.edited_image_url}
                target="_blank"
                rel="noreferrer"
                className="block h-full rounded-md border border-primary/40 bg-black/40 overflow-hidden"
                title="Open full size (right-click to save)"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scene.edited_image_url}
                  alt={`Scene ${scene.n} edited`}
                  className="w-full h-full object-contain"
                />
              </a>
              {animGenerating && (
                <div className="absolute inset-0 rounded-md bg-black/60 flex flex-col items-center justify-center gap-1">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-[10px] text-zinc-300">Animating…</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-56 rounded-md border border-dashed border-border/60 flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-zinc-600" />
            </div>
          )}
        </div>
      </div>

      {/* Version history — the big image above is the CURRENT one and is what
          Animate uses; clicking an older version makes it current */}
      {scene.image_versions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-zinc-500">
            Older versions — click one to make it the current image (the one that gets animated):
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {scene.image_versions.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt="Previous version"
                className="h-14 w-auto object-contain bg-black/40 rounded border border-border/50 cursor-pointer hover:border-primary shrink-0"
                onClick={() => handleRestore(url)}
                title="Make this the current image"
              />
            ))}
          </div>
        </div>
      )}

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
          className="hidden"
          onChange={(e) => handleAddRef(e.target.files?.[0])}
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

      {/* Video prompt — the EXACT text the animation model receives. Nothing
          else is appended; the fixed negative quality guard is shown below. */}
      <div>
        <button
          className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-white"
          onClick={() => setShowDetails((v) => !v)}
        >
          <span>Video prompt — exactly what the animation receives</span>
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showDetails && (
          <div className="mt-2 space-y-1.5">
            <Textarea
              value={motionPrompt}
              onChange={(e) => setMotionPrompt(e.target.value)}
              onBlur={saveMotionPrompt}
              className="text-xs min-h-[140px]"
              disabled={animating || animGenerating}
            />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">
                Negative prompt (what the video must avoid)
              </p>
              <Textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                onBlur={saveNegativePrompt}
                className="text-xs min-h-[48px]"
                disabled={animating || animGenerating}
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-zinc-500"
                onClick={() => {
                  setMotionPrompt(composeMotionPrompt(scene.analysis));
                  setNegativePrompt(CLONE_ANIM_NEGATIVE_PROMPT);
                }}
                title="Restore the AI-suggested prompt and default negative prompt"
              >
                Reset to suggestion
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
