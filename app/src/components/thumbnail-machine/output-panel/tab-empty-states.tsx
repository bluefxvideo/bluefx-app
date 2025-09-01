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
    <div className="flex-1 overflow-hidden">
      <UnifiedEmptyState
        icon={RotateCcw}
        title="Upload Reference Image"
        description="Upload a thumbnail to recreate with AI-powered variations and improvements"
        onFocusPrompt={onFocusPrompt}
      />
    </div>
  );
}