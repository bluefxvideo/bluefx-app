'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { UserRound, Wand2 } from 'lucide-react';
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