'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Download, ExternalLink, Film, ImagePlus, Info, Loader2, Music } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { pollSceneAnimation, assembleCloneProject, addCustomScene, uploadCloneReference } from '@/actions/tools/clone-studio';
import { CLONE_MUSIC_CREDITS, type CloneProject } from '@/types/clone-studio';
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
  const [addingScene, setAddingScene] = useState(false);
  const [addAfter, setAddAfter] = useState<string>('end');
  const addSceneInputRef = useRef<HTMLInputElement>(null);
  const summary = project.analysis_summary;
  const pollBusy = useRef(false);

  const animatedCount = project.scenes.filter((s) => s.anim?.status === 'completed').length;

  const handleAssemble = async () => {
    setAssembling(true);
    try {
      const result = await assembleCloneProject(project.id, { withMusic });
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
          <h3 className="text-xl font-bold text-white">{project.title || 'Untitled clone'}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{project.source_platform}</Badge>
            <Badge variant="secondary">{Math.round(project.video_duration_seconds || 0)}s</Badge>
            <Badge variant="secondary">{project.scenes.length} scenes</Badge>
            <Badge variant="secondary">{project.aspect_ratio}</Badge>
            <Badge variant="secondary">{project.credits_spent} credits spent</Badge>
            {project.source_url && (
              <a
                href={project.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
                title={project.source_url}
              >
                <ExternalLink className="w-3 h-3" /> Original video
              </a>
            )}
          </div>
        </div>
        {project.source_video_url && (
          <video
            src={project.source_video_url}
            controls
            preload="metadata"
            className="w-full lg:w-64 rounded-lg border border-border/50 bg-black"
          />
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

      {/* Assemble */}
      {animatedCount > 0 && (
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              {animatedCount}/{project.scenes.length} scenes animated
            </p>
            <p className="text-xs text-zinc-500">
              Assembles the animated scenes cut-for-cut on the original ad&apos;s timing.
            </p>
          </div>
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

      {/* How it works */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex gap-3 text-sm text-zinc-300">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-white">How to clone:</span> for each scene, tell it
            what to swap (&quot;replace the man with the woman in my reference photo&quot;), upload your
            reference images, and generate until the frame looks right. Use the <span className="text-white">same
            2–3 photos of your person in every scene</span> so they stay consistent. Animation comes
            after your images are approved.
          </div>
        </div>
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

      {/* Scene cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
    </div>
  );
}
