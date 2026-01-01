'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { containerStyles } from '@/lib/container-styles';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContextualOutput } from './output-panel/contextual-output';
import { HistoryOutput } from './output-panel/history-output';
import { StartingShotOutput } from './output-panel/starting-shot-output';
import { useAICinematographer } from './hooks/use-ai-cinematographer';
import { Video, History, Image, LayoutGrid } from 'lucide-react';

// Tab content components
import { GeneratorTab } from './tabs/generator-tab';
import { StartingShotTab } from './tabs/starting-shot-tab';
import { StoryboardTab } from './tabs/storyboard-tab';
import { StoryboardOutput } from './output-panel/storyboard-output';

/**
 * AI Cinematographer - Complete AI-Orchestrated Tool with Tabs
 * Uses uniform tool layout consistent with all BlueFX tools
 */
export function AICinematographerPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
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
    isLoadingCredits,
    isStateRestored,
    deleteVideo,
    // Starting Shot
    generateStartingShot,
    isGeneratingImage,
    startingShotResult,
    pendingImageForVideo,
    setImageForVideo,
    // Storyboard
    generateStoryboard,
    isGeneratingStoryboard,
    storyboardResult,
    extractedFrames,
    isExtractingFrames,
    extractingProgress,
    extractFrames,
    regenerateFrame,
    uploadGridImage,
  } = useAICinematographer();

  // Check for image URL in search params (from Starting Shot "Make Video" button)
  useEffect(() => {
    const imageUrl = searchParams.get('image');
    if (imageUrl) {
      setImageForVideo(decodeURIComponent(imageUrl));
      // Clean up the URL by removing the search param
      router.replace('/dashboard/ai-cinematographer');
    }
  }, [searchParams, setImageForVideo, router]);

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/history')) return 'history';
    if (pathname.includes('/starting-shot')) return 'starting-shot';
    if (pathname.includes('/storyboard')) return 'storyboard';
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
      id: 'storyboard',
      label: 'Storyboard',
      icon: LayoutGrid,
      path: '/dashboard/ai-cinematographer/storyboard'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/dashboard/ai-cinematographer/history'
    }
  ];

  // Handle "Make Video From This Image" - navigate to generator with image URL in params
  const handleMakeVideoFromImage = (imageUrl: string) => {
    // Pass image URL via search params so it persists across route change
    router.push(`/dashboard/ai-cinematographer?image=${encodeURIComponent(imageUrl)}`);
  };

  // Render generator tab content (other tabs handled separately)
  const renderGeneratorTab = () => (
    <GeneratorTab
      onGenerate={generateVideo}
      isGenerating={isGenerating}
      credits={credits}
      isLoadingCredits={isLoadingCredits}
      pendingImageUrl={pendingImageForVideo}
      onClearPendingImage={() => setImageForVideo('')}
    />
  );

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
            onMakeVideoFromImage={handleMakeVideoFromImage}
          />
        </div>
      ) : activeTab === 'starting-shot' ? (
        // Starting Shot tab - Two-panel layout like Generate tab
        <StandardToolLayout>
          {/* Left Panel - Settings */}
          <div className="h-full overflow-hidden">
            <StartingShotTab
              onGenerate={generateStartingShot}
              isGenerating={isGeneratingImage}
              credits={credits}
              isLoadingCredits={isLoadingCredits}
            />
          </div>

          {/* Right Panel - Generated Image Output */}
          <StartingShotOutput
            isGenerating={isGeneratingImage}
            generatedImage={startingShotResult?.image}
            onMakeVideo={handleMakeVideoFromImage}
          />
        </StandardToolLayout>
      ) : activeTab === 'storyboard' ? (
        // Storyboard tab - Two-panel layout
        <StandardToolLayout>
          {/* Left Panel - Settings */}
          <div className="h-full overflow-hidden">
            <StoryboardTab
              onGenerate={generateStoryboard}
              isGenerating={isGeneratingStoryboard}
              credits={credits}
              isLoadingCredits={isLoadingCredits}
            />
          </div>

          {/* Right Panel - Storyboard Output */}
          <StoryboardOutput
            isGenerating={isGeneratingStoryboard}
            storyboardResult={storyboardResult?.storyboard}
            extractedFrames={extractedFrames}
            isExtractingFrames={isExtractingFrames}
            extractingProgress={extractingProgress}
            onExtractFrames={extractFrames}
            onRegenerateGrid={() => {
              // Re-trigger generation with last prompt
              if (storyboardResult?.storyboard) {
                generateStoryboard({
                  story_description: storyboardResult.storyboard.prompt,
                  visual_style: storyboardResult.storyboard.visual_style,
                  user_id: '',
                });
              }
            }}
            onRegenerateFrame={regenerateFrame}
            onMakeVideo={handleMakeVideoFromImage}
            onDownload={async (url, filename) => {
              // Download image by fetching as blob (works with cross-origin URLs)
              try {
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
              } catch (error) {
                console.error('Download failed:', error);
                // Fallback: open in new tab
                window.open(url, '_blank');
              }
            }}
            onUploadGrid={uploadGridImage}
          />
        </StandardToolLayout>
      ) : (
        // Generate tab - Use standard two-panel layout
        <StandardToolLayout>
          {/* Left Panel - Content Only */}
          <div className="h-full overflow-hidden">
            {renderGeneratorTab()}
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
