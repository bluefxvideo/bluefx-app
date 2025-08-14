'use client';

import { useEffect, useRef, useState } from 'react';
import { useAIVideoEditorStore } from '../store/use-ai-video-editor-store';
import { useAIEditorContext } from '../context/ai-editor-context';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Play, Pause } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

export function AITimelinePanel() {
  const {
    composition,
    timeline,
    setCurrentFrame,
    setZoom,
    selectItems,
    clearSelection,
    selectCaptionSegment,
    clearCaptionSegmentSelection
  } = useAIVideoEditorStore();
  
  const { seekToFrame, togglePlayback } = useAIEditorContext();
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
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
  
  const { durationInFrames, fps } = composition.composition;
  const totalSeconds = Math.ceil(durationInFrames / fps);
  
  // Timeline ruler markers (every second)
  const rulerMarkers = Array.from({ length: totalSeconds + 1 }, (_, i) => ({
    frame: i * fps,
    second: i,
    position: (i / totalSeconds) * 100
  }));
  
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineContainerRef.current) return;
    
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineWidth = rect.width;
    const progress = clickX / timelineWidth;
    const targetFrame = Math.floor(progress * durationInFrames);
    
    setCurrentFrame(Math.max(0, Math.min(durationInFrames - 1, targetFrame)));
    seekToFrame(targetFrame);
  };
  
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };
  
  const playheadPosition = (timeline.currentFrame / durationInFrames) * 100;
  
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Timeline Header */}
      <div className="border-b border-border/80 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Timeline</h3>
            <span className="text-xs text-muted-foreground">
              {composition.sequences.length} item{composition.sequences.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Playback Controls */}
            <Button
              size="sm"
              variant="outline"
              onClick={togglePlayback}
            >
              {timeline.isPlaying ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setZoom(Math.max(0.1, timeline.zoom - 0.1))}
                disabled={timeline.zoom <= 0.1}
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              
              <Slider
                value={[timeline.zoom]}
                onValueChange={handleZoomChange}
                min={0.1}
                max={3}
                step={0.1}
                className="w-20"
              />
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setZoom(Math.min(3, timeline.zoom + 0.1))}
                disabled={timeline.zoom >= 3}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              
              <span className="text-xs text-muted-foreground min-w-[40px]">
                {Math.round(timeline.zoom * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Timeline Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            {/* Time Ruler */}
            <div className="relative mb-4 h-8 bg-muted rounded">
              <div 
                ref={timelineContainerRef}
                className="relative h-full cursor-pointer"
                onClick={handleTimelineClick}
              >
                {/* Ruler Markers */}
                {rulerMarkers.map((marker) => (
                  <div
                    key={marker.frame}
                    className="absolute top-0 h-full border-l border-border"
                    style={{ left: `${marker.position}%` }}
                  >
                    <div className="mt-1 ml-1 text-xs text-muted-foreground">
                      {marker.second}s
                    </div>
                  </div>
                ))}
                
                {/* Playhead */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-blue-500 z-10"
                  style={{ left: `${playheadPosition}%` }}
                >
                  <div className="absolute -top-1 -left-2 h-3 w-4 bg-blue-500 rounded-t" />
                </div>
              </div>
            </div>
            
            {/* Timeline Tracks */}
            <div className="space-y-2">
              {composition.sequences.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-muted-foreground">
                    <p className="mb-2">Timeline is empty</p>
                    <p className="text-sm">
                      Add content from the Asset Panel to get started
                    </p>
                  </div>
                </Card>
              ) : (
                composition.sequences.map((sequence) => {
                  const startPercent = (sequence.start / durationInFrames) * 100;
                  const widthPercent = (sequence.duration / durationInFrames) * 100;
                  const isSelected = timeline.selectedItemIds.includes(sequence.id);
                  const isCaption = sequence.type === 'caption';
                  
                  return (
                    <div key={sequence.id} className="relative">
                      {/* Track Background */}
                      <div className={`relative h-12 rounded border border-border/50 ${
                        isCaption ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'bg-muted/50'
                      }`}>
                        {/* Track Item */}
                        <div
                          className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${
                            isSelected 
                              ? 'ring-2 ring-blue-500 bg-blue-500/20' 
                              : isCaption
                                ? 'bg-amber-500/30 hover:bg-amber-500/40'
                                : sequence.ai_metadata 
                                  ? 'bg-purple-500/30 hover:bg-purple-500/40' 
                                  : 'bg-accent hover:bg-accent/80'
                          }`}
                          style={{
                            left: `${startPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                          onClick={() => {
                            if (isSelected) {
                              clearSelection();
                            } else {
                              selectItems([sequence.id]);
                            }
                          }}
                        >
                          {/* Caption segments visualization */}
                          {isCaption && sequence.caption_metadata?.segments ? (
                            <div className="relative h-full">
                              {sequence.caption_metadata.segments.map((segment: any, index: number) => {
                                const segmentStartMs = segment.start;
                                const segmentEndMs = segment.end;
                                const segmentDurationMs = segmentEndMs - segmentStartMs;
                                
                                // Calculate position within this sequence
                                const sequenceStartMs = sequence.start * 1000 / fps;
                                const sequenceDurationMs = sequence.duration * 1000 / fps;
                                
                                const segmentStartPercent = ((segmentStartMs - sequenceStartMs) / sequenceDurationMs) * 100;
                                const segmentWidthPercent = (segmentDurationMs / sequenceDurationMs) * 100;
                                
                                // Check if this segment is selected
                                const isSegmentSelected = timeline.selectedCaptionSegment?.trackId === sequence.id && timeline.selectedCaptionSegment?.segmentIndex === index;
                                
                                return (
                                  <div
                                    key={index}
                                    className={`absolute top-0 h-full border cursor-pointer transition-colors ${
                                      isSegmentSelected 
                                        ? 'border-amber-500 bg-amber-500/30 ring-1 ring-amber-500' 
                                        : 'border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20'
                                    }`}
                                    style={{
                                      left: `${Math.max(0, segmentStartPercent)}%`,
                                      width: `${Math.min(100 - Math.max(0, segmentStartPercent), segmentWidthPercent)}%`
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Select this specific caption segment
                                      selectCaptionSegment(sequence.id, index);
                                      // Jump to segment start time
                                      setCurrentFrame(Math.floor(segmentStartMs * fps / 1000));
                                    }}
                                  >
                                    <div className="flex h-full items-center px-1">
                                      <div className="text-xs font-medium truncate text-amber-700">
                                        {segment.text?.substring(0, 15)}...
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* Overall track info */}
                              <div className="absolute right-1 top-1 text-xs text-amber-600">
                                💬 {sequence.caption_metadata.segments.length}
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-full items-center px-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium truncate">
                                  {isCaption
                                    ? `"${sequence.details.text?.substring(0, 25)}${sequence.details.text?.length > 25 ? '...' : ''}"`
                                    : sequence.details.text || 
                                      (sequence.details.src ? `${sequence.type} asset` : sequence.type)
                                  }
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {isCaption && sequence.caption_metadata?.words
                                    ? `${sequence.caption_metadata.words.length} words`
                                    : `${Math.round(sequence.duration / fps * 10) / 10}s`
                                  }
                                </div>
                              </div>
                              
                              {/* Caption Indicator */}
                              {isCaption && (
                                <div className="ml-1 text-xs text-amber-600">
                                  💬
                                </div>
                              )}
                              
                              {/* AI Indicator */}
                              {sequence.ai_metadata && (
                                <div className="ml-1 text-xs text-purple-400">
                                  ✨
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Track Label */}
                      <div className="absolute left-0 top-0 -ml-16 flex h-12 w-14 items-center justify-end pr-2">
                        <span className="text-xs font-medium text-muted-foreground capitalize">
                          {sequence.type}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
      
      {/* Timeline Footer */}
      <div className="border-t border-border/80 p-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Frame: {timeline.currentFrame} / {durationInFrames}
          </span>
          <span>
            {Math.floor(timeline.currentFrame / fps)}s / {Math.floor(durationInFrames / fps)}s
          </span>
        </div>
      </div>
    </div>
  );
}