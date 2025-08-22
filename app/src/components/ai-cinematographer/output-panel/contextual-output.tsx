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
  onRefresh
}: ContextualOutputProps) {
  // History tab
  if (activeTab === 'history') {
    return (
      <OutputPanelShell
        title="Video History"
        status={isLoadingHistory ? 'loading' : error ? 'error' : videos.length > 0 ? 'ready' : 'idle'}
        errorMessage={error}
        empty={<HistoryOutput videos={[]} isLoading={false} onRefresh={onRefresh} />}
      >
        <HistoryOutput
          videos={videos}
          isLoading={isLoadingHistory}
          onRefresh={onRefresh}
        />
      </OutputPanelShell>
    );
  }

  // Default: generate
  return (
    <OutputPanelShell
      title="Video Results"
      status={isGenerating ? 'loading' : error ? 'error' : (result?.success ? 'ready' : 'idle')}
      errorMessage={error}
      empty={
        <CinematographerOutput
          result={undefined}
          isGenerating={false}
          error={undefined}
          onClearResults={onClearResults}
          activeTab={activeTab}
        />
      }
    >
      <CinematographerOutput
        result={result}
        isGenerating={isGenerating}
        error={error}
        onClearResults={onClearResults}
        activeTab={activeTab}
      />
    </OutputPanelShell>
  );
}