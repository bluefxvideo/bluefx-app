'use client';

import { StandardHistoryFilters, HistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * History Tab - Left-panel filters only (right panel is handled by ContextualOutput)
 */
export function HistoryTab() {
  const talkingAvatarToolTypes = [
    { value: 'completed', label: 'Completed' },
    { value: 'processing', label: 'Processing' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' }
  ];

  const handleFiltersChange = (filters: HistoryFilters) => {
    // Filters changed
  };

  return (
    <StandardHistoryFilters
      toolName="Talking Avatar"
      toolTypes={talkingAvatarToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}