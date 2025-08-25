'use client';

import React from 'react';
import { CheckCircle, Loader2, Video, User, Mic, LucideIcon, Clock, Zap, Download, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  avatarState: { 
    state: TalkingAvatarState;
    clearResults?: () => void;
  };
}

export function TalkingAvatarOutput({ avatarState }: TalkingAvatarOutputProps) {
  const { state, clearResults } = avatarState;
  const [showStep3Complete, setShowStep3Complete] = React.useState(false);
  
  // Watch for when generation starts to show brief checkmark
  React.useEffect(() => {
    if (state.isGenerating && !showStep3Complete) {
      setShowStep3Complete(true);
      // Show checkmark for 1 second then transition to video placeholder
      const timer = setTimeout(() => {
        setShowStep3Complete(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state.isGenerating, showStep3Complete]);
  
  // Check if we're in progress mode (any step > 1 or avatar selected)
  const isInProgress = state.currentStep > 1 || state.selectedAvatarTemplate || state.customAvatarImage;
  
  // Show completed video first if available (must have actual video URL, not empty placeholder)
  if (state.generatedVideo && state.generatedVideo.video_url && state.generatedVideo.video_url.trim() && !state.isGenerating && !state.isPolling) {
    const handleDownload = () => {
      if (state.generatedVideo) {
        const a = document.createElement('a');
        a.href = state.generatedVideo.video_url;
        a.download = `talking-avatar-${state.generatedVideo.id || Date.now()}.mp4`;
        a.click();
      }
    };

    const handleOpenInNewTab = () => {
      if (state.generatedVideo) {
        window.open(state.generatedVideo.video_url, '_blank');
      }
    };

    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl space-y-4">
            {/* Video Player */}
            <Card className="overflow-hidden">
              <div className="relative aspect-video bg-black">
                <video
                  src={state.generatedVideo.video_url}
                  className="w-full h-full object-contain"
                  controls
                  preload="metadata"
                  poster={state.generatedVideo.thumbnail_url}
                />
              </div>
            </Card>

            {/* Video Info */}
            <Card className="p-4">
              <div className="space-y-3">
                {/* Video Details */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium mb-1">Generated Talking Avatar</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {state.generatedVideo.script_text || 'Avatar video generated successfully'}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge variant="outline">
                      Avatar Video
                    </Badge>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenInNewTab}
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  {clearResults && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearResults}
                      className="flex-1"
                    >
                      Create New
                    </Button>
                  )}
                </div>

                {/* Metadata */}
                <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
                  <div className="flex justify-between">
                    <span>Video ID:</span>
                    <span className="font-mono">{state.generatedVideo.id.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Generated:</span>
                    <span>{new Date(state.generatedVideo.created_at).toLocaleString()}</span>
                  </div>
                  {state.generatedVideo.thumbnail_url && (
                    <div className="flex justify-between">
                      <span>Thumbnail:</span>
                      <span>Available</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  
  // If generating video or polling for completion, show placeholder card (EXACT AI cinematographer pattern)
  // But skip during the brief step 3 complete animation
  if ((state.isGenerating || state.isPolling) && state.generatedVideo && !showStep3Complete) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        {/* Solid subtle overlay for consistency with theme */}
        <div className="absolute inset-0 bg-secondary/20"></div>
        
        <div className="relative z-10 h-full flex flex-col">
          {/* State restored notification */}
          {state.isStateRestored && (
            <div className="pb-4">
              <Card className="p-3 bg-blue-500/10 border border-blue-500/30 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-blue-300 font-medium">
                    Video generation resumed - your avatar was still processing in the background
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* Show Avatar Video Placeholder - EXACT VideoPreview pattern */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-6">
            <div className="w-full max-w-2xl">
              <div className="space-y-4">
                {/* Video Player - EXACT match */}
                <Card className="overflow-hidden">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <Clock className="w-8 h-8 mx-auto text-muted-foreground" />
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Video processing...
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Video Info - EXACT match */}
                <Card className="p-4">
                  <div className="space-y-3">
                    {/* Video Details */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium mb-1">Generated Talking Avatar</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {state.generatedVideo.script_text}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Badge variant="outline">
                          Avatar Video
                        </Badge>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
                      <div className="flex justify-between">
                        <span>Video ID:</span>
                        <span className="font-mono text-xs">{state.generatedVideo.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Generated:</span>
                        <span>{new Date(state.generatedVideo.created_at).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span>
                          {state.isPolling 
                            ? 'Processing...'
                            : 'Generating video...'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
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
      if (state.currentStep === 2 && state.isLoading) {
        return 'Preparing voice in the background...';
      }
      if (state.currentStep === 3 && state.selectedVoiceId) {
        return 'Voice ready! Click generate to create your avatar video.';
      }
      return 'Continue setting up your talking avatar video.';
    };

    const getCurrentTitle = () => {
      if (state.currentStep === 2 && state.isLoading) {
        return 'Preparing Video';
      }
      if (state.currentStep === 2) {
        return 'Configure Voice';
      }
      if (state.currentStep === 3) {
        return 'Ready to Generate';
      }
      return 'Setup in Progress';
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
            isActive={state.currentStep === 2 && !state.isLoading}
            isLoading={state.isLoading && state.currentStep === 2}
          />
          
          <StepIndicator
            stepNumber={3}
            title="Generate Video"
            description="Create professional avatar video"
            icon={Video}
            isCompleted={showStep3Complete || !!state.generatedVideo}
            isActive={false}
            isLoading={state.isGenerating && !showStep3Complete}
          />
        </div>
      </div>
    );
  }

  // Duplicate check removed - video display is now at the top of the component

  // Default: Welcome state
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 mb-6 bg-primary rounded-2xl flex items-center justify-center">
        <Video className="w-8 h-8 text-white" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">Ready to Create</h3>
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