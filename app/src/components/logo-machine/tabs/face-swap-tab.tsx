'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { UserRound, Wand2 } from 'lucide-react';
import { ThumbnailMachineRequest } from '@/actions/tools/thumbnail-machine';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';

interface FaceSwapTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => void;
  isGenerating: boolean;
  credits: number;
  error?: string;
}

/**
 * Face Swap Tab - Dedicated interface for face swapping
 * Focuses on uploading face images and applying to generated thumbnails
 */
export function FaceSwapTab({
  onGenerate,
  isGenerating,
  credits,
  error
}: FaceSwapTabProps) {
  const [formData, setFormData] = useState({
    sourceImage: null as File | null,
    targetImage: null as File | null,
    applyToAll: true,
    prompt: '',
  });

  const handleSourceUpload = (file: File) => {
    setFormData(prev => ({ ...prev, sourceImage: file }));
  };

  const _handleTargetUpload = (file: File) => {
    setFormData(prev => ({ ...prev, targetImage: file }));
  };

  const handleSubmit = () => {
    if (!formData.sourceImage || !formData.prompt.trim()) return;
    
    onGenerate({
      prompt: formData.prompt,
      face_swap: {
        source_image: formData.sourceImage,
        target_image: formData.targetImage || undefined,
        apply_to_all: formData.applyToAll
      },
      num_outputs: 4,
      aspect_ratio: '16:9',
      user_id: 'current-user',
    });
  };

  const estimatedCredits = 4 * 2 + (formData.applyToAll ? 4 * 3 : 3); // Thumbnails + face swaps

  return (
    <div className="h-full flex flex-col space-y-8 p-6 overflow-y-auto scrollbar-overlay" style={{ scrollbarGutter: 'stable', marginRight: '-8px', paddingRight: '14px' }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
            <UserRound className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-2xl font-semibold">Face Swap</h2>
        </div>
        <p className="text-base text-muted-foreground" style={{ lineHeight: '1.5' }}>
          Replace faces in generated thumbnails with your own
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1 space-y-4 overflow-visible scrollbar-hover">
        {/* Prompt */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Thumbnail Concept</Label>
          <textarea
            className="w-full p-3 border rounded-lg resize-none min-h-[80px] text-sm"
            placeholder="Describe the thumbnail style you want before face swap is applied..."
            value={formData.prompt}
            onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
          />
        </div>

        {/* Source Face Upload */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Your Face Image</Label>
          <UnifiedDragDrop
            fileType="face"
            selectedFile={formData.sourceImage}
            onFileSelect={handleSourceUpload}
            disabled={isGenerating}
            previewSize="medium"
          />
        </div>

        {/* Target Image (Optional) */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Target Image (Optional)</Label>
          <UnifiedDragDrop
            fileType="reference"
            selectedFile={formData.targetImage}
            onFileSelect={handleTargetUpload}
            disabled={isGenerating}
            title="Drop target face or click to upload"
            description="Specific face to replace in generated images"
            previewSize="medium"
          />
        </div>

        {/* Options */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="apply-all"
            checked={formData.applyToAll}
            onChange={(e) => setFormData(prev => ({ ...prev, applyToAll: e.target.checked }))}
            className="rounded"
          />
          <Label htmlFor="apply-all" className="text-sm">
            Apply face swap to all generated thumbnails
          </Label>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleSubmit}
        disabled={!formData.sourceImage || !formData.prompt.trim() || isGenerating || credits < estimatedCredits}
        className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium"
        size="lg"
      >
        {isGenerating ? (
          <>
            <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Processing Face Swap...
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4 mr-2" />
            Generate with Face Swap
          </>
        )}
      </Button>
    </div>
  );
}