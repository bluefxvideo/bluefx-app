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
  Grid3X3,
  PlayCircle,
  ExternalLink,
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
}: StoryboardOutputV2Props) {
  const [selectedFrames, setSelectedFrames] = useState<number[]>([]);
  const [regenerateGridDialogOpen, setRegenerateGridDialogOpen] = useState(false);
  const [extractAllDialogOpen, setExtractAllDialogOpen] = useState(false);
  const [isOpeningEditor, setIsOpeningEditor] = useState(false);
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
  } = useGridExtraction({ gridConfig, shouldUpscale: true, userId });

  // Notify parent when frames are extracted
  useEffect(() => {
    if (extractedFrames.length > 0 && onFramesExtracted) {
      const completedFrames = extractedFrames.filter(f => f.status === 'completed');
      if (completedFrames.length > 0) {
        onFramesExtracted(completedFrames);
      }
    }
  }, [extractedFrames, onFramesExtracted]);

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
      selectedFrames
    );
    setSelectedFrames([]);
  };

  const handleExtractAll = async () => {
    if (!storyboardResult?.grid_image_url || !projectId) return;
    setExtractAllDialogOpen(false);

    await extractAllFrames(storyboardResult.grid_image_url, projectId);
  };

  const handleDownloadGrid = () => {
    if (storyboardResult?.grid_image_url) {
      onDownload(storyboardResult.grid_image_url, `storyboard_grid_${storyboardResult.id}.png`);
    }
  };

  const handleConfirmRegenerateGrid = () => {
    onRegenerateGrid();
    clearFrames();
    setRegenerateGridDialogOpen(false);
  };

  const handleOpenInEditor = async () => {
    const completedFrames = extractedFrames.filter(f => f.status === 'completed');
    if (!projectId || completedFrames.length === 0) return;

    setIsOpeningEditor(true);

    try {
      // If custom handler is provided, use it
      if (onOpenInEditor) {
        onOpenInEditor(projectId, completedFrames);
        return;
      }

      // Default behavior: Call API and open editor in new tab
      const response = await fetch('/api/storyboard-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId,
          frames: completedFrames.map(f => ({
            frameNumber: f.frameNumber,
            row: f.row,
            col: f.col,
            originalUrl: f.originalUrl,
            upscaledUrl: f.upscaledUrl,
            width: f.width,
            height: f.height,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Open editor with storyboard data
        // The editor URL can be configured via environment variable
        const editorBaseUrl = process.env.NEXT_PUBLIC_VIDEO_EDITOR_URL || '/editor';
        // Pass the current origin as apiUrl so the editor knows where to fetch storyboard data
        const currentOrigin = window.location.origin;
        const editorUrl = `${editorBaseUrl}?storyboardId=${projectId}&userId=${userId}&apiUrl=${encodeURIComponent(currentOrigin)}`;
        window.open(editorUrl, '_blank');
      } else {
        console.error('Failed to prepare editor:', data.error);
      }
    } catch (error) {
      console.error('Error opening editor:', error);
    } finally {
      setIsOpeningEditor(false);
    }
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
            <Grid3X3 className="w-8 h-8 text-muted-foreground" />
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
                  onClick={() => setExtractAllDialogOpen(true)}
                  disabled={isExtracting || !projectId || !userId}
                >
                  <Scissors className="w-4 h-4 mr-1" />
                  Extract All ({totalFrames} credits)
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
            Cropping and upscaling to 2560×1440 (2K). 1 credit per frame.
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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Extracted Frames ({extractedFrames.filter(f => f.status === 'completed').length})
            </h3>
            <Button
              onClick={handleOpenInEditor}
              disabled={isOpeningEditor || !projectId}
              className="bg-primary hover:bg-primary/90"
            >
              {isOpeningEditor ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Open in Video Editor
                  <ExternalLink className="w-3 h-3 ml-2" />
                </>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {extractedFrames
              .filter(f => f.status === 'completed')
              .sort((a, b) => a.frameNumber - b.frameNumber)
              .map((frame) => (
                <div key={frame.frameNumber} className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden border bg-muted/10 aspect-video group">
                    <img
                      src={frame.upscaledUrl || frame.originalUrl}
                      alt={`Frame ${frame.frameNumber}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-xs text-white">
                      Frame {frame.frameNumber}
                    </div>
                    <div className="absolute top-2 right-2 px-2 py-1 rounded bg-green-600/90 text-xs text-white">
                      {frame.width}×{frame.height}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => onDownload(
                        frame.upscaledUrl || frame.originalUrl,
                        `frame_${frame.frameNumber}_${frame.width}x${frame.height}.png`
                      )}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => onMakeVideo(frame.upscaledUrl || frame.originalUrl, frame.frameNumber)}
                    >
                      <Film className="w-3 h-3 mr-1" />
                      Animate
                    </Button>
                  </div>
                </div>
              ))}
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

      {/* Extract All Confirmation Dialog */}
      <Dialog open={extractAllDialogOpen} onOpenChange={setExtractAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract All {totalFrames} Frames?</DialogTitle>
            <DialogDescription>
              This will:
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Crop all {totalFrames} frames from the grid</li>
                <li>Upscale each to 2560×1440 (2K)</li>
                <li>Save them to your project</li>
              </ul>
              <p className="mt-2 font-medium text-foreground">
                Cost: {totalFrames} credits (1 credit per frame)
              </p>
              <p className="mt-1 text-xs">This may take 1-2 minutes. Frames will appear as they complete.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtractAllDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtractAll}>
              Extract All Frames
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
