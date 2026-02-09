'use client';

import { ThumbnailMachineResponse } from '@/actions/tools/thumbnail-machine';
import { ThumbnailMachineOutput } from './thumbnail-machine-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { HistoryOutput } from './history-output';
import { CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HistoryFilters } from '@/components/tools/standard-history-filters';

interface ContextualOutputProps {
  activeTab: string;
  result?: ThumbnailMachineResponse;
  isGenerating: boolean;
  error?: string;
  onClearResults: () => void;
  onCancelGeneration?: () => void;
  onEditThumbnail?: (editPrompt: string, imageUrls: string[]) => void;
  onFocusPrompt?: () => void;
  historyFilters?: HistoryFilters;
  prompt?: string;
  hasReferenceImage?: boolean;
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
  onCancelGeneration,
  onEditThumbnail,
  onFocusPrompt,
  historyFilters,
  prompt,
  hasReferenceImage
}: ContextualOutputProps) {

  // Clean up error messages for better UX
  const getCleanErrorMessage = (errorMsg?: string) => {
    if (!errorMsg) return undefined;
    
    // OpenAI safety system errors
    if (errorMsg.includes('safety system') || errorMsg.includes('moderation_blocked')) {
      return 'Content blocked by safety system. Try a different image or description.';
    }
    
    // Rate limit errors
    if (errorMsg.includes('rate limit') || errorMsg.includes('Rate limit')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    // API errors
    if (errorMsg.includes('API Error') || errorMsg.includes('Bad Request')) {
      return 'Service temporarily unavailable. Please try again.';
    }
    
    // Timeout errors
    if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    // Generic long error cleanup - truncate if too long
    if (errorMsg.length > 100) {
      const firstSentence = errorMsg.split('.')[0];
      return firstSentence.length > 80 
        ? 'An error occurred. Please try again or contact support.'
        : firstSentence + '.';
    }
    
    return errorMsg;
  };
  // Wrap all tab-specific outputs in the shared OutputPanelShell for consistency
  if (activeTab === 'history') {
    // Create current generation object to show in history if generating
    // Determine type by checking which type of results we expect or have
    const determineGenerationType = () => {
      // Check if we have a stored generation type from restoration
      const storedType = (result as any)?.generationType;
      if (storedType) {
        return storedType;
      }
      
      // For active (non-restored) generations, use the current tab as context
      if (isGenerating) {
        // Check which tab user is currently viewing as context
        if (activeTab === 'face-swap') {
          return 'face-swap';
        }
        if (activeTab === 'recreate') {
          return 'recreate';
        }
      }
      
      // Check if we have face swap results or in progress
      if (result?.face_swapped_thumbnails && result.face_swapped_thumbnails.length > 0) {
        return 'face-swap';
      }
      // Check batch_id patterns from the generation process
      if (result?.batch_id?.includes('face')) {
        return 'face-swap';
      }
      if (result?.batch_id?.includes('recreate')) {
        return 'recreate';
      }
      // Default to thumbnail generation
      return 'thumbnail';
    };
    
    const currentGeneration = isGenerating && prompt ? {
      prompt: prompt,
      type: determineGenerationType(),
      isGenerating: true,
      batch_id: result?.batch_id
    } : undefined;
    
    return (
      <OutputPanelShell
        title="History"
        status={'ready'} // History should always be accessible, regardless of generation state
        errorMessage={undefined} // History has its own error handling
        empty={<HistoryOutput filters={historyFilters} currentGeneration={currentGeneration} />}
      >
        <HistoryOutput filters={historyFilters} currentGeneration={currentGeneration} />
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
           : activeTab === 'pro' ? 'Pro Generation Complete!'
           : activeTab === 'face-swap' ? 'Face Swap Complete!'
           : 'Recreation Complete!';
    }
    // Default title
    return activeTab === 'generate' ? 'Thumbnail Results'
         : activeTab === 'pro' ? 'Pro Thumbnail Results'
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
           : activeTab === 'pro' ? 'Your pro thumbnail is ready'
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
      status={
        isGenerating ? 'loading' : 
        error ? 'error' : 
        (result && (
          (result.thumbnails && result.thumbnails.length > 0) || 
          (result.face_swapped_thumbnails && result.face_swapped_thumbnails.length > 0)
        )) ? 'ready' : 'idle'
      }
      errorMessage={getCleanErrorMessage(error)}
      actions={getActions()}
      activeTab={activeTab}
      onCancelGeneration={onCancelGeneration}
      loading={
        // Custom loading component to show our processing card instead of simple spinner
        <ThumbnailMachineOutput
          result={result}
          isGenerating={isGenerating}
          error={getCleanErrorMessage(error)}
          onClearResults={onClearResults}
          onCancelGeneration={onCancelGeneration}
          onEditThumbnail={onEditThumbnail}
          activeTab={activeTab}
          onFocusPrompt={onFocusPrompt}
          prompt={prompt}
          hasReferenceImage={hasReferenceImage}
        />
      }
      empty={
        <ThumbnailMachineOutput
          result={result}
          isGenerating={isGenerating}
          error={getCleanErrorMessage(error)}
          onClearResults={onClearResults}
          onCancelGeneration={onCancelGeneration}
          onEditThumbnail={onEditThumbnail}
          activeTab={activeTab}
          onFocusPrompt={onFocusPrompt}
          prompt={prompt}
          hasReferenceImage={hasReferenceImage}
        />
      }
    >
      <ThumbnailMachineOutput
        result={result}
        isGenerating={isGenerating}
        error={getCleanErrorMessage(error)}
        onClearResults={onClearResults}
        onCancelGeneration={onCancelGeneration}
        onEditThumbnail={onEditThumbnail}
        activeTab={activeTab}
        onFocusPrompt={onFocusPrompt}
        prompt={prompt}
        hasReferenceImage={hasReferenceImage}
      />
    </OutputPanelShell>
  );
}