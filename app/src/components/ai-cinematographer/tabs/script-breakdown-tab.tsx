'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

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
}

const MAX_SCRIPT_LENGTH = 50000;

export function ScriptBreakdownTab({
  onBreakdown,
  isProcessing,
}: ScriptBreakdownTabProps) {
  const [scriptText, setScriptText] = useState('');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('documentary');
  const [customStyle, setCustomStyle] = useState('');

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
          <Textarea
            placeholder="Paste your script here...

Example:
The year was 218 BC. Hannibal Barca had just done the unthinkable. He had marched an army of 50,000 soldiers, 9,000 cavalry, and 37 war elephants across the Alps..."
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value.slice(0, MAX_SCRIPT_LENGTH))}
            className="min-h-[250px] resize-y font-mono text-sm"
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

        {/* Step 2: Visual Style */}
        <StandardStep
          stepNumber={2}
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
            Estimated: {estimatedScenes} scenes · {Math.ceil(estimatedScenes / 9)} batches of 9
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}
