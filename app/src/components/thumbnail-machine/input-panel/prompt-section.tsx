'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare } from 'lucide-react';
import { forwardRef } from 'react';

interface PromptSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const PromptSection = forwardRef<HTMLTextAreaElement, PromptSectionProps>(
  ({ value, onChange }, ref) => {
    return (
      <div className="space-y-3">
        <div className="px-1">
          <Textarea
          ref={ref}
          id="prompt"
          placeholder="Describe your perfect YouTube thumbnail... (e.g., 'Epic gaming moment with shocked expression, bright colors, dramatic lighting')"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[100px] resize-y"
          maxLength={500}
          />
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Be descriptive for better results</span>
          <span>{value.length}/500</span>
        </div>
      </div>
    );
  }
);

PromptSection.displayName = 'PromptSection';