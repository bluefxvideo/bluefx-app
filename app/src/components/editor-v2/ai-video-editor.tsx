'use client';

import { useEffect, useRef, useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ImperativePanelHandle } from 'react-resizable-panels';
import { AIEditorNavbar } from './navbar/ai-editor-navbar';
import { AIAssetPanel } from './panels/ai-asset-panel';
import { AIScenePanel } from './panels/ai-scene-panel';
import { AITimelinePanel } from './panels/ai-timeline-panel';
import { AIControlPanel } from './panels/ai-control-panel';
import { useAIVideoEditorStore } from './store/use-ai-video-editor-store';
import { AIEditorProvider } from './context/ai-editor-context';

/**
 * AI Video Editor - Main Layout Component
 * Follows React Video Editor patterns with AI enhancements
 */
export function AIVideoEditor() {
  const timelinePanelRef = useRef<ImperativePanelHandle>(null);
  const [loaded, setLoaded] = useState(false);
  
  const { 
    project,
    initializeEditor,
    isInitialized 
  } = useAIVideoEditorStore();

  useEffect(() => {
    const initialize = async () => {
      await initializeEditor({
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 30000 // 30 seconds default
      });
      setLoaded(true);
    };
    
    initialize();
  }, [initializeEditor]);

  useEffect(() => {
    // Auto-resize timeline to reasonable height
    const screenHeight = window.innerHeight;
    const desiredHeight = 300;
    const percentage = (desiredHeight / screenHeight) * 100;
    
    if (timelinePanelRef.current) {
      timelinePanelRef.current.resize(percentage);
    }
  }, [loaded]);

  if (!isInitialized || !loaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Initializing AI Video Editor...</p>
        </div>
      </div>
    );
  }

  return (
    <AIEditorProvider>
      <div className="flex h-screen w-screen flex-col bg-background">
        {/* Top Navigation Bar */}
        <AIEditorNavbar />
        
        {/* Main Editor Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - AI Assets & Menu */}
          <div className="flex flex-none border-r border-border/80 bg-muted/50 h-[calc(100vh-56px)]">
            <AIAssetPanel />
          </div>

          {/* Center - Scene & Timeline */}
          <ResizablePanelGroup 
            direction="vertical" 
            className="flex-1"
          >
            {/* Scene/Preview Panel */}
            <ResizablePanel 
              className="relative min-h-[200px]" 
              defaultSize={70}
            >
              <AIScenePanel />
            </ResizablePanel>

            <ResizableHandle className="border-border/80" />

            {/* Timeline Panel */}
            <ResizablePanel
              className="min-h-[150px]"
              ref={timelinePanelRef}
              defaultSize={30}
            >
              <AITimelinePanel />
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* Right Sidebar - AI Controls */}
          <div className="w-80 flex-none border-l border-border/80 bg-muted/50">
            <AIControlPanel />
          </div>
        </div>
      </div>
    </AIEditorProvider>
  );
}