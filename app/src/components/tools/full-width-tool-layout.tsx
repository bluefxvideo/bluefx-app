'use client';

import { cn } from '@/lib/utils';
import { containerStyles } from '@/lib/container-styles';

interface FullWidthToolLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [FilterBar, ResultsPanel]
  className?: string;
}

export function FullWidthToolLayout({ children, className }: FullWidthToolLayoutProps) {
  const [filterBar, resultsPanel] = children;

  return (
    <div className={cn("h-full flex flex-col gap-4", className)}>
      {/* Filter Bar - Horizontal at top */}
      <div className={`${containerStyles.panel} p-4`}>
        {filterBar}
      </div>
      
      {/* Results Panel - Full Width */}
      <div className="flex-1 min-h-0">
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <div className="h-full overflow-hidden">
            {resultsPanel}
          </div>
        </div>
      </div>
    </div>
  );
}