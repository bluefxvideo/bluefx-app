'use client';

import { useContentMultiplierStore, useContentProgress, useActiveTab, useActiveWorkflowTab } from './store/content-multiplier-store';
import { WorkflowTabs } from './tabs/workflow-tabs';
import { ContentMultiplierTabs } from './tabs/content-multiplier-tabs';
import { ContentMultiplierOutput } from './output-panel/content-multiplier-output';
import { Card } from '@/components/ui/card';
import { Layers } from 'lucide-react';

interface ContentMultiplierLayoutProps {
  children: React.ReactNode;
}

/**
 * Content Multiplier Layout Component
 * Two-column layout following the exact thumbnail machine pattern
 * Left panel: Input and controls (w-1/2 max-w-md)
 * Right panel: Output and previews (flex-1)
 */
export function ContentMultiplierLayout({ children }: ContentMultiplierLayoutProps) {
  const active_tab = useActiveTab();
  const active_workflow_tab = useActiveWorkflowTab();
  const progress = useContentProgress();
  const isGenerating = progress.is_generating;
  const error = progress.error_message;

  return (
    <div className="h-full p-6">
      <div className="h-full flex gap-6">
        {/* Left Panel - Input & Controls */}
        <div className="w-1/2 max-w-md">
          <Card className="h-full p-6 shadow-lg bg-gray-50 dark:bg-gray-800/30">
            <div className="h-full flex flex-col">
              {/* Top-Level Workflow Tabs */}
              <WorkflowTabs activeWorkflowTab={active_workflow_tab} />
              
              {/* Platform-Specific Tabs (only after content generation) */}
              <ContentMultiplierTabs activeTab={active_tab} />
              
              {/* Progress Indicator */}
              {isGenerating && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {progress.current_platform ? `Adapting content for ${progress.current_platform}...` : 'Processing content...'}
                    </span>
                  </div>
                  <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.total_progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {progress.total_progress}% complete
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                        Content Generation Error
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden">
                {children}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel - Output & Previews */}
        <div className="flex-1">
          <Card className="h-full p-6 shadow-lg bg-white dark:bg-gray-800/40">
            <ContentMultiplierOutput activeTab={active_tab} />
          </Card>
        </div>
      </div>
    </div>
  );
}