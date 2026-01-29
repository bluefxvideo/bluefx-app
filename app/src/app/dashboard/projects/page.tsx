'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Plus,
  Video,
  FileText,
  Pencil,
  Trash2,
  Clock,
  CheckCircle,
  Loader2,
  FolderOpen,
  LayoutGrid,
  Play,
  Image,
} from 'lucide-react';
import { createClient } from '@/app/supabase/client';
import {
  AdProject,
  listProjects,
  createProject,
  deleteProject,
  ProjectSourceType,
} from '@/actions/database/projects-database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StandardToolPage } from '@/components/tools/standard-tool-page';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<AdProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // New project dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<ProjectSourceType>('video_analysis');
  const [isCreating, setIsCreating] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<AdProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get user and load projects
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        const result = await listProjects(user.id);
        if (result.success) {
          setProjects(result.projects);
        }
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  const handleCreateProject = async () => {
    if (!userId) return;

    setIsCreating(true);
    const result = await createProject(userId, {
      name: newProjectName || 'Untitled Project',
      source_type: newProjectType,
    });

    if (result.success && result.project) {
      // Navigate to appropriate starting point based on type
      if (newProjectType === 'video_analysis') {
        router.push(`/dashboard/video-analyzer?projectId=${result.project.id}`);
      } else {
        router.push(`/dashboard/ai-cinematographer/storyboard?projectId=${result.project.id}`);
      }
    }

    setIsCreating(false);
    setShowNewDialog(false);
    setNewProjectName('');
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    const result = await deleteProject(projectToDelete.id);
    if (result.success) {
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
    }
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const handleOpenProject = (project: AdProject) => {
    // Navigate based on project status
    if (project.status === 'draft' || project.status === 'analyzing') {
      router.push(`/dashboard/video-analyzer?projectId=${project.id}`);
    } else if (project.status === 'storyboarding') {
      router.push(`/dashboard/ai-cinematographer/storyboard?projectId=${project.id}`);
    } else {
      router.push(`/dashboard/ai-cinematographer?projectId=${project.id}`);
    }
  };

  const getStatusBadge = (status: AdProject['status']) => {
    const config = {
      draft: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: Pencil, label: 'Draft' },
      analyzing: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Loader2, label: 'Analyzing' },
      storyboarding: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: LayoutGrid, label: 'Storyboarding' },
      generating: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: Play, label: 'Generating' },
      completed: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle, label: 'Completed' },
    };

    const { bg, text, icon: Icon, label } = config[status];

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${bg} ${text}`}>
        <Icon className={`w-3 h-3 ${status === 'analyzing' ? 'animate-spin' : ''}`} />
        {label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <StandardToolPage
        icon={FolderOpen}
        title="Ad Projects"
        description="Create and manage your AI-generated ad campaigns"
        iconGradient="bg-primary"
        toolName="Ad Projects"
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </StandardToolPage>
    );
  }

  return (
    <StandardToolPage
      icon={FolderOpen}
      title="Ad Projects"
      description="Create and manage your AI-generated ad campaigns"
      iconGradient="bg-primary"
      toolName="Ad Projects"
    >
      <div className="p-6 space-y-6">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card className="p-12 border-dashed">
            <div className="text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Create your first project to start generating AI-powered video ads
              </p>
              <Button onClick={() => setShowNewDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Project
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <Card
                key={project.id}
                className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => handleOpenProject(project)}
              >
                {/* Thumbnail or placeholder */}
                <div className="aspect-video bg-muted/30 relative overflow-hidden">
                  {project.grid_image_url ? (
                    <img
                      src={project.grid_image_url}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {project.source_type === 'video_analysis' ? (
                        <Video className="w-10 h-10 text-muted-foreground/50" />
                      ) : project.source_type === 'script_idea' ? (
                        <FileText className="w-10 h-10 text-muted-foreground/50" />
                      ) : (
                        <Image className="w-10 h-10 text-muted-foreground/50" />
                      )}
                    </div>
                  )}

                  {/* Delete button overlay */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={e => {
                      e.stopPropagation();
                      setProjectToDelete(project);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-medium truncate mb-2">{project.name}</h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(project.status)}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(project.updated_at)}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    {project.analysis_data?.shots?.length ? (
                      <span>{project.analysis_data.shots.length} shots</span>
                    ) : null}
                    {project.extracted_frames?.length ? (
                      <span>{project.extracted_frames.length} frames</span>
                    ) : null}
                    {project.generated_videos?.length ? (
                      <span>{project.generated_videos.length} videos</span>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Choose how you want to start your ad project</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                placeholder="My Ad Project"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Start From</Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    newProjectType === 'video_analysis'
                      ? 'border-primary bg-primary/10'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setNewProjectType('video_analysis')}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Video className="w-4 h-4 text-primary" />
                    Clone an Ad
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Analyze an existing video ad and recreate it with AI
                  </p>
                </button>

                <button
                  type="button"
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    newProjectType === 'script_idea'
                      ? 'border-primary bg-primary/10'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setNewProjectType('script_idea')}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <FileText className="w-4 h-4 text-primary" />
                    Script from Idea
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Describe your concept and AI will create the storyboard
                  </p>
                </button>

                <button
                  type="button"
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    newProjectType === 'manual' ? 'border-primary bg-primary/10' : 'hover:border-primary/50'
                  }`}
                  onClick={() => setNewProjectType('manual')}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Pencil className="w-4 h-4 text-primary" />
                    Manual Start
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Go directly to storyboard with your own prompts
                  </p>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{projectToDelete?.name}&quot; and all its assets. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StandardToolPage>
  );
}
