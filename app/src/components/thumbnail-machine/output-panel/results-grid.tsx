'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Copy } from 'lucide-react';

interface ResultsGridProps {
  thumbnails: {
    id: string;
    url: string;
    variation_index: number;
    batch_id: string;
  }[];
  faceSwappedThumbnails: {
    url: string;
    source_thumbnail_id: string;
  }[];
  titles: string[];
  batchId: string;
}

export function ResultsGrid({
  thumbnails,
  faceSwappedThumbnails,
  titles,
  batchId
}: ResultsGridProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

  // Select the primary result to display
  const displayThumbnail = thumbnails[2] || thumbnails[0];
  const displayFaceSwapped = faceSwappedThumbnails[0];
  const primaryResult = displayThumbnail || displayFaceSwapped;
  
  if (!primaryResult) return null;

  return (
    <div>
      {/* Standard Result Card with Centered Image */}
      <div className="flex justify-center mb-8">
        <Card className="group overflow-hidden bg-gradient-to-br from-zinc-800/40 to-zinc-900/40 
                         border border-zinc-700/50 backdrop-blur-sm shadow-2xl shadow-zinc-900/50 
                         hover:shadow-blue-500/10 transition-all duration-500 w-full max-w-2xl">
          <div className="p-8">
            {/* Centered Image */}
            <div className="relative aspect-video rounded-lg overflow-hidden 
                            border border-zinc-700/50 shadow-xl mx-auto max-w-lg">
              <img
                src={displayThumbnail?.url || displayFaceSwapped?.url}
                alt={displayThumbnail ? `Thumbnail ${displayThumbnail.variation_index}` : "Face swapped thumbnail"}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 
                             transition-all duration-300 flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 
                              backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300"
                    onClick={() => setSelectedImage(primaryResult.url)}
                  >
                    <Eye className="w-5 h-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-blue-500/80 hover:bg-blue-500 text-white border-0 
                              shadow-lg hover:scale-110 transition-all duration-300"
                    onClick={() => downloadImage(
                      primaryResult.url, 
                      displayThumbnail ? `thumbnail-${displayThumbnail.variation_index}.webp` : 'faceswap.webp'
                    )}
                  >
                    <Download className="w-5 h-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 
                              backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300"
                    onClick={() => copyToClipboard(primaryResult.url)}
                  >
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              {/* Quality Badge */}
              <div className="absolute top-3 right-3">
                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-lg">
                  <span className="text-xs font-bold">
                    {displayFaceSwapped ? "Face Swap" : "HD Quality"}
                  </span>
                </Badge>
              </div>
            </div>
            
            {/* Result Info */}
            <div className="mt-6 pt-4 border-t border-zinc-700/30 text-center">
              <p className="text-sm text-zinc-400 font-medium">
                {displayFaceSwapped 
                  ? "Enhanced with AI face swapping technology"
                  : thumbnails.length > 1 
                    ? `${thumbnails.length - 1} additional variation${thumbnails.length > 2 ? 's' : ''} generated`
                    : "Click the image to view full size or download"
                }
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={selectedImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
            />
            <Button
              className="absolute top-4 right-4 bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600"
              variant="secondary"
              onClick={() => setSelectedImage(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}