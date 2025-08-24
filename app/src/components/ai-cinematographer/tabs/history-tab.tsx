'use client';

import { StandardHistoryFilters, HistoryFilters } from '@/components/tools/standard-history-filters';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';

interface HistoryTabProps {
  videos: CinematographerVideo[];
  isLoading: boolean;
  onRefresh: () => void;
  onDeleteVideo?: (videoId: string) => Promise<boolean>;
}

/**
 * History Tab - Left-panel filters only (right panel is handled by ContextualOutput)
 */
export function HistoryTab({ videos: _videos, isLoading: _isLoading, onRefresh: _onRefresh, onDeleteVideo: _onDeleteVideo }: HistoryTabProps) {
  const cinematographerToolTypes = [
    { value: 'completed', label: 'Completed' },
    { value: 'processing', label: 'Processing' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' }
  ];

  const handleFiltersChange = (filters: HistoryFilters) => {
    console.log('Cinematographer filters changed:', filters);
  };

  return (
    <StandardHistoryFilters
      toolName="AI Cinematographer"
      toolTypes={cinematographerToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}