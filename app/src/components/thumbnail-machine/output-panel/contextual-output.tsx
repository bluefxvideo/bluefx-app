'use client';

import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { ThumbnailMachineOutput } from './thumbnail-machine-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { HistoryOutput } from './history-output';
import { TitleGeneratorOutput } from './title-generator-output';

interface ContextualOutputProps {
  activeTab: string;
  result?: ThumbnailMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  onFocusPrompt?: () => void;
}

/**
 * Contextual Output Panel - Changes content based on active tab
 * Right panel adapts to show relevant results for each tool
 */
export function ContextualOutput({
  activeTab,
  result,
  isGenerating,
  error,
  onClearResults,
  onFocusPrompt
}: ContextualOutputProps) {
  // Wrap all tab-specific outputs in the shared OutputPanelShell for consistency
  if (activeTab === 'history') {
    return (
      <OutputPanelShell
        title="History"
        status={isGenerating ? 'loading' : error ? 'error' : result ? 'ready' : 'idle'}
        errorMessage={error}
        empty={<HistoryOutput />}
      >
        <HistoryOutput />
      </OutputPanelShell>
    );
  }

  if (activeTab === 'titles') {
    return (
      <OutputPanelShell
        title="Title Results"
        status={isGenerating ? 'loading' : error ? 'error' : (result?.titles?.length ? 'ready' : 'idle')}
        errorMessage={error}
        empty={<TitleGeneratorOutput titles={[]} isGenerating={false} error={undefined} />}
      >
        <TitleGeneratorOutput titles={result?.titles} isGenerating={false} error={undefined} />
      </OutputPanelShell>
    );
  }

  // Default: generate / face-swap / recreate
  return (
    <OutputPanelShell
      title={activeTab === 'generate' ? 'Thumbnail Results' : activeTab === 'face-swap' ? 'Face Swap Results' : 'Recreate Results'}
      status={isGenerating ? 'loading' : error ? 'error' : (result?.success ? 'ready' : 'idle')}
      errorMessage={error}
      actions={undefined}
      empty={
        <ThumbnailMachineOutput
          result={undefined}
          isGenerating={false}
          error={undefined}
          onClearResults={onClearResults}
          activeTab={activeTab}
          onFocusPrompt={onFocusPrompt}
        />
      }
    >
      <ThumbnailMachineOutput
        result={result}
        isGenerating={false}
        error={undefined}
        onClearResults={onClearResults}
        activeTab={activeTab}
        onFocusPrompt={onFocusPrompt}
      />
    </OutputPanelShell>
  );
}