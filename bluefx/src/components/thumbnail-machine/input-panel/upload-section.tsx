'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Upload, X, User, Image as ImageIcon } from 'lucide-react';

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
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleReferenceUpload = (file: File) => {
    onReferenceImageChange(file);
  };

  const handleFaceUpload = (file: File) => {
    onFaceSwapChange({
      source_image: file,
      apply_to_all: faceSwap?.apply_to_all ?? false
    });
  };

  const handleDrop = (e: React.DragEvent, type: 'reference' | 'face') => {
    e.preventDefault();
    setDragOver(null);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      if (type === 'reference') {
        handleReferenceUpload(imageFile);
      } else {
        handleFaceUpload(imageFile);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Reference Image Upload */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
          <Label className="text-base font-medium">Reference Image (Optional)</Label>
        </div>
        
        <Card
          className={`p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer bg-card hover:bg-card/80 ${
            dragOver === 'reference' ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver('reference');
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, 'reference')}
          onClick={() => referenceInputRef.current?.click()}
        >
          {referenceImage ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="text-sm">
                  {referenceImage instanceof File ? referenceImage.name : 'Reference image'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onReferenceImageChange(undefined);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-base font-medium">Drop image or click to upload</p>
                <p className="text-sm text-muted-foreground">Style reference for generation</p>
              </div>
            </div>
          )}
        </Card>
        
        <input
          ref={referenceInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleReferenceUpload(file);
          }}
        />
      </div>

      {/* Face Swap Upload */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-muted-foreground" />
          <Label className="text-base font-medium">Face Swap (Optional)</Label>
        </div>
        
        <Card
          className={`p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer bg-card hover:bg-card/80 ${
            dragOver === 'face' ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver('face');
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, 'face')}
          onClick={() => faceInputRef.current?.click()}
        >
          {faceSwap?.source_image ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-sm">
                    {faceSwap.source_image instanceof File ? faceSwap.source_image.name : 'Face image'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFaceSwapChange(undefined);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="apply-to-all"
                  checked={faceSwap.apply_to_all ?? false}
                  onChange={(e) => {
                    e.stopPropagation();
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
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4">
              <User className="w-6 h-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-base font-medium">Drop face image or click to upload</p>
                <p className="text-sm text-muted-foreground">Replace faces in generated thumbnails</p>
              </div>
            </div>
          )}
        </Card>
        
        <input
          ref={faceInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFaceUpload(file);
          }}
        />
      </div>
    </div>
  );
}