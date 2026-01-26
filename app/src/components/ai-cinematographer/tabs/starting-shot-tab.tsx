'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image, X, Upload, Plus, Zap, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { StartingShotRequest } from '@/actions/tools/ai-cinematographer';
import { NANO_BANANA_ASPECT_RATIOS, NANO_BANANA_PRO_ASPECT_RATIOS, type StartingShotAspectRatio, type StartingShotModel, type StartingShotResolution } from '@/types/cinematographer';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

interface StartingShotTabProps {
  onGenerate: (request: StartingShotRequest) => void;
  isGenerating: boolean;
  credits: number;
  isLoadingCredits?: boolean;
}

// Aspect ratio display labels (all ratios for Pro mode)
const ASPECT_RATIO_LABELS: Record<StartingShotAspectRatio, string> = {
  '16:9': 'Landscape (16:9)',
  '9:16': 'Portrait (9:16)',
  '1:1': 'Square (1:1)',
  '4:3': 'Classic (4:3)',
  '3:4': 'Portrait Classic (3:4)',
  '2:3': 'Portrait (2:3)',
  '3:2': 'Landscape (3:2)',
  '21:9': 'Ultrawide (21:9)',
};

// Credit costs: Fast=1, Pro 1K=4, Pro 2K=5, Pro 4K=10
const getCreditsForSettings = (model: StartingShotModel, resolution: StartingShotResolution): number => {
  if (model === 'fast') return 1;
  if (resolution === '4K') return 10;
  if (resolution === '1K') return 4;
  return 5; // 2K default
};

/**
 * Starting Shot Tab - First Frame Image Generation
 * Uses google/nano-banana (Fast) or google/nano-banana-pro (Pro) for image generation
 * Generated images can be used as reference for video generation
 */
// Max reference images: Fast allows 3, Pro allows 14
const MAX_REFERENCE_IMAGES_FAST = 3;
const MAX_REFERENCE_IMAGES_PRO = 14;

export function StartingShotTab({
  onGenerate,
  isGenerating,
  credits,
  isLoadingCredits,
}: StartingShotTabProps) {
  const [formData, setFormData] = useState({
    prompt: '',
    aspect_ratio: '16:9' as StartingShotAspectRatio,
    model: 'fast' as StartingShotModel,
    resolution: '2K' as StartingShotResolution,
  });
  const [referenceImages, setReferenceImages] = useState<{ file: File; preview: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const isPro = formData.model === 'pro';
  const creditCost = getCreditsForSettings(formData.model, formData.resolution);
  const aspectRatios = isPro ? NANO_BANANA_PRO_ASPECT_RATIOS : NANO_BANANA_ASPECT_RATIOS;
  const maxReferenceImages = isPro ? MAX_REFERENCE_IMAGES_PRO : MAX_REFERENCE_IMAGES_FAST;

  const handleModelChange = (newModel: StartingShotModel) => {
    setFormData(prev => {
      // Reset aspect ratio to 16:9 if current ratio is not available in new model
      const availableRatios = newModel === 'pro' ? NANO_BANANA_PRO_ASPECT_RATIOS : NANO_BANANA_ASPECT_RATIOS;
      const aspectRatio = availableRatios.includes(prev.aspect_ratio) ? prev.aspect_ratio : '16:9';

      return {
        ...prev,
        model: newModel,
        aspect_ratio: aspectRatio,
        resolution: newModel === 'pro' ? '2K' : prev.resolution, // Default to 2K for Pro
      };
    });
  };

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
      model: formData.model,
      resolution: isPro ? formData.resolution : undefined,
    });
  };

  // Process files from either input or drag-drop
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newImages: { file: File; preview: string }[] = [];
    const remainingSlots = maxReferenceImages - referenceImages.length;

    for (let i = 0; i < Math.min(fileArray.length, remainingSlots); i++) {
      const file = fileArray[i];
      if (file.type.startsWith('image/')) {
        newImages.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }

    if (newImages.length > 0) {
      setReferenceImages(prev => [...prev, ...newImages]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    processFiles(files);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isGenerating && referenceImages.length < maxReferenceImages) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isGenerating || referenceImages.length >= maxReferenceImages) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
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
        {/* Model Selection Toggle - Fast/Pro */}
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
            <span className="text-xs opacity-70 hidden sm:inline">~5s • 1 credit</span>
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
            <span className="text-xs opacity-70 hidden sm:inline">Up to 4K • Higher Quality</span>
          </Button>
        </div>

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
          description={`Optional: Upload up to ${maxReferenceImages} images for style guidance`}
        >
          <div
            ref={dropZoneRef}
            className={`space-y-3 p-3 rounded-lg transition-colors ${
              isDragging
                ? 'bg-primary/10 border-2 border-dashed border-primary'
                : 'border-2 border-transparent'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            {isDragging && (
              <div className="flex items-center justify-center py-4 text-primary font-medium">
                <Upload className="w-5 h-5 mr-2" />
                Drop images here
              </div>
            )}

            {/* Reference Image Grid */}
            {!isDragging && (
              <div className={`grid gap-2 ${isPro ? 'grid-cols-4' : 'grid-cols-3'}`}>
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
                {referenceImages.length < maxReferenceImages && (
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
            )}

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
              Drag & drop or click to add. Reference images help guide style, composition, and content.
            </p>
          </div>
        </StandardStep>

        {/* Step 3: Aspect Ratio */}
        <StandardStep
          stepNumber={3}
          title="Aspect Ratio"
          description={isPro ? "Choose from all available ratios" : "Choose the frame dimensions"}
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
              {aspectRatios.map((ratio) => (
                <SelectItem key={ratio} value={ratio}>
                  {ASPECT_RATIO_LABELS[ratio]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StandardStep>

        {/* Step 4: Resolution (Pro only) */}
        {isPro && (
          <StandardStep
            stepNumber={4}
            title="Resolution"
            description="Higher resolution = more details (4K costs 10 credits)"
          >
            <div className="flex gap-2">
              {(['1K', '2K', '4K'] as StartingShotResolution[]).map((res) => (
                <Button
                  key={res}
                  type="button"
                  variant={formData.resolution === res ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormData(prev => ({ ...prev, resolution: res }))}
                  disabled={isGenerating}
                >
                  {res}
                  <span className="text-xs ml-1 opacity-70">
                    ({res === '4K' ? '10' : res === '1K' ? '4' : '5'} cr)
                  </span>
                </Button>
              ))}
            </div>
          </StandardStep>
        )}
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || (!isLoadingCredits && credits < creditCost) || !formData.prompt?.trim()}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating {isPro ? 'Pro ' : ''}Image...
            </>
          ) : (
            <>
              <Image className="w-4 h-4 mr-2" />
              Generate {isPro ? 'Pro ' : ''}Starting Shot ({creditCost} credit{creditCost > 1 ? 's' : ''})
            </>
          )}
        </Button>

        {!isLoadingCredits && credits < creditCost && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {creditCost} credit{creditCost > 1 ? 's' : ''} (you have {credits}).
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
