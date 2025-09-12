'use client';

import { useVoiceOver } from './hooks/use-voice-over';
import { useCredits } from '@/hooks/useCredits';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { containerStyles } from '@/lib/container-styles';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { GeneratorTab } from './tabs/generator-tab';
import { HistoryTab } from './tabs/history-tab';
import { VoiceOverOutput } from './output-panel/voice-over-output';
import { HistoryOutput } from './output-panel/history-output';
import { Mic, History } from 'lucide-react';

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
      default:
        return <GeneratorTab voiceOverState={voiceOverState} credits={userCredits?.available_credits || 0} />;
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