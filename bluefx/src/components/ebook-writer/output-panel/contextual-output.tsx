'use client';

import { EbookOutput } from './ebook-output';
import { TitleOutput } from './title-output';
import { HistoryOutput } from './history-output';
import { ProgressPanel } from './progress-panel';
import type { EbookMetadata, TitleOptions, GenerationProgress } from '../store/ebook-writer-store';

interface ContextualOutputProps {
  activeTab: string;
  ebook: EbookMetadata | null;
  titleOptions: TitleOptions | null;
  isGenerating: boolean;
  error?: string;
  progress: GenerationProgress;
}

/**
 * Contextual Output - Right panel adapts based on active tab
 * Following the proven thumbnail machine pattern
 */
export function ContextualOutput({
  activeTab,
  ebook,
  titleOptions,
  isGenerating,
  error,
  progress
}: ContextualOutputProps) {
  
  // Always show progress panel if generating or has progress
  const showProgress = isGenerating || progress.total_progress > 0;

  switch (activeTab) {
    case 'history':
      return <HistoryOutput />;
    
    case 'title':
      return (
        <div className="h-full flex flex-col gap-4">
          {showProgress && <ProgressPanel progress={progress} />}
          <TitleOutput
            titleOptions={titleOptions}
            isGenerating={isGenerating}
            error={error}
          />
        </div>
      );
    
    case 'topic':
    case 'outline':
    case 'content':
    case 'cover':
    case 'export':
    default:
      return (
        <div className="h-full flex flex-col gap-4">
          {showProgress && <ProgressPanel progress={progress} />}
          <EbookOutput
            ebook={ebook}
            isGenerating={isGenerating}
            error={error}
            activeTab={activeTab}
          />
        </div>
      );
  }
}