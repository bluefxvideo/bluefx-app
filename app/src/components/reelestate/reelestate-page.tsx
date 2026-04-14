'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { containerStyles } from '@/lib/container-styles';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { useReelEstate } from './hooks/use-reelestate';
import { useAgentClone } from './hooks/use-agent-clone';
import { Home, Video, ImageIcon, History, UserCircle } from 'lucide-react';

// Tab content
import { VideoMakerTab } from './tabs/video-maker-tab';
import { PhotoCleanupTab } from './tabs/photo-cleanup-tab';
import { AgentCloneTab } from './tabs/agent-clone-tab';

// Output panels
import { VideoMakerOutput } from './output-panel/video-maker-output';
import { PhotoCleanupOutput } from './output-panel/photo-cleanup-output';
import { HistoryOutput } from './output-panel/history-output';
import { AgentCloneOutput } from './output-panel/agent-clone-output';

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
    id: 'agent-clone',
    label: 'Agent Clone',
    icon: UserCircle,
    path: '/dashboard/reelestate/agent-clone',
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
    regenerateScript,
    regenerateVoiceover,
    openInEditor,
    generateClips,
    regenerateClip,
    pollClips,
    // Photo selections
    setSelectedIndices,
    // Script editing
    updateScriptSegment,
    deleteScriptSegment,
    moveScriptSegment,
    // Settings
    setAspectRatio,
    setTargetDuration,
    setVoiceId,
    setVoiceSpeed,
    setVoiceoverEnabled,
    // Music & style (simplified flow)
    setMusicTrack,
    setMusicVolume,
    setIntroText,
    setSpeedRamps,
    renderVideo,
    // User
    userId,
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

  const agentClone = useAgentClone();

  // Tab override: when loadProject is called from History, switch tab via state
  // (router.push soft navigation doesn't work reliably with this layout structure)
  const [tabOverride, setTabOverride] = useState<string | null>(null);

  const getActiveTab = () => {
    if (tabOverride) return tabOverride;
    if (pathname.includes('/agent-clone')) return 'agent-clone';
    if (pathname.includes('/photo-cleanup')) return 'photo-cleanup';
    if (pathname.includes('/history')) return 'history';
    return 'video-maker';
  };

  const activeTab = getActiveTab();

  // Wrap loadProject to also switch tab
  const handleLoadProject = useCallback((...args: Parameters<typeof loadProject>) => {
    loadProject(...args);
    setTabOverride('video-maker');
  }, [loadProject]);

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
          onTabChange={() => setTabOverride(null)}
        />
      }
    >
      {activeTab === 'history' ? (
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <HistoryOutput
            listings={listings}
            agentCloneGenerations={agentClone.history}
            isLoading={isLoadingHistory || agentClone.isLoadingHistory}
            onRefresh={() => { loadHistory(); agentClone.loadHistory(); }}
            onLoadProject={handleLoadProject}
            onDeleteGeneration={agentClone.deleteHistoryItem}
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
      ) : activeTab === 'agent-clone' ? (
        <StandardToolLayout>
          <div className="h-full overflow-hidden">
            <AgentCloneTab
              agentPhotoUrl={agentClone.agentPhotoUrl}
              onSetAgentPhoto={agentClone.setAgentPhotoUrl}
              aspectRatio={agentClone.aspectRatio}
              onSetAspectRatio={agentClone.setAspectRatio}
              shots={agentClone.shots}
              credits={agentClone.credits}
              isWorking={agentClone.isWorking}
              onUpdateShot={agentClone.updateShot}
              onRemoveShot={agentClone.removeShot}
              onCreateAndGenerate={agentClone.createAndGenerate}
              onRegenerateComposite={agentClone.regenerateComposite}
              onAnimateShot={agentClone.animateShot}
            />
          </div>
          <AgentCloneOutput
            shot={agentClone.shots.length > 0 ? agentClone.shots[agentClone.shots.length - 1] : null}
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
              onSetSelectedIndices={setSelectedIndices}
              onCleanupPhoto={cleanupInlinePhoto}
              cleaningIndices={cleaningIndices}
              onSetAspectRatio={setAspectRatio}
              onSetTargetDuration={setTargetDuration}
              onSetIntroText={setIntroText}
              onSetVoiceoverEnabled={setVoiceoverEnabled}
              onSetVoiceId={setVoiceId}
              onSetMusicTrack={setMusicTrack}
              onSetMusicVolume={setMusicVolume}
              onOpenInEditor={openInEditor}
            />
          </div>
          <VideoMakerOutput
            project={project}
            isWorking={isWorking}
            onPollClips={pollClips}
            onRegenerateClip={regenerateClip}
            onRegenerateScript={regenerateScript}
            onRegenerateVoiceover={regenerateVoiceover}
            onUpdateScriptSegment={updateScriptSegment}
          />
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}
