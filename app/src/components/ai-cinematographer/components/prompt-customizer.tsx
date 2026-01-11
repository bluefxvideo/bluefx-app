'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

// Keep AssetReference export for backwards compatibility but it's no longer used here
export interface AssetReference {
  id: string;
  file: File;
  preview: string;
  label: string;
  type: 'character' | 'product' | 'environment' | 'other';
  description?: string;
}

export interface PromptCustomizerProps {
  originalPrompt: string;
  customizedPrompt: string;
  onPromptChange: (prompt: string) => void;
  onRewriteWithAI: (instruction: string) => Promise<void>;
  isRewriting?: boolean;
  disabled?: boolean;
  // Number of reference images uploaded in Step 2 (for context in suggestions)
  referenceImageCount?: number;
}

// Default suggested instructions for prompt customization
const DEFAULT_SUGGESTIONS = [
  'Use my uploaded product as the main product in all frames',
  'Make the main character look like my uploaded reference image',
  'Ensure my product label is clearly visible in product shots',
  'Use consistent lighting and color scheme across all frames',
  'Make the setting more modern and minimalist',
];

export function PromptCustomizer({
  originalPrompt,
  customizedPrompt,
  onPromptChange,
  onRewriteWithAI,
  isRewriting = false,
  disabled = false,
  referenceImageCount = 0,
}: PromptCustomizerProps) {
  const [chatInput, setChatInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChanges = customizedPrompt !== originalPrompt;

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isRewriting) return;

    await onRewriteWithAI(chatInput);
    setChatInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  };

  const resetToOriginal = () => {
    onPromptChange(originalPrompt);
  };

  // Generate contextual suggestions based on whether reference images were uploaded
  const getSuggestions = (): string[] => {
    if (referenceImageCount > 0) {
      return [
        'Use my uploaded reference images for visual consistency',
        'Make sure my product appears prominently in frames 3, 5, and 7',
        'Replace generic characters with my uploaded character reference',
        ...DEFAULT_SUGGESTIONS.slice(3),
      ];
    }
    return DEFAULT_SUGGESTIONS;
  };

  const suggestions = getSuggestions();

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h4 className="font-medium">AI Prompt Customizer</h4>
          {referenceImageCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({referenceImageCount} reference image{referenceImageCount !== 1 ? 's' : ''} uploaded)
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {isExpanded && (
        <>
          {/* Description */}
          <p className="text-sm text-muted-foreground">
            Tell the AI how to modify your prompt. For example, ask it to reference your uploaded product or character images.
          </p>

          {/* Suggested Instructions */}
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 4).map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setChatInput(suggestion)}
                disabled={disabled || isRewriting}
                className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <div className="flex gap-2">
            <Textarea
              placeholder="e.g., Replace the generic product with my supplement bottle, make the character match my uploaded photo..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled || isRewriting}
              className="min-h-[60px] resize-none"
            />
            <Button
              onClick={handleChatSubmit}
              disabled={disabled || isRewriting || !chatInput.trim()}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              {isRewriting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Modified Prompt Preview */}
          {hasChanges && (
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">Modified Prompt</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToOriginal}
                  disabled={disabled}
                  className="text-xs h-7 gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
              </div>
              <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-sm max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                {customizedPrompt}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
