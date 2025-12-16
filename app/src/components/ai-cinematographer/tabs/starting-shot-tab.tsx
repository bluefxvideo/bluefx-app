'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Image, Video } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { StartingShotRequest, NANO_BANANA_ASPECT_RATIOS, StartingShotAspectRatio } from '@/actions/tools/ai-cinematographer';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface StartingShotTabProps {
  onGenerate: (request: StartingShotRequest) => void;
  isGenerating: boolean;
  credits: number;
  generatedImage?: {
    id: string;
    image_url: string;
    prompt: string;
    aspect_ratio: string;
  } | null;
  onMakeVideo?: (imageUrl: string) => void;
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
  generatedImage,
  onMakeVideo,
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

  const handleMakeVideo = () => {
    if (generatedImage?.image_url && onMakeVideo) {
      onMakeVideo(generatedImage.image_url);
    }
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
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {NANO_BANANA_ASPECT_RATIOS.map((ratio) => (
              <Button
                key={ratio}
                type="button"
                variant={formData.aspect_ratio === ratio ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, aspect_ratio: ratio }))}
                disabled={isGenerating}
                className="flex flex-col h-auto py-2"
              >
                <span className="font-medium">{ratio}</span>
                <span className="text-xs opacity-70 hidden sm:block">
                  {ASPECT_RATIO_LABELS[ratio].split(' ')[0]}
                </span>
              </Button>
            ))}
          </div>
        </StandardStep>

        {/* Generated Image Preview */}
        {generatedImage && (
          <StandardStep
            stepNumber={3}
            title="Generated Image"
            description="Your starting shot is ready"
          >
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                <img
                  src={generatedImage.image_url}
                  alt={generatedImage.prompt}
                  className="w-full h-auto max-h-[400px] object-contain"
                />
              </div>

              {/* Make Video Button */}
              <Button
                onClick={handleMakeVideo}
                variant="secondary"
                className="w-full h-12 font-medium"
                size="lg"
              >
                <Video className="w-4 h-4 mr-2" />
                Make Video From This Image
              </Button>
            </div>
          </StandardStep>
        )}

        {/* Credit Info */}
        <div className="p-3 rounded-lg border bg-primary/5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Cost</span>
            <span className="text-lg font-bold text-primary">{CREDIT_COST} credit</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Fast image generation (~5 seconds)
          </p>
        </div>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || credits < CREDIT_COST || !formData.prompt?.trim()}
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

        {credits < CREDIT_COST && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {CREDIT_COST} credit (you have {credits}).
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
