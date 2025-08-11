'use client';

import { Palette, RotateCcw } from 'lucide-react';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

/**
 * Tab-specific empty states for different logo machine tools
 */

export function GenerateEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <UnifiedEmptyState
        icon={Palette}
        title="Ready to Generate"
        description="Enter your company name and style preferences to generate professional logos powered by AI."
      />
    </div>
  );
}

export function RecreateEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <UnifiedEmptyState
        icon={RotateCcw}
        title="Ready to Recreate"
        description="Upload a reference logo to recreate or modify it with your specifications."
      />
    </div>
  );
}