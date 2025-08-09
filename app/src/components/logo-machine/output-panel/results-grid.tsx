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
      {/* Original Thumbnails */}
      {thumbnails.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-medium">Generated Thumbnails</h4>
            <Badge variant="secondary">{thumbnails.length}</Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {thumbnails.map((thumbnail) => (
              <Card key={thumbnail.id} className="group overflow-hidden">
                <div className="relative aspect-video">
                  <Image
                    src={thumbnail.url}
                    alt={`Thumbnail ${thumbnail.variation_index}`}
                    fill
                    className="object-cover"
                  />
                  
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
                      onClick={() => downloadImage(thumbnail.url, `thumbnail-${thumbnail.variation_index}.webp`)}
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
                  
                  {/* Variation Badge */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      #{thumbnail.variation_index}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Face Swapped Thumbnails */}
      {faceSwappedThumbnails.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-medium">Face Swapped</h4>
            <Badge variant="secondary">{faceSwappedThumbnails.length}</Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {faceSwappedThumbnails.map((thumbnail, index) => (
              <Card key={index} className="group overflow-hidden">
                <div className="relative aspect-video">
                  <Image
                    src={thumbnail.url}
                    alt={`Face swapped thumbnail ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  
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
                      onClick={() => downloadImage(thumbnail.url, `faceswap-${index + 1}.webp`)}
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
                  
                  {/* Face Swap Badge */}
                  <div className="absolute top-2 left-2">
                    <Badge className="text-xs bg-blue-500">
                      Face Swap
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Generated Titles */}
      {titles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-medium">YouTube Titles</h4>
            <Badge variant="secondary">{titles.length}</Badge>
          </div>
          
          <div className="space-y-2">
            {titles.map((title, index) => (
              <Card key={index} className="p-3 group">
                <div className="flex items-center justify-between">
                  <p className="text-sm flex-1 mr-3">{title}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(title)}
                    >
                      <Copy className="w-3 h-3" />
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