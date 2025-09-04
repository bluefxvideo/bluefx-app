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
          className="min-h-[120px] sm:min-h-[100px] resize-y text-base sm:text-sm"
          maxLength={500}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm text-muted-foreground">
          <span className="text-xs sm:text-sm">Be descriptive for better results</span>
          <span className="text-xs sm:text-sm font-medium">{value.length}/500</span>
        </div>
      </div>
    );
  }
);

PromptSection.displayName = 'PromptSection';