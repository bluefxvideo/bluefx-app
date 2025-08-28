'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { User, Image as ImageIcon } from 'lucide-react';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';

interface UploadSectionProps {
  referenceImage?: string | File;
  onReferenceImageChange: (image?: string | File) => void;
  faceSwap?: {
    source_image: string | File;
    target_image?: string | File;
    apply_to_all?: boolean;
  };
  onFaceSwapChange: (faceSwap?: {
    source_image: string | File;
    target_image?: string | File;
    apply_to_all?: boolean;
  }) => void;
}

export function UploadSection({
  referenceImage,
  onReferenceImageChange,
  faceSwap,
  onFaceSwapChange
}: UploadSectionProps) {
  const handleReferenceUpload = (file: File) => {
    onReferenceImageChange(file);
  };

  const handleFaceUpload = (file: File) => {
    onFaceSwapChange({
      source_image: file,
      apply_to_all: faceSwap?.apply_to_all ?? false
    });
  };

  return (
    <div className="space-y-6">
      {/* Reference Image Upload */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
          <Label className="text-base font-medium">Reference Image (Optional)</Label>
        </div>
        
        <UnifiedDragDrop
          fileType="reference"
          selectedFile={referenceImage as File}
          onFileSelect={handleReferenceUpload}
          title="Drop style reference or click to upload"
          description="Style reference for generation"
          previewSize="medium"
        />
      </div>

      {/* Face Swap Upload */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-muted-foreground" />
          <Label className="text-base font-medium">Face Swap (Optional)</Label>
        </div>
        
        <div className="space-y-3">
          <UnifiedDragDrop
            fileType="face"
            selectedFile={faceSwap?.source_image as File}
            onFileSelect={handleFaceUpload}
            title="Drop face image or click to upload"
            description="Replace faces in generated thumbnails"
            previewSize="medium"
          />
          
          {faceSwap?.source_image && (
            <div className="flex items-center gap-2 pl-2">
              <input
                type="checkbox"
                id="apply-to-all"
                checked={faceSwap.apply_to_all ?? false}
                onChange={(e) => {
                  onFaceSwapChange({
                    ...faceSwap,
                    apply_to_all: e.target.checked
                  });
                }}
                className="rounded"
              />
              <Label htmlFor="apply-to-all" className="text-sm text-muted-foreground">
                Apply to all generated thumbnails
              </Label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}