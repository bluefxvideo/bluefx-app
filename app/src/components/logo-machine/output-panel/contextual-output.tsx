'use client';

import { LogoMachineResponse } from '@/actions/tools/logo-machine';
import { LogoMachineOutput } from './logo-machine-output';
import { HistoryOutput } from './history-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { useState } from 'react';
import { HistoryFilters } from '@/components/tools/standard-history-filters';
import { CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContextualOutputProps {
  activeTab: string;
  result?: LogoMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  historyFilters?: HistoryFilters;
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
  historyFilters
}: ContextualOutputProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const getTitle = () => {
    // If there's an error, show friendly error message
    if (error) {
      return 'Oops, something went wrong';
    }
    // If successful and not generating, show complete message
    if (result?.success && !isGenerating) {
      return activeTab === 'generate' ? 'Generation Complete!' 
           : activeTab === 'recreate' ? 'Recreation Complete!'
           : 'Logo Results';
    }
    // Default title
    return activeTab === 'generate' ? 'Logo Results' 
         : activeTab === 'recreate' ? 'Recreation Results' 
         : activeTab === 'history' ? 'History'
         : 'Logo Results';
  };

  const getSubtitle = () => {
    // Don't show subtitle if there's an error
    if (error) return undefined;
    
    if (result?.success && !isGenerating) {
      return activeTab === 'generate' ? 'Your logo is ready'
           : activeTab === 'recreate' ? 'Your recreation is ready'
           : undefined;
    }
    return undefined;
  };

  const getIcon = () => {
    // Don't show success icon if there's an error
    if (error) return undefined;
    
    if (result?.success && !isGenerating) {
      return (
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
      );
    }
    return undefined;
  };

  const getActions = () => {
    // Don't show clear button if there's an error
    if (error) return undefined;
    
    if (result?.success && !isGenerating) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearResults}
          className="h-10 px-4 hover:bg-zinc-800/50 transition-all duration-300 hover:scale-105 text-zinc-400 hover:text-zinc-300"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear Results
        </Button>
      );
    }
    return undefined;
  };

  if (activeTab === 'history') {
    return (
      <OutputPanelShell
        title={getTitle()}
        status="ready"
        empty={<HistoryOutput refreshTrigger={refreshTrigger} filters={historyFilters} />}
      >
        <HistoryOutput refreshTrigger={refreshTrigger} filters={historyFilters} />
      </OutputPanelShell>
    );
  }

  // Default: generate / recreate
  return (
    <OutputPanelShell
      title={getTitle()}
      subtitle={getSubtitle()}
      icon={getIcon()}
      status={isGenerating ? 'loading' : error ? 'error' : (result?.success ? 'ready' : 'idle')}
      errorMessage={error}
      actions={getActions()}
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