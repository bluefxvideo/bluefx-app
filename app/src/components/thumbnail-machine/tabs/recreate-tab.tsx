'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RotateCcw, Upload, ImageIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import Image from 'next/image';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface RecreateTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => Promise<ThumbnailMachineResponse>;
  isGenerating: boolean;
  credits: { available_credits: number } | null;
  error?: string;
}

/**
 * Recreate Tab - Recreate thumbnails from reference images
 * Upload an existing thumbnail and generate similar variations
 */
export function RecreateTab({
  onGenerate,
  isGenerating,
  credits,
  error
}: RecreateTabProps) {
  const [formData, setFormData] = useState({
    referenceImage: null as File | null,
    prompt: '',
    style: 'similar' as 'similar' | 'improved' | 'style-transfer',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (file: File) => {
    setFormData(prev => ({ ...prev, referenceImage: file }));
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
      aspect_ratio: '16:9',
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
          <Card 
            className="p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {formData.referenceImage ? (
              <div className="space-y-3">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <Image
                    src={URL.createObjectURL(formData.referenceImage)}
                    alt="Reference thumbnail"
                    width={400}
                    height={225}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-base font-medium">{formData.referenceImage.name}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-base font-medium">Drop image or click to upload</p>
                  <p className="text-sm text-muted-foreground">Style reference for generation</p>
                </div>
              </div>
            )}
          </Card>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
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