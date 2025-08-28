'use client';

import { UserRound, RotateCcw } from 'lucide-react';
import { ThumbnailExample } from './thumbnail-example';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

interface EmptyStateProps {
  onFocusPrompt?: () => void;
}

/**
 * Tab-specific empty states for different thumbnail machine tools
 * Now using unified design pattern for consistency
 */

export function GenerateEmptyState({}: EmptyStateProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <ThumbnailExample />
    </div>
  );
}

export function FaceSwapEmptyState({ onFocusPrompt }: EmptyStateProps) {
  return (
    <UnifiedEmptyState
      icon={UserRound}
      title="Ready for Face Swap"
      description="Upload your face image and target image, then add optional modification instructions to generate personalized thumbnails."
      onFocusPrompt={onFocusPrompt}
    />
  );
}

export function RecreateEmptyState({ onFocusPrompt }: EmptyStateProps) {
  return (
    <UnifiedEmptyState
      icon={RotateCcw}
      title="Ready to Recreate"
      description="Upload a reference thumbnail to generate similar variations with improved quality and style."
      onFocusPrompt={onFocusPrompt}
    />
  );
}