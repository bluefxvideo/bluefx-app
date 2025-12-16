'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image, X, Upload, Plus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { StartingShotRequest } from '@/actions/tools/ai-cinematographer';
import { NANO_BANANA_ASPECT_RATIOS, type StartingShotAspectRatio } from '@/types/cinematographer';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface StartingShotTabProps {
  onGenerate: (request: StartingShotRequest) => void;
  isGenerating: boolean;
  credits: number;
  isLoadingCredits?: boolean;
}

// Aspect ratio display labels
const ASPECT_RATIO_LABELS: Record<StartingShotAspectRatio, string> = {
  '16:9': 'Landscape (16:9)',
  '9:16': 'Portrait (9:16)',
  '1:1': 'Square (1:1)',
  '4:3': 'Classic (4:3)',
  '3:4': 'Portrait Classic (3:4)',
};

const CREDIT_COST = 1; // 1 credit per image

/**
 * Starting Shot Tab - First Frame Image Generation
 * Uses google/nano-banana for fast image generation
 * Generated images can be used as reference for video generation
 */
// Max reference images allowed by nano-banana
const MAX_REFERENCE_IMAGES = 3;

export function StartingShotTab({
  onGenerate,
  isGenerating,
  credits,
  isLoadingCredits,
}: StartingShotTabProps) {
  const [formData, setFormData] = useState({
    prompt: '',
    aspect_ratio: '16:9' as StartingShotAspectRatio,
  });
  const [referenceImages, setReferenceImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;

    // Pass files directly - they'll be uploaded by the server action
    const referenceFiles = referenceImages.length > 0
      ? referenceImages.map(img => img.file)
      : undefined;

    onGenerate({
      prompt: formData.prompt,
      aspect_ratio: formData.aspect_ratio,
      reference_image_files: referenceFiles,
      user_id: '', // Will be set by the hook with real user ID
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: { file: File; preview: string }[] = [];
    const remainingSlots = MAX_REFERENCE_IMAGES - referenceImages.length;

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newImages.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }

    setReferenceImages(prev => [...prev, ...newImages]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Describe Your First Frame */}
        <StandardStep
          stepNumber={1}
          title="Describe Your First Frame"
          description="Tell AI what image to create as your video's starting point"
        >
          <Textarea
            placeholder="Describe the first frame of your video... (e.g., 'A cinematic wide shot of a misty forest at dawn with sun rays breaking through the trees')"
            value={formData.prompt}
            onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
            className="min-h-[120px] resize-y"
            disabled={isGenerating}
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>Be specific for better results</span>
            <span>{formData.prompt.length}/500</span>
          </div>
        </StandardStep>

        {/* Step 2: Reference Images (Optional) */}
        <StandardStep
          stepNumber={2}
          title="Reference Images"
          description="Optional: Upload up to 3 images for style guidance"
        >
          <div className="space-y-3">
            {/* Reference Image Grid */}
            <div className="grid grid-cols-3 gap-2">
              {referenceImages.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30 group">
                  <img
                    src={img.preview}
                    alt={`Reference ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeReferenceImage(index)}
                    disabled={isGenerating}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}

              {/* Add Image Button */}
              {referenceImages.length < MAX_REFERENCE_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
                  className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Add</span>
                </button>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="text-xs text-muted-foreground">
              Reference images help guide style, composition, and content. Supports JPG, PNG, WebP.
            </p>
          </div>
        </StandardStep>

        {/* Step 3: Aspect Ratio */}
        <StandardStep
          stepNumber={3}
          title="Aspect Ratio"
          description="Choose the frame dimensions"
        >
          <Select
            value={formData.aspect_ratio}
            onValueChange={(value: StartingShotAspectRatio) => setFormData(prev => ({ ...prev, aspect_ratio: value }))}
            disabled={isGenerating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NANO_BANANA_ASPECT_RATIOS.map((ratio) => (
                <SelectItem key={ratio} value={ratio}>
                  {ASPECT_RATIO_LABELS[ratio]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || (!isLoadingCredits && credits < CREDIT_COST) || !formData.prompt?.trim()}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Image...
            </>
          ) : (
            <>
              <Image className="w-4 h-4 mr-2" />
              Generate Starting Shot ({CREDIT_COST} credit)
            </>
          )}
        </Button>

        {!isLoadingCredits && credits < CREDIT_COST && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {CREDIT_COST} credit (you have {credits}).
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
