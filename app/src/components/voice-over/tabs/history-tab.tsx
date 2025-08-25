'use client';

import { StandardHistoryFilters, HistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * History Tab - Left-panel filters only (right panel is handled by ContextualOutput)
 */
export function HistoryTab() {
  const voiceOverToolTypes = [
    { value: 'completed', label: 'Completed' },
    { value: 'processing', label: 'Processing' },
    { value: 'failed', label: 'Failed' }
  ];

  const handleFiltersChange = (filters: HistoryFilters) => {
    console.log('Voice-Over filters changed:', filters);
  };

  return (
    <StandardHistoryFilters
      toolName="Voice Over"
      toolTypes={voiceOverToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}