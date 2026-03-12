'use client';

import { usePathname } from 'next/navigation';
import { containerStyles } from '@/lib/container-styles';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { useReelEstate } from './hooks/use-reelestate';
import { Home, Video, ImageIcon, History } from 'lucide-react';

// Tab content
import { VideoMakerTab } from './tabs/video-maker-tab';
import { PhotoCleanupTab } from './tabs/photo-cleanup-tab';

// Output panels
import { VideoMakerOutput } from './output-panel/video-maker-output';
import { PhotoCleanupOutput } from './output-panel/photo-cleanup-output';
import { HistoryOutput } from './output-panel/history-output';

const REELESTATE_TABS = [
  {
    id: 'video-maker',
    label: 'Video Maker',
    icon: Video,
    path: '/dashboard/reelestate',
  },
  {
    id: 'photo-cleanup',
    label: 'Photo Cleanup',
    icon: ImageIcon,
    path: '/dashboard/reelestate/photo-cleanup',
  },
  {
    id: 'history',
    label: 'History',
    icon: History,
    path: '/dashboard/reelestate/history',
  },
];

export function ReelEstatePage() {
  const pathname = usePathname();

  const {
    // Project state
    project,
    // Credits
    credits,
    isLoadingCredits,
    // Video Maker actions
    startProject,
    analyzePhotos,
    generateScript,
    generateVoiceover,
    renderVideo,
    generateClips,
    regenerateClip,
    pollClips,
    // Photo selections
    setSelectedIndices,
    // Script editing
    updateScriptSegment,
    // Settings
    setAspectRatio,
    setTargetDuration,
    setVoiceId,
    // Photo Cleanup
    cleanupInlinePhoto,
    cleaningIndices,
    cleanupPhotos,
    cleanupResults,
    isCleaningUp,
    cleanupQueue,
    addToCleanupQueue,
    removeFromCleanupQueue,
    clearCleanupQueue,
    // History
    listings,
    isLoadingHistory,
    loadHistory,
    loadProject,
    // Status helpers
    isWorking,
  } = useReelEstate();

  const getActiveTab = () => {
    if (pathname.includes('/photo-cleanup')) return 'photo-cleanup';
    if (pathname.includes('/history')) return 'history';
    return 'video-maker';
  };

  const activeTab = getActiveTab();

  return (
    <StandardToolPage
      icon={Home}
      title="ReelEstate"
      description="Create listing videos and clean up property photos"
      iconGradient="bg-primary"
      toolName="ReelEstate"
      tabs={
        <StandardToolTabs
          tabs={REELESTATE_TABS}
          activeTab={activeTab}
          basePath="/dashboard/reelestate"
        />
      }
    >
      {activeTab === 'history' ? (
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <HistoryOutput
            listings={listings}
            isLoading={isLoadingHistory}
            onRefresh={loadHistory}
            onLoadProject={loadProject}
          />
        </div>
      ) : activeTab === 'photo-cleanup' ? (
        <StandardToolLayout>
          <div className="h-full overflow-hidden">
            <PhotoCleanupTab
              onCleanup={cleanupPhotos}
              isCleaning={isCleaningUp}
              credits={credits}
              isLoadingCredits={isLoadingCredits}
              queue={cleanupQueue}
              onAddToQueue={addToCleanupQueue}
              onRemoveFromQueue={removeFromCleanupQueue}
              onClearQueue={clearCleanupQueue}
            />
          </div>
          <PhotoCleanupOutput
            results={cleanupResults}
            isCleaning={isCleaningUp}
          />
        </StandardToolLayout>
      ) : (
        <StandardToolLayout>
          <div className="h-full overflow-hidden">
            <VideoMakerTab
              project={project}
              credits={credits}
              isLoadingCredits={isLoadingCredits}
              isWorking={isWorking}
              onStartProject={startProject}
              onAnalyzePhotos={analyzePhotos}
              onGenerateScript={generateScript}
              onGenerateVoiceover={generateVoiceover}
              onRenderVideo={renderVideo}
              onSetSelectedIndices={setSelectedIndices}
              onUpdateScriptSegment={updateScriptSegment}
              onSetAspectRatio={setAspectRatio}
              onSetTargetDuration={setTargetDuration}
              onSetVoiceId={setVoiceId}
              onCleanupPhoto={cleanupInlinePhoto}
              cleaningIndices={cleaningIndices}
            />
          </div>
          <VideoMakerOutput
            project={project}
            isWorking={isWorking}
            onPollClips={pollClips}
            onRegenerateClip={regenerateClip}
          />
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}
