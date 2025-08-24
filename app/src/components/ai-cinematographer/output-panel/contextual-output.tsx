'use client';

import { CinematographerResponse } from '@/actions/tools/ai-cinematographer';
import { CinematographerOutput } from './cinematographer-output';
import { HistoryOutput } from './history-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';

interface ContextualOutputProps {
  activeTab: string;
  result?: CinematographerResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  videos?: CinematographerVideo[];
  isLoadingHistory?: boolean;
  onRefresh?: () => void;
  isStateRestored?: boolean;
  onDeleteVideo?: (videoId: string) => Promise<boolean>;
}

/**
 * Contextual Output Panel - Changes based on active tab
 * Matches Thumbnail Machine pattern exactly
 */
export function ContextualOutput({
  activeTab,
  result,
  isGenerating,
  error,
  onClearResults,
  videos = [],
  isLoadingHistory = false,
  onRefresh,
  isStateRestored = false,
  onDeleteVideo
}: ContextualOutputProps) {
  // History tab
  if (activeTab === 'history') {
    return (
      <OutputPanelShell
        title="Video History"
        status={isLoadingHistory ? 'loading' : error ? 'error' : videos.length > 0 ? 'ready' : 'idle'}
        errorMessage={error}
        empty={<HistoryOutput videos={[]} isLoading={false} onRefresh={onRefresh} onDeleteVideo={onDeleteVideo} />}
      >
        <HistoryOutput
          videos={videos}
          isLoading={isLoadingHistory}
          onRefresh={onRefresh}
          onDeleteVideo={onDeleteVideo}
        />
      </OutputPanelShell>
    );
  }

  // Default: generate
  const titleWithIndicator = isStateRestored ? "Video Results (Resumed)" : "Video Results";
  
  return (
    <OutputPanelShell
      title={titleWithIndicator}
      status={isGenerating ? 'loading' : error ? 'error' : (result?.success || isStateRestored ? 'ready' : 'idle')}
      errorMessage={error}
      empty={
        // Don't show empty state if we have restored state or result data
        (isStateRestored || result?.success) ? (
          <CinematographerOutput
            result={result}
            isGenerating={isGenerating}
            error={error}
            onClearResults={onClearResults}
            activeTab={activeTab}
            isStateRestored={isStateRestored}
          />
        ) : (
          <CinematographerOutput
            result={undefined}
            isGenerating={false}
            error={undefined}
            onClearResults={onClearResults}
            activeTab={activeTab}
          />
        )
      }
    >
      <CinematographerOutput
        result={result}
        isGenerating={isGenerating}
        error={error}
        onClearResults={onClearResults}
        activeTab={activeTab}
        isStateRestored={isStateRestored}
      />
    </OutputPanelShell>
  );
}