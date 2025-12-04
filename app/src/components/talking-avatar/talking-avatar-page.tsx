'use client';

import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { containerStyles } from '@/lib/container-styles';
import { GeneratorTab } from './tabs/generator-tab';
import { HistoryTab } from './tabs/history-tab';
import { ContextualOutput } from './output-panel/contextual-output';
import { HistoryOutput } from './output-panel/history-output';
import { useTalkingAvatar } from './hooks/use-talking-avatar';
import { useCredits } from '@/hooks/useCredits';
import { Video, History } from 'lucide-react';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';

export function TalkingAvatarPage() {
  const avatarState = useTalkingAvatar();
  const { credits: userCredits, isLoading: _creditsLoading } = useCredits();

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (avatarState.activeTab) {
      case 'history':
        return null; // No left panel content for history
      default:
        return <GeneratorTab avatarState={avatarState} credits={userCredits?.available_credits || 0} />;
    }
  };

  // Define tabs for StandardToolTabs
  const avatarTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Video,
      path: '/dashboard/talking-avatar'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/talking-avatar/history'
    }
  ];

  // Tab Navigation Component
  const tabsComponent = (
    <StandardToolTabs 
      tabs={avatarTabs}
      activeTab={avatarState.activeTab} 
      basePath="/dashboard/talking-avatar"
    />
  );

  return (
    <StandardToolPage
      icon={Video}
      title="Talking Avatar"
      description="Create AI-powered talking avatar videos"
      iconGradient="bg-primary"
      toolName="Talking Avatar"
      tabs={tabsComponent}
    >
      {avatarState.activeTab === 'history' ? (
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <HistoryOutput
            videos={avatarState.state.videos}
            isLoading={avatarState.state.isLoadingHistory}
            onRefresh={avatarState.loadHistory}
            onDeleteVideo={avatarState.deleteVideo}
            onCheckStatus={avatarState.checkHistoryItemStatus}
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
            <ContextualOutput
              key="output"
              activeTab={avatarState.activeTab}
              avatarState={avatarState}
            />
          ]}
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}