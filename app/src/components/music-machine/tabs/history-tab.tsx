'use client';

import { StandardHistoryFilters, HistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * History Tab - Left-panel filters only (right panel is handled by MusicMachineOutput)
 */
export function HistoryTab() {
  const musicMachineToolTypes = [
    { value: 'completed', label: 'Completed' },
    { value: 'processing', label: 'Processing' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' }
  ];

  const handleFiltersChange = (filters: HistoryFilters) => {
    console.log('Music Machine filters changed:', filters);
  };

  return (
    <StandardHistoryFilters
      toolName="Music Maker"
      toolTypes={musicMachineToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}