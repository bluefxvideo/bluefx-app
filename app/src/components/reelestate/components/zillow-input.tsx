'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

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
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading || isUploading}
            className="w-full h-24 border-dashed flex flex-col gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Uploading photos...</span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                <span>Click to upload listing photos</span>
              </>
            )}
          </Button>
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
