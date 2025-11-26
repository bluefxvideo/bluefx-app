'use client';

import { useCallback, useRef } from 'react';
import { Upload, Image as ImageIcon, X, AlertCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CharacterStepProps {
  characterImage: File | null;
  characterImagePreview: string | null;
  onImageSelect: (file: File | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export function CharacterStep({
  characterImage,
  characterImagePreview,
  onImageSelect,
  onNext,
  onBack,
}: CharacterStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image file (JPEG, PNG, WebP, or GIF)');
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image file is too large. Maximum size is 10MB.');
        return;
      }

      onImageSelect(file);
    }
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file);
    }
  }, [onImageSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleRemove = useCallback(() => {
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onImageSelect]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Choose New Character</h2>
        <p className="text-muted-foreground mt-2">
          Upload an image of the character you want to swap into the video
        </p>
      </div>

      {/* Upload Area */}
      {!characterImage ? (
        <Card
          className={cn(
            "border-2 border-dashed cursor-pointer transition-colors",
            "hover:border-primary hover:bg-muted/50"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-medium">Upload character image</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            <p className="text-xs text-muted-foreground mt-4">
              Supported formats: JPEG, PNG, WebP, GIF (max 10MB)
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{characterImage.name}</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              {(characterImage.size / 1024 / 1024).toFixed(1)} MB
            </CardDescription>
          </CardHeader>
          <CardContent>
            {characterImagePreview && (
              <div className="relative aspect-square max-w-sm mx-auto rounded-lg overflow-hidden bg-muted">
                <img
                  src={characterImagePreview}
                  alt="Character preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Character image requirements:</p>
            <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
              <li>Clear, well-lit face visible</li>
              <li>Front-facing or slight angle works best</li>
              <li>High resolution for better quality</li>
              <li>Single person in the image</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          size="lg"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!characterImage}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
