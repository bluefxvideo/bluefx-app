'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image } from 'lucide-react';
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

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;

    onGenerate({
      prompt: formData.prompt,
      aspect_ratio: formData.aspect_ratio,
      user_id: '', // Will be set by the hook with real user ID
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

        {/* Step 2: Aspect Ratio */}
        <StandardStep
          stepNumber={2}
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
