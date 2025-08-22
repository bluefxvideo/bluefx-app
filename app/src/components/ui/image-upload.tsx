'use client';

import { useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  file: File | null;
  onFileChange: (file: File) => void;
  title?: string;
  description?: string;
  previewSize?: 'square' | 'landscape' | 'portrait';
  disabled?: boolean;
  className?: string;
}

/**
 * Reusable Image Upload Component
 * Provides consistent image upload experience across all tools
 */
export function ImageUpload({
  file,
  onFileChange,
  title = 'Upload image',
  description = 'Click to select an image',
  previewSize = 'landscape',
  disabled = false,
  className = ''
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const getPreviewDimensions = () => {
    switch (previewSize) {
      case 'square':
        return { className: 'w-32 h-32', width: 128, height: 128 };
      case 'portrait':
        return { className: 'w-32 h-48', width: 128, height: 192 };
      case 'landscape':
      default:
        return { className: 'aspect-video', width: 400, height: 225 };
    }
  };

  const dimensions = getPreviewDimensions();

  return (
    <>
      <Card 
        className={`p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        onClick={handleClick}
      >
        {file ? (
          <div className="space-y-3">
            <div className={`${dimensions.className} mx-auto rounded-lg overflow-hidden bg-muted ${previewSize === 'square' ? 'relative' : ''}`}>
              {previewSize === 'landscape' ? (
                <Image
                  src={URL.createObjectURL(file)}
                  alt="Preview"
                  width={dimensions.width}
                  height={dimensions.height}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={URL.createObjectURL(file)}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div className="text-center">
              <p className="text-base font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">Click to change</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <div className="text-center">
              <p className="text-base font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        )}
      </Card>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileChange(file);
        }}
      />
    </>
  );
}