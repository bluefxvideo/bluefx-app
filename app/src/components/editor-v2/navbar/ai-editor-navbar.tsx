'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Download,
  Save,
  Undo,
  Redo,
  Settings,
  Sparkles
} from 'lucide-react';
import { useAIVideoEditorStore } from '../store/use-ai-video-editor-store';
import { useAIEditorContext } from '../context/ai-editor-context';
import { cn } from '@/lib/utils';

export function AIEditorNavbar() {
  const {
    project,
    timeline,
    composition,
    ai_operations,
    play,
    pause,
    saveProject,
    createProject
  } = useAIVideoEditorStore();
  
  const { togglePlayback, seekToFrame } = useAIEditorContext();
  
  const handleProjectNameChange = (name: string) => {
    if (name.trim()) {
      createProject(name.trim());
    }
  };
  
  const handleSave = async () => {
    await saveProject();
  };
  
  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Exporting video...');
  };
  
  const handleSeekBackward = () => {
    const newFrame = Math.max(0, timeline.currentFrame - 30); // Go back 1 second
    seekToFrame(newFrame);
  };
  
  const handleSeekForward = () => {
    const maxFrame = composition?.composition.durationInFrames || 0;
    const newFrame = Math.min(maxFrame, timeline.currentFrame + 30); // Go forward 1 second
    seekToFrame(newFrame);
  };
  
  return (
    <nav className="flex h-14 items-center justify-between border-b border-border/80 bg-background px-4">
      {/* Left Section - Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-cyan-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold">AI Video Editor</span>
        </div>
        
        <div className="h-6 w-px bg-border/80" />
        
        <div className="flex items-center gap-2">
          <Input
            value={project.name}
            onChange={(e) => handleProjectNameChange(e.target.value)}
            className="h-8 w-48 border-0 bg-transparent text-sm font-medium focus-visible:bg-muted focus-visible:ring-1"
            placeholder="Project name..."
          />
          {ai_operations.isGenerating || ai_operations.isRegenerating ? (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              AI Working...
            </div>
          ) : null}
        </div>
      </div>
      
      {/* Center Section - Playback Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSeekBackward}
          disabled={timeline.currentFrame <= 0}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={togglePlayback}
          className={cn(
            "h-9 w-9",
            timeline.isPlaying && "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {timeline.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleSeekForward}
          disabled={timeline.currentFrame >= (composition?.composition.durationInFrames || 0)}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        
        {/* Timeline Indicator */}
        <div className="ml-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{Math.floor((timeline.currentFrame || 0) / (composition?.composition.fps || 30))}s</span>
          <span>/</span>
          <span>{Math.floor((composition?.composition.durationInFrames || 0) / (composition?.composition.fps || 30))}s</span>
        </div>
      </div>
      
      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="text-muted-foreground"
        >
          <Undo className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="text-muted-foreground"
        >
          <Redo className="h-4 w-4" />
        </Button>
        
        <div className="h-6 w-px bg-border/80" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className="text-muted-foreground hover:text-foreground"
        >
          <Save className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
        >
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}