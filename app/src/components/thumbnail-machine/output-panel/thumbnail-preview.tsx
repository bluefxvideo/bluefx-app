'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, Copy, Loader2, Images, Sparkles, ExternalLink, X } from 'lucide-react';
import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';

// Helper function to validate URLs
function isValidUrl(url: string): boolean {
  try {
    if (!url || url.trim() === '') return false;
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

interface ThumbnailPreviewProps {
  result: ThumbnailMachineResponse;
  isGenerating?: boolean;
  onDownload?: () => void;
  onOpenInNewTab?: () => void;
  onCreateNew?: () => void;
  onCancelGeneration?: () => void;
  prompt?: string;
  activeTab?: string;
}

/**
 * UNIFIED Thumbnail Preview Component (matches AI Cinematographer pattern)
 * Handles ALL states: processing → completed in a single component
 * No more fragmentation between preview/results/grid components
 */
export function ThumbnailPreview({ 
  result, 
  isGenerating = false,
  onDownload, 
  onOpenInNewTab, 
  onCreateNew,
  onCancelGeneration,
  prompt,
  activeTab = 'generate'
}: ThumbnailPreviewProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Determine expected aspect ratio from result data or active tab context
  const getExpectedAspectRatio = (): 'landscape' | 'portrait' | 'square' => {
    // For recreate tab: try to detect from the uploaded reference image or result
    if (activeTab === 'recreate') {
      // If we have a completed result, use the actual image to detect ratio
      const thumbnail = result?.thumbnails?.[0];
      if (thumbnail) {
        // We'll update this when the image loads, but for now assume portrait
        // since the screenshot shows a portrait result
        return 'portrait';
      }
      // Default to portrait for recreate if no result yet (will be updated on image load)
      return 'portrait';
    }
    
    // For generate tab: check aspect_ratio from generation settings
    if (activeTab === 'generate') {
      const inputData = result?.thumbnails?.[0];
      const generationSettings = inputData?.generation_settings;
      
      if (generationSettings?.aspect_ratio) {
        const aspectRatio = generationSettings.aspect_ratio;
        if (aspectRatio === '9:16' || aspectRatio === '3:4' || aspectRatio === '2:3' || aspectRatio === '10:16') {
          return 'portrait';
        } else if (aspectRatio === '1:1') {
          return 'square';
        } else {
          return 'landscape';
        }
      }
    }
    
    // For face-swap: usually portrait
    if (activeTab === 'face-swap') {
      return 'portrait';
    }
    
    // Default
    return 'landscape';
  };
  
  const [imageAspectRatio, setImageAspectRatio] = useState<'landscape' | 'portrait' | 'square'>(getExpectedAspectRatio());
  
  // Update aspect ratio when activeTab or result changes
  React.useEffect(() => {
    setImageAspectRatio(getExpectedAspectRatio());
  }, [activeTab, result]);

  // Handle image load to detect aspect ratio
  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.target as HTMLImageElement;
    const { naturalWidth, naturalHeight } = img;
    
    if (naturalWidth > naturalHeight) {
      setImageAspectRatio('landscape');
    } else if (naturalHeight > naturalWidth) {
      setImageAspectRatio('portrait');
    } else {
      setImageAspectRatio('square');
    }
    
    console.log('📐 Image aspect ratio detected:', {
      naturalWidth,
      naturalHeight,
      ratio: naturalWidth / naturalHeight,
      classification: naturalWidth > naturalHeight ? 'landscape' : naturalHeight > naturalWidth ? 'portrait' : 'square'
    });
  }, []);

  // EXACT same hasResults logic as title (contextual-output.tsx line 98-100)
  const hasResults = activeTab === 'face-swap' 
    ? (result?.face_swapped_thumbnails && result?.face_swapped_thumbnails.length > 0)
    : (result?.thumbnails && result?.thumbnails.length > 0);
  
  
  // ✅ FIX: Remove isWaitingForWebhook - Face Swap uses same pattern as Normal Generate
  const effectivelyGenerating = isGenerating;

  // Select the primary result to display - prioritize based on active tab
  const displayThumbnail = result.thumbnails?.[0];
  const displayFaceSwapped = result.face_swapped_thumbnails?.[0];
  
  // Create unified result object with consistent URL property
  const primaryResult = (() => {
    const selected = activeTab === 'face-swap' 
      ? (displayFaceSwapped || displayThumbnail)  // Face swap tab: prioritize face swap result
      : (displayThumbnail || displayFaceSwapped); // Other tabs: prioritize thumbnail result
    
    if (!selected) return null;
    
    // Face swap results use 'image_url', thumbnails use 'url' - normalize to 'url'
    const normalizedUrl = selected.image_url || selected.url || '';
    console.log('🖼️ Primary result URL mapping:', {
      activeTab,
      selectedType: selected.image_url ? 'face-swap' : 'thumbnail',
      originalImageUrl: selected.image_url,
      originalUrl: selected.url, 
      normalizedUrl,
      isValid: isValidUrl(normalizedUrl)
    });
    
    return {
      ...selected,
      url: normalizedUrl
    };
  })();

  // Download/Copy utilities (moved from ResultsGrid)
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

  return (
    <div className="w-full h-auto">
      <Card className="overflow-hidden h-auto">
        
        {/* UNIFIED CONTENT AREA */}
        {hasResults && result?.success ? (
          // ✅ PRIORITY 1: Show actual result if we have data (regardless of isGenerating)
          <div className="flex justify-center p-4 max-h-[60vh] overflow-hidden">
            <div className={`group relative rounded-lg overflow-hidden 
                            border border-zinc-700/50 shadow-xl w-full
                            ${imageAspectRatio === 'portrait' ? 'max-h-[48vh] aspect-[9/16]' : 
                              imageAspectRatio === 'square' ? 'max-h-[45vh] aspect-square' : 
                              'max-w-4xl max-h-[40vh] aspect-video'}`}>
              {primaryResult?.url && isValidUrl(primaryResult.url) ? (
                <Image
                  src={primaryResult.url}
                  alt={displayThumbnail ? `Thumbnail ${displayThumbnail.variation_index}` : "Face swapped thumbnail"}
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 bg-secondary/10"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  onLoad={handleImageLoad}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-secondary/20 text-muted-foreground">
                  <div className="text-center">
                    <Images className="w-12 h-12 mx-auto mb-2" />
                    <p>Image not available</p>
                  </div>
                </div>
              )}
              
              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 
                             transition-all duration-300 flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 
                              backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300"
                    onClick={() => primaryResult?.url && isValidUrl(primaryResult.url) && setSelectedImage(primaryResult.url)}
                  >
                    <Eye className="w-5 h-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-blue-500/80 hover:bg-blue-500 text-white border-0 
                              shadow-lg hover:scale-110 transition-all duration-300"
                    onClick={() => {
                      if (primaryResult?.url && isValidUrl(primaryResult.url)) {
                        downloadImage(
                          primaryResult.url,
                          displayThumbnail ? `thumbnail-${displayThumbnail.variation_index}.webp` : 'faceswap.webp'
                        );
                      }
                    }}
                  >
                    <Download className="w-5 h-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 
                              backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300"
                    onClick={() => {
                      if (primaryResult?.url && isValidUrl(primaryResult.url)) {
                        copyToClipboard(primaryResult.url);
                      }
                    }}
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
          </div>
        ) : isGenerating ? (
          // ✅ PROCESSING STATE: Show unified processing card matching image container size
          <div className="flex justify-center p-4 max-h-[60vh] overflow-hidden">
            <div className={`group relative rounded-lg overflow-hidden 
                            border border-zinc-700/50 shadow-xl w-full flex items-center justify-center
                            ${imageAspectRatio === 'portrait' ? 'max-h-[48vh] aspect-[9/16]' : 
                              imageAspectRatio === 'square' ? 'max-h-[45vh] aspect-square' : 
                              'max-w-4xl max-h-[40vh] aspect-video'}`}>
              <Card className="relative p-8 w-full h-full text-center space-y-4 border-none bg-transparent dark:bg-card-content/50 flex flex-col justify-center">
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
              
              {/* Blue Square with Spinning Icon */}
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              
              {/* Processing Text */}
              <div className="space-y-2 px-2">
                <h3 className="font-medium text-center">
                  {activeTab === 'face-swap' ? 'Processing Face Swap...' : 
                   activeTab === 'recreate' ? 'Recreating Thumbnail...' : 'Generating Images...'}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {(() => {
                    const text = prompt || 'Creating your thumbnail variations...';
                    return text.length > 100 ? `${text.substring(0, 100)}...` : text;
                  })()}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-yellow-500">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {activeTab === 'face-swap' ? '~1-2 minutes' : 
                     activeTab === 'recreate' ? '~45-90 seconds' : '~30-60 seconds'}
                  </span>
                </div>
              </div>
            </Card>
            </div>
          </div>
        ) : (
          // Empty state - show nothing or minimal placeholder
          <div className="relative aspect-video bg-muted/20 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No results to display</p>
          </div>
        )}

        {/* UNIFIED FOOTER - Always visible (matches AI Cinematographer pattern) */}
        <div className="p-4 bg-card border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex-1 min-w-0 mr-2">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">
                  {activeTab === 'face-swap' ? 'Face Swap Result' : 
                   activeTab === 'recreate' ? 'Recreation Result' : 
                   'Generated Thumbnails'}
                </h4>
                <Badge variant="outline" className="text-xs">
                  {activeTab === 'face-swap' ? 'Face Swap' : 
                   activeTab === 'recreate' ? 'Recreation' : 
                   'Generation'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {(() => {
                  const text = prompt || 'Image generation in progress...';
                  return text.length > 60 ? `${text.substring(0, 60)}...` : text;
                })()}
              </p>
            </div>
            
            <div className="flex gap-1 items-center shrink-0">
              <span className="text-muted-foreground text-xs">{result.batch_id?.slice(-8) || ''}</span>
              <span className={hasResults && !effectivelyGenerating ? 'text-green-500' : 'text-yellow-500'}>
                {hasResults && !effectivelyGenerating ? '✓' : '⋯'}
              </span>
              
              {/* Action Buttons - only show when images are ready */}
              {hasResults && !effectivelyGenerating && (
                <div className="flex gap-1 ml-2">
                  {onOpenInNewTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onOpenInNewTab}
                      className="h-6 w-6 p-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  )}
                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDownload}
                      className="h-6 w-6 p-0"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Create New Button - bottom row when generation is complete */}
          {hasResults && !effectivelyGenerating && onCreateNew && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateNew}
                className="w-full text-xs"
              >
                <Images className="w-3 h-3 mr-1" />
                Create New {activeTab === 'face-swap' ? 'Face Swap' : 
                           activeTab === 'recreate' ? 'Recreation' : 'Thumbnails'}
              </Button>
            </div>
          )}
        </div>
      </Card>

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
              className="max-w-full max-h-full object-contain"
              width={800}
              height={600}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
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