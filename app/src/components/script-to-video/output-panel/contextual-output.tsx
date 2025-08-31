'use client';

import { ScriptToVideoOutput } from './script-to-video-output';
import { HistoryOutput } from './history-output';
import { EditorOutput } from './editor-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
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
    
    case 'editor':
      return (
        <OutputPanelShell
          title="Editor Results"
          status={isEditing ? 'loading' : error ? 'error' : result ? 'ready' : 'idle'}
          errorMessage={error}
          loading={
            <EditorOutput
              result={result}
              isEditing={isEditing}
              error={error}
            />
          }
          empty={
            <EditorOutput
              result={undefined}
              isEditing={false}
              error={undefined}
            />
          }
        >
          <EditorOutput
            result={result}
            isEditing={isEditing}
            error={error}
          />
        </OutputPanelShell>
      );
    
    case 'generate':
    default:
      return (
        <OutputPanelShell
          title="Video Results"
          status={isGenerating ? 'loading' : error ? 'error' : result ? 'ready' : 'idle'}
          errorMessage={error}
          loading={
            <ScriptToVideoOutput
              result={result}
              isGenerating={isGenerating}
              error={error}
              onClearResults={onClearResults}
              activeTab={activeTab}
            />
          }
          empty={
            <ScriptToVideoOutput
              result={undefined}
              isGenerating={false}
              error={undefined}
              onClearResults={onClearResults}
              activeTab={activeTab}
            />
          }
        >
          <ScriptToVideoOutput
            result={result}
            isGenerating={isGenerating}
            error={error}
            onClearResults={onClearResults}
            activeTab={activeTab}
          />
        </OutputPanelShell>
      );
  }
}