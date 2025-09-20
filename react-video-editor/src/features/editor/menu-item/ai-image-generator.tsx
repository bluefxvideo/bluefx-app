'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wand2, 
  Sparkles, 
  Image as ImageIcon, 
  RefreshCw,
  AlertCircle,
  Check,
  Loader2
} from 'lucide-react';
import useStore from '../store/use-store';
import { ITrackItem } from '@designcombo/types';
import { dispatch } from '@designcombo/events';
import { EDIT_OBJECT } from '@designcombo/state';

interface AIImageGeneratorPanelProps {
  trackItem: ITrackItem | null;
}

interface ImageGenerationOptions {
  visual_style: 'realistic' | 'artistic' | 'minimal' | 'dynamic';
  quality: 'draft' | 'standard' | 'premium';
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:3';
}

export function AIImageGeneratorPanel({ trackItem }: AIImageGeneratorPanelProps) {
  const { trackItemsMap, activeIds } = useStore();
  
  // State for generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [prompt, setPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [options, setOptions] = useState<ImageGenerationOptions>({
    visual_style: 'realistic',
    quality: 'standard',
    aspect_ratio: '16:9'
  });

  // Get the selected AI image
  const selectedAIImage = useMemo(() => {
    if (!trackItem && activeIds.length === 1) {
      const item = trackItemsMap[activeIds[0]];
      if (item?.type === 'image' && item.metadata?.aiGenerated) {
        return item;
      }
    }
    if (trackItem?.type === 'image' && trackItem.metadata?.aiGenerated) {
      return trackItem;
    }
    return null;
  }, [trackItem, activeIds, trackItemsMap]);

  // Load original prompt and detect aspect ratio when image is selected
  useEffect(() => {
    if (selectedAIImage) {
      // Load original prompt
      if (selectedAIImage.metadata?.prompt) {
        const original = selectedAIImage.metadata.prompt;
        setOriginalPrompt(original);
        setPrompt(original);
      }
      
      // Detect and set aspect ratio
      let detectedAspectRatio: '16:9' | '9:16' | '1:1' | '4:3' = '16:9';
      
      // First check if aspect ratio is stored in metadata
      if (selectedAIImage.metadata?.aspectRatio) {
        detectedAspectRatio = selectedAIImage.metadata.aspectRatio as typeof detectedAspectRatio;
      } 
      // Otherwise, detect from dimensions if available
      else if (selectedAIImage.details?.width && selectedAIImage.details?.height) {
        const width = selectedAIImage.details.width;
        const height = selectedAIImage.details.height;
        const ratio = width / height;
        
        // Determine closest standard aspect ratio
        if (Math.abs(ratio - 16/9) < 0.1) {
          detectedAspectRatio = '16:9';
        } else if (Math.abs(ratio - 9/16) < 0.1) {
          detectedAspectRatio = '9:16';
        } else if (Math.abs(ratio - 1) < 0.1) {
          detectedAspectRatio = '1:1';
        } else if (Math.abs(ratio - 4/3) < 0.1) {
          detectedAspectRatio = '4:3';
        } else {
          // Default based on orientation
          detectedAspectRatio = ratio > 1 ? '16:9' : '9:16';
        }
      }
      // Check from the composition size as a fallback
      else {
        // Get the global composition size from store
        const { size } = useStore.getState();
        if (size) {
          const ratio = size.width / size.height;
          if (Math.abs(ratio - 16/9) < 0.1) {
            detectedAspectRatio = '16:9';
          } else if (Math.abs(ratio - 9/16) < 0.1) {
            detectedAspectRatio = '9:16';
          } else if (Math.abs(ratio - 1) < 0.1) {
            detectedAspectRatio = '1:1';
          } else {
            detectedAspectRatio = ratio > 1 ? '16:9' : '9:16';
          }
        }
      }
      
      console.log('🎯 Detected aspect ratio for image:', detectedAspectRatio);
      
      // Update options with detected aspect ratio
      setOptions(prev => ({
        ...prev,
        aspect_ratio: detectedAspectRatio,
        visual_style: selectedAIImage.metadata?.visualStyle || prev.visual_style,
        quality: selectedAIImage.metadata?.quality || prev.quality
      }));
    }
  }, [selectedAIImage]);

  const handleRegenerate = async () => {
    if (!selectedAIImage || !prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setSuccess(false);
    setProgress(10);
    
    try {
      // Simulate progress updates
      setProgress(30);

      // Use local API endpoint - no more cross-origin issues!
      const apiUrl = '/api/regenerate';
      console.log('Using local regeneration API');

      // Call the local regeneration API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_prompt: prompt,
          style_settings: options
        })
      });
      
      setProgress(70);
      
      if (!response.ok) {
        throw new Error('Failed to regenerate image');
      }
      
      const result = await response.json();
      
      if (result.success && result.image_url) {
        setProgress(90);
        
        // Update the image in the timeline
        dispatch(EDIT_OBJECT, {
          payload: {
            [selectedAIImage.id]: {
              details: {
                ...selectedAIImage.details,
                src: result.image_url
              },
              metadata: {
                ...selectedAIImage.metadata,
                prompt: prompt, // Update with new prompt
                aspectRatio: options.aspect_ratio, // Store aspect ratio
                visualStyle: options.visual_style,
                quality: options.quality,
                lastRegenerated: new Date().toISOString()
              }
            }
          }
        });
        
        console.log('✅ Image updated in timeline:', result.image_url);
        
        setProgress(100);
        setSuccess(true);
        
        // Reset success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
        
        // Update original prompt to the new one after successful regeneration
        setOriginalPrompt(prompt);
      } else {
        throw new Error(result.error || 'Image regeneration failed');
      }
      
    } catch (err) {
      console.error('Regeneration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate image');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleReset = () => {
    setPrompt(originalPrompt);
    setError(null);
    setSuccess(false);
  };

  // Credit cost calculation
  const creditCost = useMemo(() => {
    const costs = { draft: 3, standard: 4, premium: 6 };
    return costs[options.quality];
  }, [options.quality]);

  if (!selectedAIImage) {
    return (
      <div className="p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Select an AI-generated image from the timeline to regenerate it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI Image Regenerator
          </CardTitle>
          <CardDescription className="text-xs">
            Regenerate this image with a new prompt or style
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-0">
          {/* Current Image Info */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Current Image</Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
              <ImageIcon className="h-4 w-4" />
              <span className="text-sm truncate">
                {selectedAIImage.name || `Image ${selectedAIImage.id.slice(-6)}`}
              </span>
            </div>
          </div>

          {/* Prompt Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt" className="text-xs">Image Prompt</Label>
              {prompt !== originalPrompt && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleReset}
                  className="h-5 text-xs px-2"
                >
                  Reset
                </Button>
              )}
            </div>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="min-h-[80px] resize-none text-xs"
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              Be specific about composition, lighting, and style
            </p>
          </div>

          {/* Generation Options */}
          <div className="grid gap-2">
            {/* Visual Style */}
            <div className="space-y-1">
              <Label htmlFor="style" className="text-xs">Visual Style</Label>
              <Select
                value={options.visual_style}
                onValueChange={(value: any) => 
                  setOptions(prev => ({ ...prev, visual_style: value }))
                }
                disabled={isGenerating}
              >
                <SelectTrigger id="style" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realistic" className="text-xs">
                    🎨 Realistic
                  </SelectItem>
                  <SelectItem value="artistic" className="text-xs">
                    🖼️ Artistic
                  </SelectItem>
                  <SelectItem value="minimal" className="text-xs">
                    ⚡ Minimal
                  </SelectItem>
                  <SelectItem value="dynamic" className="text-xs">
                    🎬 Dynamic
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quality */}
            <div className="space-y-1">
              <Label htmlFor="quality" className="text-xs">Quality</Label>
              <Select
                value={options.quality}
                onValueChange={(value: any) => 
                  setOptions(prev => ({ ...prev, quality: value }))
                }
                disabled={isGenerating}
              >
                <SelectTrigger id="quality" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft" className="text-xs">
                    ⚡ Draft (3 credits)
                  </SelectItem>
                  <SelectItem value="standard" className="text-xs">
                    ✨ Standard (4 credits)
                  </SelectItem>
                  <SelectItem value="premium" className="text-xs">
                    💎 Premium (6 credits)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1">
              <Label htmlFor="ratio" className="text-xs">Aspect Ratio</Label>
              <Select
                value={options.aspect_ratio}
                onValueChange={(value: any) => 
                  setOptions(prev => ({ ...prev, aspect_ratio: value }))
                }
                disabled={isGenerating}
              >
                <SelectTrigger id="ratio" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9" className="text-xs">16:9 - Widescreen</SelectItem>
                  <SelectItem value="9:16" className="text-xs">9:16 - Portrait</SelectItem>
                  <SelectItem value="1:1" className="text-xs">1:1 - Square</SelectItem>
                  <SelectItem value="4:3" className="text-xs">4:3 - Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Progress Bar */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Generating new image...
              </p>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                Image regenerated successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleRegenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full h-8"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                <span className="text-xs">Generating...</span>
              </>
            ) : (
              <>
                <RefreshCw className="mr-1 h-3 w-3" />
                <span className="text-xs">Regenerate ({creditCost} credits)</span>
              </>
            )}
          </Button>

          {/* Original Prompt Reference */}
          {originalPrompt && originalPrompt !== prompt && (
            <div className="pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">Original Prompt</Label>
              <p className="text-xs mt-1 p-2 bg-muted/20 rounded text-muted-foreground">
                {originalPrompt}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}