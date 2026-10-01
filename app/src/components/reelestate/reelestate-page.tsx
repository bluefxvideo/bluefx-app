'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { containerStyles } from '@/lib/container-styles';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { useReelEstate } from './hooks/use-reelestate';
import { useAgentClone } from './hooks/use-agent-clone';
import { Home, Video, ImageIcon, History, UserCircle, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSmartVideo } from '@/components/smart-video/hooks/use-smart-video';
import { urlToFile } from '@/lib/url-to-file';

// Tab content
import { AutomaticTab } from './tabs/automatic-tab';
import { VideoMakerTab } from './tabs/video-maker-tab';
import { PhotoCleanupTab } from './tabs/photo-cleanup-tab';
import { AgentCloneTab } from './tabs/agent-clone-tab';

// Output panels
import { VideoMakerOutput } from './output-panel/video-maker-output';
import { PhotoCleanupOutput } from './output-panel/photo-cleanup-output';
import { HistoryOutput } from './output-panel/history-output';
import { AgentCloneOutput } from './output-panel/agent-clone-output';
import { AutomaticOutput } from './output-panel/automatic-output';
import type { AgentCloneExample, AutomaticVideoExample, ListingVideoExample, PhotoCleanupExample } from './examples';

const REELESTATE_TABS = [
  {
    id: 'automatic',
    label: 'Automatic',
    icon: Wand2,
    path: '/dashboard/reelestate',
  },
  {
    id: 'video-maker',
    label: 'Step by Step',
    icon: Video,
    path: '/dashboard/reelestate/video-maker',
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
    createProject,
    renameProject,
    startProject,
    startExampleProject,
    addPhotos,
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
  // The automatic listing video runs on the Phantom's job system
  const automatic = useSmartVideo('listing');

  // Tab override: when loadProject is called from History, switch tab via state
  // (router.push soft navigation doesn't work reliably with this layout structure)
  const [tabOverride, setTabOverride] = useState<string | null>(null);

  const getActiveTab = () => {
    if (tabOverride) return tabOverride;
    if (pathname.includes('/agent-clone')) return 'agent-clone';
    if (pathname.includes('/photo-cleanup')) return 'photo-cleanup';
    if (pathname.includes('/history')) return 'history';
    if (pathname.includes('/video-maker')) return 'video-maker';
    return 'automatic';
  };

  const activeTab = getActiveTab();

  // "Try this example": the examples sit in the result panel, the form in the tab
  const [loadingExampleId, setLoadingExampleId] = useState<string | null>(null);
  const handleTryListingExample = useCallback(async (example: ListingVideoExample) => {
    setLoadingExampleId(example.id);
    await startExampleProject({
      name: example.projectName,
      photos: example.photos.map(photo => photo.url),
      aspectRatio: example.aspectRatio,
      targetDuration: example.targetDuration,
      introText: example.introText,
      voiceId: example.voice.id,
      musicTrackId: example.music.id,
      musicUrl: example.music.url,
    });
    setLoadingExampleId(null);
  }, [startExampleProject]);

  // "Try this example" of the automatic video: the photos, the facts and the settings go into the form
  const [loadingAutomaticId, setLoadingAutomaticId] = useState<string | null>(null);
  const handleTryAutomaticExample = useCallback(async (example: AutomaticVideoExample) => {
    setLoadingAutomaticId(example.id);
    automatic.setLink('');
    automatic.setBrief(example.facts);
    automatic.setListingSeconds(example.seconds);
    automatic.setFormat(example.format);
    automatic.setVoiceOver(true);
    automatic.setMusic(true);
    try {
      const files = await Promise.all(example.photos.map((photo) => urlToFile(photo.url, photo.name, 'image/jpeg')));
      automatic.replaceFiles(files);
      toast.success('Example loaded. Nothing is charged until you click Make the listing video.');
    } catch {
      toast.error('The example photos could not be loaded. The facts are filled in: add your own photos.');
    } finally {
      setLoadingAutomaticId(null);
    }
  }, [automatic]);

  const [cleanupExample, setCleanupExample] = useState<PhotoCleanupExample | null>(null);
  const clearCleanupExample = useCallback(() => setCleanupExample(null), []);

  const [agentCloneExample, setAgentCloneExample] = useState<AgentCloneExample | null>(null);
  const clearAgentCloneExample = useCallback(() => setAgentCloneExample(null), []);

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
              example={cleanupExample}
              onExampleDone={clearCleanupExample}
            />
          </div>
          <PhotoCleanupOutput
            results={cleanupResults}
            isCleaning={isCleaningUp}
            onTryExample={setCleanupExample}
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
              onSwitchVoice={agentClone.switchVoice}
              lastVoiceSample={agentClone.lastVoiceSample}
              example={agentCloneExample}
              onExampleDone={clearAgentCloneExample}
            />
          </div>
          <AgentCloneOutput
            shot={agentClone.shots.length > 0 ? agentClone.shots[agentClone.shots.length - 1] : null}
            onTryExample={setAgentCloneExample}
          />
        </StandardToolLayout>
      ) : activeTab === 'automatic' ? (
        <StandardToolLayout>
          <div className="h-full overflow-hidden">
            <AutomaticTab video={automatic} />
          </div>
          <AutomaticOutput video={automatic} onTryExample={handleTryAutomaticExample} loadingExampleId={loadingAutomaticId} />
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
              onAddPhotos={addPhotos}
              onAnalyzePhotos={analyzePhotos}
              onSetSelectedIndices={setSelectedIndices}
              onCleanupPhoto={cleanupInlinePhoto}
              cleaningIndices={cleaningIndices}
              onSetAspectRatio={setAspectRatio}
              onSetTargetDuration={setTargetDuration}
              onSetIntroText={setIntroText}
              onSetVoiceoverEnabled={setVoiceoverEnabled}
              onSetVoiceId={setVoiceId}
              onGenerateScript={generateScript}
              onGenerateVoiceover={generateVoiceover}
              onRegenerateScript={regenerateScript}
              onRegenerateVoiceover={regenerateVoiceover}
              onUpdateScriptSegment={updateScriptSegment}
              onSetMusicTrack={setMusicTrack}
              onSetMusicVolume={setMusicVolume}
              onOpenInEditor={openInEditor}
              onRenderVideo={renderVideo}
              onCreateProject={createProject}
              onRenameProject={renameProject}
              onGoToHistory={() => setTabOverride('history')}
            />
          </div>
          <VideoMakerOutput
            project={project}
            isWorking={isWorking}
            onPollClips={pollClips}
            onRegenerateClip={regenerateClip}
            onTryExample={handleTryListingExample}
            loadingExampleId={loadingExampleId}
          />
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}
