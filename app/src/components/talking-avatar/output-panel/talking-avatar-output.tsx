'use client';

import { CheckCircle, Loader2, Video, User, Mic, LucideIcon } from 'lucide-react';
import { TalkingAvatarState } from '../hooks/use-talking-avatar';

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

interface TalkingAvatarOutputProps {
  avatarState: { state: TalkingAvatarState };
}

export function TalkingAvatarOutput({ avatarState }: TalkingAvatarOutputProps) {
  const { state } = avatarState;
  
  // Check if we're in progress mode (any step > 1 or avatar selected)
  const isInProgress = state.currentStep > 1 || state.selectedAvatarTemplate || state.customAvatarImage;
  
  // If generating video, show progress with step 3 in loading state
  if (state.isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 mb-6 bg-primary rounded-2xl flex items-center justify-center">
          <Video className="w-8 h-8 text-white" />
        </div>
        
        <h3 className="text-2xl font-bold mb-2">Creating Magic ✨</h3>
        <p className="text-base text-muted-foreground mb-8 max-w-md">
          AI is generating your talking avatar video in 3 simple steps.
        </p>

        <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
          <StepIndicator
            stepNumber={1}
            title="Choose Avatar"
            description="Select template or upload custom"
            icon={User}
            isCompleted={true}
            isActive={false}
            isLoading={false}
          />
          
          <StepIndicator
            stepNumber={2}
            title="Add Voice"
            description="Enter script and select voice"
            icon={Mic}
            isCompleted={true}
            isActive={false}
            isLoading={false}
          />
          
          <StepIndicator
            stepNumber={3}
            title="Generate Video"
            description="Create professional avatar video"
            icon={Video}
            isCompleted={false}
            isActive={true}
            isLoading={true}
          />
        </div>
      </div>
    );
  }

  // If in progress but not generating, show progress state
  if (isInProgress) {
    const getCurrentMessage = () => {
      if (state.currentStep === 2 && state.selectedAvatarTemplate) {
        return 'Avatar selected! Add your script and choose a voice.';
      }
      if (state.currentStep === 3 && state.selectedVoiceId) {
        return 'Voice ready! Click generate to create your avatar video.';
      }
      return 'Continue setting up your talking avatar video.';
    };

    const getCurrentTitle = () => {
      if (state.currentStep === 2) {
        return 'Configure Voice ✨';
      }
      if (state.currentStep === 3) {
        return 'Ready to Generate ✨';
      }
      return 'Setup in Progress ✨';
    };

    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 mb-6 bg-primary rounded-2xl flex items-center justify-center">
          <Video className="w-8 h-8 text-white" />
        </div>
        
        <h3 className="text-2xl font-bold mb-2">{getCurrentTitle()}</h3>
        <p className="text-base text-muted-foreground mb-8 max-w-md">
          {getCurrentMessage()}
        </p>

        <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
          <StepIndicator
            stepNumber={1}
            title="Choose Avatar"
            description="Select template or upload custom"
            icon={User}
            isCompleted={!!(state.selectedAvatarTemplate || state.customAvatarImage)}
            isActive={state.currentStep === 1}
            isLoading={state.isLoading && state.currentStep === 1}
          />
          
          <StepIndicator
            stepNumber={2}
            title="Add Voice"
            description="Enter script and select voice"
            icon={Mic}
            isCompleted={!!(state.selectedVoiceId && state.voiceAudioUrl)}
            isActive={state.currentStep === 2}
            isLoading={state.isLoading && state.currentStep === 2}
          />
          
          <StepIndicator
            stepNumber={3}
            title="Generate Video"
            description="Create professional avatar video"
            icon={Video}
            isCompleted={false}
            isActive={state.currentStep === 3}
            isLoading={state.isLoading && state.currentStep === 3}
          />
        </div>
      </div>
    );
  }

  // Default: Welcome state
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-primary rounded-2xl flex items-center justify-center">
        <Video className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        Transform text into engaging videos with AI-powered talking avatars in 3 simple steps.
      </p>

      <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
        <StepIndicator
          stepNumber={1}
          title="Choose Avatar"
          description="Select template or upload custom"
          icon={User}
          isCompleted={false}
          isActive={state.currentStep === 1}
          isLoading={false}
        />
        
        <StepIndicator
          stepNumber={2}
          title="Add Voice"
          description="Enter script and select voice"
          icon={Mic}
          isCompleted={false}
          isActive={false}
          isLoading={false}
        />
        
        <StepIndicator
          stepNumber={3}
          title="Generate Video"
          description="Create professional avatar video"
          icon={Video}
          isCompleted={false}
          isActive={false}
          isLoading={false}
        />
      </div>
    </div>
  );
}