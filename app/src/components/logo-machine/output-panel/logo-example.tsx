'use client';

import { Palette } from 'lucide-react';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

/**
 * Logo example component for empty state
 */
export function LogoExample() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <UnifiedEmptyState
        icon={Palette}
        title="Ready to Generate"
        description="Enter your company name and preferences to create a unique logo."
      />
    </div>
  );
}