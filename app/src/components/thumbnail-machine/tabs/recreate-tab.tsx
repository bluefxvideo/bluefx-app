'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RotateCcw, Upload, ImageIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ThumbnailMachineRequest } from '@/actions/tools/thumbnail-machine';
import Image from 'next/image';
import { TabContentWrapper, TabHeader, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';

interface RecreateTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => void;
  isGenerating: boolean;
  credits: number;
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

  const handleSubmit = () => {
    if (!formData.referenceImage) return;
    
    const prompt = formData.prompt || 'Recreate this thumbnail with similar style and composition';
    
    onGenerate({
      prompt,
      reference_image: formData.referenceImage,
      num_outputs: 4,
      aspect_ratio: '16:9',
      guidance_scale: 7, // Higher guidance for recreation
      user_id: 'current-user',
    });
  };

  const estimatedCredits = 4 * 2; // 4 thumbnails

  return (
    <TabContentWrapper>
      {/* Error Display */}
      {error && <TabError error={error} />}
      
      {/* Header */}
      <TabHeader
        icon={RotateCcw}
        title="Recreate"
        description="Upload a reference thumbnail and generate similar variations"
      />

      <TabBody>
        {/* Reference Image Upload */}
        <div>
          <Label className="text-base font-medium mb-2 block">Reference Thumbnail</Label>
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
        </div>

        {/* Optional Description */}
        <div>
          <Label className="text-base font-medium mb-2 block">Modification Instructions (Optional)</Label>
          <div className="px-1">
            <Textarea
              placeholder="e.g., 'Make it more vibrant', 'Change the background', 'Add more energy'..."
              value={formData.prompt}
              onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
              className="min-h-[80px] resize-none bg-muted border-muted-foreground focus:outline-offset-[-1px]"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Leave empty to recreate the exact style and composition
          </p>
        </div>

        {/* Style Options */}
        <div>
          <Label className="text-base font-medium mb-2 block">Recreation Style</Label>
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
        </div>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={!formData.referenceImage || isGenerating || credits < estimatedCredits}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Recreating Thumbnail...
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4 mr-2" />
              Recreate Thumbnail
            </>
          )}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}