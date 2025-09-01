'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FullWidthToolLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [FilterBar, ResultsPanel]
  className?: string;
}

export function FullWidthToolLayout({ children, className }: FullWidthToolLayoutProps) {
  const [filterBar, resultsPanel] = children;

  return (
    <div className={cn("h-full flex flex-col gap-4", className)}>
      {/* Filter Bar - Horizontal at top */}
      <Card className="bg-card border-border/30 p-4">
        {filterBar}
      </Card>
      
      {/* Results Panel - Full Width */}
      <div className="flex-1 min-h-0">
        <Card className="h-full bg-card border-border/30 p-4">
          <div className="h-full overflow-hidden">
            {resultsPanel}
          </div>
        </Card>
      </div>
    </div>
  );
}