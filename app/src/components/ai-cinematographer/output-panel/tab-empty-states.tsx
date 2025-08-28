'use client';

import { Video, History } from 'lucide-react';
import { CinematographerExample } from './cinematographer-example';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';

/**
 * Tab-specific empty states for different cinematographer tools
 */

export function GenerateEmptyState() {
  return (
    <div className="flex-1 overflow-hidden">
      <CinematographerExample />
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