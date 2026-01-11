'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutGrid } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { PromptCustomizer, AssetReference } from '../components/prompt-customizer';

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
  // New: asset references for cross-grid consistency
  asset_references?: AssetReference[];
}

// Stored asset reference (after upload, has URL instead of File)
export interface StoredAssetReference {
  id: string;
  label: string;
  type: 'character' | 'product' | 'environment' | 'other';
  url: string;
}

interface StoryboardTabProps {
  onGenerate: (request: StoryboardRequest) => void;
  isGenerating: boolean;
  credits: number;
  isLoadingCredits?: boolean;
  // Pre-fill values (e.g., from Video Analyzer "Send to Storyboard" button)
  initialPrompt?: string;
  initialStyle?: string;
  // Stored asset references for cross-grid consistency
  storedAssetReferences?: StoredAssetReference[];
  onAssetReferencesChange?: (assets: StoredAssetReference[]) => void;
}

const CREDIT_COST = 6; // 6 credits for Nano Banana Pro grid generation
const MAX_STORY_LENGTH = 20000;

export function StoryboardTab({
  onGenerate,
  isGenerating,
  credits,
  isLoadingCredits,
  initialPrompt,
  initialStyle,
  storedAssetReferences = [],
  onAssetReferencesChange,
}: StoryboardTabProps) {
  // Original prompt (from video analyzer or user input)
  const [originalPrompt, setOriginalPrompt] = useState(initialPrompt || '');
  // Customized prompt (after AI rewriting)
  const [customizedPrompt, setCustomizedPrompt] = useState(initialPrompt || '');
  // Asset references for character/product consistency (new uploads in this session)
  const [assetReferences, setAssetReferences] = useState<AssetReference[]>([]);
  // Is AI rewriting the prompt
  const [isRewriting, setIsRewriting] = useState(false);

  const [formData, setFormData] = useState({
    visual_style: (initialStyle as VisualStyle) || 'cinematic_realism' as VisualStyle,
    custom_style: '',
  });

  // Update original prompt when initialPrompt changes (from URL params)
  useEffect(() => {
    if (initialPrompt) {
      setOriginalPrompt(initialPrompt);
      setCustomizedPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // Show indicator if there are stored assets from previous grids
  const hasStoredAssets = storedAssetReferences.length > 0;

  const handlePromptChange = (newPrompt: string) => {
    // Update both original and customized when user types directly
    setOriginalPrompt(newPrompt);
    setCustomizedPrompt(newPrompt);
  };

  const handleCustomizedPromptChange = (newPrompt: string) => {
    // Only update customized prompt (preserve original)
    setCustomizedPrompt(newPrompt);
  };

  const handleRewriteWithAI = async (instruction: string) => {
    if (!originalPrompt.trim()) return;

    setIsRewriting(true);
    try {
      const response = await fetch('/api/storyboard-prompt/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt: customizedPrompt, // Use current customized version as base
          instruction,
          assets: assetReferences.map(a => ({
            label: a.label,
            type: a.type,
            description: a.description,
          })),
        }),
      });

      const data = await response.json();

      if (data.success && data.rewrittenPrompt) {
        setCustomizedPrompt(data.rewrittenPrompt);
      } else {
        console.error('Failed to rewrite prompt:', data.error);
      }
    } catch (error) {
      console.error('Error rewriting prompt:', error);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleSubmit = () => {
    const promptToUse = customizedPrompt.trim() || originalPrompt.trim();
    if (!promptToUse) return;

    // Combine asset reference files with any additional styling
    const referenceFiles = assetReferences.length > 0
      ? assetReferences.map(asset => asset.file)
      : undefined;

    onGenerate({
      story_description: promptToUse,
      visual_style: formData.visual_style,
      custom_style: formData.visual_style === 'custom' ? formData.custom_style : undefined,
      reference_image_files: referenceFiles,
      user_id: '', // Will be set by the hook
      asset_references: assetReferences,
    });
  };

  const effectivePrompt = customizedPrompt.trim() || originalPrompt.trim();
  const hasPrompt = effectivePrompt.length > 0;

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
            value={originalPrompt}
            onChange={(e) => handlePromptChange(e.target.value.slice(0, MAX_STORY_LENGTH))}
            className="min-h-[150px] resize-y"
            disabled={isGenerating}
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>Be specific about setting, mood, and characters</span>
            <span>{originalPrompt.length}/{MAX_STORY_LENGTH}</span>
          </div>
        </StandardStep>

        {/* Step 2: Customize with Your Assets (NEW) */}
        {hasPrompt && (
          <StandardStep
            stepNumber={2}
            title="Customize with Your Assets"
            description={
              hasStoredAssets
                ? `${storedAssetReferences.length} asset(s) saved for consistency across grids`
                : "Optional: Upload your face, product, or environment to personalize the storyboard"
            }
          >
            {/* Show stored assets from previous grids */}
            {hasStoredAssets && (
              <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-primary font-medium mb-2">
                  Stored Assets (used for consistency)
                </p>
                <div className="flex flex-wrap gap-2">
                  {storedAssetReferences.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-primary/10 text-xs"
                    >
                      <img
                        src={asset.url}
                        alt={asset.label}
                        className="w-6 h-6 rounded object-cover"
                      />
                      <span>{asset.label}</span>
                      <span className="text-muted-foreground">({asset.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <PromptCustomizer
              originalPrompt={originalPrompt}
              customizedPrompt={customizedPrompt}
              onPromptChange={handleCustomizedPromptChange}
              assets={assetReferences}
              onAssetsChange={(newAssets) => {
                setAssetReferences(newAssets);
                // Notify parent about asset changes for cross-grid persistence
                if (onAssetReferencesChange && newAssets.length > 0) {
                  // Convert to stored format (would need upload, but for now just track)
                  // The actual URL storage happens after generation
                }
              }}
              onRewriteWithAI={handleRewriteWithAI}
              isRewriting={isRewriting}
              disabled={isGenerating}
            />
          </StandardStep>
        )}

        {/* Step 3: Visual Style */}
        <StandardStep
          stepNumber={hasPrompt ? 3 : 2}
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
