'use client';

import { Card } from '@/components/ui/card';
import { Upload, Sparkles, Image as ImageIcon } from 'lucide-react';

interface StandardUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  accept?: string;
  title?: string;
  description?: string;
}

/**
 * StandardUpload - Uniform file upload component used across ALL BlueFX tools
 * Provides consistent drag-and-drop styling and animations
 */
export function StandardUpload({ 
  onFileSelect,
  selectedFile,
  accept = "image/*",
  title = "Drop your inspiration here",
  description = "Upload an image to guide the style"
}: StandardUploadProps) {
  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onFileSelect(file);
    };
    input.click();
  };

  return (
    <Card
      className="relative p-6 border border-border/50 cursor-pointer transition-all duration-300 
                 backdrop-blur-sm hover:border-border group/upload overflow-hidden"
      onClick={handleClick}
    >
      {selectedFile ? (
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
            <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-foreground font-semibold">{selectedFile.name}</p>
            <p className="text-muted-foreground text-sm">Ready to use as reference</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4 relative z-10">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-secondary/50 to-card/50 rounded-2xl flex items-center justify-center 
                           border border-border/30 group-hover/upload:border-border/70 transition-all duration-300">
              <Upload className="w-7 h-7 text-muted-foreground group-hover/upload:text-foreground transition-colors duration-300" />
            </div>
            {/* Floating sparkles */}
            <div className="absolute -top-1 -right-1 opacity-0 group-hover/upload:opacity-100 transition-opacity duration-500">
              <Sparkles className="w-4 h-4 text-yellow-700 dark:text-yellow-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-foreground font-semibold text-lg">{title}</p>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>
      )}
    </Card>
  );
}