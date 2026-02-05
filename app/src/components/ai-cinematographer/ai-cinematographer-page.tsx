'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { containerStyles } from '@/lib/container-styles';
import { StandardToolLayout } from '@/components/tools/standard-tool-layout';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { StandardToolTabs } from '@/components/tools/standard-tool-tabs';
import { ContextualOutput } from './output-panel/contextual-output';
import { HistoryOutput } from './output-panel/history-output';
import { StartingShotOutput } from './output-panel/starting-shot-output';
import { useAICinematographer } from './hooks/use-ai-cinematographer';
import { Video, History, Image, LayoutGrid, FileText } from 'lucide-react';
import { useProject } from '@/lib/project-context';

// Tab content components
import { GeneratorTab } from './tabs/generator-tab';
import { StartingShotTab } from './tabs/starting-shot-tab';
import { StoryboardTab } from './tabs/storyboard-tab';
import { ScriptBreakdownTab } from './tabs/script-breakdown-tab';
import { ScriptBreakdownOutput } from './output-panel/script-breakdown-output';
import { StoryboardOutput } from './output-panel/storyboard-output';
import { StoryboardOutputV2 } from './output-panel/storyboard-output-v2';
import { BatchAnimationQueue } from './batch-animation-queue';
import { breakdownScript, type SavedBreakdown } from '@/actions/tools/scene-breakdown';
import type { SceneBreakdownResult, BreakdownScene } from '@/lib/scene-breakdown/types';

/**
 * AI Cinematographer - Complete AI-Orchestrated Tool with Tabs
 * Uses uniform tool layout consistent with all BlueFX tools
 */
