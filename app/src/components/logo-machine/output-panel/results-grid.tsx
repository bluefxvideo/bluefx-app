'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  batchId: _batchId
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
      // Could show a toast here
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generated Logo */}
      {thumbnails.length > 0 && (
        <div>
          <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
            {thumbnails.map((thumbnail) => (
              <Card key={thumbnail.id} className="group overflow-hidden">
                <div className="relative aspect-square">
                  {thumbnail.url && (
                    <Image
                      src={thumbnail.url}
                      alt="Generated Logo"
                      fill
                      className="object-contain p-4"
                    />
                  )}
                  
                  {/* Overlay Controls */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedImage(thumbnail.url)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadImage(thumbnail.url, `logo-${Date.now()}.png`)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyToClipboard(thumbnail.url)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}


      {/* Image Preview Modal */}
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
              className="absolute top-4 right-4"
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