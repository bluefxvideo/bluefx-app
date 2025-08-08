'use client';

import { StandardHistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * History Tab - Uses standardized history filters for ebook creation history
 */
export function HistoryTab() {
  // Define ebook-specific tool types
  const ebookToolTypes = [
    { value: 'topic-generation', label: 'Topic Generation' },
    { value: 'title-creation', label: 'Title Creation' },
    { value: 'outline-building', label: 'Outline Building' },
    { value: 'content-writing', label: 'Content Writing' },
    { value: 'cover-design', label: 'Cover Design' },
    { value: 'export', label: 'Ebook Export' }
  ];

  const handleFiltersChange = (filters: any) => {
    console.log('Ebook filters changed:', filters);
    // TODO: Implement actual filtering logic
  };

  return (
    <StandardHistoryFilters
      toolName="Ebook Writer"
      toolTypes={ebookToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}