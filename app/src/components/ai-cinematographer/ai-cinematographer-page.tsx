'use client';

import { usePathname, useRouter } from 'next/navigation';
import { containerStyles } from '@/lib/container-styles';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContextualOutput } from './output-panel/contextual-output';
import { HistoryOutput } from './output-panel/history-output';
import { useAICinematographer } from './hooks/use-ai-cinematographer';
import { Video, History, Image } from 'lucide-react';

// Tab content components
import { GeneratorTab } from './tabs/generator-tab';
import { StartingShotTab } from './tabs/starting-shot-tab';

/**
 * AI Cinematographer - Complete AI-Orchestrated Tool with Tabs
 * Uses uniform tool layout consistent with all BlueFX tools
 */
export function AICinematographerPage() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    generateVideo,
    isGenerating,
    result,
    error,
    videos,
    isLoadingHistory,
    clearResults,
    loadHistory,
    credits,
    isStateRestored,
    deleteVideo,
    // Starting Shot
    generateStartingShot,
    isGeneratingImage,
    startingShotResult,
    pendingImageForVideo,
    setImageForVideo,
  } = useAICinematographer();

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/history')) return 'history';
    if (pathname.includes('/starting-shot')) return 'starting-shot';
    return 'generate'; // default
  };

  const activeTab = getActiveTab();

  // Define tabs for StandardToolTabs
  const cinematographerTabs = [
    {
      id: 'generate',
      label: 'Generate',
      icon: Video,
      path: '/dashboard/ai-cinematographer'
    },
    {
      id: 'starting-shot',
      label: 'Starting Shot',
      icon: Image,
      path: '/dashboard/ai-cinematographer/starting-shot'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/ai-cinematographer/history'
    }
  ];

  // Handle "Make Video From This Image" - navigate to generator with image
  const handleMakeVideoFromImage = (imageUrl: string) => {
    setImageForVideo(imageUrl);
    router.push('/dashboard/ai-cinematographer');
  };

  // Render appropriate tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'history':
        return null; // No left panel content for history
      case 'starting-shot':
        return (
          <StartingShotTab
            onGenerate={generateStartingShot}
            isGenerating={isGeneratingImage}
            credits={credits}
            generatedImage={startingShotResult?.image}
            onMakeVideo={handleMakeVideoFromImage}
          />
        );
      default:
        return (
          <GeneratorTab
            onGenerate={generateVideo}
            isGenerating={isGenerating}
            credits={credits}
            pendingImageUrl={pendingImageForVideo}
            onClearPendingImage={() => setImageForVideo('')}
          />
        );
    }
  };

  return (
    <StandardToolPage
      icon={Video}
      title="AI Cinematographer"
      description="Create cinematic AI videos from text prompts"
      iconGradient="bg-primary"
      toolName="AI Cinematographer"
      tabs={<StandardToolTabs tabs={cinematographerTabs} activeTab={activeTab} basePath="/dashboard/ai-cinematographer" />}
    >
      {activeTab === 'history' ? (
        // History tab - Full width single panel
        <div className={`h-full ${containerStyles.panel} p-4`}>
          <HistoryOutput
            videos={videos}
            isLoading={isLoadingHistory}
            onRefresh={loadHistory}
            onDeleteVideo={deleteVideo}
          />
        </div>
      ) : (
        // Other tabs - Use standard two-panel layout
        <StandardToolLayout>
          {/* Left Panel - Content Only */}
          <div className="h-full overflow-hidden">
            {renderTabContent()}
          </div>

          {/* Right Panel - Contextual Output */}
          <ContextualOutput
            activeTab={activeTab}
            result={result}
            isGenerating={isGenerating}
            error={error}
            onClearResults={clearResults}
            videos={videos}
            isLoadingHistory={isLoadingHistory}
            onRefresh={loadHistory}
            isStateRestored={isStateRestored}
            onDeleteVideo={deleteVideo}
          />
        </StandardToolLayout>
      )}
    </StandardToolPage>
  );
}

export default AICinematographerPage;
