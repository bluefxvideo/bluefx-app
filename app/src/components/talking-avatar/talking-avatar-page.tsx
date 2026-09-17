'use client';

import { useEffect, useRef } from 'react';
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
  const { credits: userCredits, isLoading: creditsLoading } = useCredits();

  // In the one column layout the result sits under the whole wizard. When a render
  // starts, finishes or fails, bring it into view; on wide screens it already is.
  const outputRef = useRef<HTMLDivElement>(null);
  const s = avatarState.state;
  const isHistory = avatarState.activeTab === 'history';
  // Only a video's own outcome counts as an error here: a failed photo upload or
  // voice must not scroll the user away from the box they are working in
  const revealKey = s.isGenerating
    ? 'generating'
    : s.generatedVideo?.video_url
      ? 'done'
      : s.error && s.currentStep === 3 && s.generatedVideo ? 'error' : '';
  useEffect(() => {
    if (isHistory || !revealKey || !window.matchMedia('(max-width: 767px)').matches) return;
    const t = setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    return () => clearTimeout(t);
  }, [revealKey, isHistory]);

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
      title="AI Avatar"
      description="Create AI-powered talking avatar videos"
      iconGradient="bg-primary"
      toolName="Talking Avatar"
      tabs={tabsComponent}
    >
      {isHistory && (
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <HistoryOutput
            videos={avatarState.state.videos}
            isLoading={avatarState.state.isLoadingHistory}
            loadFailed={avatarState.state.historyLoadFailed}
            onRefresh={avatarState.loadHistory}
            onDeleteVideo={avatarState.deleteVideo}
            onCheckStatus={avatarState.checkHistoryItemStatus}
          />
        </div>
      )}
      {/* The wizard stays mounted behind History: the voice pick, the voice sliders, the
          avatar filters and a paid AI avatar photo live in its own state and would be
          lost on an unmount. */}
      <div className={isHistory ? 'hidden' : 'h-full'}>
        <StandardToolLayout>
          {[
            // Left Panel - Tab Content
            <div key="input" className="h-full">
              <GeneratorTab
                avatarState={avatarState}
                credits={userCredits?.available_credits || 0}
                creditsLoading={creditsLoading}
                isActive={!isHistory}
              />
            </div>,

            // Right Panel - Output
            <div key="output" ref={outputRef} className="h-full">
              <ContextualOutput
                activeTab="generate"
                avatarState={avatarState}
              />
            </div>
          ]}
        </StandardToolLayout>
      </div>
    </StandardToolPage>
  );
}