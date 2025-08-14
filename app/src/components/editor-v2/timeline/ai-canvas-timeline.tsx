'use client';

import { useEffect, useRef, useState } from 'react';
import { useAIVideoEditorStore } from '../store/use-ai-video-editor-store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Play, Pause } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { timeMsToUnits, unitsToTimeMs } from '@designcombo/timeline';
import { dispatch, filter, subject } from '@designcombo/events';
import { TIMELINE_BOUNDING_CHANGED, TIMELINE_PREFIX } from '@designcombo/timeline';
import { DESIGN_LOAD, LAYER_PREFIX, LAYER_SELECTION } from '@designcombo/state';
import { AITimeline, AIText, AIImage, AIVideo, AIAudio } from './items';
import { getStateManagerBridge, initializeStateManager } from '../adapters/designcombo-state-manager';
import StateManager from '@designcombo/state';
import { AITrackItemAdapter } from '../adapters/ai-track-item-adapter';
import AITimelineRuler from './ruler';
import AITimelinePlayhead from './playhead';
import AITimelineHeader from './header';
import { useAIEditorContext } from '../context/ai-editor-context';
import { ITrackItem } from '@designcombo/types';

// Register timeline items - following research pattern
AITimeline.registerItems({
  Text: AIText,
  Image: AIImage,
  Video: AIVideo,
  Audio: AIAudio,
});

const EMPTY_SIZE = { width: 0, height: 0 };
const TIMELINE_OFFSET_CANVAS_LEFT = 40;
const TIMELINE_OFFSET_CANVAS_RIGHT = 40;

interface AICanvasTimelineProps {
  onSelectionChange?: (selectedItem: ITrackItem | null) => void;
}

