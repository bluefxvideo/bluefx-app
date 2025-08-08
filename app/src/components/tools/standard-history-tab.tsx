'use client';

import { ReactNode } from 'react';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardHistoryFilters } from '@/components/tools/standard-history-filters';

interface FilterOption {
  value: string;
  label: string;
}

interface StandardHistoryTabProps {
  toolName: string;
  toolTypes: FilterOption[];
  onFiltersChange: (filters: any) => void;
  RightPanel: ReactNode; // caller provides the right panel content (results list/grid)
}

/**
 * StandardHistoryTab
 * Left panel: StandardHistoryFilters
 * Right panel: caller-provided results component
 */
export function StandardHistoryTab({ toolName, toolTypes, onFiltersChange, RightPanel }: StandardHistoryTabProps) {
  return (
    <StandardToolLayout>
      {/* Left: Filters */}
      <div className="h-full">
        <StandardHistoryFilters toolName={toolName} toolTypes={toolTypes} onFiltersChange={onFiltersChange} />
      </div>

      {/* Right: Results */}
      <div className="h-full">
        {RightPanel}
      </div>
    </StandardToolLayout>
  );
}




