'use client';

import { ScriptToVideoOutput } from './script-to-video-output';
import { HistoryOutput } from './history-output';
import { EditorOutput } from './editor-output';
import type { ScriptToVideoResponse } from '@/actions/tools/script-to-video-orchestrator';

interface ContextualOutputProps {
  activeTab: string;
  result?: ScriptToVideoResponse;
  isGenerating: boolean;
  isEditing: boolean;
  error?: string;
  onClearResults: () => void;
}

/**
 * Contextual Output Switcher
 * Right panel adapts based on active tab (EXACT thumbnail machine pattern)
 */
export function ContextualOutput({
  activeTab,
  result,
  isGenerating,
  isEditing,
  error,
  onClearResults
}: ContextualOutputProps) {
  switch (activeTab) {
    case 'history':
      return <HistoryOutput />;
    
    case 'editor':
      return (
        <EditorOutput
          result={result}
          isEditing={isEditing}
          error={error}
        />
      );
    
    case 'generate':
    default:
      return (
        <ScriptToVideoOutput
          result={result}
          isGenerating={isGenerating}
          error={error}
          onClearResults={onClearResults}
          activeTab={activeTab}
        />
      );
  }
}