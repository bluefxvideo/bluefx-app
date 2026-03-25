'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wand2 } from 'lucide-react';
import { breakdownScript } from '@/actions/tools/scene-breakdown';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { useAICinematographer } from '@/components/ai-cinematographer/hooks/use-ai-cinematographer';
import { WizardStepper } from './wizard-stepper';
import { WizardNavigation } from './wizard-navigation';
import { CustomizePlanStep } from './steps/customize-plan-step';
import { ImageGenerationStep } from './steps/image-generation-step';
import { VideoGenerationStep } from './steps/video-generation-step';
import { VoiceOverStep } from './steps/voice-over-step';
import { getDefaultWizardData, type WizardData, type WizardStep, type ExtractedFrame } from './wizard-types';
import type { BreakdownScene, SceneBreakdownResult } from '@/lib/scene-breakdown/types';
import { groupScenesIntoBatches, scenesToAnalyzerShots } from '@/lib/scene-breakdown/types';
import { motionPresetToNativeCameraMotion } from '@/lib/scene-breakdown/motion-presets';
import { toast } from 'sonner';

export function AIRecreatePage() {
  const searchParams = useSearchParams();

  // ===== Wizard State =====
  const [currentStep, setCurrentStep] = useState<WizardStep>(2);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [highestStepReached, setHighestStepReached] = useState<WizardStep>(2);
  const [wizardData, setWizardData] = useState<WizardData>(getDefaultWizardData);

  // (auto-breakdown removed — user sets up product first)

  // ===== Image Generation State =====
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [imageGenProgress, setImageGenProgress] = useState({ current: 0, total: 0 });
  const autoGenTriggeredRef = useRef(false);

  // ===== Reuse existing hooks =====
  const cinematographer = useAICinematographer();

  // ===== Load analysis from Video Analyzer =====
  useEffect(() => {
    const analysisId = searchParams.get('analysisId');
    if (!analysisId) return;

    try {
      const stored = localStorage.getItem(analysisId);
      if (!stored) return;

      const payload = JSON.parse(stored);
      const referenceImages: WizardData['referenceImages'] = [];

      // Deserialize reference images from data URLs
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
              referenceImages.push({ file, preview: img.dataUrl });
            } catch {
              console.warn('Failed to deserialize reference image');
            }
          }
        }
      }

      // Build enriched analysis text
      let enrichedText = payload.analysisText || '';
      if (payload.customizationInstructions) {
        enrichedText = `## USER CUSTOMIZATION INSTRUCTIONS:\n${payload.customizationInstructions}\n\n---\n\n${enrichedText}`;
      }
      if (payload.productFidelityEnabled && referenceImages.length > 0) {
        enrichedText += '\n\n## PRODUCT FIDELITY:\nI am uploading reference images of my product. Use these as the definitive visual reference. Do NOT describe colors, shapes, or appearance details from the original video — use ONLY the uploaded reference image for product appearance.';
      }

      setWizardData(prev => ({
        ...prev,
        analysisText: enrichedText,
        sourceVideoUrl: payload.sourceVideoUrl,
        referenceImages,
        aspectRatio: payload.aspectRatio || '9:16',
      }));

      // Set aspect ratio in cinematographer hook
      if (payload.aspectRatio) {
        cinematographer.setLastUsedAspectRatio(payload.aspectRatio);
      }

      // Clean up localStorage
      localStorage.removeItem(analysisId);
      // No auto-breakdown — user adds product image first, then clicks "Break Down"
    } catch (err) {
      console.error('Failed to load analysis payload:', err);
    }
  }, [searchParams]);

  // ===== Step completion logic =====
  const canGoNext = useCallback((): boolean => {
    switch (currentStep) {
      case 2:
        return wizardData.scenes.length > 0;
      case 3:
        return wizardData.extractedFrames.length > 0;
      case 4: {
        const completed = cinematographer.animationQueue.filter(q => q.status === 'completed');
        return completed.length > 0;
      }
      case 5:
        return true; // Voice over is optional
      default:
        return false;
    }
  }, [currentStep, wizardData, cinematographer.animationQueue]);

  const handleNext = () => {
    if (!canGoNext()) return;
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    const nextStep = (currentStep + 1) as WizardStep;
    if (nextStep <= 5) {
      setCurrentStep(nextStep);
      setHighestStepReached(prev => Math.max(prev, nextStep) as WizardStep);

      // When entering Step 4, always repopulate animation queue from extracted frames
      if (nextStep === 4 && wizardData.extractedFrames.length > 0) {
        cinematographer.clearAnimationQueue();
        populateAnimationQueue();
      }
    }
  };

  const handlePrevious = () => {
    const prevStep = (currentStep - 1) as WizardStep;
    if (prevStep >= 2) setCurrentStep(prevStep);
  };

  // ===== Step 2: Breakdown handlers =====
  const handleBreakdownComplete = (result: SceneBreakdownResult) => {
    setWizardData(prev => ({
      ...prev,
      scenes: result.scenes,
      enabledScenes: new Set(result.scenes.map(s => s.sceneNumber)),
      globalAestheticPrompt: result.globalAestheticPrompt,
      breakdownResult: result,
      narrationScript: result.scenes.map(s => s.narration).join(' '),
      extractedFrames: [], // Clear old frames on re-breakdown
    }));
  };

  const handleToggleScene = (sceneNumber: number) => {
    setWizardData(prev => {
      const newSet = new Set(prev.enabledScenes);
      if (newSet.has(sceneNumber)) {
        newSet.delete(sceneNumber);
      } else {
        newSet.add(sceneNumber);
      }
      return { ...prev, enabledScenes: newSet };
    });
  };

  const handleUpdateScene = (sceneNumber: number, updates: Partial<BreakdownScene>) => {
    setWizardData(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.sceneNumber === sceneNumber ? { ...s, ...updates } : s),
    }));
  };

  const handleUpdateGlobalAesthetic = (prompt: string) => {
    setWizardData(prev => ({ ...prev, globalAestheticPrompt: prompt }));
  };

  const handleUpdateNarration = (narration: string) => {
    setWizardData(prev => ({ ...prev, narrationScript: narration }));
  };

  const handleUpdateReferenceImages = (images: { file: File; preview: string }[]) => {
    setWizardData(prev => ({ ...prev, referenceImages: images }));
  };

  const handleUpdateAspectRatio = (ratio: '16:9' | '9:16') => {
    setWizardData(prev => ({ ...prev, aspectRatio: ratio }));
    cinematographer.setLastUsedAspectRatio(ratio);
  };

  // ===== Step 3: Image generation =====
  const handleGenerateAllImages = async () => {
    // Only generate images for enabled scenes
    const enabledScenesList = wizardData.scenes.filter(s => wizardData.enabledScenes.has(s.sceneNumber));
    if (enabledScenesList.length === 0) return;

    // Clear old frames before regenerating
    setWizardData(prev => ({ ...prev, extractedFrames: [] }));
    setIsGeneratingImages(true);
    setImageGenProgress({ current: 0, total: enabledScenesList.length });

    const allFrames: ExtractedFrame[] = [];
    let failedCount = 0;

    // Upload reference images once (via API route — File objects can't serialize to server actions)
    let uploadedImageUrls: string[] = [];
    if (wizardData.referenceImages.length > 0) {
      const batchId = crypto.randomUUID();
      for (const img of wizardData.referenceImages) {
        try {
          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('type', 'reference');
          formData.append('batchId', batchId);
          const response = await fetch('/api/upload/cinematographer', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          if (result.success && result.url) {
            uploadedImageUrls.push(result.url);
          }
        } catch {
          console.warn('Failed to upload reference image');
        }
      }
    }

    // Generate each scene individually (2K resolution, better reference image support)
    const { generateSingleSceneImage } = await import('@/actions/tools/ai-cinematographer');

    for (let i = 0; i < enabledScenesList.length; i++) {
      const scene = enabledScenesList[i];
      const prompt = `${wizardData.globalAestheticPrompt}\n\n${scene.visualPrompt}\n\nCRITICAL: Do NOT add any text, captions, titles, subtitles, watermarks, or overlays on the image. The image must be completely clean with no written words.`;

      try {
        const result = await generateSingleSceneImage({
          prompt,
          aspectRatio: wizardData.aspectRatio,
          referenceImageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
          userId: cinematographer.user?.id || '',
        });

        if (result.success && result.imageUrl) {
          const duration = scene.narration
            ? Math.max(6, Math.min(20, Math.ceil(scene.narration.split(/\s+/).length / 2.5)))
            : 6;

          allFrames.push({
            id: `scene-${scene.sceneNumber}-${Date.now()}`,
            imageUrl: result.imageUrl,
            prompt: scene.visualPrompt,
            sceneNumber: scene.sceneNumber,
            batchNumber: Math.ceil((i + 1) / 4),
            narration: scene.narration,
            duration,
            motionPresetId: scene.motionPresetId,
            imageVersions: [result.imageUrl],
            currentVersionIndex: 0,
          });
        } else {
          failedCount++;
          console.error(`Scene ${scene.sceneNumber} failed:`, result.error);
        }
      } catch (err) {
        failedCount++;
        console.error(`Scene ${scene.sceneNumber} error:`, err);
      }

      setImageGenProgress({ current: i + 1, total: enabledScenesList.length });
    }

    setWizardData(prev => ({ ...prev, extractedFrames: [...prev.extractedFrames, ...allFrames] }));
    setIsGeneratingImages(false);

    if (failedCount === 0) {
      toast.success(`All ${enabledScenesList.length} scene images generated!`);
    } else {
      toast.warning(`${enabledScenesList.length - failedCount}/${enabledScenesList.length} scenes generated. ${failedCount} failed.`);
    }
  };

  // ===== Auto-start image generation when entering step 3 =====
  useEffect(() => {
    if (
      currentStep === 3 &&
      wizardData.scenes.length > 0 &&
      wizardData.extractedFrames.length === 0 &&
      !isGeneratingImages &&
      !autoGenTriggeredRef.current
    ) {
      autoGenTriggeredRef.current = true;
      handleGenerateAllImages();
    }
    // Reset the flag when leaving step 3 so it can trigger again on re-entry
    if (currentStep !== 3) {
      autoGenTriggeredRef.current = false;
    }
  }, [currentStep, wizardData.scenes.length, wizardData.extractedFrames.length, isGeneratingImages]);

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

  // ===== Regenerate a single frame (keeps version history) =====
  const [regeneratingFrameId, setRegeneratingFrameId] = useState<string | null>(null);

  const handleRegenerateFrame = async (frameId: string) => {
    const frame = wizardData.extractedFrames.find(f => f.id === frameId);
    if (!frame) return;

    if (!cinematographer.user?.id) {
      toast.error('Session expired — please refresh the page and log in again');
      return;
    }

    setRegeneratingFrameId(frameId);
    try {
      // Upload reference images if needed
      let uploadedImageUrls: string[] = [];
      if (wizardData.referenceImages.length > 0) {
        const { uploadReferenceImages } = await import('@/actions/tools/ai-cinematographer');
        const urls = await uploadReferenceImages(wizardData.referenceImages.map(img => img.file));
        uploadedImageUrls = urls.filter(Boolean) as string[];
      }

      const prompt = `${wizardData.globalAestheticPrompt}\n\n${frame.prompt}\n\nCRITICAL: Do NOT add any text, captions, titles, subtitles, watermarks, or overlays on the image. The image must be completely clean with no written words.`;

      const { generateSingleSceneImage } = await import('@/actions/tools/ai-cinematographer');
      const result = await generateSingleSceneImage({
        prompt,
        aspectRatio: wizardData.aspectRatio,
        referenceImageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
        userId: cinematographer.user?.id || '',
      });

      if (result.success && result.imageUrl) {
        // Add to version history
        const existingVersions = frame.imageVersions || [frame.imageUrl];
        const newVersions = [...existingVersions, result.imageUrl];
        const newIndex = newVersions.length - 1;

        handleUpdateFrame(frameId, {
          imageUrl: result.imageUrl,
          imageVersions: newVersions,
          currentVersionIndex: newIndex,
        });
        toast.success(`Frame #${frame.sceneNumber} regenerated (version ${newVersions.length})`);
      } else {
        toast.error(result.error || 'Failed to regenerate frame');
      }
    } catch {
      toast.error('Failed to regenerate frame');
    }
    setRegeneratingFrameId(null);
  };

  // ===== Step 4: Populate animation queue from extracted frames =====
  const populateAnimationQueue = () => {
    const shots = scenesToAnalyzerShots(wizardData.scenes);
    cinematographer.setAnalyzerShots(shots);

    const queueItems = wizardData.extractedFrames.map(frame => ({
      id: frame.id,
      frameNumber: frame.sceneNumber,
      imageUrl: frame.imageUrl,
      prompt: frame.prompt,
      dialogue: frame.narration,
      includeDialogue: false,
      duration: frame.duration,
      cameraStyle: 'stable' as const,
      camera_motion: frame.motionPresetId
        ? motionPresetToNativeCameraMotion(frame.motionPresetId)
        : undefined,
      aspectRatio: wizardData.aspectRatio,
      model: 'fast' as const,
      status: 'pending' as const,
      batchNumber: frame.batchNumber,
      sceneNumber: frame.sceneNumber,
    }));

    cinematographer.addToAnimationQueue(queueItems);
  };

  // ===== Step 5: Voice over handlers =====
  const handleVoiceGenerated = (audioUrl: string, duration?: number) => {
    setWizardData(prev => ({
      ...prev,
      voiceAudioUrl: audioUrl,
      voiceDuration: duration,
    }));
  };

  const handleVoiceSettingsChange = (voice?: string, speed?: number) => {
    setWizardData(prev => ({
      ...prev,
      selectedVoice: voice ?? prev.selectedVoice,
      voiceSpeed: speed ?? prev.voiceSpeed,
    }));
  };

  // ===== Check if any step is processing =====
  const isProcessing = isGeneratingImages || cinematographer.isProcessingQueue;

  return (
    <StandardToolPage
      icon={Wand2}
      title="AI Recreate"
      description="Recreate any video with your product — step by step"
      iconGradient="bg-primary"
      toolName="AI Recreate"
      tabs={
        <WizardStepper
          currentStep={currentStep}
          completedSteps={completedSteps}
          highestStepReached={highestStepReached}
          onStepClick={setCurrentStep}
        />
      }
    >
      <div className="flex flex-col h-full">
        {/* Step content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
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
              onRegenerateFrame={handleRegenerateFrame}
              regeneratingFrameId={regeneratingFrameId}
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
              narrationScript={wizardData.narrationScript}
              onVoiceGenerated={handleVoiceGenerated}
              onSettingsChange={handleVoiceSettingsChange}
              selectedVoice={wizardData.selectedVoice}
              voiceSpeed={wizardData.voiceSpeed}
              voiceAudioUrl={wizardData.voiceAudioUrl}
            />
          )}
        </div>

        {/* Navigation */}
        <WizardNavigation
          currentStep={currentStep}
          onPrevious={handlePrevious}
          onNext={handleNext}
          canGoNext={canGoNext()}
          isProcessing={isProcessing}
        />
      </div>
    </StandardToolPage>
  );
}