export function AICanvasTimeline({ onSelectionChange }: AICanvasTimelineProps = {}) {
  const canScrollRef = useRef(false);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<AITimeline | null>(null);
  const verticalScrollbarVpRef = useRef<HTMLDivElement>(null);
  const horizontalScrollbarVpRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(EMPTY_SIZE);
  const [size, setSize] = useState<{ width: number; height: number }>(EMPTY_SIZE);
  const stateManagerBridgeRef = useRef<ReturnType<typeof getStateManagerBridge> | null>(null);
  const minimalStateManagerRef = useRef<StateManager | null>(null);
  
  // Selection state for properties panel
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [selectedTrackItem, setSelectedTrackItem] = useState<ITrackItem | null>(null);
  const [trackItemsMap, setTrackItemsMap] = useState<Record<string, ITrackItem>>({});

  const {
    composition,
    timeline,
    setCurrentFrame,
    setZoom,
    play,
    pause,
    isInitialized
  } = useAIVideoEditorStore();

  // Get player controls from context
  const { playerRef, togglePlayback, seekToFrame } = useAIEditorContext();

  // Sync with player state
  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      console.log('No player ref available for sync');
      return;
    }

    console.log('Setting up player event listeners');

    const handlePlay = () => {
      console.log('Player started playing');
      play();
    };
    const handlePause = () => {
      console.log('Player paused');
      pause();
    };
    const handleFrameUpdate = () => {
      const currentFrame = player.getCurrentFrame();
      setCurrentFrame(currentFrame);
      // Only log every 30 frames to avoid spam
      if (currentFrame % 30 === 0) {
        console.log('Frame update:', currentFrame);
      }
    };

    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('frameupdate', handleFrameUpdate);

    return () => {
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
      player.removeEventListener('frameupdate', handleFrameUpdate);
    };
  }, [playerRef, play, pause, setCurrentFrame]);

  // Create minimal state manager for Timeline constructor
  useEffect(() => {
    if (!minimalStateManagerRef.current) {
      minimalStateManagerRef.current = new StateManager({
        size: {
          width: 1920,
          height: 1080,
        },
        fps: 30,
      });
    }
  }, []);

  const onScroll = (v: { scrollTop: number; scrollLeft: number }) => {
    if (horizontalScrollbarVpRef.current && verticalScrollbarVpRef.current) {
      verticalScrollbarVpRef.current.scrollTop = -v.scrollTop;
      horizontalScrollbarVpRef.current.scrollLeft = -v.scrollLeft;
      setScrollLeft(-v.scrollLeft);
    }
  };

  const onResizeCanvas = (payload: { width: number; height: number }) => {
    setCanvasSize({
      width: payload.width,
      height: payload.height,
    });
  };

  // Initialize canvas timeline
  useEffect(() => {
    const canvasEl = canvasElRef.current;
    const timelineContainerEl = timelineContainerRef.current;
    const minimalStateManager = minimalStateManagerRef.current;

    if (!canvasEl || !timelineContainerEl || !composition || !minimalStateManager) return;

    const containerWidth = timelineContainerEl.clientWidth - 40;
    const containerHeight = Math.max(200, timelineContainerEl.clientHeight - 120); // Ensure minimum height for timeline items
    const duration = (composition.composition.durationInFrames / composition.composition.fps) * 1000;

    const canvas = new AITimeline(canvasEl, {
      width: containerWidth,
      height: containerHeight,
      bounding: {
        width: containerWidth,
        height: 0,
      },
      selectionColor: "rgba(0, 216, 214, 0.1)",
      selectionBorderColor: "rgba(0, 216, 214, 1.0)",
      onScroll,
      onResizeCanvas,
      scale: { zoom: timeline.zoom, unit: 1000, segments: 5 },
      state: minimalStateManager,
      duration,
      spacing: {
        left: TIMELINE_OFFSET_CANVAS_LEFT,
        right: TIMELINE_OFFSET_CANVAS_RIGHT,
      },
      sizesMap: {
        text: 32,
        audio: 36,
        image: 40,
        video: 40,
        caption: 32,
      },
      itemTypes: [
        "text",
        "image",
        "audio", 
        "video",
        "caption",
        "helper",
        "track",
      ],
      acceptsMap: {
        text: ["text", "caption"],
        image: ["image", "video"],
        video: ["video", "image"],
        audio: ["audio"],
        main: ["video", "image", "audio", "text", "caption"],
      },
      guideLineColor: "#ffffff",
    });

    canvasRef.current = canvas;

    // Load composition data into timeline using StateManager
    if (composition.sequences.length > 0) {
      console.log('Original AI sequences:', composition.sequences);
      
      // Use StateManager to load data instead of direct timeline methods
      const stateManager = minimalStateManagerRef.current;
      if (stateManager) {
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
          
          // Store trackItemsMap locally for selection handling
          setTrackItemsMap(trackItemsMap);
          
          // Load items via StateManager using research format
          const designData = {
            trackItems: dcItems,
            trackItemsMap: trackItemsMap,
            trackItemIds: trackItemIds,
            activeIds: [],
            tracks: [],
            transitionsMap: {},
            transitionIds: []
          };
          
          console.log('Loading design data:', designData);
          
          // Load data using global dispatch (like research version)
          dispatch(DESIGN_LOAD, { payload: designData });
          
        } catch (error) {
          console.error('Failed to load timeline data via StateManager:', error);
        }
      }
    }

    // Show composition data as simple timeline items for now
    console.log('Timeline initialized. Composition sequences:', composition.sequences);

    setCanvasSize({ width: containerWidth, height: containerHeight });
    setSize({
      width: containerWidth,
      height: 0,
    });

    return () => {
      canvas.purge();
    };
  }, [composition, isInitialized, timeline.zoom]);

  
  // Handle play/pause using actual Remotion player
  const handlePlayPause = () => {
    console.log('Play/Pause clicked. Current state:', timeline.isPlaying);
    console.log('Player ref:', playerRef.current);
    
    togglePlayback(); // Use the actual player controls
    
    // Update store state to reflect player state
    if (timeline.isPlaying) {
      console.log('Pausing...');
      pause();
    } else {
      console.log('Playing...');
      play();
    }
  };

  // Timeline should be driven by external player, not internal state
  // Remove our custom playback - @designcombo expects to follow a player
  // TODO: Integrate with Remotion player for proper timeline sync

  // Handle zoom changes
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
    if (canvasRef.current) {
      canvasRef.current.setScale({ zoom: value[0] });
    }
  };

  // Handle horizontal scroll
  const handleOnScrollH = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (canScrollRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.scrollTo({ scrollLeft });
      }
    }
    setScrollLeft(scrollLeft);
  };

  // Handle vertical scroll
  const handleOnScrollV = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (canScrollRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.scrollTo({ scrollTop });
      }
    }
  };

  // Handle ruler click - seek to frame
  const onClickRuler = (units: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !composition) return;

    const time = unitsToTimeMs(units, timeline.zoom);
    const frame = Math.floor((time * composition.composition.fps) / 1000);
    
    console.log('Ruler clicked, seeking to frame:', frame);
    // Seek both the player and update store
    seekToFrame(frame);
    setCurrentFrame(frame);
  };

  // Handle ruler scroll
  const onRulerScroll = (newScrollLeft: number) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.scrollTo({ scrollLeft: newScrollLeft });
    }

    if (horizontalScrollbarVpRef.current) {
      horizontalScrollbarVpRef.current.scrollLeft = newScrollLeft;
    }

    setScrollLeft(newScrollLeft);
  };

  // Listen for timeline bounding changes
  useEffect(() => {
    const addEvents = subject.pipe(
      filter(({ key }) => key.startsWith(TIMELINE_PREFIX)),
    );

    const subscription = addEvents.subscribe((obj) => {
      if (obj.key === TIMELINE_BOUNDING_CHANGED) {
        const bounding = obj.value?.payload?.bounding;
        if (bounding) {
          setSize({
            width: bounding.width,
            height: bounding.height,
          });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Listen for selection events from @designcombo/state
  useEffect(() => {
    const selectionEvents = subject.pipe(
      filter(({ key }) => key.startsWith(LAYER_PREFIX)),
    );

    const selectionSubscription = selectionEvents.subscribe((obj) => {
      if (obj.key === LAYER_SELECTION) {
        const newActiveIds = obj.value?.payload?.activeIds || [];
        console.log('Selection event received:', newActiveIds);
        setActiveIds(newActiveIds);
        
        // Update selected track item for properties panel
        if (newActiveIds.length === 1) {
          const itemId = newActiveIds[0];
          const trackItem = trackItemsMap[itemId];
          if (trackItem) {
            console.log('Selected track item:', trackItem);
            setSelectedTrackItem(trackItem);
            onSelectionChange?.(trackItem);
          } else {
            setSelectedTrackItem(null);
            onSelectionChange?.(null);
          }
        } else {
          setSelectedTrackItem(null);
          onSelectionChange?.(null);
        }
      }
    });
    
    return () => {
      selectionSubscription.unsubscribe();
    };
  }, [trackItemsMap]);

  if (!composition) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/50">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            No composition loaded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">

      {/* Canvas Timeline Container */}
      <div
        ref={timelineContainerRef}
        id="ai-timeline-container"
        className="relative h-full w-full overflow-hidden bg-muted"
      >
        <AITimelineHeader />
        <AITimelineRuler
          onClick={onClickRuler}
          scrollLeft={scrollLeft}
          onScroll={onRulerScroll}
          zoom={timeline.zoom}
          duration={composition.composition.durationInFrames / composition.composition.fps}
        />
        <AITimelinePlayhead 
          scrollLeft={scrollLeft} 
          currentFrame={timeline.currentFrame}
          totalFrames={composition.composition.durationInFrames}
          zoom={timeline.zoom}
          onSeek={(frame) => {
            console.log('Seeking to frame:', frame);
            seekToFrame(frame);
            setCurrentFrame(frame);
          }}
        />


        <div className="flex">
          <div
            style={{ width: TIMELINE_OFFSET_CANVAS_LEFT }}
            className="relative flex-none"
          />
          <div style={{ height: Math.max(canvasSize.height, 200), minHeight: '200px' }} className="relative flex-1">
            <div
              style={{ height: Math.max(canvasSize.height, 200), minHeight: '200px' }}
              ref={containerRef}
              className="absolute top-0 w-full"
            >
              <canvas id="ai-timeline-canvas" ref={canvasElRef} />
            </div>

            {/* Horizontal Scrollbar */}
            <ScrollAreaPrimitive.Root
              type="always"
              style={{
                position: "absolute",
                width: "calc(100vw - 40px)",
                height: "10px",
              }}
              className="ScrollAreaRootH"
              onPointerDown={() => {
                canScrollRef.current = true;
              }}
              onPointerUp={() => {
                canScrollRef.current = false;
              }}
            >
              <ScrollAreaPrimitive.Viewport
                onScroll={handleOnScrollH}
                className="ScrollAreaViewport"
                id="viewportH"
                ref={horizontalScrollbarVpRef}
              >
                <div
                  style={{
                    width:
                      size.width > canvasSize.width
                        ? size.width + TIMELINE_OFFSET_CANVAS_RIGHT
                        : size.width,
                  }}
                  className="pointer-events-none h-[10px]"
                />
              </ScrollAreaPrimitive.Viewport>

              <ScrollAreaPrimitive.Scrollbar
                className="ScrollAreaScrollbar"
                orientation="horizontal"
              >
                <ScrollAreaPrimitive.Thumb
                  onMouseDown={() => {
                    canScrollRef.current = true;
                  }}
                  onMouseUp={() => {
                    canScrollRef.current = false;
                  }}
                  className="ScrollAreaThumb"
                />
              </ScrollAreaPrimitive.Scrollbar>
            </ScrollAreaPrimitive.Root>

            {/* Vertical Scrollbar */}
            <ScrollAreaPrimitive.Root
              type="always"
              style={{
                position: "absolute",
                height: canvasSize.height,
                width: "10px",
              }}
              className="ScrollAreaRootV"
            >
              <ScrollAreaPrimitive.Viewport
                onScroll={handleOnScrollV}
                className="ScrollAreaViewport"
                ref={verticalScrollbarVpRef}
              >
                <div
                  style={{
                    height:
                      size.height > canvasSize.height
                        ? size.height + 40
                        : canvasSize.height,
                  }}
                  className="pointer-events-none w-[10px]"
                />
              </ScrollAreaPrimitive.Viewport>
              <ScrollAreaPrimitive.Scrollbar
                className="ScrollAreaScrollbar"
                orientation="vertical"
              >
                <ScrollAreaPrimitive.Thumb
                  onMouseDown={() => {
                    canScrollRef.current = true;
                  }}
                  onMouseUp={() => {
                    canScrollRef.current = false;
                  }}
                  className="ScrollAreaThumb"
                />
              </ScrollAreaPrimitive.Scrollbar>
            </ScrollAreaPrimitive.Root>
          </div>
        </div>
      </div>

      {/* Timeline Footer */}
      <div className="border-t border-border/80 p-2 relative z-20 bg-background">
        <div className="flex items-center justify-between">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePlayPause}
              className="h-8 w-8 p-0 relative z-10"
              style={{ pointerEvents: 'auto' }}
            >
              {timeline.isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <div className="text-xs text-muted-foreground">
              Frame: {typeof timeline.currentFrame === 'number' ? timeline.currentFrame : 0} / {composition.composition.durationInFrames || 0}
            </div>
          </div>

          {/* Timeline Info */}
          <div className="text-xs text-muted-foreground">
            {Math.floor((typeof timeline.currentFrame === 'number' ? timeline.currentFrame : 0) / (composition.composition.fps || 30))}s / {Math.floor((composition.composition.durationInFrames || 0) / (composition.composition.fps || 30))}s
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleZoomChange([Math.max(0.1, timeline.zoom - 0.2)])}
              className="h-8 w-8 p-0"
              disabled={timeline.zoom <= 0.1}
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
              {Math.round(timeline.zoom * 100)}%
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleZoomChange([Math.min(5, timeline.zoom + 0.2)])}
              className="h-8 w-8 p-0"
              disabled={timeline.zoom >= 5}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}