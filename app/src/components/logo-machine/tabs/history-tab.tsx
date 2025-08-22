'use client';

import { StandardHistoryFilters, HistoryFilters } from '@/components/tools/standard-history-filters';

interface HistoryTabProps {
  onFiltersChange: (filters: HistoryFilters) => void;
}

/**
 * History Tab - Uses standardized history filters for logo generation history
 */
export function HistoryTab({ onFiltersChange }: HistoryTabProps) {
  // Define logo-specific tool types
  const logoToolTypes = [
    { value: 'logo-design', label: 'Logo Design' },
    { value: 'recreate', label: 'Recreate' }
  ];

  return (
    <StandardHistoryFilters
      toolName="Logo Machine"
      toolTypes={logoToolTypes}
      onFiltersChange={onFiltersChange}
    />
  );
}