'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface UniformToolPageProps {
  tabs: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Uniform Tool Page Wrapper
 * Provides the dark card container with tabs at the top
 * and content area below - consistent across ALL tools
 */
export function UniformToolPage({ tabs, children, className }: UniformToolPageProps) {
  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Professional Workspace Container - Dark Card */}
      <div className="flex-1 overflow-hidden m-3 ml-0">
        <div className="h-full flex flex-col bg-card rounded-2xl">
          {/* Tab Header Inside Dark Card */}
          <div className="flex-shrink-0 px-6 py-3">
            {tabs}
          </div>
          
          {/* Content Area with Consistent Padding */}
          <div className="flex-1 overflow-hidden p-6 pt-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}