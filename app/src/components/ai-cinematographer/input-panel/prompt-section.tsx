'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

interface PromptSectionProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * Prompt input section for video generation
 * Matches Thumbnail Machine pattern
 */
export function PromptSection({
  prompt,
  onPromptChange,
  placeholder = "Describe your video...",
  disabled = false,
  error
}: PromptSectionProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="prompt">
        Prompt *
      </Label>
      <Textarea
        id="prompt"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={4}
        className="resize-none"
      />
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Tip: Be descriptive for better results
        </p>
        <span className="text-xs text-muted-foreground">
          {prompt.length}/500
        </span>
      </div>
      {error && (
        <Card className="p-3 bg-destructive/5 border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}
    </div>
  );
}