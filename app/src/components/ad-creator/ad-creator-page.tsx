'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Scissors, FileText, Video, ArrowRight, Link2, Loader2, History, ExternalLink, Trash2 } from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { analyzeVideo, fetchVideoAnalyses } from '@/actions/tools/video-analyzer';
import { useQuery } from '@tanstack/react-query';
import { breakdownScript } from '@/actions/tools/scene-breakdown';
import { useAICinematographer } from '@/components/ai-cinematographer/hooks/use-ai-cinematographer';
import { WizardStepper } from '@/components/ai-recreate/wizard-stepper';
import { WizardNavigation } from '@/components/ai-recreate/wizard-navigation';
import { CustomizePlanStep } from '@/components/ai-recreate/steps/customize-plan-step';
import { ImageGenerationStep } from '@/components/ai-recreate/steps/image-generation-step';
import { VideoGenerationStep } from '@/components/ai-recreate/steps/video-generation-step';
import { VoiceOverStep } from '@/components/ai-recreate/steps/voice-over-step';
import { getDefaultWizardData, type WizardData, type WizardStep, type ExtractedFrame } from '@/components/ai-recreate/wizard-types';
import type { BreakdownScene, SceneBreakdownResult } from '@/lib/scene-breakdown/types';
import { groupScenesIntoBatches, scenesToAnalyzerShots } from '@/lib/scene-breakdown/types';
import { motionPresetToNativeCameraMotion } from '@/lib/scene-breakdown/motion-presets';
import { toast } from 'sonner';

type AdCreatorMode = 'select' | 'clone' | 'script';

export function AdCreatorPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AdCreatorMode>('select');

  // Check URL params for mode
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'clone') setMode('clone');
    else if (modeParam === 'script') setMode('script');

    // Check if coming from old ai-recreate with analysisId
    const analysisId = searchParams.get('analysisId');
    if (analysisId) setMode('clone');
  }, [searchParams]);

  return (
    <StandardToolPage
      icon={Video}
      title="Ad (Re)Creator"
      description="Create AI video ads — clone a competitor's ad or start from your own script"
      iconGradient="bg-primary"
      toolName="Ad (Re)Creator"
    >
      {mode === 'select' ? (
        <ModeSelector onSelect={setMode} />
      ) : (
        <AdCreatorWizard mode={mode} onBack={() => setMode('select')} />
      )}
    </StandardToolPage>
  );
}

