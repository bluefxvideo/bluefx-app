'use client';

import { useVoiceOver } from './hooks/use-voice-over';
import { useCredits } from '@/hooks/useCredits';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
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

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return null; // No left panel content for history
      case 'clone':
        return (
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
        );
      default:
        return (
          <GeneratorTab
            voiceOverState={voiceOverState}
            credits={userCredits?.available_credits || 0}
            clonedVoices={voiceOverState.state.clonedVoices}
          />
        );
    }
  };

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
          {renderTabContent()}
        </div>
      ) : (
        <StandardToolLayout>
          {[
            // Left Panel - Tab Content
            <div key="input" className="h-full">
              {renderTabContent()}
            </div>,

            // Right Panel - Output
            <VoiceOverOutput
              key="output"
              voiceOverState={{
                ...voiceOverState,
                deleteVoice: voiceOverState.deleteVoice
              }}
            />
          ]}
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}