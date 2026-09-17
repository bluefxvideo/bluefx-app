'use client';

import { TalkingAvatarOutput } from './talking-avatar-output';
import { HistoryOutput } from './history-output';
import { OutputPanelShell } from '@/components/tools/output-panel-shell';
import { UseTalkingAvatarReturn } from '../hooks/use-talking-avatar';

interface ContextualOutputProps {
  activeTab: string;
  avatarState: UseTalkingAvatarReturn;
}

export function ContextualOutput({ activeTab, avatarState }: ContextualOutputProps) {
  // History tab
  if (activeTab === 'history') {
    return (
      <OutputPanelShell
        title="Avatar History"
        status={avatarState.state.isLoadingHistory ? 'loading' : avatarState.state.error ? 'error' : avatarState.state.videos.length > 0 ? 'ready' : 'idle'}
        errorMessage={avatarState.state.error || undefined}
        empty={<HistoryOutput videos={[]} isLoading={false} onRefresh={avatarState.loadHistory} onDeleteVideo={avatarState.deleteVideo} onCheckStatus={avatarState.checkHistoryItemStatus} />}
      >
        <HistoryOutput
          videos={avatarState.state.videos}
          isLoading={avatarState.state.isLoadingHistory}
          onRefresh={avatarState.loadHistory}
          onDeleteVideo={avatarState.deleteVideo}
          onCheckStatus={avatarState.checkHistoryItemStatus}
        />
      </OutputPanelShell>
    );
  }

  // Default: generate tab. TalkingAvatarOutput decides what to show for every state.
  const output = (
    <TalkingAvatarOutput avatarState={{
      state: avatarState.state,
      clearResults: avatarState.clearResults,
      resetWizard: avatarState.resetWizard,
      goToStep: avatarState.goToStep,
      checkStatusManually: avatarState.checkStatusManually
    }} />
  );

  return (
    <OutputPanelShell
      title="Avatar Results"
      status={avatarState.state.isGenerating ? 'loading' : avatarState.state.error ? 'error' : (avatarState.state.generatedVideo || avatarState.state.isStateRestored ? 'ready' : 'idle')}
      errorMessage={avatarState.state.error || undefined}
      onBeforeReload={() => {
        const script = avatarState.state.scriptText?.trim();
        if (script) localStorage.setItem('prefill_script', script);
      }}
      loading={output}
      empty={output}
    >
      {output}
    </OutputPanelShell>
  );
}
