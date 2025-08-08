'use client';

import { useVoiceOver } from './hooks/use-voice-over';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { GeneratorTab } from './tabs/generator-tab';
import { HistoryTab } from './tabs/history-tab';
import { SettingsTab } from './tabs/settings-tab';
import { VoiceOverOutput } from './output-panel/voice-over-output';
import { Mic, History, Settings } from 'lucide-react';

export function VoiceOverPage() {
  const voiceOverState = useVoiceOver();
  const { activeTab, setActiveTab } = voiceOverState;

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
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/dashboard/voice-over/settings'
    }
  ];

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return <HistoryTab voiceOverState={voiceOverState} />;
      case 'settings':
        return <SettingsTab voiceOverState={voiceOverState} />;
      default:
        return <GeneratorTab voiceOverState={voiceOverState} />;
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
      description="Generate professional AI voice overs"
      iconGradient="bg-primary"
      tabs={tabsComponent}
    >
      <StandardToolLayout>
        {[
          // Left Panel - Tab Content
          <div key="input" className="h-full">
            {renderTabContent()}
          </div>,
          
          // Right Panel - Output
          <VoiceOverOutput
            key="output"
            voiceOverState={voiceOverState}
          />
        ]}
      </StandardToolLayout>
    </StandardToolPage>
  );
}