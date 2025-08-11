'use client';

import { LogoMachineResponse } from '@/actions/tools/logo-machine';
import { LogoMachineOutput } from './logo-machine-output';
import { HistoryOutput } from './history-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';

interface ContextualOutputProps {
  activeTab: string;
  result?: LogoMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
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
  onClearResults
}: ContextualOutputProps) {
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

  // Default: generate / recreate
  return (
    <OutputPanelShell
      title={activeTab === 'recreate' ? 'Recreate Results' : 'Logo Results'}
      status={isGenerating ? 'loading' : error ? 'error' : (result?.success ? 'ready' : 'idle')}
      errorMessage={error}
      empty={
        <LogoMachineOutput
          result={undefined}
          isGenerating={false}
          error={undefined}
          onClearResults={onClearResults}
          activeTab={activeTab}
        />
      }
    >
      <LogoMachineOutput
        result={result}
        isGenerating={false}
        error={undefined}
        onClearResults={onClearResults}
        activeTab={activeTab}
      />
    </OutputPanelShell>
  );
}