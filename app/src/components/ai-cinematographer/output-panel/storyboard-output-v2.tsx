'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  LayoutGrid,
  Download,
  RefreshCw,
  Check,
  Loader2,
  Film,
  X,
  Upload,
  Scissors,
  ZoomIn,
  Grid2X2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useGridExtraction, ExtractedFrameResult } from '../hooks/use-grid-extraction';

export interface StoryboardResult {
  id: string;
  grid_image_url: string;
  prompt: string;
  visual_style: string;
  frame_aspect_ratio?: '16:9' | '9:16';
  created_at: string;
}

interface StoryboardOutputV2Props {
  isGenerating: boolean;
  storyboardResult?: StoryboardResult;
  projectId?: string; // For saving to ad_projects
  userId?: string; // For credit deduction during extraction
  gridConfig?: { columns: number; rows: number };
  onRegenerateGrid: () => void;
  onMakeVideo: (imageUrl: string, frameNumber: number) => void;
  onDownload: (imageUrl: string, filename: string) => void;
  onUploadGrid?: (file: File) => void;
  onFramesExtracted?: (frames: ExtractedFrameResult[]) => void;
  onOpenInEditor?: (projectId: string, frames: ExtractedFrameResult[]) => void;
  // Animation Queue
  onAddToQueue?: (items: Array<{
    frameNumber: number;
    imageUrl: string;
    prompt: string;
    dialogue?: string;
    duration: number;
    cameraStyle: 'none' | 'amateur' | 'stable' | 'cinematic';
    aspectRatio: string;
    model: 'fast' | 'pro';
    batchNumber?: number;
    sceneNumber?: number;
  }>) => void;
  analyzerShots?: Array<{
    shotNumber: number;
    description: string;
    duration: string;
    action?: string;
    dialogue?: string;
  }>;
  batchNumber?: number; // From script breakdown pipeline
}

/** Estimate minimum video duration for natural-sounding speech */
function estimateDurationFromDialogue(dialogue: string): number {
  const CHARS_PER_SECOND = 15;
  const rawSeconds = Math.ceil(dialogue.length / CHARS_PER_SECOND);
  const fastDurations = [6, 8, 10, 12, 14, 16, 18, 20];
  return fastDurations.find(d => d >= rawSeconds) || fastDurations[fastDurations.length - 1];
}

