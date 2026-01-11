'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutGrid, X, Upload, Plus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

// Visual style options for storyboard generation
const VISUAL_STYLES = [
  { id: 'cinematic_realism', label: 'Cinematic Realism' },
  { id: 'film_noir', label: 'Film Noir' },
  { id: 'sci_fi', label: 'Sci-Fi' },
  { id: 'fantasy_epic', label: 'Fantasy Epic' },
  { id: 'documentary', label: 'Documentary Style' },
  { id: 'custom', label: 'Custom' },
] as const;

type VisualStyle = typeof VISUAL_STYLES[number]['id'];

export interface StoryboardRequest {
  story_description: string;
  visual_style: VisualStyle;
  custom_style?: string;
  reference_image_files?: File[];
  user_id: string;
}

interface StoryboardTabProps {
  onGenerate: (request: StoryboardRequest) => void;
  isGenerating: boolean;
  credits: number;
  isLoadingCredits?: boolean;
  // Pre-fill values (e.g., from Video Analyzer "Send to Storyboard" button)
  initialPrompt?: string;
  initialStyle?: string;
}

const CREDIT_COST = 6; // 6 credits for Nano Banana Pro grid generation
const MAX_REFERENCE_IMAGES = 14;
const MAX_STORY_LENGTH = 20000;

export function StoryboardTab({
  onGenerate,
  isGenerating,
  credits,
  isLoadingCredits,
  initialPrompt,
  initialStyle,
}: StoryboardTabProps) {
  // Story description prompt (user can edit directly)
  const [storyPrompt, setStoryPrompt] = useState(initialPrompt || '');

  // Reference images for Nano Banana (the main image generation input)
  const [referenceImages, setReferenceImages] = useState<{ file: File; preview: string }[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    visual_style: (initialStyle as VisualStyle) || 'cinematic_realism' as VisualStyle,
    custom_style: '',
  });

  // Update prompt when initialPrompt changes (from URL params)
  useEffect(() => {
    if (initialPrompt) {
      setStoryPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Process files from either input or drag-drop (for reference images)
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newImages: { file: File; preview: string }[] = [];
    const remainingSlots = MAX_REFERENCE_IMAGES - referenceImages.length;

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isGenerating && referenceImages.length < MAX_REFERENCE_IMAGES) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

    if (isGenerating || referenceImages.length >= MAX_REFERENCE_IMAGES) return;

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

  const handleSubmit = () => {
    const promptToUse = storyPrompt.trim();
    if (!promptToUse) return;

    // Use reference images from Step 2 (sent directly to Nano Banana)
    const referenceFiles = referenceImages.map(img => img.file);

    console.log('📤 Submitting storyboard with reference images:', referenceFiles.length);

    onGenerate({
      story_description: promptToUse,
      visual_style: formData.visual_style,
      custom_style: formData.visual_style === 'custom' ? formData.custom_style : undefined,
      reference_image_files: referenceFiles.length > 0 ? referenceFiles : undefined,
      user_id: '', // Will be set by the hook
    });
  };

  const hasPrompt = storyPrompt.trim().length > 0;

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Story Description */}
        <StandardStep
          stepNumber={1}
          title="Story Description"
          description="Describe your scene or paste storyboard script from Script Generator"
        >
          <Textarea
            placeholder="Describe your scene or paste storyboard script from Script Generator..."
            value={storyPrompt}
            onChange={(e) => setStoryPrompt(e.target.value.slice(0, MAX_STORY_LENGTH))}
            className="min-h-[150px] resize-y"
            disabled={isGenerating}
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>Be specific about setting, mood, and characters</span>
            <span>{storyPrompt.length}/{MAX_STORY_LENGTH}</span>
          </div>
        </StandardStep>

        {/* Step 2: Reference Images - MAIN input for Nano Banana */}
        <StandardStep
          stepNumber={2}
          title="Reference Images"
          description="Upload images of your product, character, or environment. These go directly to the AI image generator."
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
            {isDragging && (
              <div className="flex items-center justify-center py-4 text-primary font-medium">
                <Upload className="w-5 h-5 mr-2" />
                Drop images here
              </div>
            )}

            {!isDragging && (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
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
                      className="absolute top-1 right-1 h-5 w-5 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeReferenceImage(index)}
                      disabled={isGenerating}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}

                {referenceImages.length < MAX_REFERENCE_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Add</span>
                  </button>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="text-xs text-muted-foreground">
              Drag & drop or click to add up to {MAX_REFERENCE_IMAGES} images. These reference images are sent directly to the image generator for visual consistency.
            </p>
          </div>
        </StandardStep>

        {/* Step 3: Visual Style */}
        <StandardStep
          stepNumber={3}
          title="Visual Style"
          description="Choose the visual aesthetic for your storyboard"
        >
          <Select
            value={formData.visual_style}
            onValueChange={(value: VisualStyle) => setFormData(prev => ({ ...prev, visual_style: value }))}
            disabled={isGenerating}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISUAL_STYLES.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {formData.visual_style === 'custom' && (
            <Textarea
              placeholder="e.g., dark moody atmosphere, nordic aesthetic, natural lighting..."
              value={formData.custom_style}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                custom_style: e.target.value.slice(0, 200)
              }))}
              className="min-h-[80px] resize-y mt-3"
              disabled={isGenerating}
            />
          )}
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || (!isLoadingCredits && credits < CREDIT_COST) || !hasPrompt}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Storyboard...
            </>
          ) : (
            <>
              <LayoutGrid className="w-4 h-4 mr-2" />
              Generate Storyboard ({CREDIT_COST} credits)
            </>
          )}
        </Button>

        {!isLoadingCredits && credits < CREDIT_COST && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {CREDIT_COST} credits (you have {credits}).
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
