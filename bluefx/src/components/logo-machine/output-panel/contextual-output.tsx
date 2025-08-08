'use client';

import { LogoMachineResponse } from '@/actions/tools/logo-machine';
import { LogoMachineOutput } from './logo-machine-output';
import { HistoryOutput } from './history-output';

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
  switch (activeTab) {
    case 'history':
      return <HistoryOutput />;
    
    case 'generate':
    case 'recreate':
    default:
      return (
        <LogoMachineOutput
          result={result}
          isGenerating={isGenerating}
          error={error}
          onClearResults={onClearResults}
          activeTab={activeTab}
        />
      );
  }
}