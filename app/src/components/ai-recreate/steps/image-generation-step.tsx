'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Download, RefreshCw, Pencil, Trash2, ImageIcon, Zap, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { WizardData, ExtractedFrame } from '../wizard-types';
import { toast } from 'sonner';

interface ImageGenerationStepProps {
  wizardData: WizardData;
  isGenerating: boolean;
  progress: { current: number; total: number };
  onGenerateAll: () => void;
  onUpdateFrame: (frameId: string, updates: Partial<ExtractedFrame>) => void;
  onRemoveFrame: (frameId: string) => void;
  onRegenerateFrame?: (frameId: string) => void;
  regeneratingFrameId?: string | null;
}

export function ImageGenerationStep({
  wizardData,
  isGenerating,
  progress,
  onGenerateAll,
  onUpdateFrame,
  onRemoveFrame,
  onRegenerateFrame,
  regeneratingFrameId,
}: ImageGenerationStepProps) {
  const [editingFrame, setEditingFrame] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editRefImage, setEditRefImage] = useState<{ file: File; preview: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [processingFrameIds, setProcessingFrameIds] = useState<Set<string>>(new Set());
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const frames = wizardData.extractedFrames;
  const hasFrames = frames.length > 0;

  // Version navigation helpers
  const getVersionCount = (frame: ExtractedFrame) => frame.imageVersions?.length || 1;
  const getCurrentVersion = (frame: ExtractedFrame) => frame.currentVersionIndex ?? (getVersionCount(frame) - 1);
  const getDisplayUrl = (frame: ExtractedFrame) => {
    if (!frame.imageVersions?.length) return frame.imageUrl;
    return frame.imageVersions[getCurrentVersion(frame)] || frame.imageUrl;
  };
  const navigateVersion = (frame: ExtractedFrame, direction: 'prev' | 'next') => {
    const count = getVersionCount(frame);
    if (count <= 1) return;
    const current = getCurrentVersion(frame);
    const newIndex = direction === 'prev'
      ? Math.max(0, current - 1)
      : Math.min(count - 1, current + 1);
    if (newIndex !== current) {
      const newUrl = frame.imageVersions![newIndex];
      onUpdateFrame(frame.id, { imageUrl: newUrl, currentVersionIndex: newIndex });
    }
  };

  // ===== Edit image using Nano Banana 2 /edit =====
  const handleEditImage = async (frame: ExtractedFrame) => {
    if (!editPrompt.trim() && !editRefImage) return;
    setIsEditing(true);
    setProcessingFrameIds(prev => new Set(prev).add(frame.id));

    try {
      // Upload reference image if provided
      let refImageUrl: string | undefined;
      if (editRefImage) {
        const formData = new FormData();
        formData.append('file', editRefImage.file);
        formData.append('type', 'reference');
        formData.append('batchId', `edit-${Date.now()}`);
        const uploadRes = await fetch('/api/upload/cinematographer', { method: 'POST', body: formData });
        const uploadResult = await uploadRes.json();
        if (uploadResult.success) refImageUrl = uploadResult.url;
      }

      // Call Nano Banana 2 /edit with the original image + optional reference
      const imageUrls = [frame.imageUrl];
      if (refImageUrl) imageUrls.push(refImageUrl);

      const { generateImageWithPro } = await import('@/actions/models/fal-nano-banana-2');
      const result = await generateImageWithPro(
        editPrompt || 'recreate this image with the reference product',
        wizardData.aspectRatio,
        imageUrls,
        '2K',
        'jpg'
      );

      if (result.success && result.imageUrl) {
        // Re-upload to Supabase for permanent storage
        let finalUrl = result.imageUrl;
        try {
          const reuploadForm = new FormData();
          const blob = await (await fetch(result.imageUrl)).blob();
          reuploadForm.append('file', blob, 'edited-frame.jpg');
          reuploadForm.append('type', 'reference');
          reuploadForm.append('batchId', `edited-${Date.now()}`);
          const reuploadRes = await fetch('/api/upload/cinematographer', { method: 'POST', body: reuploadForm });
          const reuploadResult = await reuploadRes.json();
          if (reuploadResult.success && reuploadResult.url) {
            finalUrl = reuploadResult.url;
          }
        } catch {
          console.warn('Re-upload failed, using fal.ai URL');
        }

        // Add to version history
        const existingVersions = frame.imageVersions || [frame.imageUrl];
        const newVersions = [...existingVersions, finalUrl];
        const newIndex = newVersions.length - 1;

        onUpdateFrame(frame.id, {
          imageUrl: finalUrl,
          imageVersions: newVersions,
          currentVersionIndex: newIndex,
        });
        setEditingFrame(null);
        setEditPrompt('');
        setEditRefImage(null);
        toast.success(`Image edited (version ${newVersions.length})`);
      } else {
        toast.error(result.error || 'Failed to edit image');
      }
    } catch {
      toast.error('Failed to edit image');
    }
    setIsEditing(false);
    setProcessingFrameIds(prev => {
      const next = new Set(prev);
      next.delete(frame.id);
      return next;
    });
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditRefImage({ file, preview: URL.createObjectURL(file) });
    }
  };

  // ===== Download all images =====
  const handleDownloadAll = async () => {
    for (const frame of frames) {
      try {
        const response = await fetch(frame.imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scene-${frame.sceneNumber}-b${frame.batchNumber}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      } catch {
        console.warn(`Failed to download frame ${frame.sceneNumber}`);
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Generate Images</h2>
          <p className="text-sm text-muted-foreground">
            {hasFrames
              ? `${frames.length} frames generated from ${wizardData.scenes.length} scenes`
              : `Generate storyboard images for ${wizardData.scenes.length} scenes`}
          </p>
        </div>

        <div className="flex gap-2">
          {hasFrames && (
            <Button variant="outline" onClick={handleDownloadAll}>
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
          )}
          <Button
            onClick={onGenerateAll}
            disabled={isGenerating || wizardData.scenes.length === 0}
            className="bg-primary"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scene {progress.current}/{progress.total}...
              </>
            ) : hasFrames ? (
              <><RefreshCw className="w-4 h-4 mr-2" /> Regenerate All</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Generate All Images</>
            )}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {isGenerating && progress.total > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}

      {/* Empty state */}
      {!hasFrames && !isGenerating && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">Click &quot;Generate All Images&quot; to create storyboard frames</p>
          <p className="text-xs mt-1">
            {wizardData.scenes.length} scenes will be generated in batches of 4
          </p>
        </div>
      )}

      {/* Frame grid */}
      {hasFrames && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {frames.map(frame => (
            <Card key={frame.id} className="overflow-hidden">
              {/* Image with version navigation */}
              <div className="relative aspect-video bg-secondary/20 group">
                {regeneratingFrameId === frame.id ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <img
                      src={getDisplayUrl(frame)}
                      alt={`Scene ${frame.sceneNumber}`}
                      className="w-full h-full object-cover"
                    />
                    {processingFrameIds.has(frame.id) && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                          <span className="text-xs text-white/80">Processing...</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="absolute top-1.5 left-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  #{frame.sceneNumber}
                </div>

                {/* Version navigation overlay */}
                {getVersionCount(frame) > 1 && (
                  <>
                    <button
                      onClick={() => navigateVersion(frame, 'prev')}
                      disabled={getCurrentVersion(frame) === 0}
                      className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigateVersion(frame, 'next')}
                      disabled={getCurrentVersion(frame) === getVersionCount(frame) - 1}
                      className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    {/* Version dots */}
                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                      {frame.imageVersions!.map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${i === getCurrentVersion(frame) ? 'bg-white' : 'bg-white/40'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5 space-y-2">
                <p className="text-xs text-muted-foreground line-clamp-2">{frame.narration}</p>

                {/* Edit mode */}
                {editingFrame === frame.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editPrompt}
                      onChange={e => setEditPrompt(e.target.value)}
                      placeholder="Describe the edit (e.g., 'replace the product with the uploaded image')"
                      className="text-xs min-h-[60px]"
                    />

                    {/* Reference image upload for edit */}
                    <div className="flex items-center gap-2">
                      {editRefImage ? (
                        <div className="relative w-10 h-10 rounded border border-border/50 overflow-hidden shrink-0">
                          <img src={editRefImage.preview} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => { setEditRefImage(null); if (editFileInputRef.current) editFileInputRef.current.value = ''; }}
                            className="absolute -top-0.5 -right-0.5 bg-black/70 rounded-full w-3.5 h-3.5 flex items-center justify-center text-white text-[8px]"
                          >×</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => editFileInputRef.current?.click()}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-dashed border-border/50 rounded px-2 py-1"
                        >
                          <Upload className="w-3 h-3" /> Add ref image
                        </button>
                      )}
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleEditFileChange}
                      />
                    </div>

                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={() => { setEditingFrame(null); setEditPrompt(''); setEditRefImage(null); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => handleEditImage(frame)}
                        disabled={isEditing || (!editPrompt.trim() && !editRefImage)}
                      >
                        {isEditing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      onClick={() => { setEditingFrame(frame.id); setEditPrompt(''); setEditRefImage(null); setIsEditing(false); }}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    {onRegenerateFrame && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => onRegenerateFrame(frame.id)}
                        disabled={regeneratingFrameId === frame.id}
                        title="Regenerate (keeps previous versions)"
                      >
                        <RefreshCw className={`w-3 h-3 ${regeneratingFrameId === frame.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => onRemoveFrame(frame.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
