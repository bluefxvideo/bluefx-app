'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { UserRound, Upload, Wand2, Monitor, Smartphone } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import Image from 'next/image';

interface FaceSwapTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => Promise<ThumbnailMachineResponse>;
  isGenerating: boolean;
  credits: { available_credits: number } | null;
  error?: string;
}

/**
 * Face Swap Tab - Dedicated interface for face swapping
 * Focuses on uploading face images and applying to generated thumbnails
 */
export function FaceSwapTab({
  onGenerate,
  isGenerating,
  credits,
  error
}: FaceSwapTabProps) {
  const [formData, setFormData] = useState({
    sourceImage: null as File | null,
    targetImage: null as File | null,
    aspect_ratio: '16:9' as '16:9' | '9:16',
  });
  
  // Create refs for both file inputs
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const handleSourceUpload = (file: File) => {
    setFormData(prev => ({ ...prev, sourceImage: file }));
  };

  const handleTargetUpload = (file: File) => {
    setFormData(prev => ({ ...prev, targetImage: file }));
  };

  const handleSubmit = async () => {
    if (!formData.sourceImage || !formData.targetImage) return;
    
    // Call unified orchestrator with face-swap-only mode
    await onGenerate({
      operation_mode: 'face-swap-only',
      aspect_ratio: formData.aspect_ratio,
      face_swap: {
        source_image: formData.sourceImage,
        target_image: formData.targetImage,
      },
      user_id: 'current-user', // This will be handled by the parent component
    });
  };

  const estimatedCredits = 3; // Just face swap operation

  return (
    <TabContentWrapper>
      {/* Form Content */}
      <TabBody>
        {/* Step 1: Upload Your Face */}
        <StandardStep
          stepNumber={1}
          title="Upload Your Face"
          description="Your face will be swapped into the thumbnails"
        >
          <Card 
            className="p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors"
            onClick={() => sourceInputRef.current?.click()}
          >
            {formData.sourceImage ? (
              <div className="space-y-3">
                <div className="relative w-32 h-32 mx-auto rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={URL.createObjectURL(formData.sourceImage)}
                    alt="Source face"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium">{formData.sourceImage.name}</p>
                  <p className="text-sm text-muted-foreground">Click to change face image</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-base font-medium">Upload your face image</p>
                  <p className="text-sm text-muted-foreground">Clear photo with visible face</p>
                </div>
              </div>
            )}
          </Card>
          <input
            ref={sourceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSourceUpload(file);
            }}
          />
        </StandardStep>

        {/* Step 2: Target Image */}
        <StandardStep
          stepNumber={2}
          title="Target Image"
          description="Image containing the face to be replaced"
        >
          <Card 
            className="p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors"
            onClick={() => targetInputRef.current?.click()}
          >
            {formData.targetImage ? (
              <div className="space-y-3">
                <div className="relative w-32 h-32 mx-auto rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={URL.createObjectURL(formData.targetImage)}
                    alt="Target image"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium">{formData.targetImage.name}</p>
                  <p className="text-sm text-muted-foreground">Click to change target image</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-base font-medium">Upload target image</p>
                  <p className="text-sm text-muted-foreground">Image containing face to replace</p>
                </div>
              </div>
            )}
          </Card>
          <input
            ref={targetInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleTargetUpload(file);
            }}
          />
        </StandardStep>

        {/* Step 3: Choose Aspect Ratio */}
        <StandardStep
          stepNumber={3}
          title="Choose Aspect Ratio"
          description="Select the output format for your face swap"
        >
          <div className="grid grid-cols-2 gap-3">
            {/* Landscape 16:9 */}
            <Card 
              className={`p-4 cursor-pointer transition-all duration-300 ${
                formData.aspect_ratio === '16:9'
                  ? 'border-primary bg-primary/10 shadow-lg' 
                  : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-secondary/50'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, aspect_ratio: '16:9' }))}
            >
              <div className="flex flex-col items-center gap-3">
                <div className={`w-12 h-8 rounded border-2 flex items-center justify-center ${
                  formData.aspect_ratio === '16:9'
                    ? 'border-primary bg-primary/20' 
                    : 'border-muted-foreground/40'
                }`}>
                  <Monitor className={`w-4 h-4 ${
                    formData.aspect_ratio === '16:9' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-medium ${
                    formData.aspect_ratio === '16:9' ? 'text-primary' : 'text-foreground'
                  }`}>
                    Landscape
                  </p>
                  <p className="text-xs text-muted-foreground">16:9 • YouTube</p>
                </div>
              </div>
            </Card>

            {/* Portrait 9:16 */}
            <Card 
              className={`p-4 cursor-pointer transition-all duration-300 ${
                formData.aspect_ratio === '9:16'
                  ? 'border-primary bg-primary/10 shadow-lg' 
                  : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-secondary/50'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, aspect_ratio: '9:16' }))}
            >
              <div className="flex flex-col items-center gap-3">
                <div className={`w-8 h-12 rounded border-2 flex items-center justify-center ${
                  formData.aspect_ratio === '9:16'
                    ? 'border-primary bg-primary/20' 
                    : 'border-muted-foreground/40'
                }`}>
                  <Smartphone className={`w-4 h-4 ${
                    formData.aspect_ratio === '9:16' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-medium ${
                    formData.aspect_ratio === '9:16' ? 'text-primary' : 'text-foreground'
                  }`}>
                    Portrait
                  </p>
                  <p className="text-xs text-muted-foreground">9:16 • Vertical</p>
                </div>
              </div>
            </Card>
          </div>
        </StandardStep>

      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={!formData.sourceImage || !formData.targetImage || isGenerating || (credits?.available_credits || 0) < estimatedCredits}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              Processing Face Swap...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Perform Face Swap ({estimatedCredits} credits)
            </>
          )}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}