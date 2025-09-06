'use client';

import React from 'react';
import { CheckCircle, Loader2, Video, User, Mic, LucideIcon, Zap } from 'lucide-react';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TalkingAvatarState } from '../hooks/use-talking-avatar';
import { AvatarExample } from './avatar-example';
import { AvatarVideoPreview } from './avatar-video-preview';

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
    resetWizard?: () => void;
  };
}

export function TalkingAvatarOutput({ avatarState }: TalkingAvatarOutputProps) {
  const { state, clearResults, resetWizard } = avatarState;
  
  // Debug logging to help troubleshoot
  console.log('🎬 TalkingAvatarOutput render:', {
    isGenerating: state.isGenerating,
    hasGeneratedVideo: !!state.generatedVideo,
    videoUrl: state.generatedVideo?.video_url,
    isStateRestored: state.isStateRestored,
    currentStep: state.currentStep
  });
  
  // Check if we're in progress mode (any step > 1 or avatar selected)
  const isInProgress = state.currentStep > 1 || state.selectedAvatarTemplate || state.customAvatarImage;
  
  // Show completed video first if available (must have actual video URL, not empty placeholder)
  if (state.generatedVideo && state.generatedVideo.video_url && state.generatedVideo.video_url.trim() && !state.isGenerating) {
    const handleDownload = async () => {
      if (!state.generatedVideo?.video_url) return;
      
      try {
        // Fetch the video blob
        const response = await fetch(state.generatedVideo.video_url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        // Create blob URL and download
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `talking-avatar-${state.generatedVideo.id || Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up blob URL
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download failed:', error);
        // Fallback to opening in new tab
        window.open(state.generatedVideo.video_url, '_blank');
      }
    };

    const handleOpenInNewTab = () => {
      if (state.generatedVideo) {
        window.open(state.generatedVideo.video_url, '_blank');
      }
    };

    return (
      <div className="h-full flex items-center justify-center overflow-auto">
        <div className="w-full max-w-4xl">
          <AvatarVideoPreview
            video={state.generatedVideo}
            onDownload={handleDownload}
            onOpenInNewTab={handleOpenInNewTab}
            onCreateNew={resetWizard}
          />
        </div>
      </div>
    );
  }
  
  // If generating video, show processing state using the same AvatarVideoPreview component
  // Show this for both initial generation AND resumed generation
  if ((state.isGenerating || (state.isStateRestored && state.generatedVideo)) && state.generatedVideo) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        {/* State restored notification */}
        {state.isStateRestored && (
          <div className="p-4">
            <Card className="p-3 ">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-300 font-medium">
                  Video generation resumed - your avatar was still processing in the background
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* Unified Avatar Video Preview - same component for processing and completed */}
        <div className="flex-1 flex items-center justify-center overflow-auto">
          <div className="w-full max-w-4xl">
            <AvatarVideoPreview
              video={state.generatedVideo}
              onDownload={undefined} // No download during processing
              onOpenInNewTab={undefined} // No open during processing
              onCreateNew={undefined} // No create new during processing
            />
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
        return 'Preparing Voice';
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
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-8">
            <UnifiedEmptyState
              icon={Video}
              title={getCurrentTitle()}
              description={getCurrentMessage()}
            />
            
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
                title={!!(state.selectedVoiceId && state.voiceAudioUrl) ? "Prepared Voice" : "Add Voice"}
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
                isCompleted={!!state.generatedVideo && !!state.generatedVideo.video_url}
                isActive={false}
                isLoading={state.isGenerating}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Duplicate check removed - video display is now at the top of the component

  // Default: Welcome state with example
  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full">
            <AvatarExample />
          </div>
        </div>
      </div>
    </div>
  );
}