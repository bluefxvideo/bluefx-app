'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare } from 'lucide-react';

interface PromptSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function PromptSection({ value, onChange }: PromptSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <Label htmlFor="prompt" className="text-sm font-medium">
          Prompt
        </Label>
      </div>
      <Textarea
        id="prompt"
        placeholder="Describe your perfect YouTube thumbnail... (e.g., 'Epic gaming moment with shocked expression, bright colors, dramatic lighting')"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[100px] resize-none"
        maxLength={500}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Tip: Be descriptive for better results</span>
        <span>{value.length}/500</span>
      </div>
    </div>
  );
}