'use client';

import { useState } from 'react';
import { useMusicMachine } from './hooks/use-music-machine';
import { useCredits } from '@/hooks/useCredits';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { containerStyles } from '@/lib/container-styles';
import { GeneratorTab } from './tabs/generator-tab';
import { MusicHistoryFilters, type MusicHistoryFilters as HistoryFiltersType } from './tabs/music-history-filters';
import { MusicMachineOutput } from './output-panel/music-machine-output';
import { MusicHistoryOutput } from './output-panel/music-history-output';
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
        return null; // No left panel content for history
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
      {activeTab === 'history' ? (
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <MusicHistoryOutput
            musicHistory={musicMachineState.state.musicHistory}
            filters={historyFilters}
            isLoading={musicMachineState.state.isLoading}
            error={musicMachineState.state.error}
            playingMusicId={musicMachineState.playingMusicId}
            onPlayMusic={musicMachineState.handleMusicPlayback}
            onDeleteMusic={musicMachineState.deleteMusic}
          />
        </div>
      ) : (
        <StandardToolLayout>
          {[
            <div key="input" className="h-full">
              {renderTabContent()}
            </div>,
            <MusicMachineOutput
              key="output"
              musicMachineState={musicMachineState}
              historyFilters={historyFilters}
            />
          ]}
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}