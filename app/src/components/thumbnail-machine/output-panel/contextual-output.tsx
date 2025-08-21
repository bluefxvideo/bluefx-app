'use client';

import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { ThumbnailMachineOutput } from './thumbnail-machine-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { HistoryOutput } from './history-output';
import { TitleGeneratorOutput } from './title-generator-output';
import { CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    const titleTitle = result?.titles?.length 
      ? `${result.titles.length} Titles Generated!`
      : 'Title Results';
    const titleSubtitle = result?.titles?.length 
      ? 'Your YouTube titles are ready'
      : undefined;
    const titleIcon = result?.titles?.length
      ? (
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
      )
      : undefined;

    return (
      <OutputPanelShell
        title={titleTitle}
        subtitle={titleSubtitle}
        icon={titleIcon}
        status={isGenerating ? 'loading' : error ? 'error' : (result?.titles?.length ? 'ready' : 'idle')}
        errorMessage={error}
        actions={result?.titles?.length ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearResults}
            className="h-10 px-4 hover:bg-zinc-800/50 transition-all duration-300 hover:scale-105 text-zinc-400 hover:text-zinc-300"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Results
          </Button>
        ) : undefined}
        empty={<TitleGeneratorOutput titles={[]} isGenerating={false} error={undefined} />}
      >
        <TitleGeneratorOutput titles={result?.titles} isGenerating={false} error={undefined} />
      </OutputPanelShell>
    );
  }

  // Default: generate / face-swap / recreate
  const getTitle = () => {
    if (result?.success && !isGenerating) {
      return activeTab === 'generate' ? 'Generation Complete!' 
           : activeTab === 'face-swap' ? 'Face Swap Complete!'
           : 'Recreation Complete!';
    }
    return activeTab === 'generate' ? 'Thumbnail Results' 
         : activeTab === 'face-swap' ? 'Face Swap Results' 
         : 'Recreation Results';
  };

  const getSubtitle = () => {
    if (result?.success && !isGenerating) {
      return activeTab === 'generate' ? 'Your thumbnails are ready'
           : activeTab === 'face-swap' ? 'Your face swap is ready'
           : 'Your recreation is ready';
    }
    return undefined;
  };

  const getIcon = () => {
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

  return (
    <OutputPanelShell
      title={getTitle()}
      subtitle={getSubtitle()}
      icon={getIcon()}
      status={isGenerating ? 'loading' : error ? 'error' : (result?.success ? 'ready' : 'idle')}
      errorMessage={error}
      actions={getActions()}
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