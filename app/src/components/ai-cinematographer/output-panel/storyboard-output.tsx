'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Download, RefreshCw, Check, Loader2, Film, X, RotateCcw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Frame labels for the 3x3 grid
const FRAME_LABELS = [
  'ELS - Extreme Long Shot',
  'LS - Long Shot',
  'MLS - Medium Long Shot',
  'MS - Medium Shot',
  'MCU - Medium Close-Up',
  'CU - Close-Up',
  'ECU - Extreme Close-Up',
  'Low Angle',
  'High Angle',
];

export interface StoryboardResult {
  id: string;
  grid_image_url: string;
  prompt: string;
  visual_style: string;
  created_at: string;
}

export interface ExtractedFrame {
  id: string;
  frame_number: number;
  image_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface StoryboardOutputProps {
  isGenerating: boolean;
  storyboardResult?: StoryboardResult;
  extractedFrames: ExtractedFrame[];
  isExtractingFrames: boolean;
  extractingProgress: { current: number; total: number };
  onExtractFrames: (frameNumbers: number[]) => void;
  onRegenerateGrid: () => void;
  onRegenerateFrame?: (frameNumber: number) => void;
  onMakeVideo: (imageUrl: string) => void;
  onDownload: (imageUrl: string, filename: string) => void;
  onUploadGrid?: (file: File) => void;
}

export function StoryboardOutput({
  isGenerating,
  storyboardResult,
  extractedFrames,
  isExtractingFrames,
  extractingProgress,
  onExtractFrames,
  onRegenerateGrid,
  onRegenerateFrame,
  onMakeVideo,
  onDownload,
  onUploadGrid,
}: StoryboardOutputProps) {
  const [selectedFrames, setSelectedFrames] = useState<number[]>([]);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateGridDialogOpen, setRegenerateGridDialogOpen] = useState(false);
  const [frameToRegenerate, setFrameToRegenerate] = useState<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadGrid) {
      onUploadGrid(file);
    }
    // Reset input
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

  const handleExtract = () => {
    if (selectedFrames.length > 0) {
      onExtractFrames(selectedFrames);
      setSelectedFrames([]); // Clear selection after extraction starts
    }
  };

  const handleDownloadGrid = () => {
    if (storyboardResult?.grid_image_url) {
      onDownload(storyboardResult.grid_image_url, `storyboard_grid_${storyboardResult.id}.jpg`);
    }
  };

  const handleRegenerateFrameClick = (frameNumber: number) => {
    setFrameToRegenerate(frameNumber);
    setRegenerateDialogOpen(true);
  };

  const handleConfirmRegenerateFrame = () => {
    if (frameToRegenerate && onRegenerateFrame) {
      onRegenerateFrame(frameToRegenerate);
    }
    setRegenerateDialogOpen(false);
    setFrameToRegenerate(null);
  };

  const handleRegenerateGridClick = () => {
    setRegenerateGridDialogOpen(true);
  };

  const handleConfirmRegenerateGrid = () => {
    onRegenerateGrid();
    setRegenerateGridDialogOpen(false);
  };

  // Empty state
  if (!isGenerating && !storyboardResult) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10 rounded-lg border border-dashed border-muted-foreground/20">
        <div className="text-center p-8 max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
            <LayoutGrid className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Storyboard Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Describe your scene and generate a 3x3 cinematic storyboard grid with 9 different camera angles.
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
                Upload a 3x3 grid image to extract individual frames
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
            Creating your 9-panel cinematic storyboard. This may take 30-60 seconds.
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
            <h3 className="text-lg font-semibold">Generated Storyboard</h3>
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
          </div>

          {/* Frame Selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Select frames to extract:</p>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((frameNum) => (
                <button
                  key={frameNum}
                  onClick={() => toggleFrame(frameNum)}
                  disabled={isExtractingFrames}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border transition-all text-left",
                    selectedFrames.includes(frameNum)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/30",
                    isExtractingFrames && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                    selectedFrames.includes(frameNum)
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}>
                    {selectedFrames.includes(frameNum) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Frame {frameNum}</p>
                    <p className="text-xs text-muted-foreground truncate">{FRAME_LABELS[frameNum - 1]}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Selection Counter & Extract Button */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFrames.length} frame{selectedFrames.length !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateGridClick}
                  disabled={isGenerating || isExtractingFrames}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Regenerate (3 credits)
                </Button>
                <Button
                  onClick={handleExtract}
                  disabled={selectedFrames.length === 0 || isExtractingFrames}
                  size="sm"
                >
                  {isExtractingFrames ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    `Extract${selectedFrames.length > 0 ? ` (${selectedFrames.length} credit${selectedFrames.length !== 1 ? 's' : ''})` : ''}`
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Extraction Progress */}
      {isExtractingFrames && (
        <div className="space-y-3 p-4 rounded-lg border bg-muted/10">
          <p className="text-sm font-medium">Extracting frames...</p>
          <div className="space-y-2">
            {extractedFrames
              .filter(f => f.status === 'processing' || f.status === 'pending')
              .map((frame) => (
                <div key={frame.id} className="flex items-center gap-2 text-sm">
                  {frame.status === 'processing' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span>Frame {frame.frame_number}</span>
                  <span className="text-muted-foreground">
                    {frame.status === 'processing' ? '- Processing...' : '- Waiting...'}
                  </span>
                </div>
              ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Progress: {extractingProgress.current}/{extractingProgress.total} frames
          </div>
        </div>
      )}

      {/* Section 3: Extracted Frames Gallery */}
      {extractedFrames.filter(f => f.status === 'completed').length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Extracted Frames</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {extractedFrames
              .filter(f => f.status === 'completed')
              .map((frame) => (
                <div key={frame.id} className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden border bg-muted/10 aspect-video group">
                    <img
                      src={frame.image_url}
                      alt={`Frame ${frame.frame_number}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-xs text-white">
                      Frame {frame.frame_number}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => onDownload(frame.image_url, `storyboard_frame_${frame.frame_number}.jpg`)}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => onMakeVideo(frame.image_url)}
                    >
                      <Film className="w-3 h-3 mr-1" />
                      Video
                    </Button>
                    {onRegenerateFrame && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleRegenerateFrameClick(frame.frame_number)}
                        disabled={isExtractingFrames}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Failed extractions notice */}
      {extractedFrames.filter(f => f.status === 'failed').length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-sm">
          <X className="w-4 h-4 text-destructive" />
          <span>{extractedFrames.filter(f => f.status === 'failed').length} frame(s) failed to extract. You can try again.</span>
        </div>
      )}

      {/* Regenerate Grid Confirmation Dialog */}
      <Dialog open={regenerateGridDialogOpen} onOpenChange={setRegenerateGridDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Storyboard Grid?</DialogTitle>
            <DialogDescription>
              This will generate a new 3x3 storyboard grid using the same prompt and settings.
              The current grid will be replaced. This costs 3 credits.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateGridDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRegenerateGrid}>
              Regenerate (3 credits)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Frame Confirmation Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Frame {frameToRegenerate}?</DialogTitle>
            <DialogDescription>
              This will extract a new high-quality version of Frame {frameToRegenerate} from the storyboard grid.
              The current frame will be replaced. This costs 1 credit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRegenerateFrame}>
              Regenerate (1 credit)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
