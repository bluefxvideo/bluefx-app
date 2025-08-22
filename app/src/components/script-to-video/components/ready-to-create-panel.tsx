'use client';

import { FileText, Mic, Video, CheckCircle, LucideIcon, Clapperboard, Sparkles, Zap, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface StepIndicatorProps {
  stepNumber: number;
  title: string;
  description: string;
  icon: LucideIcon;
  isCompleted: boolean;
  isActive: boolean;
  isLoading?: boolean;
}

function StepIndicator({ stepNumber, title, description, icon: Icon, isCompleted, isActive, isLoading }: StepIndicatorProps) {
  return (
    <div className="text-center">
      <div className={`w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center ${
        isCompleted 
          ? 'bg-primary' 
          : isActive 
            ? 'bg-primary' 
            : 'bg-muted border-2 border-muted-foreground/20'
      }`}>
        {isCompleted ? (
          <CheckCircle className="w-6 h-6 text-white" />
        ) : isLoading ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : (
          <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
        )}
      </div>
      <div className={`text-lg font-bold mb-1 ${
        isCompleted 
          ? 'text-primary' 
          : isActive 
            ? 'text-primary' 
            : 'text-muted-foreground'
      }`}>
        {stepNumber}
      </div>
      <p className={`text-sm font-medium ${isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
        {title}
      </p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

interface ReadyToCreatePanelProps {
  currentStep?: number;
  scriptGenerated?: boolean;
  voiceSelected?: boolean;
  isGeneratingVideo?: boolean;
  showOrchestrationProgress?: boolean;
  videoGenerated?: boolean;
  isGeneratingScript?: boolean;
}

/**
 * Ready to Create Panel - Welcome state for Script-to-Video
 * Shows dynamic step completion based on current progress
 */
export function ReadyToCreatePanel({ 
  currentStep = 1, 
  scriptGenerated = false, 
  voiceSelected = false,
  isGeneratingVideo = false,
  showOrchestrationProgress = false,
  videoGenerated = false,
  isGeneratingScript = false
}: ReadyToCreatePanelProps) {
  const [step3Completed, setStep3Completed] = useState(false);
  const [hideSteps, setHideSteps] = useState(false);

  // Debug logging to see what props we're receiving
  console.log('🔍 ReadyToCreatePanel props:', {
    currentStep,
    scriptGenerated,
    voiceSelected,
    isGeneratingVideo,
    videoGenerated,
    step3Completed
  });
  
  // Handle step 3 completion and transition to orchestration
  useEffect(() => {
    if (isGeneratingVideo) {
      // Don't mark as completed while still generating
      setStep3Completed(false);
      
      // After 2 seconds, hide the steps to show orchestration progress
      setTimeout(() => {
        setHideSteps(true);
      }, 2000);
    }
  }, [isGeneratingVideo]);

  // Handle video generation completion
  useEffect(() => {
    if (videoGenerated) {
      // Mark step 3 as completed when video is done
      setStep3Completed(true);
      setHideSteps(false); // Show the steps with checkmark
    }
  }, [videoGenerated]);

  // Reset states when starting fresh
  useEffect(() => {
    if (!isGeneratingVideo && !videoGenerated) {
      setStep3Completed(false);
      setHideSteps(false);
    }
  }, [isGeneratingVideo, videoGenerated]);

  // Show orchestration progress
  if (showOrchestrationProgress || (isGeneratingVideo && hideSteps)) {
    return <OrchestrationProgress />;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-primary rounded-2xl flex items-center justify-center">
        <Video className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        Transform scripts into engaging videos with AI orchestration in 3 simple steps.
      </p>

      <div className={`grid grid-cols-3 gap-6 w-full max-w-lg transition-all duration-500 ${hideSteps ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <StepIndicator
          stepNumber={1}
          title="Create Script"
          description="Generate from idea or write your own"
          icon={FileText}
          isCompleted={scriptGenerated}
          isActive={currentStep === 1}
          isLoading={isGeneratingScript && currentStep === 1}
        />
        
        <StepIndicator
          stepNumber={2}
          title="Choose Voice"
          description="Select AI voice and speaking style"
          icon={Mic}
          isCompleted={voiceSelected}
          isActive={currentStep === 2}
          isLoading={false}
        />
        
        <StepIndicator
          stepNumber={3}
          title="Generate Assets"
          description="AI creates images and assembles video"
          icon={Video}
          isCompleted={step3Completed}
          isActive={currentStep === 3}
          isLoading={isGeneratingVideo && currentStep === 3 && !step3Completed}
        />
      </div>
    </div>
  );
}

// Simple orchestration progress component
function OrchestrationProgress() {
  const [currentPhase, setCurrentPhase] = useState(0);
  
  const phases = [
    { icon: Sparkles, title: "Analyzing Script", description: "AI is understanding your content..." },
    { icon: Mic, title: "Generating Voice", description: "Creating natural speech audio..." },
    { icon: Clapperboard, title: "Creating Visuals", description: "Generating images and scenes..." },
    { icon: Video, title: "Assembling Video", description: "Putting everything together..." }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhase(prev => (prev + 1) % phases.length);
    }, 3000); // Change phase every 3 seconds

    return () => clearInterval(interval);
  }, [phases.length]);

  const currentPhaseData = phases[currentPhase];
  const Icon = currentPhaseData.icon;

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 mb-6 bg-primary rounded-2xl flex items-center justify-center animate-pulse">
        <Icon className="w-10 h-10 text-white animate-bounce" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">{currentPhaseData.title}</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        {currentPhaseData.description}
      </p>

      {/* Progress indicator */}
      <div className="flex gap-2 mb-4">
        {phases.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index <= currentPhase ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      
      <p className="text-sm text-muted-foreground">
        This may take 1-2 minutes...
      </p>
    </div>
  );
}