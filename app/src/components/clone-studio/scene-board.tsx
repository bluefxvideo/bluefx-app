'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Clapperboard, Download, ExternalLink, Film, ImagePlus, Info, Loader2, Music, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  pollSceneAnimation,
  assembleCloneProject,
  addCustomScene,
  uploadCloneReference,
  updateProjectReferences,
  applyInstructionToAllScenes,
  generateSceneImage,
  animateScene,
} from '@/actions/tools/clone-studio';
import {
  CLONE_ANIM_CREDITS_PER_SECOND,
  CLONE_IMAGE_CREDITS,
  CLONE_MUSIC_CREDITS,
  type CloneProject,
} from '@/types/clone-studio';
import { SceneCard } from './scene-card';

interface SceneBoardProps {
  project: CloneProject;
  onProjectUpdate: (project: CloneProject) => void;
  onBack: () => void;
}

export function SceneBoard({ project, onProjectUpdate, onBack }: SceneBoardProps) {
  const [showSummary, setShowSummary] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [withMusic, setWithMusic] = useState(true);
  const [trimToOriginal, setTrimToOriginal] = useState(false);
  const [addingScene, setAddingScene] = useState(false);
  const [addAfter, setAddAfter] = useState<string>('end');
  const addSceneInputRef = useRef<HTMLInputElement>(null);
  const projectRefInputRef = useRef<HTMLInputElement>(null);
  const [uploadingProjectRefs, setUploadingProjectRefs] = useState(false);
  const [globalInstruction, setGlobalInstruction] = useState('');
  const [applyingInstruction, setApplyingInstruction] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const batchCancel = useRef(false);
  const summary = project.analysis_summary;
  const pollBusy = useRef(false);

  const animatedCount = project.scenes.filter((s) => s.anim?.status === 'completed').length;
  const projectRefs = project.analysis_summary?.project_ref_urls || [];
  const missingImages = project.scenes.filter((s) => !s.edited_image_url);
  const readyToAnimate = project.scenes.filter(
    (s) => s.edited_image_url && (s.anim?.status === 'idle' || s.anim?.status === 'failed' || !s.anim)
  );
  const animateAllCredits = readyToAnimate.reduce((sum, s) => {
    const seconds = s.anim_seconds ?? Math.min(15, Math.max(3, Math.ceil(s.end - s.start)));
    return sum + seconds * CLONE_ANIM_CREDITS_PER_SECOND;
  }, 0);

  const handleProjectRefUpload = async (files: FileList | null) => {
    const slots = 6 - projectRefs.length;
    const selected = Array.from(files || []).slice(0, slots);
    if (!selected.length) return;
    setUploadingProjectRefs(true);
    try {
      const uploaded: string[] = [];
      for (const file of selected) {
        const up = await uploadCloneReference(project.id, file);
        if (up.success && up.url) uploaded.push(up.url);
        else toast.error(up.error || `Upload failed for ${file.name}`);
      }
      if (uploaded.length) {
        const result = await updateProjectReferences(project.id, [...projectRefs, ...uploaded]);
        if (result.success && result.project) onProjectUpdate(result.project);
      }
    } finally {
      setUploadingProjectRefs(false);
      if (projectRefInputRef.current) projectRefInputRef.current.value = '';
    }
  };

  const handleRemoveProjectRef = async (url: string) => {
    const result = await updateProjectReferences(project.id, projectRefs.filter((u) => u !== url));
    if (result.success && result.project) onProjectUpdate(result.project);
  };

  const handleApplyInstruction = async () => {
    if (!globalInstruction.trim()) return;
    if (!window.confirm('Write this instruction into ALL scenes? (overwrites each scene\u2019s current instruction)')) return;
    setApplyingInstruction(true);
    try {
      const result = await applyInstructionToAllScenes(project.id, globalInstruction.trim());
      if (result.success && result.project) {
        onProjectUpdate(result.project);
        toast.success('Instruction applied to all scenes');
      } else toast.error(result.error || 'Could not apply');
    } finally {
      setApplyingInstruction(false);
    }
  };

  const handleGenerateAll = async () => {
    const targets = missingImages.map((s) => s.n);
    if (!targets.length) return;
    if (!window.confirm(`Generate images for ${targets.length} scenes (${targets.length * CLONE_IMAGE_CREDITS} credits)?`)) return;
    batchCancel.current = false;
    let done = 0, failed = 0;
    for (const [i, n] of targets.entries()) {
      if (batchCancel.current) break;
      setBatchStatus(`Generating scene ${n} (${i + 1}/${targets.length})\u2026`);
      try {
        const result = await generateSceneImage(project.id, n);
        if (result.success && result.project) { onProjectUpdate(result.project); done++; }
        else failed++;
      } catch { failed++; }
    }
    setBatchStatus(null);
    toast[failed ? 'warning' : 'success'](`Generated ${done} scene image${done === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}`);
  };

  const handleAnimateAll = async () => {
    const targets = readyToAnimate.map((s) => s.n);
    if (!targets.length) return;
    if (!window.confirm(`Animate ${targets.length} scenes with sound (${animateAllCredits} credits)? They render in parallel (~2-4 min).`)) return;
    batchCancel.current = false;
    let done = 0, failed = 0;
    for (const [i, n] of targets.entries()) {
      if (batchCancel.current) break;
      setBatchStatus(`Starting animation for scene ${n} (${i + 1}/${targets.length})\u2026`);
      try {
        const result = await animateScene(project.id, n);
        if (result.success && result.project) { onProjectUpdate(result.project); done++; }
        else failed++;
      } catch { failed++; }
    }
    setBatchStatus(null);
    toast[failed ? 'warning' : 'success'](`${done} animation${done === 1 ? '' : 's'} started${failed ? `, ${failed} failed` : ''}`);
  };

  const handleAssemble = async () => {
    setAssembling(true);
    try {
      const result = await assembleCloneProject(project.id, { withMusic, trimToOriginal });
      if (!result.success || !result.project) {
        toast.error(result.error || 'Assembly failed');
        return;
      }
      onProjectUpdate(result.project);
      toast.success('Your cloned ad is ready!');
    } finally {
      setAssembling(false);
    }
  };

  // Poll fallback for in-flight animations — the webhook usually wins, but
  // this covers local dev and missed callbacks. Sequential to avoid races on
  // the shared scenes jsonb.
  const generatingScenes = project.scenes.filter((s) => s.anim?.status === 'generating').map((s) => s.n);
  useEffect(() => {
    if (generatingScenes.length === 0) return;
    const interval = setInterval(async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try {
        let latest: CloneProject | null = null;
        for (const n of generatingScenes) {
          const result = await pollSceneAnimation(project.id, n);
          if (result.success && result.project) latest = result.project;
        }
        if (latest) onProjectUpdate(latest);
      } finally {
        pollBusy.current = false;
      }
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, generatingScenes.join(','), onProjectUpdate]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 space-y-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-zinc-400 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> All projects
          </Button>
          <h3 className="text-2xl font-bold text-white tracking-tight">{project.title || 'Untitled clone'}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-zinc-500 tabular-nums">
            <span>{project.source_platform}</span>
            <span className="text-zinc-700">·</span>
            <span>{Math.round(project.video_duration_seconds || 0)}s</span>
            <span className="text-zinc-700">·</span>
            <span>{project.scenes.length} scenes</span>
            <span className="text-zinc-700">·</span>
            <span>{project.aspect_ratio}</span>
            <span className="text-zinc-700">·</span>
            <span>{project.credits_spent} cr spent</span>
            {project.source_url && (
              <>
                <span className="text-zinc-700">·</span>
                <a
                  href={project.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-sans"
                  title={project.source_url}
                >
                  <ExternalLink className="w-3 h-3" /> original
                </a>
              </>
            )}
          </div>
        </div>
        {project.source_video_url && (
          <div className="w-full lg:w-[520px] xl:w-[600px] shrink-0 space-y-1">
            <video
              src={project.source_video_url}
              controls
              preload="metadata"
              className="w-full rounded-lg border border-border/50 bg-black"
            />
            <p className="text-[10px] text-zinc-600 text-right">
              Tip: use the player&apos;s ⋮ menu → Picture in Picture to keep it floating while you scroll.
            </p>
          </div>
        )}
      </div>

      {/* Final video */}
      {project.final_video_url && (
        <Card className="p-4 space-y-3 border-primary/40">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-primary" /> Your cloned ad
            </h4>
            <a href={`${project.final_video_url}?download=${(project.title || 'cloned-ad').replace(/[^a-z0-9-]+/gi, '-')}.mp4`}>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1.5" /> Download
              </Button>
            </a>
          </div>
          <video
            src={project.final_video_url}
            controls
            className="w-full max-h-[420px] rounded-lg bg-black"
          />
        </Card>
      )}

      {/* Setup: project refs + one instruction + batch actions */}
      <Card className="p-4 space-y-4">
        <p className="text-sm font-semibold text-white">How it works — set up once, then review scene by scene</p>

        <div className="space-y-2">
          <p className="text-xs text-zinc-300">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold mr-1.5">1</span>
            Add photos of <span className="text-white">your person and product</span> — they're used in every scene
            automatically, so everyone stays consistent:
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {projectRefs.map((url) => (
              <div key={url} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Project reference" className="w-14 h-14 object-cover rounded border border-border/50" />
                <button
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center"
                  onClick={() => handleRemoveProjectRef(url)}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <input
              ref={projectRefInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleProjectRefUpload(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-14"
              onClick={() => projectRefInputRef.current?.click()}
              disabled={uploadingProjectRefs || projectRefs.length >= 6}
            >
              {uploadingProjectRefs ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5" />}
              Add references
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-zinc-300">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold mr-1.5">2</span>
            Say what to swap, once — it fills every scene (you can still tweak any scene after):
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Textarea
              value={globalInstruction}
              onChange={(e) => setGlobalInstruction(e.target.value)}
              placeholder='e.g. "Replace the young man with the bald man from reference 1. Replace every Pringles can with the Nutella jar from reference 2."'
              className="text-sm min-h-[60px] flex-1"
              disabled={applyingInstruction || !!batchStatus}
            />
            <Button
              onClick={handleApplyInstruction}
              disabled={applyingInstruction || !globalInstruction.trim() || !!batchStatus}
              className="sm:self-end h-11 px-6 font-medium"
              size="lg"
            >
              {applyingInstruction ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Apply to all scenes
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
          <Button
            onClick={handleGenerateAll}
            disabled={!!batchStatus || missingImages.length === 0}
            className="flex-1"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate {missingImages.length} missing image{missingImages.length === 1 ? '' : 's'} · {missingImages.length * CLONE_IMAGE_CREDITS} cr
          </Button>
          <Button
            variant="secondary"
            onClick={handleAnimateAll}
            disabled={!!batchStatus || readyToAnimate.length === 0}
            className="flex-1"
          >
            <Clapperboard className="w-4 h-4 mr-2" />
            Animate {readyToAnimate.length} ready scene{readyToAnimate.length === 1 ? '' : 's'} · {animateAllCredits} cr
          </Button>
        </div>
        {batchStatus && (
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {batchStatus}</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { batchCancel.current = true; }}>
              Stop after current
            </Button>
          </div>
        )}
      </Card>

      {/* Analysis summary */}
      {summary && (
        <Card className="p-4">
          <button
            className="w-full flex items-center justify-between text-sm font-medium text-white"
            onClick={() => setShowSummary((v) => !v)}
          >
            <span>Ad breakdown (AI analysis)</span>
            {showSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showSummary && (
            <div className="mt-3 space-y-3 text-sm text-zinc-300">
              <p>{summary.summary}</p>
              {summary.characters.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-zinc-400 uppercase">Characters</p>
                  {summary.characters.map((c) => (
                    <p key={c.id} className="text-xs">
                      <span className="text-white font-medium">{c.id}:</span> {c.description}
                    </p>
                  ))}
                </div>
              )}
              {summary.products.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {summary.products.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                  ))}
                </div>
              )}
              {summary.visual_style && (
                <p className="text-xs text-zinc-400"><span className="font-semibold">Style:</span> {summary.visual_style}</p>
              )}
              {summary.music_brief && (
                <p className="text-xs text-zinc-400"><span className="font-semibold">Music:</span> {summary.music_brief}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Scene cards — one per row so frames stay big and comparable */}
      <div className="grid grid-cols-1 gap-4">
        {project.scenes.map((scene) => (
          <SceneCard
            key={`${scene.n}-${scene.keyframe_url}`}
            project={project}
            scene={scene}
            onProjectUpdate={onProjectUpdate}
          />
        ))}

        {/* Add your own scene — any frame becomes a scene like the others */}
        <Card className="p-4 border-dashed flex flex-col items-center justify-center gap-3 min-h-[220px]">
          <ImagePlus className="w-6 h-6 text-zinc-600" />
          <p className="text-sm text-zinc-400 text-center">
            Add your own scene from an image — prompt and animate it like any other.
          </p>
          <div className="flex items-center gap-2">
            <select
              value={addAfter}
              onChange={(e) => setAddAfter(e.target.value)}
              disabled={addingScene}
              className="h-8 rounded-md border border-border/60 bg-transparent text-xs px-2 text-zinc-300"
            >
              <option value="end">At the end</option>
              {project.scenes.map((s) => (
                <option key={s.n} value={String(s.n)}>After scene {s.n}</option>
              ))}
            </select>
            <input
              ref={addSceneInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAddingScene(true);
                try {
                  const upload = await uploadCloneReference(project.id, file);
                  if (!upload.success || !upload.url) {
                    toast.error(upload.error || 'Image upload failed');
                    return;
                  }
                  const result = await addCustomScene(project.id, {
                    image_url: upload.url,
                    afterScene: addAfter === 'end' ? undefined : parseInt(addAfter, 10),
                  });
                  if (!result.success || !result.project) {
                    toast.error(result.error || 'Could not add the scene');
                    return;
                  }
                  onProjectUpdate(result.project);
                  toast.success('Scene added');
                } catch (error) {
                  console.error('addCustomScene threw:', error);
                  toast.error('Could not add the scene — try again');
                } finally {
                  setAddingScene(false);
                  if (addSceneInputRef.current) addSceneInputRef.current.value = '';
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={addingScene}
              onClick={() => addSceneInputRef.current?.click()}
            >
              {addingScene ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1.5" />}
              Upload frame
            </Button>
          </div>
        </Card>
      </div>

      {/* Assemble */}
      {animatedCount > 0 && (
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              {animatedCount}/{project.scenes.length} scenes animated
            </p>
            <p className="text-xs text-zinc-500">
              Joins your animated scenes in order, full length.
            </p>
          </div>
          <label
            className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer"
            title="Trim every clip back to the source ad's exact cut lengths. Tighter rhythm, but actions in short scenes may get cut off."
          >
            <Checkbox checked={trimToOriginal} onCheckedChange={(v) => setTrimToOriginal(v === true)} />
            Cut to original ad timing
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <Checkbox checked={withMusic} onCheckedChange={(v) => setWithMusic(v === true)} />
            <Music className="w-3.5 h-3.5" /> AI music bed · {CLONE_MUSIC_CREDITS} cr
          </label>
          <Button onClick={handleAssemble} disabled={assembling || project.status === 'assembling'}>
            {assembling || project.status === 'assembling' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Film className="w-4 h-4 mr-2" />
            )}
            {project.final_video_url ? 'Re-assemble' : 'Assemble video'}
          </Button>
        </Card>
      )}

    </div>
  );
}
