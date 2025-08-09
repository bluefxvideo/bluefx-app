'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Video, User, Mic, Upload, Play, Square, ArrowRight, ArrowLeft } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';
import { UseTalkingAvatarReturn } from '../hooks/use-talking-avatar';
import { AvatarTemplate } from '@/actions/tools/talking-avatar';

interface GeneratorTabProps {
  avatarState: UseTalkingAvatarReturn;
}

export function GeneratorTab({ avatarState }: GeneratorTabProps) {
  const {
    state,
    loadAvatarTemplates,
    handleAvatarSelection, 
    handleVoiceGeneration,
    handleVideoGeneration,
    goToStep,
    resetWizard,
    clearVoice,
  } = avatarState;

  const [localScriptText, setLocalScriptText] = useState(state.scriptText);
  const [selectedTemplate, setSelectedTemplate] = useState<AvatarTemplate | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [customImage, setCustomImage] = useState<File | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    loadAvatarTemplates();
  }, [loadAvatarTemplates]);

  // Update local state when wizard state changes
  useEffect(() => {
    setLocalScriptText(state.scriptText);
    setSelectedTemplate(state.selectedAvatarTemplate);
    setSelectedVoice(state.selectedVoiceId || '');
  }, [state.scriptText, state.selectedAvatarTemplate, state.selectedVoiceId]);

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomImage(file);
      setSelectedTemplate(null);
      // Update the main state and right panel with custom image
      await handleAvatarSelection(null, file);
    }
  };

  const handleVoicePlayback = (voiceId: string, sampleUrl: string) => {
    // If the same voice is playing, stop it
    if (playingVoiceId === voiceId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setPlayingVoiceId(null);
      return;
    }

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // Start new audio
    const audio = new Audio(sampleUrl);
    setCurrentAudio(audio);
    setPlayingVoiceId(voiceId);

    // Handle audio end
    audio.addEventListener('ended', () => {
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });

    // Handle audio error
    audio.addEventListener('error', () => {
      console.error('Audio playback failed for:', sampleUrl);
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });

    audio.play().catch((error) => {
      console.error('Audio playback failed:', error);
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });
  };

  const handleStepAction = async () => {
    if (state.currentStep === 1) {
      // Step 1: Avatar selection
      if (customImage) {
        await handleAvatarSelection(null, customImage);
      } else if (selectedTemplate) {
        await handleAvatarSelection(selectedTemplate);
      }
      if (!state.error) {
        goToStep(2);
      }
    } else if (state.currentStep === 2) {
      // Step 2: Voice generation or proceed to video
      if (!state.voiceAudioUrl) {
        // Generate voice and stay in Step 2 to show preview
        if (selectedVoice && localScriptText.trim()) {
          await handleVoiceGeneration(selectedVoice, localScriptText);
          // Stay in Step 2 to show voice preview - don&apos;t auto-advance
        }
      } else {
        // Voice already generated, proceed to Step 3 for video generation
        goToStep(3);
      }
    } else if (state.currentStep === 3) {
      // Step 3: Video generation
      await handleVideoGeneration();
    }
  };

  const canProceed = () => {
    if (state.currentStep === 1) {
      return selectedTemplate || customImage;
    } else if (state.currentStep === 2) {
      // If no voice generated yet, need voice selection + script text
      if (!state.voiceAudioUrl) {
        return selectedVoice && localScriptText.trim();
      }
      // If voice already generated, can proceed to video step
      return true;
    } else if (state.currentStep === 3) {
      return true;
    }
    return false;
  };

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={Video}
        title="Talking Avatar Generator"
        description="Create AI-powered talking avatar videos"
      />

      {/* Form Content */}
      <TabBody>
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-medium">Step {state.currentStep} of {state.totalSteps}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={resetWizard}
              className="text-xs"
            >
              Start Over
            </Button>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(state.currentStep / state.totalSteps) * 100}%` }}
            />
          </div>
        </div>
        {/* Step 1: Avatar Selection */}
        {state.currentStep === 1 && (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-2 block">Choose Your Avatar</Label>
            </div>
            
            {/* Avatar Templates Grid */}
            <div className="grid grid-cols-2 gap-2">
                {state.avatarTemplates.map((template: AvatarTemplate) => (
                  <Card
                    key={template.id}
                    className={`p-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] bg-white dark:bg-gray-800/40 ${
                      selectedTemplate?.id === template.id 
                        ? 'ring-2 ring-blue-500 bg-blue-100/10 shadow-lg scale-[1.02]' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={async () => {
                      setSelectedTemplate(template);
                      setCustomImage(null);
                      // Update the main state and right panel
                      await handleAvatarSelection(template);
                    }}
                  >
                    <div className="relative aspect-square bg-muted rounded-lg mb-1 flex items-center justify-center overflow-hidden">
                      {template.thumbnail_url ? (
                        <Image 
                          src={template.thumbnail_url} 
                          alt={template.name}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            console.log('Image failed to load:', template.thumbnail_url);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <User className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-center truncate">
                      {template.name}
                    </p>
                    <p className="text-xs text-muted-foreground text-center truncate">
                      {template.category} • {template.gender}
                    </p>
                  </Card>
                ))}
            </div>

            {/* Custom Upload Option */}
            <div className={`border-2 border-dashed rounded-lg p-3 transition-all duration-200 ${
              customImage 
                ? 'border-blue-500 bg-blue-100/10' 
                : 'border-muted hover:border-blue-300'
            }`}>
              <div className="text-center">
                <Upload className={`w-5 h-5 mx-auto mb-1 ${
                  customImage ? 'text-blue-600' : 'text-muted-foreground'
                }`} />
                <p className="text-xs font-medium mb-1">Upload Custom Avatar</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomImageUpload}
                  className="hidden"
                  id="custom-avatar-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className={`text-xs ${customImage 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'hover:border-blue-300'
                  }`}
                >
                  <label htmlFor="custom-avatar-upload" className="cursor-pointer">
                    {customImage ? (
                      <span>
                        {customImage.name.length > 15 
                          ? customImage.name.substring(0, 15) + '...' 
                          : customImage.name
                        }
                      </span>
                    ) : (
                      'Choose File'
                    )}
                  </label>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Voice & Script */}
        {state.currentStep === 2 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Script Text</Label>
              <Textarea
                value={localScriptText}
                onChange={(e) => setLocalScriptText(e.target.value)}
                placeholder="Enter the text you want your avatar to speak..."
                className="min-h-[100px] resize-none"
                disabled={state.isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Word count: {localScriptText.trim().split(/\s+/).filter(Boolean).length} words
              </p>
            </div>

            <div className="space-y-2">
              <Label>Voice Selection</Label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { 
                    id: 'alloy', 
                    name: 'Alloy', 
                    description: 'Natural female voice',
                    sampleUrl: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_01.mp3'
                  },
                  { 
                    id: 'nova', 
                    name: 'Nova', 
                    description: 'Warm female voice',
                    sampleUrl: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_2.mp3'
                  },
                  { 
                    id: 'shimmer', 
                    name: 'Shimmer', 
                    description: 'Bright female voice',
                    sampleUrl: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_3.mp3'
                  },
                  { 
                    id: 'echo', 
                    name: 'Echo', 
                    description: 'Deep male voice',
                    sampleUrl: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/male_1.mp3'
                  },
                  { 
                    id: 'onyx', 
                    name: 'Onyx', 
                    description: 'Professional male voice',
                    sampleUrl: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/male_2.mp3'
                  },
                  { 
                    id: 'fable', 
                    name: 'Fable', 
                    description: 'Neutral storytelling voice',
                    sampleUrl: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/neutral_1.mp3'
                  }
                ].map((voice) => (
                  <Card
                    key={voice.id}
                    className={`p-3 cursor-pointer transition-all duration-200 hover:shadow-md bg-white dark:bg-gray-800/40 ${
                      selectedVoice === voice.id 
                        ? 'ring-2 ring-purple-500 bg-blue-100/10 shadow-lg' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedVoice(voice.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{voice.name}</p>
                        <p className="text-xs text-muted-foreground">{voice.description}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVoicePlayback(voice.id, voice.sampleUrl);
                        }}
                      >
                        {playingVoiceId === voice.id ? (
                          <Square className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Step 3: Video Generation */}
        {state.currentStep === 3 && (
          <div className="space-y-3">
            {/* Voice Preview in Step 3 */}
            {state.voiceAudioUrl && (
              <Card className="p-4 bg-white dark:bg-gray-800/40">
                <h3 className="font-semibold mb-3">Generated Voice</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Voice: {selectedVoice}</p>
                      <p className="text-xs text-muted-foreground">Ready for video generation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <audio controls className="flex-1">
                      <source src={state.voiceAudioUrl} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearVoice();
                        setSelectedVoice('');
                        goToStep(2); // Go back to Step 2 to regenerate
                      }}
                      className="text-xs"
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-4 bg-white dark:bg-gray-800/40">
              <h3 className="font-semibold mb-3">Generation Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Avatar:</span>
                  <span className="text-muted-foreground">
                    {state.selectedAvatarTemplate?.name || 'Custom Upload'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Script Length:</span>
                  <span className="text-muted-foreground">
                    {localScriptText.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
              </div>
            </Card>

            {state.generatedVideo && (
              <Card className="p-4 bg-white dark:bg-gray-800/40">
                <h3 className="font-semibold mb-2">Video Generated!</h3>
                <p className="text-sm text-muted-foreground">
                  Your talking avatar video has been submitted for processing. 
                  Check the History tab for updates.
                </p>
              </Card>
            )}
          </div>
        )}

        {state.error && (
          <Card className="p-4 border-destructive">
            <p className="text-sm text-destructive">{state.error}</p>
          </Card>
        )}
      </TabBody>

      {/* Footer Button - Outside scrollable area */}
      <div className="mt-6">
        <div className="flex gap-2">
          {state.currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => goToStep(state.currentStep - 1)}
              disabled={state.isLoading || state.isGenerating}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          
          <Button
            onClick={handleStepAction}
            disabled={!canProceed() || state.isLoading || state.isGenerating}
            className={`${state.currentStep === 1 ? 'w-full' : 'flex-1'} h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium`}
            size="lg"
          >
            <Video className="w-4 h-4 mr-2" />
            {state.isLoading || state.isGenerating ? (
              state.currentStep === 3 ? 'Generating Video...' : 'Processing...'
            ) : (
              state.currentStep === 3 ? 'Generate Video' : 
              state.currentStep === 2 ? (state.voiceAudioUrl ? 'Prepare Video' : 'Prepare Voice') : 'Select Avatar'
            )}
            {state.currentStep < 3 && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </TabContentWrapper>
  );
}