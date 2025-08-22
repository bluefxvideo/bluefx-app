'use client';

import { CinematographerResponse } from '@/actions/tools/ai-cinematographer';
import { CinematographerOutput } from './cinematographer-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';

interface ContextualOutputProps {
  activeTab: string;
  result?: CinematographerResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
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
}: ContextualOutputProps) {
  // History tab
  if (activeTab === 'history') {
    return (
      <OutputPanelShell
        title="History"
        status={isGenerating ? 'loading' : error ? 'error' : result ? 'ready' : 'idle'}
        errorMessage={error}
        empty={<CinematographerOutput result={undefined} isGenerating={false} error={undefined} onClearResults={onClearResults} activeTab={activeTab} />}
      >
        <CinematographerOutput
          result={result}
          isGenerating={false}
          error={undefined}
          onClearResults={onClearResults}
          activeTab={activeTab}
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