'use client';

import React, { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Download, Eye, Copy, Loader2, Images, Sparkles, ExternalLink, X, Pencil, Send, ImagePlus, Link } from 'lucide-react';
import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { uploadImageToStorage } from '@/actions/supabase-storage';

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
  onEditThumbnail?: (editPrompt: string, additionalImageUrls: string[]) => void;
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
  onEditThumbnail,
  prompt,
  activeTab = 'generate'
}: ThumbnailPreviewProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [ytEditUrl, setYtEditUrl] = useState('');
  const [isFetchingYtEdit, setIsFetchingYtEdit] = useState(false);

  const handleGrabYtForEdit = async () => {
    const match = ytEditUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/
    );
    const videoId = match?.[1];
    if (!videoId) return;

    setIsFetchingYtEdit(true);
    const tryLoad = (url: string): Promise<string | null> =>
      new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(null);
        img.src = url;
      });

    const url =
      (await tryLoad(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`)) ||
      (await tryLoad(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`));

    if (url) {
      setEditImages(prev => [...prev, url]);
    }
    setYtEditUrl('');
    setIsFetchingYtEdit(false);
  };
  
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
      const generationSettings = (inputData as any)?.generation_settings;
      
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
    
    // Face swap results use 'image_url', thumbnails use 'image_urls' array or 'url' - normalize to 'url'
    const normalizedUrl = (selected as any).image_url || selected.url || ((selected as any).image_urls && (selected as any).image_urls[0]) || '';
    
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
                  alt={displayThumbnail ? `Thumbnail ${(displayThumbnail as any).variation_index || 1}` : "Face swapped thumbnail"}
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
                    className="
                              shadow-lg hover:scale-110 transition-all duration-300"
                    onClick={() => {
                      if (primaryResult?.url && isValidUrl(primaryResult.url)) {
                        downloadImage(
                          primaryResult.url,
                          displayThumbnail ? `thumbnail-${(displayThumbnail as any).variation_index || 1}.jpeg` : 'faceswap.jpeg'
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
                  // Get prompt from result data if available (cast to any to access prompt property)
                  const resultPrompt = (displayThumbnail as any)?.prompt || (displayFaceSwapped as any)?.prompt || (result as any).prompt;
                  const text = prompt || resultPrompt || (effectivelyGenerating ? 'Image generation in progress...' : 'Generation complete');
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
          
          {/* Edit / Create New Buttons - bottom row when generation is complete */}
          {hasResults && !effectivelyGenerating && (
            <div className="pt-2 flex gap-2">
              {onEditThumbnail && (
                <Button
                  variant={editMode ? 'secondary' : 'default'}
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                  className="flex-1 text-xs"
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  {editMode ? 'Close Editor' : 'Edit This (10 credits)'}
                </Button>
              )}
              {onCreateNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCreateNew}
                  className="flex-1 text-xs"
                >
                  <Images className="w-3 h-3 mr-1" />
                  Create New
                </Button>
              )}
            </div>
          )}

          {/* Inline Edit Panel */}
          {editMode && hasResults && !effectivelyGenerating && onEditThumbnail && (
            <div className="pt-3 border-t mt-3 space-y-3">
              {/* Quick edit chips */}
              <div className="flex flex-wrap gap-1.5">
                {['Brighter', 'Darker', 'Change background', 'More dramatic', 'Zoom in', 'Add text'].map((chip) => (
                  <Button
                    key={chip}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      onEditThumbnail(chip, editImages);
                      setEditMode(false);
                      setEditPrompt('');
                      setEditImages([]);
                    }}
                  >
                    {chip}
                  </Button>
                ))}
              </div>

              {/* Grab thumbnail from YouTube URL */}
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    value={ytEditUrl}
                    onChange={(e) => setYtEditUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGrabYtForEdit(); } }}
                    placeholder="YouTube URL..."
                    className="pl-8 h-7 text-xs"
                    disabled={isFetchingYtEdit || editImages.length >= 5}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGrabYtForEdit}
                  disabled={!ytEditUrl.trim() || isFetchingYtEdit || editImages.length >= 5}
                  className="h-7 text-xs px-2"
                >
                  {isFetchingYtEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Grab'}
                </Button>
              </div>

              {/* Additional image uploads */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Add images (logo, person, etc.):</p>
                <div className="flex flex-wrap gap-2">
                  {editImages.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        src={url}
                        alt={`Edit ref ${i + 1}`}
                        className="h-12 w-12 rounded border border-border object-cover"
                      />
                      <button
                        onClick={() => setEditImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {editImages.length < 5 && (
                    <>
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;
                          setIsUploadingEditImage(true);
                          try {
                            for (const file of Array.from(files).slice(0, 5 - editImages.length)) {
                              const result = await uploadImageToStorage(file, {
                                folder: 'reference-images',
                                contentType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
                              });
                              if (result.success && result.url) {
                                setEditImages(prev => [...prev, result.url!]);
                              }
                            }
                          } finally {
                            setIsUploadingEditImage(false);
                            if (editFileInputRef.current) editFileInputRef.current.value = '';
                          }
                        }}
                        className="hidden"
                        id="edit-image-upload"
                      />
                      <label
                        htmlFor="edit-image-upload"
                        className={`flex flex-col items-center justify-center h-12 w-12 border border-dashed border-border rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                          isUploadingEditImage ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        {isUploadingEditImage ? (
                          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                        ) : (
                          <ImagePlus className="w-4 h-4 text-muted-foreground" />
                        )}
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Edit prompt input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editPrompt.trim()) {
                    onEditThumbnail(editPrompt, editImages);
                    setEditMode(false);
                    setEditPrompt('');
                    setEditImages([]);
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Describe what to change..."
                  className="flex-1 h-9 text-sm"
                />
                <Button
                  type="submit"
                  disabled={!editPrompt.trim()}
                  size="sm"
                  className="h-9 px-3"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
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