'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Clapperboard, Download, ImagePlus, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  updateSceneInput,
  uploadCloneReference,
  generateSceneImage,
  restoreSceneImageVersion,
  animateScene,
} from '@/actions/tools/clone-studio';
import {
  CLONE_ANIM_CREDITS_PER_SECOND,
  CLONE_IMAGE_CREDITS,
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
  const [details, setDetails] = useState(scene.analysis);
  const refInputRef = useRef<HTMLInputElement>(null);
  const [animating, setAnimating] = useState(false);

  const duration = (scene.end - scene.start).toFixed(1);
  const animSeconds = Math.min(15, Math.max(3, Math.ceil(scene.end - scene.start)));
  const animCredits = animSeconds * CLONE_ANIM_CREDITS_PER_SECOND;
  const animGenerating = scene.anim?.status === 'generating';

  const saveInstruction = async () => {
    if (instruction === (scene.user_instruction || '')) return;
    const result = await updateSceneInput(project.id, scene.n, { user_instruction: instruction });
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const saveDetails = async () => {
    if (JSON.stringify(details) === JSON.stringify(scene.analysis)) return;
    const result = await updateSceneInput(project.id, scene.n, { analysis: details });
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
      const result = await animateScene(project.id, scene.n);
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
          {scene.analysis?.purpose && (
            <Badge variant="secondary" className="text-[10px] uppercase">{scene.analysis.purpose}</Badge>
          )}
          <span className="text-xs text-zinc-500">
            {scene.start.toFixed(1)}–{scene.end.toFixed(1)}s · {duration}s
          </span>
        </div>
        {scene.credits_spent > 0 && (
          <span className="text-xs text-zinc-500">{scene.credits_spent} cr</span>
        )}
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
              {/* Supabase storage: ?download= sets Content-Disposition attachment
                  (the download attribute is ignored on cross-origin links) */}
              <a href={`${scene.anim.video_url}?download=scene-${scene.n}.mp4`}>
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-zinc-400">
                  <Download className="w-3 h-3 mr-1.5" /> Download clip
                </Button>
              </a>
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

      {/* Animate (Kling O3 Pro, audio on) */}
      {scene.edited_image_url && (
        <Button
          variant={scene.anim?.status === 'completed' ? 'outline' : 'secondary'}
          size="sm"
          className="w-full"
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
      )}

      {/* Scene details (editable analysis) */}
      <div>
        <button
          className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-white"
          onClick={() => setShowDetails((v) => !v)}
        >
          <span>Scene details (camera, action, dialog)</span>
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showDetails && (
          <div className="mt-2 space-y-2">
            <div>
              <Label className="text-[10px] uppercase text-zinc-500">Action (what happens)</Label>
              <Textarea
                value={details.action_arc.action}
                onChange={(e) => setDetails({ ...details, action_arc: { ...details.action_arc, action: e.target.value } })}
                onBlur={saveDetails}
                className="text-xs min-h-[56px]"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-zinc-500">End state (locked)</Label>
              <Textarea
                value={details.action_arc.end_state}
                onChange={(e) => setDetails({ ...details, action_arc: { ...details.action_arc, end_state: e.target.value } })}
                onBlur={saveDetails}
                className="text-xs min-h-[40px]"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-zinc-500">Rules (one per line, e.g. &quot;the can NEVER comes off&quot;)</Label>
              <Textarea
                value={details.action_arc.invariants.join('\n')}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    action_arc: { ...details.action_arc, invariants: e.target.value.split('\n').filter(Boolean) },
                  })
                }
                onBlur={saveDetails}
                className="text-xs min-h-[40px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] uppercase text-zinc-500">Dialog</Label>
                <Input
                  value={details.dialog}
                  onChange={(e) => setDetails({ ...details, dialog: e.target.value })}
                  onBlur={saveDetails}
                  className="text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase text-zinc-500">Camera</Label>
                <Input
                  value={details.camera}
                  onChange={(e) => setDetails({ ...details, camera: e.target.value })}
                  onBlur={saveDetails}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
