'use client';

import { Card } from '@/components/ui/card';
import { Wand2, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onFocusPrompt?: () => void;
}

/**
 * Empty state when no results are available
 */
export function EmptyState({ onFocusPrompt }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card 
        className="p-8 max-w-sm text-center space-y-4 border-dashed bg-muted/20 border-muted-foreground/20 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onFocusPrompt}
      >
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
          <Wand2 className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 flex items-center justify-center gap-2">
            Ready to Create Magic
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </h3>
          <p className="text-base text-muted-foreground/60 leading-relaxed">
            Enter a detailed prompt and customize your settings to generate amazing YouTube thumbnails powered by AI.
          </p>
        </div>

      </Card>
    </div>
  );
}