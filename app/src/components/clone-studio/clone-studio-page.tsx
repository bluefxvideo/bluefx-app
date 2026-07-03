'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Film, Link2, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  createCloneProject,
  processCloneProject,
  getCloneProject,
  listCloneProjects,
  deleteCloneProject,
  uploadCloneSource,
} from '@/actions/tools/clone-studio';
import { CLONE_INGEST_CREDITS, type CloneProject } from '@/types/clone-studio';
import { SceneBoard } from './scene-board';

const PROCESSING_STATUSES = ['pending', 'downloading', 'segmenting', 'analyzing'];

const PROCESSING_STEPS: Array<{ status: string; label: string }> = [
  { status: 'downloading', label: 'Downloading the ad' },
  { status: 'segmenting', label: 'Detecting scenes & extracting keyframes' },
  { status: 'analyzing', label: 'Analyzing every scene with AI' },
];

export function CloneStudioPage() {
  const [projects, setProjects] = useState<CloneProject[]>([]);
  const [activeProject, setActiveProject] = useState<CloneProject | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshList = useCallback(async () => {
    const result = await listCloneProjects();
    if (result.success && result.projects) setProjects(result.projects);
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Poll while the ingest pipeline runs so the stepper reflects real progress
  useEffect(() => {
    if (!activeProject || !PROCESSING_STATUSES.includes(activeProject.status)) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const result = await getCloneProject(activeProject.id);
      if (result.success && result.project) {
        setActiveProject(result.project);
        if (!PROCESSING_STATUSES.includes(result.project.status)) {
          refreshList();
        }
      }
    }, 3000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [activeProject, refreshList]);

  const startProject = async (videoUrl?: string) => {
    if (!sourceUrl.trim() && !videoUrl) {
      toast.error('Paste an ad URL or upload a video file');
      return;
    }
    setStarting(true);
    try {
      const request = {
        source_url: videoUrl ? undefined : sourceUrl.trim(),
        video_url: videoUrl,
      };
      const created = await createCloneProject(request);
      if (!created.success || !created.project) {
        toast.error(created.error || 'Could not start the project');
        return;
      }
      setActiveProject(created.project);
      setSourceUrl('');
      // Run the pipeline; polling keeps the stepper live in the meantime
      processCloneProject(created.project.id, request).then((result) => {
        if (result.success && result.project) {
          setActiveProject(result.project);
        } else if (result.error) {
          toast.error(result.error);
        }
        refreshList();
      });
    } finally {
      setStarting(false);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 300 * 1024 * 1024) {
      toast.error('Video is too large (max 300MB)');
      return;
    }
    setStarting(true);
    try {
      const upload = await uploadCloneSource(file);
      if (!upload.success || !upload.url) {
        toast.error(upload.error || 'Upload failed');
        return;
      }
      await startProject(upload.url);
    } finally {
      setStarting(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    const result = await deleteCloneProject(projectId);
    if (!result.success) {
      toast.error(result.error || 'Delete failed');
      return;
    }
    if (activeProject?.id === projectId) setActiveProject(null);
    refreshList();
  };

  const isProcessing = activeProject && PROCESSING_STATUSES.includes(activeProject.status);

  return (
    <StandardToolPage
      icon={Clapperboard}
      title="Clone Studio"
      description="Scene-by-scene ad cloning — swap the people and products, keep the winning structure"
      toolName="Clone Studio"
    >
      <div className="h-full overflow-y-auto p-4 lg:p-6">
        {!activeProject && (
          <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Clone an ad</h3>
                <Badge variant="secondary">Beta</Badge>
              </div>
              <p className="text-sm text-zinc-400">
                Paste a TikTok, Instagram, Facebook, or YouTube link to the ad you want to clone.
                We break it into scenes, analyze each one, and let you swap in your own person and
                product — scene by scene.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/... or youtube.com/..."
                    className="pl-9"
                    disabled={starting}
                  />
                </div>
                <Button onClick={() => startProject()} disabled={starting || !sourceUrl.trim()}>
                  {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Film className="w-4 h-4 mr-2" />}
                  Break it down · {CLONE_INGEST_CREDITS} credits
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-xs text-zinc-500">or</span>
                <div className="h-px flex-1 bg-border/50" />
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files?.[0])}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={starting}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload a video file
                </Button>
                <span className="ml-3 text-xs text-zinc-500">Up to 3 minutes</span>
              </div>
            </Card>

            {projects.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300">Your clone projects</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <Card
                      key={project.id}
                      className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors group"
                      onClick={() => setActiveProject(project)}
                    >
                      <div className="aspect-video bg-secondary/40 relative">
                        {project.scenes?.[0]?.keyframe_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={project.scenes[0].keyframe_url}
                            alt={project.title || 'Clone project'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-8 h-8 text-zinc-600" />
                          </div>
                        )}
                        <Badge
                          className="absolute top-2 right-2"
                          variant={
                            project.status === 'failed'
                              ? 'destructive'
                              : project.status === 'board_ready'
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{project.title || 'Untitled clone'}</p>
                          <p className="text-xs text-zinc-500">
                            {project.scenes?.length || 0} scenes · {project.credits_spent} credits ·{' '}
                            {new Date(project.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeProject && isProcessing && (
          <div className="max-w-lg mx-auto mt-12">
            <Card className="p-8 space-y-6">
              <div className="text-center space-y-1">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <h3 className="text-lg font-semibold text-white pt-2">Breaking down the ad…</h3>
                <p className="text-sm text-zinc-400">Usually takes 1–2 minutes.</p>
              </div>
              <div className="space-y-3">
                {PROCESSING_STEPS.map((step, i) => {
                  const currentIndex = PROCESSING_STEPS.findIndex((s) => s.status === activeProject.status);
                  const state = currentIndex > i || activeProject.status === 'board_ready'
                    ? 'done'
                    : currentIndex === i
                      ? 'active'
                      : 'todo';
                  return (
                    <div key={step.status} className="flex items-center gap-3 text-sm">
                      {state === 'done' && <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">✓</span>}
                      {state === 'active' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                      {state === 'todo' && <span className="w-5 h-5 rounded-full border border-border" />}
                      <span className={state === 'todo' ? 'text-zinc-500' : 'text-zinc-200'}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setActiveProject(null)}>
                Back to projects (keeps processing)
              </Button>
            </Card>
          </div>
        )}

        {activeProject && !isProcessing && activeProject.status === 'failed' && (
          <div className="max-w-lg mx-auto mt-12">
            <Card className="p-8 space-y-4 text-center">
              <h3 className="text-lg font-semibold text-white">This one didn&apos;t work</h3>
              <p className="text-sm text-red-400">{activeProject.error_message || 'Ingest failed'}</p>
              <p className="text-xs text-zinc-500">Your {CLONE_INGEST_CREDITS} credits were refunded.</p>
              <Button variant="outline" onClick={() => setActiveProject(null)}>Back to projects</Button>
            </Card>
          </div>
        )}

        {activeProject && !isProcessing && activeProject.status !== 'failed' && (
          <SceneBoard
            project={activeProject}
            onProjectUpdate={setActiveProject}
            onBack={() => {
              setActiveProject(null);
              refreshList();
            }}
          />
        )}
      </div>
    </StandardToolPage>
  );
}
