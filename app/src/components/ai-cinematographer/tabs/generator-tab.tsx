'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Video, Volume2, X, Image, Zap, Sparkles, Lock, Mic } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { CinematographerRequest } from '@/actions/tools/ai-cinematographer';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';
import { VIDEO_MODEL_CONFIG, VideoModel, ProAspectRatio } from '@/types/cinematographer';

interface GeneratorTabProps {
  onGenerate: (request: CinematographerRequest) => void;
  isGenerating: boolean;
  credits: number;
  isLoadingCredits?: boolean;
  pendingImageUrl?: string; // Image URL from Starting Shot
  onClearPendingImage?: () => void;
}

/**
 * Video Generation Tab - Multi-model cinematic video creation
 * Features:
 * - Fast Mode (LTX-2-Fast): Quick generation, longer videos, higher resolutions
 * - Pro Mode (Seedance 1.5 Pro): Better quality, lip sync, singing, frame control
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
    last_frame_image: null as File | null,
    model: 'fast' as VideoModel,
    duration: 6 as number,
    resolution: '1080p' as string,
    aspect_ratio: '16:9' as ProAspectRatio,
    generate_audio: true,
    seed: '' as string,
    camera_fixed: false,
    upscale: false,
  });

  const config = VIDEO_MODEL_CONFIG[formData.model];

  // Track if we're using a pending image URL from Starting Shot
  const usingPendingImage = !!pendingImageUrl && !formData.reference_image;

  // Get available durations for the selected model
  const availableDurations = config.durations as readonly number[];

  // For Fast model: Durations > 10 seconds require 1080p resolution
  const availableResolutions = formData.model === 'fast' && formData.duration > 10
    ? { '1080p': { label: '1080p (Full HD)', creditsPerSecond: 1 } }
    : formData.model === 'fast'
      ? {
          '1080p': { label: '1080p (Full HD)', creditsPerSecond: 1 },
          '2k': { label: '2K', creditsPerSecond: 2 },
          '4k': { label: '4K', creditsPerSecond: 4 },
        }
      : {
          '720p': { label: '720p', creditsPerSecond: 2 },
          '1080p': { label: '1080p (Upscaled)', creditsPerSecond: 3 },
        };

  // Handle model change
  const handleModelChange = (newModel: VideoModel) => {
    const newConfig = VIDEO_MODEL_CONFIG[newModel];
    setFormData(prev => ({
      ...prev,
      model: newModel,
      // Reset to default duration for the new model
      duration: newConfig.durations[0],
      // Reset resolution based on model
      resolution: newModel === 'fast' ? '1080p' : '720p',
      // Reset aspect ratio for Pro model
      aspect_ratio: newModel === 'pro' ? '16:9' : prev.aspect_ratio,
      // Clear last frame image if switching to Fast mode (not supported)
      last_frame_image: newModel === 'fast' ? null : prev.last_frame_image,
      // Clear seed if switching to Fast mode (not supported)
      seed: newModel === 'fast' ? '' : prev.seed,
      // Reset upscale flag
      upscale: newModel === 'pro' && prev.resolution === '1080p',
    }));
  };

  // Handle duration change
  const handleDurationChange = (newDuration: number) => {
    setFormData(prev => ({
      ...prev,
      duration: newDuration,
      // Force 1080p for Fast mode durations > 10s
      resolution: formData.model === 'fast' && newDuration > 10 ? '1080p' : prev.resolution
    }));
  };

  // Handle resolution change for Pro mode (enables upscale)
  const handleResolutionChange = (newResolution: string) => {
    setFormData(prev => ({
      ...prev,
      resolution: newResolution,
      upscale: formData.model === 'pro' && newResolution === '1080p',
    }));
  };

  const handleSubmit = () => {
    if (!formData.prompt?.trim()) return;

    onGenerate({
      prompt: formData.prompt,
      reference_image: formData.reference_image || undefined,
      reference_image_url: usingPendingImage ? pendingImageUrl : undefined,
      duration: formData.duration as any,
      resolution: formData.resolution as any,
      generate_audio: formData.generate_audio,
      workflow_intent: 'generate',
      user_id: '', // Will be set by the hook with real user ID
      // Pro model specific fields
      model: formData.model,
      aspect_ratio: formData.model === 'pro' ? formData.aspect_ratio : undefined,
      last_frame_image: formData.model === 'pro' ? formData.last_frame_image || undefined : undefined,
      seed: formData.model === 'pro' && formData.seed ? parseInt(formData.seed) : undefined,
      camera_fixed: formData.model === 'pro' ? formData.camera_fixed : undefined,
      upscale: formData.model === 'pro' ? formData.upscale : undefined,
    });
  };

  const handleImageUpload = (file: File | null) => {
    setFormData(prev => ({ ...prev, reference_image: file }));
  };

  const handleLastFrameUpload = (file: File | null) => {
    setFormData(prev => ({ ...prev, last_frame_image: file }));
  };

  // Calculate credits based on model and settings
  const calculateCredits = () => {
    if (formData.model === 'fast') {
      const creditsPerSecond = formData.resolution === '4k' ? 4 : formData.resolution === '2k' ? 2 : 1;
      return formData.duration * creditsPerSecond;
    } else {
      // Pro model: 2 credits/sec base, +1 for upscale
      const baseCredits = formData.duration * 2;
      const upscaleCredits = formData.upscale ? formData.duration * 1 : 0;
      return baseCredits + upscaleCredits;
    }
  };

  const estimatedCredits = calculateCredits();

  return (
    <TabContentWrapper>
      {/* Form Sections */}
      <TabBody>
        {/* Model Selector */}
        <div className="flex gap-2 p-1 bg-muted/50 rounded-lg mb-4">
          <Button
            type="button"
            variant={formData.model === 'fast' ? 'default' : 'ghost'}
            className="flex-1 gap-2"
            onClick={() => handleModelChange('fast')}
            disabled={isGenerating}
          >
            <Zap className="w-4 h-4" />
            <span className="font-medium">Fast</span>
            <span className="text-xs opacity-70 hidden sm:inline">6-20s • Up to 4K</span>
          </Button>
          <Button
            type="button"
            variant={formData.model === 'pro' ? 'default' : 'ghost'}
            className="flex-1 gap-2"
            onClick={() => handleModelChange('pro')}
            disabled={isGenerating}
          >
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">Pro</span>
            <span className="text-xs opacity-70 hidden sm:inline">2-12s • Lip Sync</span>
          </Button>
        </div>

        {/* Model description badge */}
        <div className="text-xs text-muted-foreground mb-4 p-2 rounded bg-muted/30">
          {formData.model === 'fast' ? (
            <>
              <strong>Fast Mode:</strong> Quick generation (15-30s), longer videos up to 20s, 1080p/2K/4K resolutions.
              Best for landscapes, abstract, and fast turnaround.
            </>
          ) : (
            <>
              <strong>Pro Mode:</strong> Higher quality, lip sync support, singing mode, first & last frame control,
              seed for reproducibility. 2-12s duration at 720p (upscalable to 1080p). 2x credit cost.
            </>
          )}
        </div>

        {/* Step 1: Describe Your Video */}
        <StandardStep
          stepNumber={1}
          title="Describe Your Video"
          description="Tell AI what cinematic video to create"
        >
          <Textarea
            placeholder={formData.model === 'pro'
              ? "Describe your video... Pro mode excels at people, lip sync, and complex motion (e.g., 'A woman smiling and waving at the camera')"
              : "Describe the cinematic video you want to create... (e.g., 'A majestic eagle soaring over snow-capped mountains at sunset')"
            }
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

        {/* Step 2: Reference Image (First Frame) */}
        <StandardStep
          stepNumber={2}
          title={formData.model === 'pro' ? 'First Frame Image' : 'Reference Image'}
          description={formData.model === 'pro'
            ? 'Upload a starting frame for image-to-video generation'
            : 'Optional: Upload a first frame for image-to-video generation'
          }
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
                description={formData.model === 'pro'
                  ? 'Upload a starting frame for your video'
                  : 'Optional - Leave empty for text-to-video mode'
                }
                previewSize="medium"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supports JPG, PNG, WebP. Max 10MB.
              </p>
            </>
          )}
        </StandardStep>

        {/* Step 2.5: Last Frame Image (Pro mode only) */}
        {formData.model === 'pro' && config.features.lastFrame && (
          <StandardStep
            stepNumber={2.5}
            title="Last Frame Image"
            description="Optional: Upload an ending frame for controlled transitions"
          >
            <UnifiedDragDrop
              fileType="reference"
              selectedFile={formData.last_frame_image}
              onFileSelect={handleLastFrameUpload}
              disabled={isGenerating}
              title="Drop ending frame or click to upload"
              description="Optional - The video will transition to this frame"
              previewSize="medium"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Pro feature: Control how your video ends by specifying the last frame.
            </p>
          </StandardStep>
        )}

        {/* Step 3: Video Settings */}
        <StandardStep
          stepNumber={3}
          title="Video Settings"
          description="Configure duration, resolution, and audio"
        >
          <div className="space-y-4">
            {/* Aspect Ratio (Pro mode only) */}
            {formData.model === 'pro' && config.aspectRatios && (
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select
                  value={formData.aspect_ratio}
                  onValueChange={(value: ProAspectRatio) => setFormData(prev => ({ ...prev, aspect_ratio: value }))}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.aspectRatios.map((ratio) => (
                      <SelectItem key={ratio} value={ratio}>
                        {ratio === '16:9' && '16:9 (Landscape)'}
                        {ratio === '9:16' && '9:16 (Portrait/TikTok)'}
                        {ratio === '1:1' && '1:1 (Square)'}
                        {ratio === '4:3' && '4:3 (Classic)'}
                        {ratio === '3:4' && '3:4 (Portrait Classic)'}
                        {ratio === '21:9' && '21:9 (Ultrawide)'}
                        {ratio === '9:21' && '9:21 (Tall)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Duration Selection - Button Grid */}
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {availableDurations.map((d) => {
                  const cost = formData.model === 'fast'
                    ? d * (formData.resolution === '4k' ? 4 : formData.resolution === '2k' ? 2 : 1)
                    : d * (formData.upscale ? 3 : 2);
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
              {formData.model === 'fast' && formData.duration > 10 && (
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
                onValueChange={handleResolutionChange}
                disabled={isGenerating || (formData.model === 'fast' && formData.duration > 10)}
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
              {formData.model === 'pro' && formData.resolution === '1080p' && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  1080p uses AI upscaling from 720p (+1 credit/sec)
                </p>
              )}
            </div>

            {/* Pro Mode Advanced Controls */}
            {formData.model === 'pro' && (
              <>
                {/* Seed Input */}
                {config.features.seed && (
                  <div className="space-y-2">
                    <Label htmlFor="seed">Seed (Optional)</Label>
                    <Input
                      id="seed"
                      type="number"
                      placeholder="Leave empty for random"
                      value={formData.seed}
                      onChange={(e) => setFormData(prev => ({ ...prev, seed: e.target.value }))}
                      disabled={isGenerating}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the same seed to reproduce similar results
                    </p>
                  </div>
                )}

                {/* Camera Lock Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label htmlFor="camera-lock" className="cursor-pointer">Lock Camera</Label>
                      <p className="text-xs text-muted-foreground">Keep camera stationary during video</p>
                    </div>
                  </div>
                  <Switch
                    id="camera-lock"
                    checked={formData.camera_fixed}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, camera_fixed: checked }))}
                    disabled={isGenerating}
                  />
                </div>

                {/* Singing Mode Info */}
                {config.features.singing && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Lip Sync & Singing Ready</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Pro mode supports accurate lip sync and singing animations
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

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
              Generate {formData.model === 'pro' ? 'Pro' : 'Fast'} Video ({estimatedCredits} credits)
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