// ============ Mode Selector ============
function ModeSelector({ onSelect }: { onSelect: (mode: AdCreatorMode) => void }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full px-4">
        {/* Clone an Ad */}
        <Card
          className="p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors group"
          onClick={() => onSelect('clone')}
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Scissors className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Clone an Ad</h3>
              <p className="text-sm text-muted-foreground">
                Paste a video URL from TikTok, Facebook, Instagram or YouTube.
                We&apos;ll analyze it and help you recreate it with your own product.
              </p>
            </div>
            <div className="mt-2 inline-flex items-center px-4 py-2 rounded-md border border-border text-sm font-medium group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
              Start Cloning <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        </Card>

        {/* Create from Script */}
        <Card
          className="p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors group"
          onClick={() => onSelect('script')}
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Create from Script</h3>
              <p className="text-sm text-muted-foreground">
                Already have a script? Paste it in and we&apos;ll generate a shot-by-shot
                video with AI images, animation and voiceover.
              </p>
            </div>
            <div className="mt-2 inline-flex items-center px-4 py-2 rounded-md border border-border text-sm font-medium group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
              Start Creating <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============ Clone Step (Video Analyzer embedded) ============
interface SavedAnalysis {
  id: string;
  title: string;
  video_url: string | null;
  video_duration_seconds: number | null;
  analysis_result: string;
  custom_prompt: string | null;
  credits_used: number;
  created_at: string;
}

function CloneAnalyzeStep({
  onAnalysisComplete,
}: {
  onAnalysisComplete: (analysisText: string, sourceUrl: string) => void;
}) {
  const [videoUrl, setVideoUrl] = useState('');
  const [analysisType, setAnalysisType] = useState('storyboard_recreation');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // Fetch history
  const { data: savedAnalyses, isLoading: historyLoading } = useQuery({
    queryKey: ['video-analyses'],
    queryFn: async () => {
      const result = await fetchVideoAnalyses();
      return result.success ? (result.analyses || []) : [];
    },
  });

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const response = await analyzeVideo({
        videoUrl: videoUrl.trim(),
        analysisType: analysisType as 'storyboard_recreation',
        additionalInstructions: additionalInstructions.trim() || undefined,
        videoDurationSeconds: 60,
      });

      if (response.success && response.analysisText) {
        setAnalysisResult(response.analysisText);
        toast.success('Video analyzed successfully!');
      } else {
        toast.error(response.error || 'Failed to analyze video');
      }
    } catch {
      toast.error('Analysis failed');
    }
    setIsAnalyzing(false);
  };

  const handleLoadFromHistory = (analysis: SavedAnalysis) => {
    onAnalysisComplete(analysis.analysis_result, analysis.video_url || '');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">Clone an Ad</h2>
        <p className="text-sm text-muted-foreground">
          Paste the URL of the ad you want to clone, or pick from a previous analysis.
        </p>
      </div>

      {/* Previous Analyses */}
      {!analysisResult && savedAnalyses && savedAnalyses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <History className="w-4 h-4" />
            Previous Analyses
          </div>
          <div className="grid gap-2 max-h-[200px] overflow-y-auto">
            {(savedAnalyses as SavedAnalysis[]).map((analysis) => (
              <Card
                key={analysis.id}
                className="p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => handleLoadFromHistory(analysis)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{analysis.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
                      {analysis.video_url && (
                        <span className="truncate flex items-center gap-1">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          {analysis.video_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    Use This <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <div className="border-b border-border/30 pt-2" />
        </div>
      )}

      {historyLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading previous analyses...
        </div>
      )}

      {/* URL Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Video URL</label>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)}
            placeholder="https://www.tiktok.com/... or Facebook/Instagram/YouTube URL"
            className="pl-10"
          />
        </div>
      </div>

      {/* Additional Instructions */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Additional Instructions (Optional)</label>
        <Textarea
          value={additionalInstructions}
          onChange={e => setAdditionalInstructions(e.target.value)}
          placeholder="e.g., 'Focus on the product placement moments'"
          rows={2}
        />
      </div>

      {/* Analyze Button */}
      <Button
        onClick={handleAnalyze}
        disabled={!videoUrl.trim() || isAnalyzing}
        className="w-full h-12"
        size="lg"
      >
        {isAnalyzing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Video...</>
        ) : (
          'Analyze Video'
        )}
      </Button>

      {/* Analysis Result */}
      {analysisResult && (
        <div className="space-y-3">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-400 font-medium">Analysis complete! Click continue to customize with your product.</p>
          </div>
          <Button
            onClick={() => onAnalysisComplete(analysisResult, videoUrl)}
            className="w-full h-12"
            size="lg"
          >
            Continue to Customize <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============ Main Wizard (reuses all existing steps) ============
function AdCreatorWizard({ mode, onBack }: { mode: 'clone' | 'script'; onBack: () => void }) {
  const searchParams = useSearchParams();

  // For clone mode: track whether analysis is done
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // ===== Wizard State =====
  const [currentStep, setCurrentStep] = useState<WizardStep>(mode === 'clone' ? 1 as WizardStep : 2);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [highestStepReached, setHighestStepReached] = useState<WizardStep>(mode === 'clone' ? 1 as WizardStep : 2);
  const [wizardData, setWizardData] = useState<WizardData>(getDefaultWizardData);

  // ===== Image Generation State =====
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [imageGenProgress, setImageGenProgress] = useState({ current: 0, total: 0 });
  const autoGenTriggeredRef = useRef(false);
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);

  // ===== Reuse existing hooks =====
  const cinematographer = useAICinematographer();

  // ===== Load analysis from old AI Recreate URL params =====
  useEffect(() => {
    const analysisId = searchParams.get('analysisId');
    if (!analysisId) return;

    try {
      const stored = localStorage.getItem(analysisId);
      if (!stored) return;

      const payload = JSON.parse(stored);
      const referenceImages: WizardData['referenceImages'] = [];

      if (payload.referenceImages?.length) {
        for (const img of payload.referenceImages) {
          if (img.dataUrl) {
            try {
              const byteString = atob(img.dataUrl.split(',')[1]);
              const mimeString = img.dataUrl.split(',')[0].split(':')[1].split(';')[0];
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
              const file = new File([ab], img.name || 'product.jpg', { type: mimeString });
              referenceImages.push({ file, preview: img.dataUrl, label: img.label });
            } catch {
              console.warn('Failed to deserialize reference image');
            }
          }
        }
      }

      let enrichedText = payload.analysisText || '';
      if (payload.customizationInstructions) {
        enrichedText = `## USER CUSTOMIZATION INSTRUCTIONS:\n${payload.customizationInstructions}\n\n---\n\n${enrichedText}`;
      }

      setWizardData(prev => ({
        ...prev,
        analysisText: enrichedText,
        sourceVideoUrl: payload.sourceVideoUrl,
        referenceImages,
        aspectRatio: payload.aspectRatio || '9:16',
      }));

      if (payload.aspectRatio) {
        cinematographer.setLastUsedAspectRatio(payload.aspectRatio);
      }

      // Skip analyze step since we already have analysis
      setAnalysisComplete(true);
      setCurrentStep(2);
      setCompletedSteps(new Set([1 as WizardStep]));
      setHighestStepReached(2);

      localStorage.removeItem(analysisId);
    } catch (err) {
      console.error('Failed to load analysis payload:', err);
    }
  }, [searchParams]);

  // ===== Handlers (same as AI Recreate) =====
  const handleAnalysisComplete = (analysisText: string, sourceUrl: string) => {
    setWizardData(prev => ({
      ...prev,
      analysisText,
      sourceVideoUrl: sourceUrl,
    }));
    setAnalysisComplete(true);
    setCompletedSteps(prev => new Set(prev).add(1 as WizardStep));
    setCurrentStep(2);
    setHighestStepReached(2);
  };

  const handleBreakdownComplete = (result: SceneBreakdownResult) => {
    const allSceneNumbers = new Set(result.scenes.map(s => s.sceneNumber));
    setWizardData(prev => ({
      ...prev,
      scenes: result.scenes,
      globalAestheticPrompt: result.globalAestheticPrompt,
      breakdownResult: result,
      narrationScript: result.scenes.map(s => s.narration).join(' '),
      enabledScenes: allSceneNumbers,
    }));
    toast.success(`Script broken down into ${result.scenes.length} scenes`);
  };

  const handleUpdateScene = (sceneNumber: number, updates: Partial<BreakdownScene>) => {
    setWizardData(prev => ({
      ...prev,
      scenes: prev.scenes.map(s =>
        s.sceneNumber === sceneNumber ? { ...s, ...updates } : s
      ),
    }));
  };

  const handleUpdateGlobalAesthetic = (prompt: string) => {
    setWizardData(prev => ({ ...prev, globalAestheticPrompt: prompt }));
  };

  const handleUpdateNarration = (narration: string) => {
    setWizardData(prev => ({ ...prev, narrationScript: narration }));
  };

  const handleUpdateReferenceImages = (images: WizardData['referenceImages']) => {
    setWizardData(prev => ({ ...prev, referenceImages: images }));
  };

  const handleUpdateAspectRatio = (ratio: '16:9' | '9:16') => {
    setWizardData(prev => ({ ...prev, aspectRatio: ratio }));
    cinematographer.setLastUsedAspectRatio(ratio);
  };

  const handleToggleScene = (sceneNumber: number) => {
    setWizardData(prev => {
      const newEnabled = new Set(prev.enabledScenes);
      if (newEnabled.has(sceneNumber)) newEnabled.delete(sceneNumber);
      else newEnabled.add(sceneNumber);
      return { ...prev, enabledScenes: newEnabled };
    });
  };

  // ===== Step Navigation =====
  const goToStep = (step: WizardStep) => {
    if (step <= highestStepReached || completedSteps.has(step as WizardStep)) {
      setCurrentStep(step);
    }
  };

  const goNext = () => {
    const steps = mode === 'clone' ? [1, 2, 3, 4, 5] : [2, 3, 4, 5];
    const idx = steps.indexOf(currentStep);
    if (idx < steps.length - 1) {
      const next = steps[idx + 1] as WizardStep;

      // When moving from Customize → Images, auto-start image generation
      if (currentStep === 2 && next === 3 && wizardData.extractedFrames.length === 0) {
        setShouldAutoGenerate(true);
      }

      // When moving to Videos step, populate the animation queue from frames
      if (next === 4 && wizardData.extractedFrames.length > 0) {
        populateAnimationQueue();
      }

      setCompletedSteps(prev => new Set(prev).add(currentStep));
      setCurrentStep(next);
      if (next > highestStepReached) setHighestStepReached(next);
    }
  };

  const goPrevious = () => {
    const steps = mode === 'clone' ? [1, 2, 3, 4, 5] : [2, 3, 4, 5];
    const idx = steps.indexOf(currentStep);
    if (idx > 0) setCurrentStep(steps[idx - 1] as WizardStep);
    else onBack(); // Go back to mode selector
  };

  // ===== Image generation (reused from AIRecreatePage) =====
  const { extractAllFrames } = cinematographer;

  const handleGenerateAllImages = async () => {
    const enabledScenes = wizardData.scenes.filter(s => wizardData.enabledScenes.has(s.sceneNumber));
    if (enabledScenes.length === 0) return;

    setIsGeneratingImages(true);
    setImageGenProgress({ current: 0, total: enabledScenes.length });

    // Clear old frames
    setWizardData(prev => ({ ...prev, extractedFrames: [] }));

    const allFrames: ExtractedFrame[] = [];

    // Upload reference images once
    let uploadedImageUrls: string[] = [];
    if (wizardData.referenceImages.length > 0) {
      try {
        const { uploadReferenceImages } = await import('@/actions/tools/ai-cinematographer');
        const urls = await uploadReferenceImages(wizardData.referenceImages.map(img => img.file));
        uploadedImageUrls = urls.filter(Boolean) as string[];
      } catch { console.warn('Failed to upload reference images'); }
    }

    for (let i = 0; i < enabledScenes.length; i++) {
      const scene = enabledScenes[i];
      setImageGenProgress({ current: i + 1, total: enabledScenes.length });

      try {
        const imagePrompt = `${wizardData.globalAestheticPrompt}\n\n${scene.visualPrompt}\n\nIMPORTANT: Do NOT add any text, words, letters, watermarks, or overlays on the image. The image must be completely clean with no text whatsoever.`;

        const { generateImageWithPro } = await import('@/actions/models/fal-nano-banana-2');
        const result = await generateImageWithPro(
          imagePrompt,
          wizardData.aspectRatio,
          uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
          '2K',
          'jpg'
        );

        if (result.success && result.imageUrl) {
          let finalUrl = result.imageUrl;
          try {
            const { uploadCinematographerImage } = await import('@/actions/tools/ai-cinematographer');
            const uploaded = await uploadCinematographerImage(result.imageUrl);
            if (uploaded) finalUrl = uploaded;
          } catch { /* use fal URL */ }

          const duration = scene.narration
            ? Math.max(6, Math.min(20, Math.ceil(scene.narration.split(/\s+/).length / 2.5)))
            : 6;

          allFrames.push({
            id: `scene-${scene.sceneNumber}-${Date.now()}`,
            imageUrl: finalUrl,
            prompt: scene.visualPrompt,
            sceneNumber: scene.sceneNumber,
            batchNumber: Math.ceil((i + 1) / 4),
            narration: scene.narration,
            duration,
            motionPresetId: scene.motionPresetId,
          });

          // Update incrementally
          setWizardData(prev => ({
            ...prev,
            extractedFrames: [...prev.extractedFrames, allFrames[allFrames.length - 1]],
          }));
        }
      } catch (err) {
        console.error(`Scene ${scene.sceneNumber} failed:`, err);
      }
    }

    setIsGeneratingImages(false);
    setImageGenProgress({ current: 0, total: 0 });
    toast.success(`${allFrames.length} images generated`);
  };

  const handleUpdateFrame = (frameId: string, updates: Partial<ExtractedFrame>) => {
    setWizardData(prev => ({
      ...prev,
      extractedFrames: prev.extractedFrames.map(f => f.id === frameId ? { ...f, ...updates } : f),
    }));
  };

  const handleRemoveFrame = (frameId: string) => {
    setWizardData(prev => ({
      ...prev,
      extractedFrames: prev.extractedFrames.filter(f => f.id !== frameId),
    }));
  };

  // ===== Populate animation queue from frames =====
  const populateAnimationQueue = () => {
    const existingUrls = new Set(cinematographer.animationQueue.map(q => q.imageUrl));
    const newFrames = wizardData.extractedFrames.filter(f => !existingUrls.has(f.imageUrl));
    if (newFrames.length === 0) return;

    cinematographer.addToAnimationQueue(
      newFrames.map(frame => ({
        frameNumber: frame.sceneNumber,
        imageUrl: frame.imageUrl,
        prompt: frame.prompt || '',
        dialogue: frame.narration,
        duration: frame.duration || 6,
        cameraStyle: 'cinematic' as const,
        camera_motion: motionPresetToNativeCameraMotion(frame.motionPresetId),
        aspectRatio: wizardData.aspectRatio === '9:16' ? '9:16' : '16:9',
        model: 'fast' as const,
        batchNumber: frame.batchNumber,
        sceneNumber: frame.sceneNumber,
      }))
    );
  };

  // ===== Dynamic steps =====
  const wizardSteps = mode === 'clone'
    ? [
        { number: 1 as WizardStep, label: 'Analyze', description: 'Analyze the ad' },
        { number: 2 as WizardStep, label: 'Customize', description: 'Plan your shots' },
        { number: 3 as WizardStep, label: 'Images', description: 'Generate frames' },
        { number: 4 as WizardStep, label: 'Videos', description: 'Animate clips' },
        { number: 5 as WizardStep, label: 'Voice Over', description: 'Add narration' },
      ]
    : [
        { number: 2 as WizardStep, label: 'Customize', description: 'Plan your shots' },
        { number: 3 as WizardStep, label: 'Images', description: 'Generate frames' },
        { number: 4 as WizardStep, label: 'Videos', description: 'Animate clips' },
        { number: 5 as WizardStep, label: 'Voice Over', description: 'Add narration' },
      ];

  // Auto-generate images after breakdown completes
  useEffect(() => {
    if (shouldAutoGenerate && currentStep === 3 && !isGeneratingImages && wizardData.scenes.length > 0) {
      setShouldAutoGenerate(false);
      handleGenerateAllImages();
    }
  }, [shouldAutoGenerate, currentStep, isGeneratingImages, wizardData.scenes.length]);

  // Check if can proceed
  const canGoNext = () => {
    if (currentStep === 1) return analysisComplete;
    if (currentStep === 2) return wizardData.scenes.length > 0;
    if (currentStep === 3) return wizardData.extractedFrames.length > 0;
    return true;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stepper */}
      <div className="px-4 pt-3 pb-2">
        <WizardStepper
          steps={wizardSteps}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
          highestStepReached={highestStepReached}
        />
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === 1 && mode === 'clone' && (
          <CloneAnalyzeStep onAnalysisComplete={handleAnalysisComplete} />
        )}

        {currentStep === 2 && (
          <CustomizePlanStep
            wizardData={wizardData}
            onBreakdownComplete={handleBreakdownComplete}
            onUpdateScene={handleUpdateScene}
            onUpdateGlobalAesthetic={handleUpdateGlobalAesthetic}
            onUpdateNarration={handleUpdateNarration}
            onUpdateReferenceImages={handleUpdateReferenceImages}
            onUpdateAspectRatio={handleUpdateAspectRatio}
            onToggleScene={handleToggleScene}
          />
        )}

        {currentStep === 3 && (
          <ImageGenerationStep
            wizardData={wizardData}
            isGenerating={isGeneratingImages}
            progress={imageGenProgress}
            onGenerateAll={handleGenerateAllImages}
            onUpdateFrame={handleUpdateFrame}
            onRemoveFrame={handleRemoveFrame}
          />
        )}

        {currentStep === 4 && (
          <VideoGenerationStep
            queue={cinematographer.animationQueue}
            isProcessing={cinematographer.isProcessingQueue}
            progress={cinematographer.queueProgress}
            onProcessQueue={cinematographer.processAnimationQueue}
            onUpdateItem={cinematographer.updateQueueItem}
            onRemoveItem={cinematographer.removeFromQueue}
            onClearQueue={cinematographer.clearAnimationQueue}
            onRetryItem={cinematographer.retryQueueItem}
            credits={cinematographer.credits}
            analyzerShots={cinematographer.analyzerShots}
          />
        )}

        {currentStep === 5 && (
          <VoiceOverStep
            wizardData={wizardData}
            onUpdateVoiceData={(data) => setWizardData(prev => ({ ...prev, ...data }))}
            cinematographer={cinematographer}
          />
        )}
      </div>

      {/* Navigation */}
      <WizardNavigation
        onPrevious={goPrevious}
        onNext={goNext}
        canGoNext={canGoNext()}
        isFirstStep={currentStep === (mode === 'clone' ? 1 : 2)}
        isLastStep={currentStep === 5}
        nextLabel={
          currentStep === 2 && wizardData.extractedFrames.length === 0
            ? 'Continue to Image Generation'
            : currentStep === 3
              ? 'Continue to Video Generation'
              : currentStep === 4
                ? 'Continue to Voice Over'
                : 'Next'
        }
        isProcessing={isGeneratingImages}
      />
    </div>
  );
}
