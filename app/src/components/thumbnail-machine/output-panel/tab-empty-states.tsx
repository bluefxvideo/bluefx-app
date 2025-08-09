'use client';

import { Card } from '@/components/ui/card';
import { Sparkles, UserRound, RotateCcw } from 'lucide-react';
import { ThumbnailExamplesCarousel } from './thumbnail-examples-carousel';

interface EmptyStateProps {
  onFocusPrompt?: () => void;
}

/**
 * Tab-specific empty states for different thumbnail machine tools
 */

export function GenerateEmptyState({}: EmptyStateProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <ThumbnailExamplesCarousel />
    </div>
  );
}

export function FaceSwapEmptyState({ onFocusPrompt }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card 
        className="p-8 max-w-sm text-center space-y-4 border-dashed bg-muted/20 border-muted-foreground/20 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onFocusPrompt}
      >
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
          <UserRound className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 flex items-center justify-center gap-2">
            Ready for Face Swap Magic
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </h3>
          <p className="text-base text-muted-foreground/60 leading-relaxed">
            Upload your face image and describe your thumbnail concept to generate personalized YouTube thumbnails.
          </p>
        </div>

      </Card>
    </div>
  );
}

export function RecreateEmptyState({ onFocusPrompt }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card 
        className="p-8 max-w-sm text-center space-y-4 border-dashed bg-muted/20 border-muted-foreground/20 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onFocusPrompt}
      >
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
          <RotateCcw className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h3 className="font-medium mb-2 flex items-center justify-center gap-2">
            Ready to Recreate Magic
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </h3>
          <p className="text-base text-muted-foreground/60 leading-relaxed">
            Upload a reference thumbnail to generate similar variations with improved quality and style.
          </p>
        </div>

      </Card>
    </div>
  );
}