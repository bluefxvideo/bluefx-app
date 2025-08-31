'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Sparkles, Download, Eye, Copy, Palette, X } from 'lucide-react';

interface LogoPreviewProps {
  logo?: {
    id: string;
    url: string;
    company_name: string;
    style: string;
    batch_id: string;
  };
  isGenerating?: boolean;
  companyName?: string;
  onCancelGeneration?: () => void;
}

export function LogoPreview({ logo, isGenerating, companyName, onCancelGeneration }: LogoPreviewProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // If we have a logo, show the result
  if (logo) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center">
          <Card className="group overflow-hidden max-w-md w-full">
            <div className="relative aspect-square">
              <Image
                src={logo.url}
                alt={`${logo.company_name} Logo`}
                fill
                className="object-contain p-6 bg-white/5"
                onLoad={() => setImageLoaded(true)}
              />
              
              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedImage(logo.url)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadImage(logo.url, `${logo.company_name}-logo.png`)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyToClipboard(logo.url)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Logo Info */}
            <div className="p-4 space-y-2">
              <h3 className="font-medium text-center">{logo.company_name}</h3>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Palette className="w-4 h-4" />
                <span className="capitalize">{logo.style} Style</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Full Screen Preview Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
              <Image
                src={selectedImage}
                alt="Preview"
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain"
              />
              <Button
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                variant="secondary"
                onClick={() => setSelectedImage(null)}
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loading state with rich preview card
  if (isGenerating) {
    return (
      <div className="flex justify-center">
        <Card className="relative p-8 text-center space-y-4 border-zinc-700/50 bg-card-content/50 max-w-md w-full">
          {/* Cancel Button - Top Right */}
          {onCancelGeneration && (
            <Button
              variant="ghost"
              size="sm" 
              onClick={onCancelGeneration}
              className="absolute top-3 right-3 h-8 w-8 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
              title="Cancel Generation"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          
          {/* Preview Area with Loading Animation */}
          <div className="aspect-square bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 rounded-xl flex items-center justify-center relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 animate-pulse"></div>
            
            {/* Loading Icon */}
            <div className="relative z-10 w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          </div>
          
          {/* Processing Text */}
          <div className="space-y-2">
            <h3 className="font-medium">Creating Your Logo</h3>
            <p className="text-sm text-muted-foreground">
              {companyName ? `Designing for ${companyName}` : 'AI is crafting your brand identity...'}
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-yellow-500">
              <Sparkles className="w-3 h-3" />
              <span>~30-45 seconds</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Default empty state
  return null;
}