'use client';

import { StandardHistoryFilters, HistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * History Tab - Uses standardized history filters for content multiplier history
 */
export function HistoryTab() {
  // Define content multiplier tool types
  const contentToolTypes = [
    { value: 'twitter', label: 'Twitter Content' },
    { value: 'instagram', label: 'Instagram Content' },
    { value: 'tiktok', label: 'TikTok Content' },
    { value: 'linkedin', label: 'LinkedIn Content' },
    { value: 'facebook', label: 'Facebook Content' }
  ];

  const handleFiltersChange = (filters: HistoryFilters) => {
    console.log('Content filters changed:', filters);
    // TODO: Implement actual filtering logic
  };

  return (
    <StandardHistoryFilters
      toolName="Content Multiplier"
      toolTypes={contentToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}