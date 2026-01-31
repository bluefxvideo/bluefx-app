'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, User, Mic, Play, Square, ArrowRight, ArrowLeft, Monitor, Smartphone } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';
import { UseTalkingAvatarReturn } from '../hooks/use-talking-avatar';
import { AvatarTemplate } from '@/actions/tools/talking-avatar';
import { MINIMAX_VOICE_OPTIONS, DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '@/components/shared/voice-constants';

interface GeneratorTabProps {
  avatarState: UseTalkingAvatarReturn;
  credits: number;
}

export function GeneratorTab({ avatarState, credits }: GeneratorTabProps) {
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
  const [selectedVoice, setSelectedVoice] = useState<string>('Friendly_Person');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [customImage, setCustomImage] = useState<File | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');

  // Load templates on mount
  useEffect(() => {
    loadAvatarTemplates();
  }, [loadAvatarTemplates]);

  // Check for prefilled script from Script Generator
  useEffect(() => {
    const prefillScript = localStorage.getItem('prefill_script');
    if (prefillScript) {
      setLocalScriptText(prefillScript);
      localStorage.removeItem('prefill_script'); // Clear after use
    }
  }, []);

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
      // Step 2: Auto-prepare voice and proceed to video generation
      if (selectedVoice && localScriptText.trim()) {
        try {
          let voiceGenerated = false;
          
          // First generate voice if not already generated
          if (!state.voiceAudioUrl) {
            const result = await handleVoiceGeneration(selectedVoice, localScriptText);
            voiceGenerated = result.success;
          } else {
            voiceGenerated = true;
          }
          
          // Only proceed to Step 3 if voice generation was successful
          if (voiceGenerated && !state.error) {
            goToStep(3);
          }
        } catch (error) {
          console.error('Voice generation failed:', error);
        }
      }
    } else if (state.currentStep === 3) {
      // Step 3: Video generation - verify we have voice URL
      if (!state.voiceAudioUrl) {
        console.error('Cannot generate video: Voice audio URL is missing');
        return;
      }
      await handleVideoGeneration(aspectRatio);
    }
  };

  // Calculate estimated credits based on video length (matches backend formula)
  // 1.0 credits per second, ~2.5 words per second, minimum 10 credits
  const wordCount = localScriptText ? localScriptText.trim().split(/\s+/).filter(w => w).length : 0;
  const estimatedDuration = Math.ceil(wordCount / 2.5);
  const estimatedCredits = Math.max(10, Math.ceil(estimatedDuration * 1.0));

  const canProceed = () => {
    if (state.currentStep === 1) {
      return selectedTemplate || customImage;
    } else if (state.currentStep === 2) {
      // Need voice selection + script text (voice will be generated automatically)
      return selectedVoice && localScriptText.trim();
    } else if (state.currentStep === 3) {
      // For video generation, we need to have the voice audio URL ready AND sufficient credits
      return state.voiceAudioUrl && !state.isLoading && credits >= estimatedCredits;
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
                    className={`p-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
                      selectedTemplate?.id === template.id 
                        ? 'ring-2 ring-blue-500'
                        : 'bg-card hover:bg-muted/50'
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
                          priority={false}
                          quality={75}
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                          className="object-cover transition-opacity duration-300"
                          onLoad={() => console.log(`Avatar template ${template.name} loaded`)}
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
            <UnifiedDragDrop
              fileType="avatar"
              selectedFile={customImage}
              onFileSelect={(file) => {
                setCustomImage(file);
                setSelectedTemplate(null);
                // Update the main state and right panel with custom image
                handleAvatarSelection(null, file);
              }}
              disabled={state.isLoading}
              previewSize="medium"
              title="Drop custom avatar or click to upload"
              description="Use your own image as avatar"
            />
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
              <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
                {MINIMAX_VOICE_OPTIONS.map((voice) => (
                  <Card
                    key={voice.id}
                    className={`p-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedVoice === voice.id
                        ? 'ring-2 ring-purple-500'
                        : 'bg-card hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedVoice(voice.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{voice.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {voice.gender}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{voice.description}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVoicePlayback(voice.id, voice.preview_url);
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

            {/* Voice Settings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Voice Settings</Label>
              
              <div className="grid grid-cols-1 gap-4">
                {/* Speed Control */}
                <div className="space-y-2">
                  <Label className="text-xs">Speed: {voiceSettings.speed}x</Label>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.25}
                    value={voiceSettings.speed}
                    onChange={(e) => {
                      const speed = parseFloat(e.target.value);
                      setVoiceSettings(prev => ({ ...prev, speed }));
                    }}
                    disabled={state.isGenerating}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.5x</span>
                    <span>Normal</span>
                    <span>2.0x</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Step 3: Video Generation */}
        {state.currentStep === 3 && (
          <div className="space-y-3">
            {/* Video Format Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Choose Video Format</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Landscape 16:9 */}
                <Card 
                  className={`p-4 cursor-pointer transition-all duration-300 ${
                    aspectRatio === '16:9'
                      ? 'border-primary bg-primary/10 shadow-lg' 
                      : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-secondary/50'
                  }`}
                  onClick={() => setAspectRatio('16:9')}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-8 rounded border-2 flex items-center justify-center ${
                      aspectRatio === '16:9'
                        ? 'border-primary bg-primary/20' 
                        : 'border-muted-foreground/40'
                    }`}>
                      <Monitor className={`w-4 h-4 ${
                        aspectRatio === '16:9' ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-medium ${
                        aspectRatio === '16:9' ? 'text-primary' : 'text-foreground'
                      }`}>
                        Landscape
                      </p>
                      <p className="text-xs text-muted-foreground">16:9 • YouTube</p>
                    </div>
                  </div>
                </Card>

                {/* Portrait 9:16 */}
                <Card 
                  className={`p-4 cursor-pointer transition-all duration-300 ${
                    aspectRatio === '9:16'
                      ? 'border-primary bg-primary/10 shadow-lg' 
                      : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-secondary/50'
                  }`}
                  onClick={() => setAspectRatio('9:16')}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-8 h-12 rounded border-2 flex items-center justify-center ${
                      aspectRatio === '9:16'
                        ? 'border-primary bg-primary/20' 
                        : 'border-muted-foreground/40'
                    }`}>
                      <Smartphone className={`w-4 h-4 ${
                        aspectRatio === '9:16' ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-medium ${
                        aspectRatio === '9:16' ? 'text-primary' : 'text-foreground'
                      }`}>
                        Portrait
                      </p>
                      <p className="text-xs text-muted-foreground">9:16 • Vertical</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Voice Preview in Step 3 */}
            {state.voiceAudioUrl && (
              <Card className="p-4">
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

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Generation Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Avatar:</span>
                  <span className="text-muted-foreground">
                    {state.selectedAvatarTemplate?.name || 'Custom Upload'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Video Format:</span>
                  <span className="text-muted-foreground">
                    {aspectRatio === '16:9' ? 'Landscape (16:9)' : 'Portrait (9:16)'}
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
              <Card className="p-4">
                <h3 className="font-semibold mb-2">Video Generated!</h3>
                <p className="text-sm text-muted-foreground">
                  Your talking avatar video has been submitted for processing. 
                  Check the History tab for updates.
                </p>
              </Card>
            )}
          </div>
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
              className="flex-1 h-12"
              size="lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          
          <Button
            onClick={handleStepAction}
            disabled={!canProceed() || state.isLoading || state.isGenerating}
            className={`${state.currentStep === 1 ? 'w-full' : 'flex-1'} h-12 font-medium`}
            size="lg"
          >
            <Video className="w-4 h-4 mr-2" />
            {state.isLoading || state.isGenerating ? (
              state.currentStep === 3 ? 'Generating Video...' : state.currentStep === 2 ? 'Preparing Voice...' : 'Processing...'
            ) : (
              state.currentStep === 3 ? `Generate Video (${estimatedCredits} credits)` : 
              state.currentStep === 2 ? 'Prepare Voice' : 'Select Avatar'
            )}
            {state.currentStep < 3 && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
        {state.currentStep === 3 && credits < estimatedCredits && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {estimatedCredits} credits.
          </p>
        )}
      </div>
    </TabContentWrapper>
  );
}