export function StoryboardOutputV2({
  isGenerating,
  storyboardResult,
  projectId,
  userId,
  gridConfig = { columns: 3, rows: 3 },
  onRegenerateGrid,
  onMakeVideo,
  onDownload,
  onUploadGrid,
  onFramesExtracted,
  onOpenInEditor,
  onAddToQueue,
  analyzerShots,
  batchNumber,
}: StoryboardOutputV2Props) {
  const [selectedFrames, setSelectedFrames] = useState<number[]>([]);
  const [selectedForQueue, setSelectedForQueue] = useState<number[]>([]);
  const [regenerateGridDialogOpen, setRegenerateGridDialogOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const totalFrames = gridConfig.columns * gridConfig.rows;

  // Use the new grid extraction hook with userId for credit deduction
  const {
    isExtracting,
    extractedFrames,
    progress,
    error: extractionError,
    extractAllFrames,
    extractSelectedFrames,
    clearFrames,
  } = useGridExtraction({ gridConfig, shouldUpscale: false, userId });

  // Notify parent when frames are extracted
  useEffect(() => {
    if (extractedFrames.length > 0 && onFramesExtracted) {
      const completedFrames = extractedFrames.filter(f => f.status === 'completed');
      if (completedFrames.length > 0) {
        onFramesExtracted(completedFrames);
      }
    }
  }, [extractedFrames, onFramesExtracted]);

  // Auto-extract frames when a new storyboard grid is generated
  const hasAutoExtracted = useRef(false);
  useEffect(() => {
    if (
      storyboardResult?.grid_image_url &&
      projectId &&
      !isExtracting &&
      extractedFrames.length === 0 &&
      !hasAutoExtracted.current
    ) {
      hasAutoExtracted.current = true;
      extractAllFrames(storyboardResult.grid_image_url, projectId, undefined, {
        prompt: storyboardResult.prompt,
        aspectRatio: storyboardResult.frame_aspect_ratio || '16:9',
        batchNumber,
      });
    }
    // Reset when storyboard result changes (new generation)
    if (!storyboardResult?.grid_image_url) {
      hasAutoExtracted.current = false;
    }
  }, [storyboardResult?.grid_image_url, projectId, isExtracting, extractedFrames.length, extractAllFrames]);

  // Auto-add completed frames to animation queue
  const hasAutoAddedToQueue = useRef(false);
  useEffect(() => {
    if (
      extractedFrames.length > 0 &&
      !isExtracting &&
      onAddToQueue &&
      !hasAutoAddedToQueue.current
    ) {
      const completedFrames = extractedFrames.filter(f => f.status === 'completed');
      if (completedFrames.length === totalFrames) {
        hasAutoAddedToQueue.current = true;
        const framesToAdd = completedFrames.map(frame => {
          const shotData = analyzerShots?.[frame.frameNumber - 1];
          const durationMatch = shotData?.duration?.match(/(\d+\.?\d*)/);
          const shotSeconds = durationMatch ? parseFloat(durationMatch[1]) : 6;
          // Use dialogue length for duration estimate, fall back to shot duration hint
          const suggestedDuration = shotData?.dialogue
            ? estimateDurationFromDialogue(shotData.dialogue)
            : (shotSeconds > 7 ? 10 : 6);

          return {
            frameNumber: frame.frameNumber,
            imageUrl: frame.upscaledUrl || frame.originalUrl,
            prompt: shotData?.action || shotData?.description || '',
            dialogue: shotData?.dialogue,
            includeDialogue: false,
            duration: suggestedDuration,
            cameraStyle: 'none' as const,
            aspectRatio: '16:9',
            model: 'fast' as const,
            batchNumber,
            sceneNumber: shotData?.shotNumber,
          };
        });
        onAddToQueue(framesToAdd);
      }
    }
    // Reset when frames are cleared (new extraction)
    if (extractedFrames.length === 0) {
      hasAutoAddedToQueue.current = false;
    }
  }, [extractedFrames, isExtracting, totalFrames, onAddToQueue, analyzerShots, batchNumber]);

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadGrid) {
      onUploadGrid(file);
      clearFrames();
    }
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  const toggleFrame = (frameNumber: number) => {
    setSelectedFrames(prev =>
      prev.includes(frameNumber)
        ? prev.filter(f => f !== frameNumber)
        : [...prev, frameNumber]
    );
  };

  const selectAllFrames = () => {
    setSelectedFrames(Array.from({ length: totalFrames }, (_, i) => i + 1));
  };

  const clearSelection = () => {
    setSelectedFrames([]);
  };

  const handleExtractSelected = async () => {
    if (!storyboardResult?.grid_image_url || !projectId || selectedFrames.length === 0) return;

    await extractSelectedFrames(
      storyboardResult.grid_image_url,
      projectId,
      selectedFrames,
      undefined,
      {
        prompt: storyboardResult.prompt,
        aspectRatio: storyboardResult.frame_aspect_ratio || '16:9',
        batchNumber,
      }
    );
    setSelectedFrames([]);
  };

  const handleExtractAll = async () => {
    if (!storyboardResult?.grid_image_url || !projectId) return;

    await extractAllFrames(storyboardResult.grid_image_url, projectId, undefined, {
      prompt: storyboardResult.prompt,
      aspectRatio: storyboardResult.frame_aspect_ratio || '16:9',
      batchNumber,
    });
  };

  const handleDownloadGrid = () => {
    if (storyboardResult?.grid_image_url) {
      onDownload(storyboardResult.grid_image_url, `storyboard_grid_${storyboardResult.id}.png`);
    }
  };

  const handleDownloadAll = async () => {
    const completedFrames = extractedFrames.filter(f => f.status === 'completed');
    for (let i = 0; i < completedFrames.length; i++) {
      const frame = completedFrames[i];
      onDownload(
        frame.upscaledUrl || frame.originalUrl,
        `frame_${frame.frameNumber}_${frame.width}x${frame.height}.png`
      );
      // Small delay between downloads to prevent browser blocking
      if (i < completedFrames.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
  };

  const handleConfirmRegenerateGrid = () => {
    onRegenerateGrid();
    clearFrames();
    setRegenerateGridDialogOpen(false);
  };

  const getFrameLabel = (frameNumber: number) => {
    const row = Math.ceil(frameNumber / gridConfig.columns);
    const col = ((frameNumber - 1) % gridConfig.columns) + 1;
    return `R${row}C${col}`;
  };

  // Empty state
  if (!isGenerating && !storyboardResult) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10 rounded-lg border border-dashed border-muted-foreground/20">
        <div className="text-center p-8 max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
            <Grid2X2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Storyboard Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate a {gridConfig.columns}x{gridConfig.rows} cinematic storyboard grid with {totalFrames} consistent frames.
          </p>
          {onUploadGrid && (
            <>
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Existing Grid
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Upload a {gridConfig.columns}x{gridConfig.rows} grid image to extract frames
              </p>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating && !storyboardResult) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10 rounded-lg">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Generating Storyboard...</h3>
          <p className="text-sm text-muted-foreground">
            Creating your {totalFrames}-panel cinematic storyboard. This may take 30-60 seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 overflow-auto p-1">
      {/* Section 1: Generated Grid */}
      {storyboardResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Generated Storyboard ({gridConfig.columns}x{gridConfig.rows})</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadGrid}
              >
                <Download className="w-4 h-4 mr-1" />
                Download Grid
              </Button>
            </div>
          </div>

          {/* Grid Image Display */}
          <div className="relative rounded-lg overflow-hidden border bg-muted/10">
            <img
              src={storyboardResult.grid_image_url}
              alt="Storyboard Grid"
              className="w-full h-auto"
            />
            {/* Frame number overlay grid */}
            <div
              className="absolute inset-0 grid pointer-events-none"
              style={{
                gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)`,
                gridTemplateRows: `repeat(${gridConfig.rows}, 1fr)`,
              }}
            >
              {Array.from({ length: totalFrames }, (_, i) => (
                <div key={i} className="flex items-start justify-start p-1">
                  <span className="text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Frame Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Select frames to extract:</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllFrames} disabled={isExtracting}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection} disabled={isExtracting || selectedFrames.length === 0}>
                  Clear
                </Button>
              </div>
            </div>

            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${gridConfig.columns}, 1fr)` }}
            >
              {Array.from({ length: totalFrames }, (_, i) => i + 1).map((frameNum) => {
                const isExtracted = extractedFrames.some(
                  f => f.frameNumber === frameNum && f.status === 'completed'
                );
                return (
                  <button
                    key={frameNum}
                    onClick={() => toggleFrame(frameNum)}
                    disabled={isExtracting}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border transition-all text-left",
                      selectedFrames.includes(frameNum)
                        ? "border-primary bg-primary/10"
                        : isExtracted
                          ? "border-green-500/50 bg-green-500/10"
                          : "border-border hover:border-primary/50 hover:bg-muted/30",
                      isExtracting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                      selectedFrames.includes(frameNum)
                        ? "border-primary bg-primary"
                        : isExtracted
                          ? "border-green-500 bg-green-500"
                          : "border-muted-foreground/30"
                    )}>
                      {(selectedFrames.includes(frameNum) || isExtracted) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-xs font-medium">
                      {frameNum} <span className="text-muted-foreground">({getFrameLabel(frameNum)})</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedFrames.length > 0
                  ? `Selected: ${selectedFrames.length} frame${selectedFrames.length !== 1 ? 's' : ''}`
                  : `${extractedFrames.filter(f => f.status === 'completed').length}/${totalFrames} extracted`
                }
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRegenerateGridDialogOpen(true)}
                  disabled={isGenerating || isExtracting}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExtractAll}
                  disabled={isExtracting || !projectId || !userId}
                >
                  <Scissors className="w-4 h-4 mr-1" />
                  Extract All (free)
                </Button>
                <Button
                  onClick={handleExtractSelected}
                  disabled={selectedFrames.length === 0 || isExtracting || !projectId || !userId}
                  size="sm"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <ZoomIn className="w-4 h-4 mr-1" />
                      Extract Selected
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Extraction Progress */}
      {isExtracting && (
        <div className="space-y-3 p-4 rounded-lg border bg-primary/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{progress.stage}</p>
            <span className="text-xs text-muted-foreground">
              {progress.current}/{progress.total} frames
            </span>
          </div>
          <Progress value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Cropping frames to 1920×1080 (Full HD). Free — no upscaling needed.
          </p>
        </div>
      )}

      {/* Extraction Error */}
      {extractionError && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-sm">
          <X className="w-4 h-4 text-destructive" />
          <span>{extractionError}</span>
        </div>
      )}

      {/* Section 3: Extracted Frames Gallery */}
      {extractedFrames.filter(f => f.status === 'completed').length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold">
              Extracted Frames ({extractedFrames.filter(f => f.status === 'completed').length})
            </h3>
            <div className="flex gap-2 flex-wrap">
              {/* Add to Queue button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const completedFrames = extractedFrames.filter(f => f.status === 'completed');

                  const framesToAdd = (selectedForQueue.length > 0
                    ? completedFrames.filter(f => selectedForQueue.includes(f.frameNumber))
                    : completedFrames
                  ).map(frame => {
                    // Match shot data by position (frame 1 → index 0, etc.)
                    // Can't use shotNumber because batch 2+ has scene numbers 5-8 while frames are always 1-4
                    const shotData = analyzerShots?.[frame.frameNumber - 1];
                    // Parse duration from shot (e.g., "3s" -> 6 or 10)
                    const durationMatch = shotData?.duration?.match(/(\d+\.?\d*)/);
                    const shotSeconds = durationMatch ? parseFloat(durationMatch[1]) : 6;
                    // Use dialogue length for duration estimate, fall back to shot duration hint
                    const suggestedDuration = shotData?.dialogue
                      ? estimateDurationFromDialogue(shotData.dialogue)
                      : (shotSeconds > 7 ? 10 : 6);

                    return {
                      frameNumber: frame.frameNumber,
                      imageUrl: frame.upscaledUrl || frame.originalUrl,
                      prompt: shotData?.action || shotData?.description || '',
                      dialogue: shotData?.dialogue,
                      includeDialogue: false,  // Off by default - user has separate voiceover
                      duration: suggestedDuration,
                      cameraStyle: 'none' as const,
                      aspectRatio: '16:9',
                      model: 'fast' as const,  // Default to Fast mode
                      batchNumber,
                      sceneNumber: shotData?.shotNumber,
                    };
                  });

                  if (onAddToQueue) {
                    onAddToQueue(framesToAdd);
                    // Scroll to the queue after a brief delay to let it render
                    setTimeout(() => {
                      const queueElement = document.querySelector('[data-animation-queue]');
                      queueElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }
                  setSelectedForQueue([]);
                }}
                disabled={extractedFrames.filter(f => f.status === 'completed').length === 0}
              >
                <Film className="w-4 h-4 mr-2" />
                {selectedForQueue.length > 0
                  ? `Add ${selectedForQueue.length} to Queue`
                  : 'Add All to Queue'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAll}
                disabled={extractedFrames.filter(f => f.status === 'completed').length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Download All
              </Button>
            </div>
          </div>

          {/* Selection hint */}
          <p className="text-xs text-muted-foreground">
            Click frames to select for batch animation, or use &quot;Add All to Queue&quot; to queue all frames.
            {selectedForQueue.length > 0 && (
              <button
                className="ml-2 text-primary hover:underline"
                onClick={() => setSelectedForQueue([])}
              >
                Clear selection
              </button>
            )}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {extractedFrames
              .filter(f => f.status === 'completed')
              .sort((a, b) => a.frameNumber - b.frameNumber)
              .map((frame) => {
                const isSelectedForQueue = selectedForQueue.includes(frame.frameNumber);
                return (
                  <div key={frame.frameNumber} className="space-y-2">
                    <div
                      className={cn(
                        "relative rounded-lg overflow-hidden border bg-muted/10 aspect-video group cursor-pointer transition-all",
                        isSelectedForQueue && "ring-2 ring-primary ring-offset-2"
                      )}
                      onClick={() => {
                        if (onAddToQueue) {
                          setSelectedForQueue(prev =>
                            prev.includes(frame.frameNumber)
                              ? prev.filter(n => n !== frame.frameNumber)
                              : [...prev, frame.frameNumber]
                          );
                        }
                      }}
                    >
                      <img
                        src={frame.upscaledUrl || frame.originalUrl}
                        alt={`Frame ${frame.frameNumber}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Checkbox overlay */}
                      {onAddToQueue && (
                        <div className={cn(
                          "absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          isSelectedForQueue
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-black/50 border-white/70"
                        )}>
                          {isSelectedForQueue && <Check className="w-3 h-3" />}
                        </div>
                      )}
                      <div className={cn(
                        "absolute top-2 px-2 py-1 rounded bg-black/70 text-xs text-white",
                        onAddToQueue ? "left-9" : "left-2"
                      )}>
                        Frame {frame.frameNumber}
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-1 rounded bg-green-600/90 text-xs text-white">
                        {frame.width}×{frame.height}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(
                            frame.upscaledUrl || frame.originalUrl,
                            `frame_${frame.frameNumber}_${frame.width}x${frame.height}.png`
                          );
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMakeVideo(frame.upscaledUrl || frame.originalUrl, frame.frameNumber);
                        }}
                      >
                        <Film className="w-3 h-3 mr-1" />
                        Animate
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Regenerate Grid Confirmation Dialog */}
      <Dialog open={regenerateGridDialogOpen} onOpenChange={setRegenerateGridDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Storyboard Grid?</DialogTitle>
            <DialogDescription>
              This will generate a new {gridConfig.columns}x{gridConfig.rows} storyboard grid using the same prompt and settings.
              The current grid and any extracted frames will be replaced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateGridDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRegenerateGrid}>
              Regenerate Grid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
