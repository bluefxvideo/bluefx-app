'use client';

import { CinematographerResponse } from '@/actions/tools/ai-cinematographer';
import { CinematographerOutput } from './cinematographer-output';

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
  return (
    <CinematographerOutput
      result={result}
      isGenerating={isGenerating}
      error={error}
      onClearResults={onClearResults}
      activeTab={activeTab}
    />
  );
}