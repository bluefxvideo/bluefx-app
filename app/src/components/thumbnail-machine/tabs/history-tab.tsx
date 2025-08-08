'use client';

import { StandardHistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * History Tab - Uses standardized history filters for thumbnail generation history
 */
export function HistoryTab() {
  // Define thumbnail-specific tool types
  const thumbnailToolTypes = [
    { value: 'thumbnail', label: 'Thumbnail Generator' },
    { value: 'face-swap', label: 'Face Swap' },
    { value: 'recreate', label: 'Recreate' },
    { value: 'titles', label: 'Title Generator' }
  ];

  const handleFiltersChange = (filters: any) => {
    console.log('Thumbnail filters changed:', filters);
    // TODO: Implement actual filtering logic
  };

  return (
    <StandardHistoryFilters
      toolName="Thumbnail Machine"
      toolTypes={thumbnailToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}