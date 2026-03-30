'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
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
import { StoryboardOutputV2 } from './output-panel/storyboard-output-v2';
import { BatchAnimationQueue } from './batch-animation-queue';
import { breakdownScript, type SavedBreakdown } from '@/actions/tools/scene-breakdown';
import type { GenerationSettings } from '@/types/cinematographer';
import type { SceneBreakdownResult, BreakdownScene } from '@/lib/scene-breakdown/types';
import { groupScenesIntoBatches, scenesToAnalyzerShots } from '@/lib/scene-breakdown/types';
import { executeStoryboardGeneration } from '@/actions/tools/ai-cinematographer';
import { cropGridToFrames } from '@/lib/utils/grid-cropper';
import { processSingleFrame } from '@/actions/tools/grid-frame-extractor';
import { toast } from 'sonner';

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

  // Script Breakdown state
  const [isProcessingBreakdown, setIsProcessingBreakdown] = useState(false);
  const [breakdownResult, setBreakdownResult] = useState<SceneBreakdownResult | null>(null);
  const [breakdownScriptText, setBreakdownScriptText] = useState<string>('');
  // Shared reference images — uploaded once in Script Breakdown, carried to all storyboard batches
  const [breakdownReferenceImages, setBreakdownReferenceImages] = useState<{ file: File; preview: string }[]>([]);

  // Batch number from script breakdown (carried through pipeline)
  const [currentBatchNumber, setCurrentBatchNumber] = useState<number | undefined>();

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

  // Check for analysis data from Video Analyzer "Send to AI Cinematographer" button
  const [analysisTextForBreakdown, setAnalysisTextForBreakdown] = useState<string | undefined>(undefined);

  useEffect(() => {
    const analysisId = searchParams.get('analysisId');
    if (analysisId) {
      const storedData = localStorage.getItem(analysisId);
      if (storedData) {
        // Try to parse as enriched JSON payload (new format)
        // Falls back to plain string (old format) for backward compat
        let analysisText = storedData;
        try {
          const payload = JSON.parse(storedData);
          if (payload && typeof payload.analysisText === 'string') {
            // New enriched format from SendToAIPanel
            analysisText = payload.analysisText;

            // Prepend customization instructions if provided
            if (payload.customizationInstructions) {
              analysisText = `--- CUSTOMIZATION INSTRUCTIONS ---\n${payload.customizationInstructions}\n--- END CUSTOMIZATION ---\n\n${analysisText}`;
            }

            // Append product fidelity instruction if enabled
            if (payload.productFidelityEnabled && payload.referenceImages?.length > 0) {
              analysisText += '\n\n--- PRODUCT IMAGE INSTRUCTIONS ---\nIMPORTANT: Use the uploaded reference image as the exact product appearance. Do NOT describe or change product colors, shape, or branding in the visual prompts — the reference image is the source of truth for how the product looks.\n--- END PRODUCT IMAGE INSTRUCTIONS ---';
            }

            // Pre-fill aspect ratio
            if (payload.aspectRatio) {
              setLastUsedAspectRatio(payload.aspectRatio);
            }

            // Deserialize and pre-fill reference images
            if (payload.referenceImages?.length > 0) {
              (async () => {
                const images: { file: File; preview: string }[] = [];
                for (const img of payload.referenceImages) {
                  try {
                    const res = await fetch(img.dataUrl);
                    const blob = await res.blob();
                    const file = new File([blob], img.name, { type: img.type });
                    images.push({ file, preview: URL.createObjectURL(file) });
                  } catch (e) {
                    console.warn('Failed to deserialize reference image:', e);
                  }
                }
                if (images.length > 0) {
                  setBreakdownReferenceImages(images);
                }
              })();
            }
          }
        } catch {
          // Not JSON — use as plain text (backward compat)
        }

        setAnalysisTextForBreakdown(analysisText);
        localStorage.removeItem(analysisId); // Clean up after reading
        // Clear previous breakdown so the user sees a fresh Script Breakdown tab
        setBreakdownResult(null);
        setBreakdownScriptText('');
        localStorage.removeItem('script-breakdown-result');
        localStorage.removeItem('script-breakdown-script-text');
      }
      // Clean up URL params
      router.replace('/dashboard/ai-cinematographer/script-breakdown');
    }
  }, [searchParams, router, setLastUsedAspectRatio]);

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
      // Load batch number from script breakdown
      const storedBatchNumber = localStorage.getItem(`${promptId}-batchNumber`);
      if (storedBatchNumber) {
        setCurrentBatchNumber(parseInt(storedBatchNumber));
        localStorage.removeItem(`${promptId}-batchNumber`);
      }
      // Restore reference images serialized by "Send to Storyboard"
      const storedImages = localStorage.getItem(`${promptId}-images`);
      if (storedImages) {
        localStorage.removeItem(`${promptId}-images`);
        (async () => {
          try {
            const parsed: Array<{ dataUrl: string; name: string; type: string }> = JSON.parse(storedImages);
            const images = await Promise.all(
              parsed.map(async ({ dataUrl, name, type }) => {
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                const file = new File([blob], name, { type });
                return { file, preview: URL.createObjectURL(blob) };
              })
            );
            setBreakdownReferenceImages(images);
          } catch (e) {
            console.error('Failed to restore reference images:', e);
          }
        })();
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
      tweakSettings={tweakSettings}
      onClearTweakSettings={() => setTweakSettings(null)}
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

  // ============ Generate All Storyboards ============
  const [isGeneratingAllStoryboards, setIsGeneratingAllStoryboards] = useState(false);
  const [generateAllProgress, setGenerateAllProgress] = useState({ current: 0, total: 0 });

  const handleGenerateAllStoryboards = async () => {
    if (!breakdownResult || !user?.id) return;

    const batches = groupScenesIntoBatches(breakdownResult.scenes);
    if (batches.length === 0) return;

    setIsGeneratingAllStoryboards(true);
    setGenerateAllProgress({ current: 0, total: batches.length });

    // Upload reference images once (reuse URLs across all batches)
    let referenceImageUrls: string[] = [];
    if (breakdownReferenceImages.length > 0) {
      const batchId = crypto.randomUUID();
      for (const img of breakdownReferenceImages) {
        try {
          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('type', 'reference');
          formData.append('batchId', batchId);
          const res = await fetch('/api/upload/cinematographer', { method: 'POST', body: formData });
          const result = await res.json();
          if (result.success && result.url) {
            referenceImageUrls.push(result.url);
          }
        } catch (e) {
          console.warn('Failed to upload reference image:', e);
        }
      }
    }

    const aspectRatio = (lastUsedAspectRatio === '9:16' || lastUsedAspectRatio === '16:9')
      ? lastUsedAspectRatio as '16:9' | '9:16'
      : '9:16';

    let totalFramesAdded = 0;
    let failedBatches = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Build storyboard prompt (same logic as handleSendToStoryboard)
      const combinedPrompt = `${breakdownResult.globalAestheticPrompt}

Create a 2x2 cinematic storyboard grid (2 columns, 2 rows = 4 frames).
CRITICAL: NO gaps, NO borders, NO black bars between frames. All frames must touch edge-to-edge.

${batch.map((s, i) => `Frame ${i + 1}: ${s.visualPrompt}`).join('\n\n')}

Maintain visual consistency across all frames.`;

      try {
        // Generate storyboard grid
        const storyboardResponse = await executeStoryboardGeneration({
          story_description: combinedPrompt,
          visual_style: 'cinematic_realism',
          aspect_ratio: aspectRatio,
          reference_image_urls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
          user_id: user.id,
        });

        if (storyboardResponse.success && storyboardResponse.storyboard) {
          // Extract frames using client-side canvas cropping (same as StoryboardOutputV2)
          const gridImageUrl = storyboardResponse.storyboard.grid_image_url;
          const projectId = storyboardResponse.storyboard.id;

          // Client-side crop: 2x2 grid → 4 individual frames
          const croppedFrames = await cropGridToFrames(gridImageUrl, { columns: 2, rows: 2 });

          // Only process frames that match the batch size (last batch may have < 4 scenes)
          const framesToProcess = croppedFrames.slice(0, batch.length);

          // Upload each cropped frame to storage
          const uploadedFrames: { frameNumber: number; imageUrl: string }[] = [];
          for (const frame of framesToProcess) {
            const result = await processSingleFrame(
              projectId,
              user.id,
              frame,
              false, // No upscaling needed (2x2 at 4K = Full HD per frame)
              {
                prompt: `[STORYBOARD FRAME ${frame.frameNumber}] Batch ${batchIndex + 1}`,
                aspectRatio,
                batchNumber: batchIndex + 1,
              }
            );

            if (result.success && result.frame) {
              uploadedFrames.push({
                frameNumber: frame.frameNumber,
                imageUrl: result.frame.originalUrl,
              });
            }
          }

          if (uploadedFrames.length > 0) {
            // Convert scenes to analyzer shots for motion/dialogue data
            const shots = scenesToAnalyzerShots(batch);

            // Add frames to animation queue
            const queueItems = uploadedFrames.map(frame => {
              const shotData = shots[frame.frameNumber - 1];
              const dialogueLength = shotData?.dialogue?.length || 0;
              const estimatedDuration = dialogueLength > 0
                ? Math.max(6, Math.ceil(dialogueLength / 15))
                : 6;
              // Clamp to valid durations
              const validDurations = [6, 8, 10, 12, 14, 16, 18, 20];
              const duration = validDurations.find(d => d >= estimatedDuration) || 6;

              return {
                frameNumber: frame.frameNumber,
                imageUrl: frame.imageUrl,
                prompt: shotData?.action || shotData?.description || '',
                dialogue: shotData?.dialogue,
                duration,
                cameraStyle: 'stable' as const,
                aspectRatio,
                model: 'fast' as const,
                batchNumber: batchIndex + 1,
                sceneNumber: shotData?.shotNumber,
              };
            });

            addToAnimationQueue(queueItems);
            totalFramesAdded += queueItems.length;
          }
        } else {
          failedBatches++;
          console.error(`Batch ${batchIndex + 1} failed:`, storyboardResponse.error);
        }
      } catch (err) {
        failedBatches++;
        console.error(`Batch ${batchIndex + 1} error:`, err);
      }

      setGenerateAllProgress({ current: batchIndex + 1, total: batches.length });
    }

    setIsGeneratingAllStoryboards(false);
    setGenerateAllProgress({ current: 0, total: 0 });

    if (failedBatches === 0) {
      toast.success(`All ${batches.length} storyboards generated! ${totalFramesAdded} frames ready in queue.`);
    } else {
      toast.warning(`${batches.length - failedBatches}/${batches.length} storyboards generated. ${totalFramesAdded} frames added. ${failedBatches} failed.`);
    }

    // Auto-scroll to queue
    setTimeout(() => {
      scriptBreakdownQueueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  // ============ Regenerate / Tweak Video ============
  const [tweakSettings, setTweakSettings] = useState<{ prompt: string; settings: GenerationSettings } | null>(null);

  const handleRegenerate = () => {
    if (!result?.generation_settings || !result?.video?.prompt) return;
    const settings = result.generation_settings;
    generateVideo({
      prompt: result.video.prompt,
      model: settings.model,
      duration: settings.duration,
      resolution: settings.resolution as any,
      aspect_ratio: settings.aspect_ratio as any,
      generate_audio: settings.generate_audio,
      camera_motion: settings.camera_motion,
      camera_fixed: settings.camera_fixed,
      seed: settings.seed,
      reference_image_url: settings.reference_image_url,
      last_frame_image_url: settings.last_frame_image_url,
      workflow_intent: 'generate',
      user_id: '',
    });
  };

  const handleTweak = () => {
    if (!result?.generation_settings || !result?.video?.prompt) return;
    setTweakSettings({
      prompt: result.video.prompt,
      settings: result.generation_settings,
    });
  };

  // ============ Generate Everything (Storyboards + Videos) ============
  const scriptBreakdownQueueRef = useRef<HTMLDivElement>(null);
  const [isGeneratingEverything, setIsGeneratingEverything] = useState(false);
  const [generateEverythingPhase, setGenerateEverythingPhase] = useState<'storyboards' | 'videos'>('storyboards');

  const handleGenerateEverything = async () => {
    setIsGeneratingEverything(true);
    setGenerateEverythingPhase('storyboards');

    // Phase 1: Generate all storyboards
    await handleGenerateAllStoryboards();

    // Phase 2: Auto-start video generation
    setGenerateEverythingPhase('videos');
    await processAnimationQueue();

    setIsGeneratingEverything(false);
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
              initialScript={analysisTextForBreakdown || breakdownScriptText || undefined}
              referenceImages={breakdownReferenceImages}
              onReferenceImagesChange={setBreakdownReferenceImages}
            />
          </div>

          {/* Right Panel - Breakdown Output + Animation Queue */}
          <div className="h-full overflow-y-auto">
            <ScriptBreakdownOutput
              isProcessing={isProcessingBreakdown}
              result={breakdownResult}
              scriptText={breakdownScriptText}
              onUpdateScene={handleUpdateScene}
              onUpdateGlobalAesthetic={handleUpdateGlobalAesthetic}
              onLoadBreakdown={handleLoadBreakdown}
              referenceImages={breakdownReferenceImages}
              onGenerateAllStoryboards={handleGenerateAllStoryboards}
              isGeneratingAll={isGeneratingAllStoryboards || isGeneratingEverything}
              generateAllProgress={generateAllProgress}
              onGenerateEverything={handleGenerateEverything}
              isGeneratingEverything={isGeneratingEverything}
              generateEverythingPhase={generateEverythingPhase}
            />

            {/* Animation Queue - appears after storyboard generation */}
            {animationQueue.length > 0 && (
              <div ref={scriptBreakdownQueueRef} className="p-4">
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
              </div>
            )}
          </div>
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
              initialReferenceImages={breakdownReferenceImages}
            />
          </div>

          {/* Right Panel - Storyboard Output */}
          <div className="space-y-4 h-full overflow-y-auto">
              <StoryboardOutputV2
                isGenerating={isGeneratingStoryboard}
                storyboardResult={storyboardResult?.storyboard}
                projectId={storyboardResult?.storyboard?.id}
                userId={user?.id}
                gridConfig={{ columns: 2, rows: 2 }}
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
                onAddToQueue={addToAnimationQueue}
                analyzerShots={analyzerShots}
                batchNumber={currentBatchNumber}
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
            onRegenerate={result?.generation_settings ? handleRegenerate : undefined}
            onTweak={result?.generation_settings ? handleTweak : undefined}
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
