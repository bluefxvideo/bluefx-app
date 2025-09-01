'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RotateCcw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';

interface RecreateTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => Promise<ThumbnailMachineResponse>;
  isGenerating: boolean;
  credits: { available_credits: number } | null;
  error?: string;
  onReferenceImageChange?: (hasImage: boolean) => void;
}

/**
 * Recreate Tab - Recreate thumbnails from reference images
 * Upload an existing thumbnail and generate similar variations
 */
export function RecreateTab({
  onGenerate,
  isGenerating,
  credits,
  error,
  onReferenceImageChange
}: RecreateTabProps) {
  const [formData, setFormData] = useState({
    referenceImage: null as File | null,
    prompt: '',
    style: 'similar' as 'similar' | 'improved' | 'style-transfer',
    detectedAspectRatio: '16:9' as '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '16:10' | '10:16' | '3:1' | '1:3',
  });

  useEffect(() => {
    // Notify parent about initial state (no image)
    onReferenceImageChange?.(false);
  }, [onReferenceImageChange]);

  // Utility function to detect aspect ratio from image dimensions
  const detectAspectRatio = (width: number, height: number): '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '16:10' | '10:16' | '3:1' | '1:3' => {
    const ratio = width / height;
    
    // Define tolerance for aspect ratio matching
    const tolerance = 0.05;
    
    if (Math.abs(ratio - 1) < tolerance) return '1:1'; // Square
    if (Math.abs(ratio - 16/9) < tolerance) return '16:9'; // Widescreen
    if (Math.abs(ratio - 9/16) < tolerance) return '9:16'; // Vertical
    if (Math.abs(ratio - 4/3) < tolerance) return '4:3'; // Traditional
    if (Math.abs(ratio - 3/4) < tolerance) return '3:4'; // Portrait
    if (Math.abs(ratio - 3/2) < tolerance) return '3:2'; // Photo
    if (Math.abs(ratio - 2/3) < tolerance) return '2:3'; // Vertical photo
    if (Math.abs(ratio - 16/10) < tolerance) return '16:10'; // Widescreen alt
    if (Math.abs(ratio - 10/16) < tolerance) return '10:16'; // Vertical widescreen
    if (Math.abs(ratio - 3) < tolerance) return '3:1'; // Ultrawide
    if (Math.abs(ratio - 1/3) < tolerance) return '1:3'; // Ultra vertical
    
    // Default fallback based on orientation
    return ratio > 1 ? '16:9' : '9:16';
  };

  const handleImageUpload = (file: File | null) => {
    if (!file) {
      // Handle image removal
      setFormData(prev => ({ 
        ...prev, 
        referenceImage: null,
        detectedAspectRatio: '16:9' 
      }));
      onReferenceImageChange?.(false);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const aspectRatio = detectAspectRatio(img.width, img.height);
      setFormData(prev => ({ 
        ...prev, 
        referenceImage: file,
        detectedAspectRatio: aspectRatio 
      }));
      onReferenceImageChange?.(true);
      URL.revokeObjectURL(url); // Clean up memory
    };
    
    img.onerror = () => {
      // Fallback if image can't be loaded
      setFormData(prev => ({ ...prev, referenceImage: file }));
      onReferenceImageChange?.(true);
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  };

  const handleSubmit = async () => {
    if (!formData.referenceImage) return;
    
    const prompt = formData.prompt || 'Recreate this thumbnail with similar style and composition';
    
    // Call unified orchestrator with recreation-only mode
    await onGenerate({
      operation_mode: 'recreation-only',
      reference_image: formData.referenceImage,
      prompt,
      recreation_style: formData.style,
      aspect_ratio: formData.detectedAspectRatio, // Use detected aspect ratio
      style_type: 'Auto',
      user_id: 'current-user', // This will be handled by the parent component
    });
  };

  const estimatedCredits = 2; // Recreation operation


  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Upload Reference Image */}
        <StandardStep
          stepNumber={1}
          title="Upload Reference Image"
          description="Upload a thumbnail to recreate with variations"
        >
          <UnifiedDragDrop
            fileType="reference"
            selectedFile={formData.referenceImage}
            onFileSelect={handleImageUpload}
            disabled={isGenerating}
            title="Drop thumbnail or click to upload"
            description="Style reference for generation"
            previewSize="large"
          />
          {formData.referenceImage && (
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="text-primary font-medium">
                Detected aspect ratio: {formData.detectedAspectRatio}
              </span>
              <span className="ml-2">• Recreation will maintain this ratio</span>
            </div>
          )}
        </StandardStep>

        {/* Step 2: Describe Your Thumbnail */}
        <StandardStep
          stepNumber={2}
          title="Describe Your Thumbnail"
          description="Specify changes you want to make (optional)"
        >
          <div className="px-1">
            <Textarea
              placeholder="Describe changes you want... (e.g., 'Make it more vibrant', 'Change the background', 'Add more energy', 'Keep the same style but brighter colors')"
              value={formData.prompt}
              onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
              className="min-h-[80px] resize-y"
            />
            <div className="flex justify-between text-sm text-muted-foreground mt-1">
              <span>Leave empty to recreate exact style</span>
              <span>{formData.prompt.length}/500</span>
            </div>
          </div>
        </StandardStep>

        {/* Step 3: Choose Recreation Style */}
        <StandardStep
          stepNumber={3}
          title="Choose Recreation Style"
          description="Select how to recreate your reference image"
        >
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'similar', label: 'Similar Style', desc: 'Keep the same style and composition' },
              { id: 'improved', label: 'Enhanced Version', desc: 'Improve quality and details' },
              { id: 'style-transfer', label: 'Style Transfer', desc: 'Apply modern thumbnail trends' }
            ].map((option) => (
              <Card 
                key={option.id}
                className={`p-3 cursor-pointer transition-colors ${
                  formData.style === option.id 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:bg-muted/30'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, style: option.id as any }))}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={formData.style === option.id}
                    onChange={() => {}}
                    className="text-primary"
                  />
                  <div>
                    <p className="text-base font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={!formData.referenceImage || isGenerating || (credits?.available_credits || 0) < estimatedCredits}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              Recreating Thumbnail...
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4 mr-2" />
              Recreate Thumbnail ({estimatedCredits} credits)
            </>
          )}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}