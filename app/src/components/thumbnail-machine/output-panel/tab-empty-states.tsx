'use client';

import { RotateCcw } from 'lucide-react';
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
      {/* Empty state - no content */}
    </div>
  );
}

export function FaceSwapEmptyState({}: EmptyStateProps) {
  return (
    <div className="flex-1 overflow-hidden">
      {/* Empty state - no content */}
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