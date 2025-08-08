'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { UserRound, Upload, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ThumbnailMachineRequest } from '@/actions/tools/thumbnail-machine';
import { TabContentWrapper, TabHeader, TabBody, TabError, TabFooter } from '@/components/tools/tab-content-wrapper';

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
    applyToAll: true,
    prompt: '',
  });

  const handleSourceUpload = (file: File) => {
    setFormData(prev => ({ ...prev, sourceImage: file }));
  };

  const handleTargetUpload = (file: File) => {
    setFormData(prev => ({ ...prev, targetImage: file }));
  };

  const handleSubmit = () => {
    if (!formData.sourceImage || !formData.prompt.trim()) return;
    
    onGenerate({
      prompt: formData.prompt,
      face_swap: {
        source_image: formData.sourceImage,
        target_image: formData.targetImage || undefined,
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
      
      {/* Header */}
      <TabHeader
        icon={UserRound}
        title="Face Swap"
        description="Replace faces in generated thumbnails with your own"
      />

      {/* Form Content */}
      <TabBody>
        {/* Prompt */}
        <div>
          <Label className="text-base font-medium mb-2 block">Thumbnail Concept</Label>
          <Textarea
            placeholder="Describe the thumbnail style you want before face swap is applied..."
            value={formData.prompt}
            onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
            className="min-h-[80px] resize-none"
          />
        </div>

        {/* Source Face Upload */}
        <div>
          <Label className="text-base font-medium mb-2 block">Your Face Image</Label>
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
        </div>

        {/* Target Image (Optional) */}
        <div>
          <Label className="text-base font-medium mb-2 block">Target Image (Optional)</Label>
          <Card className="p-4 border-2 border-dashed rounded-lg border-muted-foreground/40 bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors">
            {formData.targetImage ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-base font-medium">{formData.targetImage.name}</p>
                  <p className="text-sm text-muted-foreground">Target face to replace</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-base font-medium">Target face (optional)</p>
                  <p className="text-sm text-muted-foreground">Specific face to replace in generated images</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Options */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="apply-all"
            checked={formData.applyToAll}
            onChange={(e) => setFormData(prev => ({ ...prev, applyToAll: e.target.checked }))}
            className="rounded"
          />
          <Label htmlFor="apply-all" className="text-base">
            Apply face swap to all generated thumbnails
          </Label>
        </div>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={!formData.sourceImage || !formData.prompt.trim() || isGenerating || credits < estimatedCredits}
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