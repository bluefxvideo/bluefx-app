'use client';

import { useVideoEditorStore } from '../store/video-editor-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Debug Panel - Shows current store state and provides test buttons
 * Remove this in production
 */
export function DebugPanel() {
  const {
    // State
    segments,
    timeline,
    project,
    // Actions
    play,
    pause,
    seek
  } = useVideoEditorStore();

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-black/90 text-white border-gray-600">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <strong>Segments:</strong> {segments.length}
        </div>
        <div>
          <strong>Duration:</strong> {project.duration}s
        </div>
        <div>
          <strong>Current Time:</strong> {timeline.current_time.toFixed(2)}s
        </div>
        <div>
          <strong>Playing:</strong> {timeline.is_playing ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Status:</strong> {project.status}
        </div>
        
        <div className="flex gap-1 pt-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 text-xs"
            onClick={play}
          >
            Play
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 text-xs"
            onClick={pause}
          >
            Pause
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 text-xs"
            onClick={() => seek(5)}
          >
            Seek 5s
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}