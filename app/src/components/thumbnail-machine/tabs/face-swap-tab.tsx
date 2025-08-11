'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { UserRound, Upload, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ThumbnailMachineRequest } from '@/actions/tools/thumbnail-machine';
import { TabContentWrapper, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface FaceSwapTabProps {
  onGenerate: (request: ThumbnailMachineRequest) => void;
  isGenerating: boolean;
  credits: number;
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
    applyToAll: false,
    prompt: '',
  });

  const handleSourceUpload = (file: File) => {
    setFormData(prev => ({ ...prev, sourceImage: file }));
  };

  const _handleTargetUpload = (file: File) => {
    setFormData(prev => ({ ...prev, targetImage: file }));
  };

  const handleSubmit = () => {
    if (!formData.sourceImage || !formData.targetImage) return;
    
    const prompt = formData.prompt || 'Face swap with original style maintained';
    
    onGenerate({
      prompt,
      face_swap: {
        source_image: formData.sourceImage,
        target_image: formData.targetImage,
        apply_to_all: formData.applyToAll
      },
      num_outputs: 4,
      aspect_ratio: '16:9',
      user_id: 'current-user',
    });
  };

  const estimatedCredits = 4 * 2 + (formData.applyToAll ? 4 * 3 : 3); // Thumbnails + face swaps

  return (
    <TabContentWrapper>
      {/* Error Display */}
      {error && <TabError error={error} />}

      {/* Form Content */}
      <TabBody>
        {/* Step 1: Upload Your Face */}
        <StandardStep
          stepNumber={1}
          title="Upload Your Face"
          description="Your face will be swapped into the thumbnails"
        >
          <Card className="p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors">
            {formData.sourceImage ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-base font-medium">{formData.sourceImage.name}</p>
                  <p className="text-sm text-muted-foreground">Face to apply to thumbnails</p>
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
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSourceUpload(file);
              }}
            />
          </Card>
        </StandardStep>

        {/* Step 2: Target Image */}
        <StandardStep
          stepNumber={2}
          title="Target Image"
          description="Image containing the face to be replaced"
        >
          <Card className="p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors">
            {formData.targetImage ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-base font-medium">{formData.targetImage.name}</p>
                  <p className="text-sm text-muted-foreground">Face to be replaced</p>
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
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) _handleTargetUpload(file);
              }}
            />
          </Card>
        </StandardStep>

        {/* Step 3: Modification Instructions (Optional) */}
        <StandardStep
          stepNumber={3}
          title="Modification Instructions"
          description="Optional style adjustments for the face swap"
        >
          <div className="px-1">
            <Textarea
              placeholder="Describe modifications you want... (e.g., 'Brighter lighting', 'More dramatic expression', 'Change background color')"
              value={formData.prompt}
              onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
              className="min-h-[80px] resize-y"
            />
            <div className="flex justify-between text-sm text-muted-foreground mt-1">
              <span>Leave empty to keep original style</span>
              <span>{formData.prompt.length}/500</span>
            </div>
          </div>
        </StandardStep>

      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={!formData.sourceImage || !formData.targetImage || isGenerating || credits < estimatedCredits}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing Face Swap...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate with Face Swap
            </>
          )}
        </Button>
      </TabFooter>
    </TabContentWrapper>
  );
}