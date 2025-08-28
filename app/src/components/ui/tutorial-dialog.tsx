'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlayCircle, X } from 'lucide-react';
import { createClient } from '@/app/supabase/client';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  tool_name: string;
  video_url: string;
}

interface TutorialDialogProps {
  toolName: string;
  children?: React.ReactNode;
}

export function TutorialDialog({ toolName, children }: TutorialDialogProps) {
  const [open, setOpen] = useState(false);
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [loading, setLoading] = useState(false);

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Fetch tutorial when dialog opens
  useEffect(() => {
    if (open && toolName && !tutorial) {
      fetchTutorial();
    }
  }, [open, toolName]);

  const fetchTutorial = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .eq('tool_name', toolName)
        .single();

      if (error) {
        console.error('Error fetching tutorial:', error);
      } else {
        setTutorial(data);
      }
    } catch (err) {
      console.error('Failed to fetch tutorial:', err);
    } finally {
      setLoading(false);
    }
  };

  const videoId = tutorial?.video_url ? getYouTubeVideoId(tutorial.video_url) : null;

  // Default trigger button if no children provided
  const triggerButton = children || (
    <Button 
      variant="ghost" 
      size="sm" 
      className="gap-1.5"
    >
      <PlayCircle className="h-4 w-4" />
      <span>Tutorial</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton}
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {tutorial?.title || `${toolName} Tutorial`}
          </DialogTitle>
          {tutorial?.description && (
            <DialogDescription className="text-sm text-muted-foreground mt-2">
              {tutorial.description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="mt-4">
          {loading ? (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Loading tutorial...</p>
              </div>
            </div>
          ) : videoId ? (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                title={tutorial?.title || 'Tutorial'}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : tutorial ? (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <X className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Invalid video URL</p>
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <PlayCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No tutorial available for {toolName}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}