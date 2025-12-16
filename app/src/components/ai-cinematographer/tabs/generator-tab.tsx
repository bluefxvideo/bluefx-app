'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Video, Volume2, X, Image } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { CinematographerRequest } from '@/actions/tools/ai-cinematographer';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';

interface GeneratorTabProps {
  onGenerate: (request: CinematographerRequest) => void;
  isGenerating: boolean;
  credits: number;
  isLoadingCredits?: boolean;
  pendingImageUrl?: string; // Image URL from Starting Shot
  onClearPendingImage?: () => void;
}

// LTX-2-Fast duration options
const DURATION_OPTIONS = [6, 8, 10, 12, 14, 16, 18, 20] as const;
type Duration = typeof DURATION_OPTIONS[number];

// Resolution options with credit costs per second
const RESOLUTION_OPTIONS = {
  '1080p': { label: '1080p (Full HD)', creditsPerSecond: 1 },
  '2k': { label: '2K', creditsPerSecond: 2 },
  '4k': { label: '4K', creditsPerSecond: 4 },
} as const;
type Resolution = keyof typeof RESOLUTION_OPTIONS;

/**
 * Video Generation Tab - LTX-2-Fast powered cinematic video creation
 * Features:
 * - Text-to-video (reference image optional)
 * - Built-in AI audio generation
 * - Multiple resolutions: 1080p, 2K, 4K
 * - Durations: 6-20 seconds
 */
export function GeneratorTab({
  onGenerate,
  isGenerating,
  credits,
  isLoadingCredits,
  pendingImageUrl,
  onClearPendingImage,
}: GeneratorTabProps) {
  const [formData, setFormData] = useState({
    prompt: '',
    reference_image: null as File | null,
    duration: 6 as Duration,
    resolution: '1080p' as Resolution,
    generate_audio: true,
  });

  // Track if we're using a pending image URL from Starting Shot
  const usingPendingImage = !!pendingImageUrl && !formData.reference_image;

  // Durations > 10 seconds require 1080p resolution
  const availableResolutions = formData.duration > 10
    ? { '1080p': RESOLUTION_OPTIONS['1080p'] }
    : RESOLUTION_OPTIONS;

  // Auto-adjust resolution if duration > 10s and not 1080p
  const handleDurationChange = (newDuration: Duration) => {
    setFormData(prev => ({
      ...prev,
      duration: newDuration,
      // Force 1080p for durations > 10s
      resolution: newDuration > 10 ? '1080p' : prev.resolution
    }));
  };

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;

    onGenerate({
      prompt: formData.prompt,
      reference_image: formData.reference_image || undefined,
      reference_image_url: usingPendingImage ? pendingImageUrl : undefined, // Pass URL from Starting Shot
      duration: formData.duration,
      resolution: formData.resolution,
      generate_audio: formData.generate_audio,
      workflow_intent: 'generate',
      user_id: '' // Will be set by the hook with real user ID
    });
  };

  const handleImageUpload = (file: File | null) => {
    setFormData(prev => ({ ...prev, reference_image: file }));
  };

  // Calculate credits: duration × credits per second
  const creditsPerSecond = RESOLUTION_OPTIONS[formData.resolution].creditsPerSecond;
  const estimatedCredits = formData.duration * creditsPerSecond;

  return (
    <TabContentWrapper>
      {/* Form Sections */}
      <TabBody>
        {/* Step 1: Describe Your Video */}
        <StandardStep
          stepNumber={1}
          title="Describe Your Video"
          description="Tell AI what cinematic video to create"
        >
          <Textarea
            placeholder="Describe the cinematic video you want to create... (e.g., 'A majestic eagle soaring over snow-capped mountains at sunset')"
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

        {/* Step 2: Reference Image (Optional) */}
        <StandardStep
          stepNumber={2}
          title="Reference Image"
          description="Optional: Upload a first frame for image-to-video generation"
        >
          {usingPendingImage ? (
            // Show pending image from Starting Shot
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                <img
                  src={pendingImageUrl}
                  alt="Starting shot reference"
                  className="w-full h-auto max-h-[200px] object-contain"
                />
                <div className="absolute top-2 left-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/90 text-primary-foreground text-xs font-medium">
                    <Image className="w-3 h-3" />
                    From Starting Shot
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 bg-background/80 hover:bg-background"
                  onClick={() => onClearPendingImage?.()}
                  disabled={isGenerating}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Using image from Starting Shot. Click X to remove and upload a different image.
              </p>
            </div>
          ) : (
            <>
              <UnifiedDragDrop
                fileType="reference"
                selectedFile={formData.reference_image}
                onFileSelect={handleImageUpload}
                disabled={isGenerating}
                title="Drop image or click to upload"
                description="Optional - Leave empty for text-to-video mode"
                previewSize="medium"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supports JPG, PNG, WebP. Max 10MB. Reference image adds +2 credits.
              </p>
            </>
          )}
        </StandardStep>

        {/* Step 3: Video Settings */}
        <StandardStep
          stepNumber={3}
          title="Video Settings"
          description="Configure duration, resolution, and audio"
        >
          <div className="space-y-4">
            {/* Duration Selection - Button Grid */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map((d) => {
                  const cost = d * RESOLUTION_OPTIONS[formData.resolution].creditsPerSecond;
                  return (
                    <Button
                      key={d}
                      type="button"
                      variant={formData.duration === d ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleDurationChange(d)}
                      disabled={isGenerating}
                      className="flex flex-col h-auto py-2"
                    >
                      <span className="font-medium">{d}s</span>
                      <span className="text-xs opacity-70">{cost} cr</span>
                    </Button>
                  );
                })}
              </div>
              {formData.duration > 10 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Note: Durations over 10 seconds require 1080p resolution
                </p>
              )}
            </div>

            {/* Resolution Selection */}
            <div className="space-y-2">
              <Label>Resolution</Label>
              <Select
                value={formData.resolution}
                onValueChange={(value: Resolution) => setFormData(prev => ({ ...prev, resolution: value }))}
                disabled={isGenerating || formData.duration > 10}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(availableResolutions).map(([key, { label, creditsPerSecond }]) => (
                    <SelectItem key={key} value={key}>
                      {label} ({creditsPerSecond} credits/sec)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audio Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="audio-toggle" className="cursor-pointer">AI Audio Generation</Label>
                  <p className="text-xs text-muted-foreground">Generate ambient audio for your video</p>
                </div>
              </div>
              <Switch
                id="audio-toggle"
                checked={formData.generate_audio}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, generate_audio: checked }))}
                disabled={isGenerating}
              />
            </div>
          </div>
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || (!isLoadingCredits && credits < estimatedCredits) || !formData.prompt?.trim()}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Video...
            </>
          ) : (
            <>
              <Video className="w-4 h-4 mr-2" />
              Generate Video ({estimatedCredits} credits)
            </>
          )}
        </Button>

        {!isLoadingCredits && credits < estimatedCredits && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {estimatedCredits} credits (you have {credits}).
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
