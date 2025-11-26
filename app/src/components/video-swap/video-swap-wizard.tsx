'use client';

import { useVideoSwap } from './hooks/use-video-swap';
import { UploadStep } from './ui/upload-step';
import { CharacterStep } from './ui/character-step';
import { SettingsStep } from './ui/settings-step';
import { ProcessingStep } from './ui/processing-step';
import { ResultStep } from './ui/result-step';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Upload, User, Settings, Loader2, CheckCircle } from 'lucide-react';

// Step configuration
const steps = [
  { id: 'upload', label: 'Upload Video', icon: Upload },
  { id: 'character', label: 'Choose Character', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'processing', label: 'Processing', icon: Loader2 },
  { id: 'result', label: 'Result', icon: CheckCircle },
] as const;

export function VideoSwapWizard() {
  const {
    currentStep,
    sourceVideo,
    sourceVideoPreview,
    characterImage,
    characterImagePreview,
    settings,
    currentJob,
    availableCredits,
    creditsRequired,
    isLoading,
    setSourceVideo,
    setCharacterImage,
    updateSettings,
    nextStep,
    prevStep,
    resetWizard,
    startVideoSwap,
    cancelJob,
  } = useVideoSwap();

  // Get current step index for progress indicator
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <Card className="mb-8">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;
              const isDisabled = index > currentStepIndex;

              return (
                <div key={step.id} className="flex items-center">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        isActive && "bg-primary text-primary-foreground",
                        isCompleted && "bg-green-500 text-white",
                        isDisabled && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className={cn("h-5 w-5", isActive && step.id === 'processing' && "animate-spin")} />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-1 hidden sm:block",
                        isActive && "text-primary font-medium",
                        isCompleted && "text-green-500",
                        isDisabled && "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "w-12 sm:w-20 h-0.5 mx-2",
                        index < currentStepIndex ? "bg-green-500" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="min-h-[500px]">
        {currentStep === 'upload' && (
          <UploadStep
            sourceVideo={sourceVideo}
            sourceVideoPreview={sourceVideoPreview}
            onVideoSelect={setSourceVideo}
            onNext={nextStep}
          />
        )}

        {currentStep === 'character' && (
          <CharacterStep
            characterImage={characterImage}
            characterImagePreview={characterImagePreview}
            onImageSelect={setCharacterImage}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {currentStep === 'settings' && (
          <SettingsStep
            settings={settings}
            onSettingsChange={updateSettings}
            availableCredits={availableCredits}
            creditsRequired={creditsRequired}
            onGenerate={startVideoSwap}
            onBack={prevStep}
            isLoading={isLoading}
          />
        )}

        {currentStep === 'processing' && (
          <ProcessingStep
            job={currentJob}
            onCancel={cancelJob}
          />
        )}

        {currentStep === 'result' && (
          <ResultStep
            job={currentJob}
            onCreateAnother={resetWizard}
          />
        )}
      </div>
    </div>
  );
}
