'use client';

import { Video, History } from 'lucide-react';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

/**
 * Tab-specific empty states for different cinematographer tools
 */

export function GenerateEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <UnifiedEmptyState
        icon={Video}
        title="Ready to Generate"
        description="Enter a detailed prompt and customize your settings to generate amazing cinematic videos powered by AI."
      />
    </div>
  );
}

export function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <UnifiedEmptyState
        icon={History}
        title="No History Yet"
        description="Your generated videos will appear here with playback controls and download options."
      />
    </div>
  );
}