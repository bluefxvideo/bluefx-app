'use client';

import { StandardHistoryFilters, HistoryFilters } from '@/components/tools/standard-history-filters';

/**
 * History Tab - Left-panel filters only (right panel is handled by ContextualOutput)
 */
export function HistoryTab() {
  const scriptToVideoToolTypes = [
    { value: 'script-generation', label: 'Script Generation' },
    { value: 'video-creation', label: 'Video Creation' },
    { value: 'scene-editing', label: 'Scene Editing' },
    { value: 'export', label: 'Video Export' }
  ];

  const handleFiltersChange = (filters: HistoryFilters) => {
    console.log('Script-to-Video filters changed:', filters);
  };

  return (
    <StandardHistoryFilters
      toolName="Script to Video"
      toolTypes={scriptToVideoToolTypes}
      onFiltersChange={handleFiltersChange}
    />
  );
}