export function AICinematographerPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Project context
  const { project, projectId, loadProject } = useProject();
  const projectIdFromUrl = searchParams.get('projectId');

  // Toggle between old 3x3 mode and new 4x4 mode with math extraction
  const [use4x4Grid, setUse4x4Grid] = useState(true); // Default to new 4x4 mode

  // Script Breakdown state
  const [isProcessingBreakdown, setIsProcessingBreakdown] = useState(false);
  const [breakdownResult, setBreakdownResult] = useState<SceneBreakdownResult | null>(null);
  const [breakdownScriptText, setBreakdownScriptText] = useState<string>('');

  // Load saved breakdown result from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('script-breakdown-result');
    const savedScriptText = localStorage.getItem('script-breakdown-script-text');
    if (saved) {
      try {
        setBreakdownResult(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved breakdown:', e);
      }
    }
    if (savedScriptText) {
      setBreakdownScriptText(savedScriptText);
    }
  }, []);

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
    // User
    user,
    // Cancel
    cancelGeneration,
    // Remember aspect ratio
    lastUsedAspectRatio,
    setLastUsedAspectRatio,
    // Analyzer shots for pre-filling prompts
    analyzerShots,
    setAnalyzerShots,
    // Animation Queue
    animationQueue,
    isProcessingQueue,
    queueProgress,
    addToAnimationQueue,
    removeFromQueue,
    updateQueueItem,
    clearAnimationQueue,
    processAnimationQueue,
    retryQueueItem,
  } = useAICinematographer();

  // Load project if projectId is in URL
  useEffect(() => {
    if (projectIdFromUrl && projectIdFromUrl !== projectId) {
      loadProject(projectIdFromUrl);
    }
  }, [projectIdFromUrl, projectId, loadProject]);

  // When project loads, use its shots for the analyzer shots state
  useEffect(() => {
    if (project?.analysis_data?.shots && project.analysis_data.shots.length > 0) {
      // Convert project shots to the format expected by analyzerShots
      const shots = project.analysis_data.shots.map(shot => ({
        shotNumber: shot.shotNumber,
        description: shot.description,
        duration: shot.duration,
        shotType: shot.shotType,
        action: shot.action,      // What movement/action happens
        dialogue: shot.dialogue,  // What is being said
      }));
      setAnalyzerShots(shots);
    }
  }, [project, setAnalyzerShots]);

  // Check for image URL in search params (from Starting Shot "Make Video" button)
  useEffect(() => {
    const imageUrl = searchParams.get('image');
    if (imageUrl) {
      setImageForVideo(decodeURIComponent(imageUrl));
      // Clean up the URL by removing the search param
      router.replace('/dashboard/ai-cinematographer');
    }
  }, [searchParams, setImageForVideo, router]);

  // Check for storyboard prompt in search params (from Video Analyzer "Send to Storyboard" button)
  // Supports both direct prompt param (short prompts) and promptId param (long prompts via sessionStorage)
  const [storyboardPromptFromUrl, setStoryboardPromptFromUrl] = useState<string | undefined>(undefined);
  const storyboardStyleFromUrl = searchParams.get('style');

  // Load prompt from URL param or localStorage (localStorage shares across tabs)
  useEffect(() => {
    const directPrompt = searchParams.get('prompt');
    const promptId = searchParams.get('promptId');

    if (directPrompt) {
      setStoryboardPromptFromUrl(decodeURIComponent(directPrompt));
    } else if (promptId) {
      // Retrieve prompt from localStorage (used for long prompts to avoid HTTP 431)
      const storedPrompt = localStorage.getItem(promptId);
      if (storedPrompt) {
        setStoryboardPromptFromUrl(storedPrompt);
        localStorage.removeItem(promptId);
      }
      // Also load analyzer shots if available (for pre-filling generator prompts)
      const storedShots = localStorage.getItem(`${promptId}-shots`);
      if (storedShots) {
        try {
          setAnalyzerShots(JSON.parse(storedShots));
          localStorage.removeItem(`${promptId}-shots`);
        } catch (e) {
          console.error('Failed to parse analyzer shots:', e);
        }
      }
    }
  }, [searchParams, setAnalyzerShots]);

  // When project loads, use its storyboard prompt if available
  useEffect(() => {
    if (project?.storyboard_prompt && !storyboardPromptFromUrl) {
      setStoryboardPromptFromUrl(project.storyboard_prompt);
    }
  }, [project, storyboardPromptFromUrl]);

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.includes('/history')) return 'history';
    if (pathname.includes('/starting-shot')) return 'starting-shot';
    if (pathname.includes('/script-breakdown')) return 'script-breakdown';
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
      id: 'script-breakdown',
      label: 'Script Breakdown',
      icon: FileText,
      path: '/dashboard/ai-cinematographer/script-breakdown'
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
      defaultAspectRatio={lastUsedAspectRatio}
      onAspectRatioChange={setLastUsedAspectRatio}
      analyzerShots={analyzerShots}
    />
  );

  // Handle script breakdown
  const handleScriptBreakdown = async (request: { scriptText: string; visualStyle?: string }) => {
    setIsProcessingBreakdown(true);
    setBreakdownScriptText(request.scriptText); // Save script text for saving breakdowns
    try {
      const response = await breakdownScript(request);
      if (response.success && response.result) {
        setBreakdownResult(response.result);
        // Persist to localStorage so it survives navigation
        localStorage.setItem('script-breakdown-result', JSON.stringify(response.result));
        localStorage.setItem('script-breakdown-script-text', request.scriptText);
      } else {
        console.error('Script breakdown failed:', response.error);
      }
    } catch (error) {
      console.error('Script breakdown error:', error);
    } finally {
      setIsProcessingBreakdown(false);
    }
  };

  // Update a single scene in the breakdown result
  const handleUpdateScene = (sceneNumber: number, updates: Partial<BreakdownScene>) => {
    if (!breakdownResult) return;
    const updatedResult = {
      ...breakdownResult,
      scenes: breakdownResult.scenes.map(scene =>
        scene.sceneNumber === sceneNumber
          ? { ...scene, ...updates }
          : scene
      ),
    };
    setBreakdownResult(updatedResult);
    // Persist edits to localStorage
    localStorage.setItem('script-breakdown-result', JSON.stringify(updatedResult));
  };

  // Update the global aesthetic prompt
  const handleUpdateGlobalAesthetic = (prompt: string) => {
    if (!breakdownResult) return;
    const updatedResult = {
      ...breakdownResult,
      globalAestheticPrompt: prompt,
    };
    setBreakdownResult(updatedResult);
    // Persist edits to localStorage
    localStorage.setItem('script-breakdown-result', JSON.stringify(updatedResult));
  };

  // Load a saved breakdown from database
  const handleLoadBreakdown = (breakdown: SavedBreakdown) => {
    const result: SceneBreakdownResult = {
      globalAestheticPrompt: breakdown.global_aesthetic,
      scenes: breakdown.scenes,
    };
    setBreakdownResult(result);
    setBreakdownScriptText(breakdown.script_text || '');
    // Persist to localStorage
    localStorage.setItem('script-breakdown-result', JSON.stringify(result));
    if (breakdown.script_text) {
      localStorage.setItem('script-breakdown-script-text', breakdown.script_text);
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
      ) : activeTab === 'script-breakdown' ? (
        // Script Breakdown tab - Two-panel layout
        <StandardToolLayout>
          {/* Left Panel - Script Input */}
          <div className="h-full overflow-hidden">
            <ScriptBreakdownTab
              onBreakdown={handleScriptBreakdown}
              isProcessing={isProcessingBreakdown}
            />
          </div>

          {/* Right Panel - Breakdown Output */}
          <ScriptBreakdownOutput
            isProcessing={isProcessingBreakdown}
            result={breakdownResult}
            scriptText={breakdownScriptText}
            onUpdateScene={handleUpdateScene}
            onUpdateGlobalAesthetic={handleUpdateGlobalAesthetic}
            onLoadBreakdown={handleLoadBreakdown}
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
              initialPrompt={storyboardPromptFromUrl}
              initialStyle={storyboardStyleFromUrl ? decodeURIComponent(storyboardStyleFromUrl) : undefined}
            />
          </div>

          {/* Right Panel - Storyboard Output */}
          {use4x4Grid ? (
            <div className="space-y-4 h-full overflow-y-auto">
              <StoryboardOutputV2
                isGenerating={isGeneratingStoryboard}
                storyboardResult={storyboardResult?.storyboard}
                projectId={storyboardResult?.storyboard?.id}
                userId={user?.id}
                gridConfig={{ columns: 3, rows: 3 }}
                onRegenerateGrid={() => {
                  if (storyboardResult?.storyboard) {
                    generateStoryboard({
                      story_description: storyboardResult.storyboard.prompt,
                      visual_style: storyboardResult.storyboard.visual_style,
                      user_id: '',
                    });
                  }
                }}
                onMakeVideo={(imageUrl) => handleMakeVideoFromImage(imageUrl)}
                onDownload={async (url, filename) => {
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
                    window.open(url, '_blank');
                  }
                }}
                onUploadGrid={uploadGridImage}
                onFramesExtracted={(frames) => {
                  console.log('Frames extracted:', frames.length);
                }}
                onAddToQueue={addToAnimationQueue}
                analyzerShots={analyzerShots}
              />

              {/* Batch Animation Queue */}
              {animationQueue.length > 0 && (
                <BatchAnimationQueue
                  queue={animationQueue}
                  isProcessing={isProcessingQueue}
                  progress={queueProgress}
                  onUpdateItem={updateQueueItem}
                  onRemoveItem={removeFromQueue}
                  onClearQueue={clearAnimationQueue}
                  onProcessQueue={processAnimationQueue}
                  onRetryItem={retryQueueItem}
                  credits={credits}
                  analyzerShots={analyzerShots}
                />
              )}
            </div>
          ) : (
            <StoryboardOutput
              isGenerating={isGeneratingStoryboard}
              storyboardResult={storyboardResult?.storyboard}
              extractedFrames={extractedFrames}
              isExtractingFrames={isExtractingFrames}
              extractingProgress={extractingProgress}
              onExtractFrames={extractFrames}
              onRegenerateGrid={() => {
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
                  window.open(url, '_blank');
                }
              }}
              onUploadGrid={uploadGridImage}
            />
          )}
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
            onCancelGeneration={cancelGeneration}
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
