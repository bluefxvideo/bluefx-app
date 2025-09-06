'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  X, 
  File, 
  Image as ImageIcon,
  FileText,
  User,
  Camera,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import { formatFileSize } from '@/utils/file-utils';

type FileType = 'image' | 'document' | 'face' | 'reference' | 'avatar' | 'generic';

interface UnifiedDragDropProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  fileType?: FileType;
  title?: string;
  description?: string;
  accept?: Record<string, string[]>;
  maxSize?: number;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  className?: string;
  showFileName?: boolean;
  showFileSize?: boolean;
  previewSize?: 'small' | 'medium' | 'large';
  allowClear?: boolean;
}

const FILE_TYPE_CONFIG = {
  image: {
    icon: ImageIcon,
    defaultTitle: 'Drop image or click to upload',
    defaultDescription: 'Upload an image file',
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxSize: 10 * 1024 * 1024, // 10MB
    showPreview: true
  },
  document: {
    icon: FileText,
    defaultTitle: 'Drop documents or click to upload',
    defaultDescription: 'Upload PDF, DOCX, TXT, or MD files',
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    showPreview: false
  },
  face: {
    icon: User,
    defaultTitle: 'Drop face image or click to upload',
    defaultDescription: 'Clear photo with visible face',
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxSize: 10 * 1024 * 1024, // 10MB
    showPreview: true
  },
  reference: {
    icon: Camera,
    defaultTitle: 'Drop reference image or click to upload',
    defaultDescription: 'Style reference for generation',
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxSize: 10 * 1024 * 1024, // 10MB
    showPreview: true
  },
  avatar: {
    icon: User,
    defaultTitle: 'Drop avatar image or click to upload',
    defaultDescription: 'Custom avatar for video generation',
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxSize: 10 * 1024 * 1024, // 10MB
    showPreview: true
  },
  generic: {
    icon: File,
    defaultTitle: 'Drop files or click to upload',
    defaultDescription: 'Upload any supported file',
    accept: { '*/*': [] },
    maxSize: 100 * 1024 * 1024, // 100MB
    showPreview: false
  }
};

/**
 * UnifiedDragDrop - The ultimate drag-and-drop component for ALL BlueFX tools
 * Based on the successful document upload pattern with beautiful image previews
 * Supports multiple file types with consistent UX and styling
 */
export function UnifiedDragDrop({
  onFileSelect,
  selectedFile,
  fileType = 'generic',
  title,
  description,
  accept,
  maxSize,
  disabled = false,
  loading = false,
  error,
  className = '',
  showFileName = true,
  showFileSize = true,
  previewSize = 'medium',
  allowClear = true,
}: UnifiedDragDropProps) {
  const [dragOver, setDragOver] = useState(false);
  
  const config = FILE_TYPE_CONFIG[fileType];
  const finalTitle = title || config.defaultTitle;
  const finalDescription = description || config.defaultDescription;
  const finalAccept = accept || config.accept;
  const finalMaxSize = maxSize || config.maxSize;
  const IconComponent = config.icon;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: finalAccept,
    maxSize: finalMaxSize,
    maxFiles: 1,
    disabled: disabled || loading,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
  });

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null as any); // Clear the file
  };

  const isImage = selectedFile && selectedFile.type.startsWith('image/');
  const hasError = error || fileRejections.length > 0;
  const rejectionError = fileRejections[0]?.errors[0]?.message;

  const getPreviewDimensions = () => {
    switch (previewSize) {
      case 'small':
        return 'w-16 h-16';
      case 'large':
        return 'w-48 h-32';
      case 'medium':
      default:
        return 'w-32 h-32';
    }
  };

  const getImagePreview = () => {
    if (!isImage || !selectedFile) return null;

    const previewUrl = URL.createObjectURL(selectedFile);
    const dimensions = getPreviewDimensions();

    if (fileType === 'face') {
      return (
        <div className={`${dimensions} mx-auto rounded-full overflow-hidden bg-muted relative`}>
          <Image
            src={previewUrl}
            alt="Face preview"
            fill
            className="object-cover"
            onLoad={() => URL.revokeObjectURL(previewUrl)}
          />
        </div>
      );
    }

    if (fileType === 'reference' || fileType === 'avatar') {
      return (
        <div className={`${dimensions} mx-auto rounded-lg overflow-hidden bg-muted relative`}>
          <Image
            src={previewUrl}
            alt="Image preview"
            fill
            className="object-cover"
            onLoad={() => URL.revokeObjectURL(previewUrl)}
          />
        </div>
      );
    }

    return (
      <div className={`${dimensions} mx-auto rounded-lg overflow-hidden bg-muted relative`}>
        <Image
          src={previewUrl}
          alt="Image preview"
          fill
          className="object-cover"
          onLoad={() => URL.revokeObjectURL(previewUrl)}
        />
      </div>
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        {...getRootProps()}
        className={`
          relative p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 
          overflow-hidden
          ${disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
          ${isDragActive || dragOver ? 'border-blue-500 bg-blue-950/20'
          ${hasError ? 'border-destructive bg-destructive/5' : ''}
          ${selectedFile ? '!bg-interactive' : '!bg-interactive hover:!bg-interactive-hover'}
        `}
        style={{
          backgroundColor: !isDragActive && !dragOver && !hasError ? 'hsl(var(--interactive))' : undefined
        }}
      >
        <input {...getInputProps()} />

        {loading ? (
          // Loading State
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-base font-medium">Processing...</p>
              <p className="text-sm text-muted-foreground">Please wait</p>
            </div>
          </div>
        ) : selectedFile ? (
          // File Selected State
          <div className="space-y-4">
            {config.showPreview && isImage ? (
              // Image Preview
              <div className="space-y-3">
                {getImagePreview()}
                <div className="text-center space-y-1">
                  {showFileName && (
                    <p className="text-base font-medium truncate">{selectedFile.name}</p>
                  )}
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {selectedFile.type.split('/')[1]?.toUpperCase() || 'IMG'}
                    </Badge>
                    {showFileSize && (
                      <span>{formatFileSize(selectedFile.size)}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Click to change or drag new file</p>
                </div>
              </div>
            ) : (
              // Non-Image File Display
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                    <IconComponent className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    {showFileName && (
                      <p className="text-base font-medium truncate max-w-48">{selectedFile.name}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {selectedFile.type.split('/')[1]?.toUpperCase() || 'FILE'}
                      </Badge>
                      {showFileSize && (
                        <span className="text-sm text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {allowClear && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}

            {allowClear && config.showPreview && isImage && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Empty State - Compact Design
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="relative">
              {/* Compact icon with plus overlay */}
              <div className="w-12 h-12 text-muted-foreground/60 relative">
                <ImageIcon className="w-8 h-8 absolute top-1 left-1" />
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-muted-foreground/40 rounded-full flex items-center justify-center">
                  <span className="text-xs text-background font-bold">+</span>
                </div>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">
                {isDragActive ? 'Drop files here!' : 'Upload a file or drag and drop'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isDragActive ? 'Release to upload' : 'PNG, JPG, GIF up to 10MB'}
              </p>
            </div>
          </div>
        )}

        {/* Success indicator for selected files */}
        {selectedFile && !hasError && (
          <div className="absolute top-3 right-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
        )}
      </div>

      {/* Error Display */}
      {hasError && (
        <Card className="p-3 border-destructive bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm">{error || rejectionError}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

