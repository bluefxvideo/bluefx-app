'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { UserRound, Wand2, Monitor, Smartphone } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ThumbnailMachineRequest, ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';

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

  const handleSourceUpload = (file: File) => {
    setFormData(prev => ({ ...prev, sourceImage: file }));
  };

  const handleTargetUpload = (file: File) => {
    setFormData(prev => ({ ...prev, targetImage: file }));
  };

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default behavior
    e.stopPropagation(); // Stop event bubbling
    
    if (!formData.sourceImage || !formData.targetImage || isGenerating) {
      return;
    }
    
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
          <UnifiedDragDrop
            fileType="face"
            selectedFile={formData.sourceImage}
            onFileSelect={handleSourceUpload}
            disabled={isGenerating}
            previewSize="medium"
          />
        </StandardStep>

        {/* Step 2: Target Image */}
        <StandardStep
          stepNumber={2}
          title="Target Image"
          description="Image containing the face to be replaced"
        >
          <UnifiedDragDrop
            fileType="reference"
            selectedFile={formData.targetImage}
            onFileSelect={handleTargetUpload}
            disabled={isGenerating}
            title="Drop target image or click to upload"
            description="Image containing face to replace"
            previewSize="medium"
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
          type="button"
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