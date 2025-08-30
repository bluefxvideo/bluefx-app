'use client';

import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { ThumbnailMachineOutput } from './thumbnail-machine-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { HistoryOutput } from './history-output';
import { TitleGeneratorOutput } from './title-generator-output';
import { CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryFilters } from '@/components/tools/standard-history-filters';

interface ContextualOutputProps {
  activeTab: string;
  result?: ThumbnailMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  onFocusPrompt?: () => void;
  historyFilters?: HistoryFilters;
  prompt?: string; // Add prompt prop
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
  onFocusPrompt,
  historyFilters,
  prompt
}: ContextualOutputProps) {
  // Debug logging
  console.log('🎭 ContextualOutput render:', {
    activeTab,
    isGenerating,
    hasResult: !!result,
    hasFaceSwap: !!result?.face_swapped_thumbnails,
    faceSwapCount: result?.face_swapped_thumbnails?.length || 0
  });
  // Wrap all tab-specific outputs in the shared OutputPanelShell for consistency
  if (activeTab === 'history') {
    return (
      <OutputPanelShell
        title="History"
        status={isGenerating ? 'loading' : error ? 'error' : result ? 'ready' : 'idle'}
        errorMessage={error}
        empty={<HistoryOutput filters={historyFilters} />}
      >
        <HistoryOutput filters={historyFilters} />
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
    // If there's an error, show friendly error message
    if (error) {
      return 'Oops, something went wrong';
    }
    // If we have actual thumbnails and not generating, show complete message
    const hasResults = activeTab === 'face-swap' 
      ? (result?.face_swapped_thumbnails && result?.face_swapped_thumbnails.length > 0)
      : (result?.thumbnails && result?.thumbnails.length > 0);
    
    if (result?.success && !isGenerating && hasResults) {
      return activeTab === 'generate' ? 'Generation Complete!' 
           : activeTab === 'face-swap' ? 'Face Swap Complete!'
           : 'Recreation Complete!';
    }
    // Default title
    return activeTab === 'generate' ? 'Thumbnail Results' 
         : activeTab === 'face-swap' ? 'Face Swap Results' 
         : 'Recreation Results';
  };

  const getSubtitle = () => {
    // Don't show subtitle if there's an error
    if (error) return undefined;
    
    const hasResults = activeTab === 'face-swap' 
      ? (result?.face_swapped_thumbnails && result?.face_swapped_thumbnails.length > 0)
      : (result?.thumbnails && result?.thumbnails.length > 0);
    
    if (result?.success && !isGenerating && hasResults) {
      return activeTab === 'generate' ? 'Your thumbnails are ready'
           : activeTab === 'face-swap' ? 'Your face swap is ready'
           : 'Your recreation is ready';
    }
    return undefined;
  };

  const getIcon = () => {
    // Don't show success icon if there's an error
    if (error) return undefined;
    
    const hasResults = activeTab === 'face-swap' 
      ? (result?.face_swapped_thumbnails && result?.face_swapped_thumbnails.length > 0)
      : (result?.thumbnails && result?.thumbnails.length > 0);
    
    if (result?.success && !isGenerating && hasResults) {
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
    
    if (result?.success && !isGenerating && result?.thumbnails && result?.thumbnails.length > 0) {
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
      status={isGenerating ? 'loading' : error ? 'error' : (result?.success && (result?.thumbnails?.length || 0) > 0 ? 'ready' : 'idle')}
      errorMessage={error}
      actions={getActions()}
      loading={
        // Custom loading component to show our processing card instead of simple spinner
        <ThumbnailMachineOutput
          result={result}
          isGenerating={isGenerating}
          error={error}
          onClearResults={onClearResults}
          activeTab={activeTab}
          onFocusPrompt={onFocusPrompt}
          prompt={prompt}
        />
      }
      empty={
        <ThumbnailMachineOutput
          result={undefined}
          isGenerating={isGenerating}
          error={error}
          onClearResults={onClearResults}
          activeTab={activeTab}
          onFocusPrompt={onFocusPrompt}
          prompt={prompt}
        />
      }
    >
      <ThumbnailMachineOutput
        result={result}
        isGenerating={isGenerating}
        error={error}
        onClearResults={onClearResults}
        activeTab={activeTab}
        onFocusPrompt={onFocusPrompt}
        prompt={prompt}
      />
    </OutputPanelShell>
  );
}