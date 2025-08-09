'use client';

import { useMusicMachine } from './hooks/use-music-machine';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { GeneratorTab } from './tabs/generator-tab';
import { HistoryTab } from './tabs/history-tab';
import { MusicMachineOutput } from './output-panel/music-machine-output';
import { Music, History } from 'lucide-react';

/**
 * Music Machine Page - Main component following BlueFX style guide
 * Matches ThumbnailMachinePage structure exactly
 */
export function MusicMachinePage() {
  const musicMachineState = useMusicMachine();
  const { activeTab, setActiveTab: _setActiveTab } = musicMachineState;

  // Define tabs for StandardToolTabs
  const musicTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Music,
      path: '/dashboard/music-machine'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/music-machine/history'
    }
  ];

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return <HistoryTab musicMachineState={musicMachineState} />;
      default:
        return <GeneratorTab musicMachineState={musicMachineState} />;
    }
  };

  // Tab Navigation Component
  const tabsComponent = (
    <StandardToolTabs 
      tabs={musicTabs}
      activeTab={activeTab} 
      basePath="/dashboard/music-machine"
    />
  );

  return (
    <StandardToolPage
      icon={Music}
      title="Music Maker"
      description="Generate AI-powered music tracks and compositions"
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
          <MusicMachineOutput
            key="output"
            musicMachineState={musicMachineState}
          />
        ]}
      </StandardToolLayout>
    </StandardToolPage>
  );
}