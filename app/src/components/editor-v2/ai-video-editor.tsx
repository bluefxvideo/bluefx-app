'use client';

import { useEffect, useRef, useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ImperativePanelHandle } from 'react-resizable-panels';
import { AIEditorNavbar } from './navbar/ai-editor-navbar';
import { AIAssetPanel } from './panels/ai-asset-panel';
import { AIScenePanel } from './panels/ai-scene-panel';
import { useAIVideoEditorStore } from './store/use-ai-video-editor-store';
import { AIEditorProvider } from './context/ai-editor-context';
import StateManager, { DESIGN_LOAD } from "@designcombo/state";
import { dispatch } from "@designcombo/events";
import { AITrackItemAdapter } from './adapters/ai-track-item-adapter';
import useTimelineEvents from './hooks/use-timeline-events';
import ResearchTimeline from './timeline/research-timeline';
import { ResearchControlItem } from './control-item/research-control-item';
import useEditorStore from './store/use-editor-store';

// Create StateManager instance like research does
const stateManager = new StateManager({
	size: {
		width: 1920,
		height: 1080,
	},
});

/**
 * AI Video Editor - Main Layout Component  
 * Follows Research Video Editor architecture exactly
 */
export function AIVideoEditor() {
  const timelinePanelRef = useRef<ImperativePanelHandle>(null);
  const [loaded, setLoaded] = useState(false);
  
  // Use timeline events hook like research
  useTimelineEvents();
  
  const { 
    composition,
    initializeEditor,
    loadMockData,
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
      
      // Load some mock data for testing
      loadMockData();
      
      setLoaded(true);
    };
    
    initialize();
  }, [initializeEditor, loadMockData]);

  useEffect(() => {
    // Auto-resize timeline to reasonable height
    const screenHeight = window.innerHeight;
    const desiredHeight = 400; // Increased height
    const percentage = Math.max(40, (desiredHeight / screenHeight) * 100); // Minimum 40%
    
    if (timelinePanelRef.current) {
      timelinePanelRef.current.resize(percentage);
    }
  }, [loaded]);

  // Load composition data into StateManager like research does
  useEffect(() => {
    if (composition && composition.sequences.length > 0) {
      console.log('Loading AI composition into StateManager:', composition);
      
      try {
        // Convert AI sequences to @designcombo format
        const dcItems = AITrackItemAdapter.toDesignComboItems(composition);
        
        // Create trackItemsMap from the array
        const trackItemsMap: Record<string, any> = {};
        const trackItemIds: string[] = [];
        
        dcItems.forEach(item => {
          trackItemsMap[item.id] = item;
          trackItemIds.push(item.id);
        });
        
        // Load data using StateManager like research does
        const designData = {
          trackItems: dcItems,
          trackItemsMap: trackItemsMap,
          trackItemIds: trackItemIds,
          activeIds: [],
          tracks: [],
          transitionsMap: {},
          transitionIds: [],
          duration: (composition.composition.durationInFrames / composition.composition.fps) * 1000,
        };
        
        console.log('Loading design data into StateManager:', designData);
        console.log('TrackItems details:', dcItems.map(item => ({
          id: item.id,
          type: item.type,
          text: item.text,
          display: item.display,
          tScale: item.tScale
        })));
        
        // Use dispatch like research does
        dispatch(DESIGN_LOAD, { payload: designData });
        
      } catch (error) {
        console.error('Failed to load timeline data into StateManager:', error);
      }
    }
  }, [composition]);

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
              defaultSize={60}
            >
              <AIScenePanel />
            </ResizablePanel>

            <ResizableHandle className="border-border/80" />

            {/* Timeline Panel */}
            <ResizablePanel
              className="min-h-[300px]"
              ref={timelinePanelRef}
              defaultSize={40}
            >
              <ResearchTimeline stateManager={stateManager} />
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* Right Sidebar - Properties Panel using research component */}
          <ResearchControlItem />
        </div>
      </div>
    </AIEditorProvider>
  );
}