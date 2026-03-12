'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, Upload, Loader2 } from 'lucide-react';

interface ZillowInputProps {
  onSubmitUrl: (url: string) => void;
  onUploadPhotos: (urls: string[]) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function ZillowInput({ onSubmitUrl, onUploadPhotos, isLoading, disabled }: ZillowInputProps) {
  const [url, setUrl] = useState('');
  const [uploadMode, setUploadMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidZillowUrl = (u: string) =>
    /^https?:\/\/(www\.)?zillow\.com\/homedetails\//i.test(u.trim());

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!isValidZillowUrl(trimmed)) return;
    onSubmitUrl(trimmed);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        urls.push(URL.createObjectURL(file));
      }
    }

    if (urls.length > 0) {
      onUploadPhotos(urls);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {!uploadMode ? (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Paste a Zillow listing URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={disabled || isLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <Button
              onClick={handleSubmit}
              disabled={disabled || isLoading || !isValidZillowUrl(url)}
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
            disabled={disabled || isLoading}
            className="w-full h-24 border-dashed flex flex-col gap-2"
          >
            <Upload className="w-6 h-6" />
            <span>Click to upload listing photos</span>
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
            Or paste a Zillow URL
          </button>
        </>
      )}
    </div>
  );
}
