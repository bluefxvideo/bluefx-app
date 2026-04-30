'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ZillowInputProps {
  onSubmitUrl: (url: string) => void;
  onUploadPhotos: (urls: string[]) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function ZillowInput({ onSubmitUrl, onUploadPhotos, isLoading, disabled }: ZillowInputProps) {
  const [url, setUrl] = useState('');
  const [uploadMode, setUploadMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidListingUrl = (u: string) => {
    const trimmed = u.trim();
    return (
      /^https?:\/\/(www\.)?zillow\.com\/homedetails\//i.test(trimmed) ||
      /^https?:\/\/(www\.)?realtor\.com\/realestateandhomes-detail\//i.test(trimmed)
    );
  };

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!isValidListingUrl(trimmed)) return;
    onSubmitUrl(trimmed);
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const imageFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('No image files selected');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      for (const file of imageFiles) {
        formData.append('files', file);
      }

      const res = await fetch('/api/upload/reelestate', {
        method: 'POST',
        body: formData,
      });

      // Handle non-JSON responses (e.g. 404 HTML)
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Upload endpoint returned ${res.status}: ${text.slice(0, 100)}`);
      }

      const data = await res.json();

      if (!data.success || !data.urls?.length) {
        throw new Error(data.error || 'Upload failed');
      }

      toast.success(`Uploaded ${data.urls.length} photos`);
      onUploadPhotos(data.urls);
    } catch (err) {
      console.error('❌ Photo upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    uploadFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (disabled || isLoading || isUploading) return;
    if (e.dataTransfer.files?.length) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  return (
    <div className="space-y-4">
      {!uploadMode ? (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Paste a Zillow or Realtor.com listing URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={disabled || isLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <Button
              onClick={handleSubmit}
              disabled={disabled || isLoading || !isValidListingUrl(url)}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              <span className="ml-2">Scrape</span>
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setUploadMode(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            disabled={disabled}
          >
            Or upload photos manually
          </button>
        </>
      ) : (
        <>
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "w-full min-h-[120px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 p-4 cursor-pointer transition-colors",
              isDraggingOver
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-border bg-muted/20",
              (disabled || isLoading || isUploading) && "opacity-50 pointer-events-none"
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Uploading photos...</span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {isDraggingOver ? 'Drop photos here' : 'Click or drag photos to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WebP — multiple files supported
                  </p>
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => setUploadMode(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            disabled={disabled}
          >
            Or paste a listing URL
          </button>
        </>
      )}
    </div>
  );
}
