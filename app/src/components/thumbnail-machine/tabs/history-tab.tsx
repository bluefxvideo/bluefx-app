'use client';

import { StandardHistoryFilters, HistoryFilters } from '@/components/tools/standard-history-filters';

interface HistoryTabProps {
  onFiltersChange: (filters: HistoryFilters) => void;
}

/**
 * History Tab - Uses standardized history filters for thumbnail generation history
 */
export function HistoryTab({ onFiltersChange }: HistoryTabProps) {
  // Define thumbnail-specific tool types
  const thumbnailToolTypes = [
    { value: 'thumbnail', label: 'Thumbnail Generator' },
    { value: 'face-swap', label: 'Face Swap' },
    { value: 'recreate', label: 'Recreate' },
    { value: 'titles', label: 'Title Generator' }
  ];

  return (
    <StandardHistoryFilters
      toolName="Thumbnail Machine"
      toolTypes={thumbnailToolTypes}
      onFiltersChange={onFiltersChange}
    />
  );
}