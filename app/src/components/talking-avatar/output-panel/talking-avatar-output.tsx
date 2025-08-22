'use client';

import { CheckCircle, Loader2, Video, User, Mic } from 'lucide-react';
import { TalkingAvatarState } from '../hooks/use-talking-avatar';

interface TalkingAvatarOutputProps {
  avatarState: { state: TalkingAvatarState };
}

export function TalkingAvatarOutput({ avatarState }: TalkingAvatarOutputProps) {
  const { state } = avatarState;
  
  // Check if we're in progress mode (any step > 1 or avatar selected)
  const isInProgress = state.currentStep > 1 || state.selectedAvatarTemplate || state.customAvatarImage;
  
  // If generating video, show the same progress UI but with generating state for step 3
  if (state.isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        
        <h3 className="text-2xl font-bold mb-2">Generating Video ✨</h3>
        <p className="text-base text-muted-foreground mb-8 max-w-md">
          Creating your AI-powered talking avatar video...
        </p>

        {/* Progress steps with step 3 active */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-green-500 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-lg font-bold text-green-400 mb-1">1</div>
            <p className="text-sm font-medium text-green-300">Choose Avatar</p>
            <p className="text-xs text-green-400/70">Select template or upload custom</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-green-500 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-lg font-bold text-green-400 mb-1">2</div>
            <p className="text-sm font-medium text-green-300">Add Voice</p>
            <p className="text-xs text-green-400/70">Enter script and select voice</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <div className="text-lg font-bold text-blue-500 mb-1">3</div>
            <p className="text-sm font-medium text-white">Generate Video</p>
            <p className="text-xs text-zinc-300">Create professional avatar video</p>
          </div>
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

    const steps = [
      {
        number: 1,
        title: 'Choose Avatar',
        description: 'Select template or upload custom',
        icon: User,
        complete: !!(state.selectedAvatarTemplate || state.customAvatarImage),
        active: false
      },
      {
        number: 2,
        title: 'Add Voice',
        description: 'Enter script and select voice',
        icon: Mic,
        complete: !!(state.selectedVoiceId && state.voiceAudioUrl),
        active: state.currentStep === 2
      },
      {
        number: 3,
        title: 'Generate Video',
        description: 'Create professional avatar video',
        icon: Video,
        complete: false,
        active: state.currentStep === 3
      }
    ];

    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
          <Video className="w-8 h-8 text-white" />
        </div>
        
        <h3 className="text-2xl font-bold mb-2">{getCurrentTitle()}</h3>
        <p className="text-base text-muted-foreground mb-8 max-w-md">
          {getCurrentMessage()}
        </p>

        {/* Same 3-column grid as Script-to-Video with progress states */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="text-center">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center ${
                  step.active ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                  step.complete ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500 opacity-50'
                }`}>
                  {step.active ? (
                    <Icon className="w-6 h-6 text-white" />
                  ) : step.complete ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Icon className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className={`text-lg font-bold mb-1 ${
                  step.active ? 'text-blue-500' :
                  step.complete ? 'text-green-400' : 'text-blue-500 opacity-50'
                }`}>
                  {step.number}
                </div>
                <p className={`text-sm font-medium ${
                  step.active ? 'text-white' :
                  step.complete ? 'text-green-300' : 'text-zinc-400'
                }`}>
                  {step.title}
                </p>
                <p className={`text-xs ${
                  step.active ? 'text-zinc-300' :
                  step.complete ? 'text-green-400/70' : 'text-muted-foreground'
                }`}>
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: Welcome state
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center">
        <Video className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Ready to Create Magic ✨</h3>
      <p className="text-base text-muted-foreground mb-8 max-w-md">
        Transform text into engaging videos with AI-powered talking avatars in 3 simple steps.
      </p>

      <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">1</div>
          <p className="text-sm font-medium">Choose Avatar</p>
          <p className="text-xs text-muted-foreground">Select template or upload custom</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">2</div>
          <p className="text-sm font-medium">Add Voice</p>
          <p className="text-xs text-muted-foreground">Enter script and select voice</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div className="text-lg font-bold text-blue-500 mb-1">3</div>
          <p className="text-sm font-medium">Generate Video</p>
          <p className="text-xs text-muted-foreground">Create professional avatar video</p>
        </div>
      </div>
    </div>
  );
}