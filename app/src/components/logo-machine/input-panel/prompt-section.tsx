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
      <Textarea
        id="prompt"
        placeholder="Describe your perfect logo... (e.g., 'Modern tech logo with geometric shapes, clean lines, representing innovation and trust')"
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