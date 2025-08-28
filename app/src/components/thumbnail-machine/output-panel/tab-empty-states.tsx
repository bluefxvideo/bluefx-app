'use client';

import { UserRound, RotateCcw } from 'lucide-react';
import { ThumbnailExample } from './thumbnail-example';
import { ThumbnailFaceSwapExample } from './thumbnail-faceswap-example';
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

export function FaceSwapEmptyState({}: EmptyStateProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <ThumbnailFaceSwapExample />
    </div>
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