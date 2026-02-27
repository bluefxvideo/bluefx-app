'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, X, Plus, Upload } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { PromptRefiner } from '@/components/tools/prompt-refiner';

// Visual style options (reused from storyboard-tab)
const VISUAL_STYLES = [
  { id: 'cinematic_realism', label: 'Cinematic Realism' },
  { id: 'film_noir', label: 'Film Noir' },
  { id: 'documentary', label: 'Documentary Style' },
  { id: 'historical', label: 'Historical / Period' },
  { id: 'sci_fi', label: 'Sci-Fi' },
  { id: 'fantasy_epic', label: 'Fantasy Epic' },
  { id: 'modern_commercial', label: 'Modern Commercial' },
  { id: 'custom', label: 'Custom' },
] as const;

type VisualStyle = typeof VISUAL_STYLES[number]['id'];

export interface ScriptBreakdownRequest {
  scriptText: string;
  visualStyle?: string;
}

interface ScriptBreakdownTabProps {
  onBreakdown: (request: ScriptBreakdownRequest) => void;
  isProcessing: boolean;
  initialScript?: string;
  referenceImages?: { file: File; preview: string }[];
  onReferenceImagesChange?: (images: { file: File; preview: string }[]) => void;
}

const MAX_SCRIPT_LENGTH = 50000;
const MAX_REFERENCE_IMAGES = 14;

export function ScriptBreakdownTab({
  onBreakdown,
  isProcessing,
  initialScript,
  referenceImages = [],
  onReferenceImagesChange,
}: ScriptBreakdownTabProps) {
  const [scriptText, setScriptText] = useState(initialScript || '');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('documentary');
  const [customStyle, setCustomStyle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Update script text when initialScript arrives (async from localStorage)
  useEffect(() => {
    if (initialScript) {
      setScriptText(initialScript);
    }
  }, [initialScript]);

  const handleSubmit = () => {
    const trimmedScript = scriptText.trim();
    if (!trimmedScript) return;

    const styleText = visualStyle === 'custom'
      ? customStyle
      : VISUAL_STYLES.find(s => s.id === visualStyle)?.label || '';

    onBreakdown({
      scriptText: trimmedScript,
      visualStyle: styleText,
    });
  };

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newImages: { file: File; preview: string }[] = [];
    const remainingSlots = MAX_REFERENCE_IMAGES - referenceImages.length;
    for (let i = 0; i < Math.min(fileArray.length, remainingSlots); i++) {
      const file = fileArray[i];
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file) });
      }
    }
    if (newImages.length > 0) {
      onReferenceImagesChange?.([...referenceImages, ...newImages]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeReferenceImage = (index: number) => {
    const newImages = [...referenceImages];
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    onReferenceImagesChange?.(newImages);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isProcessing && referenceImages.length < MAX_REFERENCE_IMAGES) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (!isProcessing && e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  const hasScript = scriptText.trim().length > 0;

  // Estimate scene count (rough: ~15 words per sentence, ~5-6 seconds per scene)
  const wordCount = scriptText.trim().split(/\s+/).filter(Boolean).length;
  const estimatedScenes = Math.ceil(wordCount / 15);

  return (
    <TabContentWrapper>
      <TabBody>
        {/* Step 1: Script Input */}
        <StandardStep
          stepNumber={1}
          title="Script / Narration"
          description="Paste your script or narration text. Each sentence becomes one scene (~5-6 seconds)."
        >
          <PromptRefiner
            prompt={scriptText}
            onPromptChange={(newPrompt) => setScriptText(newPrompt)}
            disabled={isProcessing}
          />
          <Textarea
            placeholder="Paste your script here...

Example:
The year was 218 BC. Hannibal Barca had just done the unthinkable. He had marched an army of 50,000 soldiers, 9,000 cavalry, and 37 war elephants across the Alps..."
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value.slice(0, MAX_SCRIPT_LENGTH))}
            className="min-h-[150px] max-h-[220px] resize-y font-mono text-sm overflow-y-auto"
            disabled={isProcessing}
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>
              {wordCount} words
              {wordCount > 0 && ` · ~${estimatedScenes} scenes`}
            </span>
            <span>{scriptText.length.toLocaleString()}/{MAX_SCRIPT_LENGTH.toLocaleString()}</span>
          </div>
        </StandardStep>

        {/* Step 2: Reference Images */}
        <StandardStep
          stepNumber={2}
          title="Product / Reference Images"
          description="Upload your product images once — they'll be pre-loaded into every storyboard batch you send."
        >
          <div
            ref={dropZoneRef}
            className={`space-y-3 p-3 rounded-lg transition-colors ${
              isDragging ? 'bg-primary/10 border-2 border-dashed border-primary' : 'border-2 border-transparent'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isDragging ? (
              <div className="flex items-center justify-center py-4 text-primary font-medium">
                <Upload className="w-5 h-5 mr-2" />
                Drop images here
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
                {referenceImages.map((img, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30 group">
                    <img src={img.preview} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeReferenceImage(index)}
                      disabled={isProcessing}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {referenceImages.length < MAX_REFERENCE_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Add</span>
                  </button>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
            <p className="text-xs text-muted-foreground">
              {referenceImages.length > 0
                ? `${referenceImages.length} image${referenceImages.length > 1 ? 's' : ''} — will be pre-loaded into all storyboard batches`
                : 'Drag & drop or click + to add product images (up to 14)'}
            </p>
          </div>
        </StandardStep>

        {/* Step 3: Visual Style */}
        <StandardStep
          stepNumber={3}
          title="Visual Style"
          description="Choose the visual aesthetic for all scenes"
        >
          <Select
            value={visualStyle}
            onValueChange={(value: VisualStyle) => setVisualStyle(value)}
            disabled={isProcessing}
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

          {visualStyle === 'custom' && (
            <Textarea
              placeholder="e.g., Dark moody atmosphere, nordic aesthetic, natural lighting, cinematic grain..."
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value.slice(0, 200))}
              className="min-h-[80px] resize-y mt-3"
              disabled={isProcessing}
            />
          )}
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button
          onClick={handleSubmit}
          disabled={isProcessing || !hasScript}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Breaking Down Script...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Break Down Script
            </>
          )}
        </Button>

        {estimatedScenes > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Estimated: {estimatedScenes} scenes · {Math.ceil(estimatedScenes / 4)} batches of 4
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
