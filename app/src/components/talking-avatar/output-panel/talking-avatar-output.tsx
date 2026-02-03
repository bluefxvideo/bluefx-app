'use client';

import React from 'react';
import { CheckCircle, Loader2, Video, User, Mic, LucideIcon, Zap } from 'lucide-react';
import { UnifiedEmptyState } from '@/components/tools/unified-empty-state';
import { Card } from '@/components/ui/card';
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
  const { state, resetWizard } = avatarState;
  
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

  // If in progress but not generating, show progress state with avatar preview
  if (isInProgress) {
    const avatarImageUrl = state.selectedAvatarTemplate?.thumbnail_url || state.customAvatarUrl;
    const avatarPreviewVideoUrl = state.selectedAvatarTemplate?.preview_video_url;

    const getCurrentMessage = () => {
      if (state.currentStep === 2 && state.isLoading) {
        return 'Generating your voice...';
      }
      if (state.currentStep === 2) {
        return state.audioInputMode === 'upload'
          ? 'Upload your audio file.'
          : 'Write your script and choose a voice.';
      }
      if (state.currentStep === 3) {
        return 'Preview your voice and generate the video.';
      }
      return 'Continue setting up your talking avatar video.';
    };

    const getCurrentTitle = () => {
      if (state.currentStep === 2 && state.isLoading) {
        return 'Generating Voice';
      }
      if (state.currentStep === 2) {
        return 'Script & Voice';
      }
      if (state.currentStep === 3) {
        return 'Preview & Generate';
      }
      return 'Setup in Progress';
    };

    return (
      <div className="h-full flex flex-col">
        {/* Large Avatar Preview — fills most of the right panel */}
        {avatarImageUrl && (
          <div className="flex-1 flex items-center justify-center p-6 min-h-0">
            <div className="relative w-full max-w-lg aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
              {avatarPreviewVideoUrl ? (
                <video
                  src={avatarPreviewVideoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={avatarImageUrl}
                  alt={state.selectedAvatarTemplate?.name || 'Custom avatar'}
                  className="w-full h-full object-cover"
                />
              )}
              {state.selectedAvatarTemplate && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white font-medium text-lg">{state.selectedAvatarTemplate.name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Compact progress bar at bottom */}
        <div className="shrink-0 px-6 pb-6 pt-2">
          {!avatarImageUrl && (
            <div className="text-center mb-4">
              <UnifiedEmptyState
                icon={Video}
                title={getCurrentTitle()}
                description={getCurrentMessage()}
              />
            </div>
          )}
          {avatarImageUrl && (
            <p className="text-center text-sm text-muted-foreground mb-3">
              {getCurrentMessage()}
            </p>
          )}
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <StepIndicator
              stepNumber={1}
              title="Avatar"
              description="Select or upload"
              icon={User}
              isCompleted={!!(state.selectedAvatarTemplate || state.customAvatarImage)}
              isActive={state.currentStep === 1}
              isLoading={state.isLoading && state.currentStep === 1}
            />

            <StepIndicator
              stepNumber={2}
              title="Script & Voice"
              description="Write and choose"
              icon={Mic}
              isCompleted={!!(state.voiceAudioUrl || (state.uploadedAudioUrl && state.currentStep > 2))}
              isActive={state.currentStep === 2 && !state.isLoading}
              isLoading={state.isLoading && state.currentStep === 2}
            />

            <StepIndicator
              stepNumber={3}
              title="Generate"
              description="Preview and create"
              icon={Video}
              isCompleted={false}
              isActive={state.currentStep === 3 && !state.isLoading}
              isLoading={state.isLoading && state.currentStep === 3}
            />
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