'use client';

import type { CinematographerResponse } from '@/types/cinematographer';
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
  onCancelGeneration?: () => void;
  onRegenerate?: () => void;
  onTweak?: () => void;
  videos?: CinematographerVideo[];
  isLoadingHistory?: boolean;
  onRefresh?: () => void;
  isStateRestored?: boolean;
  onDeleteVideo?: (videoId: string) => Promise<boolean>;
  onSwitchVoice?: (file: File | null) => void;
  lastVoiceSample?: { url: string; name: string } | null;
  isSwitchingVoice?: boolean;
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
  onCancelGeneration,
  onRegenerate,
  onTweak,
  videos = [],
  isLoadingHistory = false,
  onRefresh,
  isStateRestored = false,
  onDeleteVideo,
  onSwitchVoice,
  lastVoiceSample,
  isSwitchingVoice,
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
      loading={
        // Custom loading component to show video processing card instead of simple spinner
        <CinematographerOutput
          result={result}
          isGenerating={isGenerating}
          error={error}
          onClearResults={onClearResults}
          onCancelGeneration={onCancelGeneration}
          onRegenerate={onRegenerate}
          onTweak={onTweak}
          activeTab={activeTab}
          isStateRestored={isStateRestored}
          onSwitchVoice={onSwitchVoice}
          lastVoiceSample={lastVoiceSample}
          isSwitchingVoice={isSwitchingVoice}
        />
      }
      empty={
        // Don't show empty state if we have restored state or result data
        (isStateRestored || result?.success) ? (
          <CinematographerOutput
            result={result}
            isGenerating={isGenerating}
            error={error}
            onClearResults={onClearResults}
            onRegenerate={onRegenerate}
            onTweak={onTweak}
            activeTab={activeTab}
            isStateRestored={isStateRestored}
          onSwitchVoice={onSwitchVoice}
          lastVoiceSample={lastVoiceSample}
          isSwitchingVoice={isSwitchingVoice}
          />
        ) : (
          <CinematographerOutput
            result={undefined}
            isGenerating={false}
            error={undefined}
            onClearResults={onClearResults}
            activeTab={activeTab}
          onSwitchVoice={onSwitchVoice}
          lastVoiceSample={lastVoiceSample}
          isSwitchingVoice={isSwitchingVoice}
          />
        )
      }
    >
      <CinematographerOutput
        result={result}
        isGenerating={isGenerating}
        error={error}
        onClearResults={onClearResults}
        onRegenerate={onRegenerate}
        onTweak={onTweak}
        activeTab={activeTab}
        isStateRestored={isStateRestored}
      onSwitchVoice={onSwitchVoice}
      lastVoiceSample={lastVoiceSample}
      isSwitchingVoice={isSwitchingVoice}
      />
    </OutputPanelShell>
  );
}