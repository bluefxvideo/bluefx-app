'use client';

import { StandardHistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * History Tab - Left-panel filters only (right panel is handled by ContextualOutput)
 */
export function HistoryTab() {
  const logoToolTypes = [
    { value: 'logo-design', label: 'Logo Design' },
    { value: 'brand-kit', label: 'Brand Kit' },
    { value: 'variations', label: 'Logo Variations' },
    { value: 'export', label: 'Logo Export' }
  ];

  const handleFiltersChange = (filters: any) => {
    console.log('Logo filters changed:', filters);
  };

  return (
    <StandardHistoryFilters
      toolName="Logo Machine"
      toolTypes={logoToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}