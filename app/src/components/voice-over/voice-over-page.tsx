'use client';

import { useVoiceOver } from './hooks/use-voice-over';
import { useCredits } from '@/hooks/useCredits';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { containerStyles } from '@/lib/container-styles';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { GeneratorTab } from './tabs/generator-tab';
import { CloneTab } from './tabs/clone-tab';
import { VoiceOverOutput } from './output-panel/voice-over-output';
import { HistoryOutput } from './output-panel/history-output';
import { Mic, History, Mic2 } from 'lucide-react';

export function VoiceOverPage() {
  const voiceOverState = useVoiceOver();
  const { credits: userCredits, isLoading: _creditsLoading } = useCredits();
  const { activeTab } = voiceOverState;

  const hasResults = voiceOverState.state.generatedAudios.length > 0;
  const isGenerating = voiceOverState.state.isGenerating;
  const showOutput = hasResults || isGenerating || voiceOverState.state.error;

  // Define tabs for StandardToolTabs
  const voiceOverTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Mic,
      path: '/dashboard/voice-over'
    },
    {
      id: 'clone',
      label: 'Clone Voice',
      icon: Mic2,
      path: '/dashboard/voice-over/clone'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/voice-over/history'
    }
  ];

  // Tab Navigation Component
  const tabsComponent = (
    <StandardToolTabs
      tabs={voiceOverTabs}
      activeTab={activeTab}
      basePath="/dashboard/voice-over"
    />
  );

  return (
    <StandardToolPage
      icon={Mic}
      title="Voice Over Studio"
      description="Create professional voice overs powered by AI"
      iconGradient="bg-primary"
      toolName="Voice Over Studio"
      tabs={tabsComponent}
    >
      {activeTab === 'history' ? (
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <HistoryOutput
            voiceOverState={{
              ...voiceOverState,
              deleteVoice: voiceOverState.deleteVoice
            }}
          />
        </div>
      ) : activeTab === 'clone' ? (
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <CloneTab
            clonedVoices={voiceOverState.state.clonedVoices}
            onCloneVoice={voiceOverState.cloneVoice}
            onDeleteVoice={voiceOverState.deleteClonedVoice}
            onSelectVoice={voiceOverState.selectClonedVoice}
            onPlayPreview={voiceOverState.handleVoicePlayback}
            playingVoiceId={voiceOverState.state.playingVoiceId}
            credits={userCredits?.available_credits || 0}
            isCloning={voiceOverState.state.isCloning}
          />
        </div>
      ) : (
        <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Full-width generator form */}
            <GeneratorTab
              voiceOverState={voiceOverState}
              credits={userCredits?.available_credits || 0}
              clonedVoices={voiceOverState.state.clonedVoices}
            />

            {/* Output appears below the form when there are results */}
            {showOutput && (
              <VoiceOverOutput
                voiceOverState={{
                  ...voiceOverState,
                  deleteVoice: voiceOverState.deleteVoice
                }}
              />
            )}
          </div>
        </div>
      )}
    </StandardToolPage>
  );
}