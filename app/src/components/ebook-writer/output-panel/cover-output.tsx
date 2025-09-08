'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Image,
  Download,
  Loader2,
  Sparkles,
  RefreshCw,
  ZoomIn,
  ExternalLink,
  Layout
} from 'lucide-react';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { useEbookWriterStore } from '../store/ebook-writer-store';
import { SharedActionsMenu } from '../components/shared-actions-menu';
import type { EbookMetadata } from '../store/ebook-writer-store';

interface CoverOutputProps {
  ebook: EbookMetadata | null;
}

export function CoverOutput({ ebook }: CoverOutputProps) {
  const { generation_progress, current_ebook } = useEbookWriterStore();
  const [imageLoading, setImageLoading] = useState(false);
  
  // Use current_ebook from store if ebook prop doesn't have cover yet
  const coverData = ebook?.cover || current_ebook?.cover;
  
  // Debug logging
  console.log('🖼️ CoverOutput Debug:', {
    ebook_cover: ebook?.cover,
    current_ebook_cover: current_ebook?.cover,
    coverData,
    has_image_url: !!coverData?.image_url
  });
  
  const handleDownload = async () => {
    if (!coverData?.image_url) return;
    
    try {
      // Open image in new tab for download
      window.open(coverData.image_url, '_blank');
    } catch (error) {
      console.error('Error downloading cover:', error);
    }
  };
  
  const handleViewFullSize = () => {
    if (!coverData?.image_url) {
      return;
    }
    window.open(coverData.image_url, '_blank');
  };
  
  // Loading state during generation
  if (generation_progress.is_generating && generation_progress.current_step === 'cover') {
    return (
      <OutputPanelShell
        title="Cover Design"
        subtitle="AI-generated book cover"
        status="loading"
      >
        <div className="flex items-center justify-center h-full">
          <UnifiedEmptyState
            icon={Sparkles}
            title="Generating Cover..."
            description="Creating a professional book cover based on your preferences"
          />
        </div>
      </OutputPanelShell>
    );
  }
  
  // No cover generated yet
  if (!coverData) {
    return (
      <div className="h-full flex flex-col min-h-0">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-border bg-muted/30">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Cover Design</h2>
              <p className="text-sm text-muted-foreground mt-1">
                AI-generated book cover
              </p>
            </div>
            <SharedActionsMenu />
          </div>
        </div>
        
        {/* Centered Empty State */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <UnifiedEmptyState
            icon={Image}
            title="Generate Cover Design"
            description="Create a professional book cover that attracts readers and represents your content."
          />
        </div>
      </div>
    );
  }
  
  // Cover display
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Cover Preview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {ebook?.title || current_ebook?.title || 'Untitled Book'}
            </p>
          </div>
          <SharedActionsMenu />
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible scrollbar-hover">
        <div className="p-6 space-y-6">
          {/* Cover Image - Fixed height with object-fit */}
          <Card className="overflow-hidden bg-secondary">
            <CardContent className="p-0">
              <div className="relative bg-gray-100 dark:bg-gray-800" style={{ height: '500px' }}>
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                <img
                  src={coverData.image_url}
                  alt="Book Cover"
                  className={`w-full h-full object-contain ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
                  style={{ maxHeight: '500px' }}
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
                {/* Overlay Actions */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleViewFullSize}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleDownload}
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Cover Details */}
          <Card className="bg-secondary">
            <CardHeader className="pb-3">
              <h3 className="text-sm font-medium">Cover Details</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Title & Author */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Title</span>
                  <span className="text-sm font-medium">{ebook?.title || current_ebook?.title}</span>
                </div>
                {coverData.author_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Author</span>
                    <span className="text-sm font-medium">{coverData.author_name}</span>
                  </div>
                )}
                {coverData.subtitle && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subtitle</span>
                    <span className="text-sm font-medium">{coverData.subtitle}</span>
                  </div>
                )}
              </div>
              
              {/* Style Settings */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">
                    <Layout className="h-3 w-3 mr-1" />
                    {coverData.style}
                  </Badge>
                  <Badge variant="secondary">
                    <Image className="h-3 w-3 mr-1" />
                    {coverData.color_scheme}
                  </Badge>
                  <Badge variant="secondary">
                    {coverData.font_style}
                  </Badge>
                </div>
              </div>
              
              {/* Generation Info */}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Generated</span>
                  <span>{new Date(coverData.generated_at || Date.now()).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Actions Card */}
          <Card className="bg-secondary">
            <CardHeader className="pb-3">
              <h3 className="text-sm font-medium">Actions</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleViewFullSize}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Full Size
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Cover
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}