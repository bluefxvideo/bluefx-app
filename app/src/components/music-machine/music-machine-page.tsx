'use client';

import { useState } from 'react';
import { useMusicMachine } from './hooks/use-music-machine';
import { useCredits } from '@/hooks/useCredits';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { GeneratorTab } from './tabs/generator-tab';
import { MusicHistoryFilters, type MusicHistoryFilters as HistoryFiltersType } from './tabs/music-history-filters';
import { MusicMachineOutput } from './output-panel/music-machine-output';
import { Music, History } from 'lucide-react';

/**
 * Music Machine Page - Main component following BlueFX style guide
 * Matches ThumbnailMachinePage structure exactly
 */
export function MusicMachinePage() {
  const musicMachineState = useMusicMachine();
  const { credits: userCredits, isLoading: _creditsLoading } = useCredits();
  const { activeTab, setActiveTab: _setActiveTab } = musicMachineState;
  const [historyFilters, setHistoryFilters] = useState<HistoryFiltersType | undefined>();

  // Define tabs for StandardToolTabs
  const musicTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Music,
      path: '/dashboard/music-maker'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/music-maker/history'
    }
  ];

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return <MusicHistoryFilters onFiltersChange={setHistoryFilters} />;
      default:
        return <GeneratorTab musicMachineState={musicMachineState} credits={userCredits?.available_credits || 0} />;
    }
  };

  // Tab Navigation Component
  const tabsComponent = (
    <StandardToolTabs 
      tabs={musicTabs}
      activeTab={activeTab} 
      basePath="/dashboard/music-maker"
    />
  );

  return (
    <StandardToolPage
      icon={Music}
      title="Music Maker"
      iconGradient="bg-primary"
      toolName="Music Maker"
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
            historyFilters={historyFilters}
          />
        ]}
      </StandardToolLayout>
    </StandardToolPage>
  );
}