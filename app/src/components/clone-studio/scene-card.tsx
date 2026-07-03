'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Plus, Sparkles, X } from 'lucide-react';
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
} from '@/actions/tools/clone-studio';
import {
  CLONE_IMAGE_CREDITS,
  type CloneImageEngine,
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
  const [engine, setEngine] = useState<CloneImageEngine>('nb2');
  const [generating, setGenerating] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState(scene.analysis);
  const refInputRef = useRef<HTMLInputElement>(null);

  const duration = (scene.end - scene.start).toFixed(1);

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
      const result = await generateSceneImage(project.id, scene.n, { engine });
      if (!result.success || !result.project) {
        toast.error(result.error || 'Generation failed — credits refunded');
        return;
      }
      onProjectUpdate(result.project);
      toast.success(`Scene ${scene.n} image ready`);
    } finally {
      setGenerating(false);
    }
  };

  const handleRestore = async (url: string) => {
    const result = await restoreSceneImageVersion(project.id, scene.n, url);
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge>Scene {scene.n}</Badge>
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

      {/* Original vs yours */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Original</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={scene.keyframe_url}
            alt={`Scene ${scene.n} original`}
            className="w-full aspect-video object-cover rounded-md border border-border/50"
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">Your version</p>
          {scene.edited_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={scene.edited_image_url}
              alt={`Scene ${scene.n} edited`}
              className="w-full aspect-video object-cover rounded-md border border-primary/40"
            />
          ) : (
            <div className="w-full aspect-video rounded-md border border-dashed border-border/60 flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-zinc-600" />
            </div>
          )}
        </div>
      </div>

      {/* Version history */}
      {scene.image_versions.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] text-zinc-500 shrink-0">Versions:</span>
          {scene.image_versions.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt="Previous version"
              className="h-10 aspect-video object-cover rounded border border-border/50 cursor-pointer hover:border-primary shrink-0"
              onClick={() => handleRestore(url)}
              title="Restore this version"
            />
          ))}
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

      {/* Engine + generate */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-border/60 overflow-hidden text-xs">
          <button
            className={`px-2.5 py-1.5 ${engine === 'nb2' ? 'bg-primary text-white' : 'text-zinc-400 hover:text-white'}`}
            onClick={() => setEngine('nb2')}
            title="Best for swapping people"
          >
            People
          </button>
          <button
            className={`px-2.5 py-1.5 ${engine === 'gpt2' ? 'bg-primary text-white' : 'text-zinc-400 hover:text-white'}`}
            onClick={() => setEngine('gpt2')}
            title="Best for products & multi-object scenes"
          >
            Products
          </button>
        </div>
        <Button className="flex-1" size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {scene.edited_image_url ? 'Regenerate' : 'Generate'} · {CLONE_IMAGE_CREDITS} cr
        </Button>
      </div>

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
              <Label className="text-[10px] uppercase text-zinc-500">Start state (painted into the image)</Label>
              <Textarea
                value={details.action_arc.start_state}
                onChange={(e) => setDetails({ ...details, action_arc: { ...details.action_arc, start_state: e.target.value } })}
                onBlur={saveDetails}
                className="text-xs min-h-[56px]"
              />
            </div>
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
            <div>
              <Label className="text-[10px] uppercase text-zinc-500">On-screen text (added in the editor later)</Label>
              <Input
                value={details.on_screen_text}
                onChange={(e) => setDetails({ ...details, on_screen_text: e.target.value })}
                onBlur={saveDetails}
                className="text-xs"
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
