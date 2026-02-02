'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, User, Mic, Play, Square, ArrowRight, ArrowLeft, Monitor, Smartphone, Upload, Clock, AlertCircle } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';
import { UseTalkingAvatarReturn } from '../hooks/use-talking-avatar';
import { AvatarTemplate } from '@/actions/tools/talking-avatar';
import { MINIMAX_VOICE_OPTIONS, DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '@/components/shared/voice-constants';
import { toast } from 'sonner';

// Constants for LTX model limits
const MAX_AUDIO_DURATION_SECONDS = 60;

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
    setAudioInputMode,
    setUploadedAudio,
    setActionPrompt,
    setSelectedResolution,
    setScriptText,
  } = avatarState;

  const [localScriptText, setLocalScriptText] = useState(state.scriptText);
  const [selectedTemplate, setSelectedTemplate] = useState<AvatarTemplate | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('Friendly_Person');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [customImage, setCustomImage] = useState<File | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [localActionPrompt, setLocalActionPrompt] = useState(state.actionPrompt);
  const audioInputRef = useRef<HTMLInputElement>(null);

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
      // Step 2: Prepare audio and proceed to video generation
      if (state.audioInputMode === 'upload') {
        // Upload mode: just proceed to step 3 if we have uploaded audio
        if (state.uploadedAudioUrl && state.audioDurationSeconds > 0) {
          goToStep(3);
        }
      } else {
        // TTS mode: generate voice then proceed
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
      }
    } else if (state.currentStep === 3) {
      // Step 3: Video generation - verify we have audio URL (TTS or uploaded)
      const audioUrl = state.audioInputMode === 'upload' ? state.uploadedAudioUrl : state.voiceAudioUrl;
      if (!audioUrl) {
        console.error('Cannot generate video: Audio URL is missing');
        return;
      }
      await handleVideoGeneration();
    }
  };

  // Calculate estimated credits based on audio duration
  // 1.0 credits per second, minimum 10, maximum 60
  const getEstimatedDuration = () => {
    if (state.audioInputMode === 'upload' && state.audioDurationSeconds > 0) {
      return Math.min(state.audioDurationSeconds, MAX_AUDIO_DURATION_SECONDS);
    }
    // TTS mode: estimate from word count (~2.5 words per second)
    const wordCount = localScriptText ? localScriptText.trim().split(/\s+/).filter(w => w).length : 0;
    return Math.min(Math.ceil(wordCount / 2.5), MAX_AUDIO_DURATION_SECONDS);
  };
  const estimatedDuration = getEstimatedDuration();
  const estimatedCredits = Math.max(10, Math.min(60, Math.ceil(estimatedDuration)));

  const canProceed = () => {
    if (state.currentStep === 1) {
      return selectedTemplate || customImage;
    } else if (state.currentStep === 2) {
      if (state.audioInputMode === 'upload') {
        // Upload mode: need uploaded audio with valid duration
        return state.uploadedAudioUrl && state.audioDurationSeconds > 0 && state.audioDurationSeconds <= MAX_AUDIO_DURATION_SECONDS;
      } else {
        // TTS mode: need voice selection + script text with valid duration
        const wordCount = localScriptText.trim().split(/\s+/).filter(Boolean).length;
        const estimatedSec = Math.ceil(wordCount / 2.5);
        return selectedVoice && localScriptText.trim() && estimatedSec <= MAX_AUDIO_DURATION_SECONDS;
      }
    } else if (state.currentStep === 3) {
      // For video generation, need audio URL AND sufficient credits
      const hasAudio = state.audioInputMode === 'upload' ? state.uploadedAudioUrl : state.voiceAudioUrl;
      return hasAudio && !state.isLoading && credits >= estimatedCredits;
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

        {/* Step 2: Audio Input (TTS or Upload) */}
        {state.currentStep === 2 && (
          <div className="space-y-4">
            {/* 60-second limit warning */}
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Maximum audio duration: <strong>60 seconds</strong>. Longer audio will be rejected.
              </p>
            </div>

            {/* Audio Input Mode Toggle */}
            <div className="space-y-2">
              <Label>Audio Input Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={state.audioInputMode === 'tts' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => setAudioInputMode('tts')}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Generate Voice
                </Button>
                <Button
                  variant={state.audioInputMode === 'upload' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => setAudioInputMode('upload')}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Audio
                </Button>
              </div>
            </div>

            {/* TTS Mode */}
            {state.audioInputMode === 'tts' && (
              <>
                <div className="space-y-2">
                  <Label>Script Text</Label>
                  <Textarea
                    value={localScriptText}
                    onChange={(e) => {
                      setLocalScriptText(e.target.value);
                      setScriptText(e.target.value);
                    }}
                    placeholder="Enter the text you want your avatar to speak..."
                    className="min-h-[100px] resize-none"
                    disabled={state.isLoading}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Word count: {localScriptText.trim().split(/\s+/).filter(Boolean).length} words</span>
                    <span>~{Math.ceil(localScriptText.trim().split(/\s+/).filter(Boolean).length / 2.5)} seconds</span>
                  </div>
                  {Math.ceil(localScriptText.trim().split(/\s+/).filter(Boolean).length / 2.5) > MAX_AUDIO_DURATION_SECONDS && (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-xs">Script too long. Please shorten to under 60 seconds (~150 words).</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Voice Selection</Label>
                  <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
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
              </>
            )}

            {/* Upload Mode */}
            {state.audioInputMode === 'upload' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Upload Audio File</Label>
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => audioInputRef.current?.click()}
                  >
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg,audio/x-m4a"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // Validate file type
                        const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/x-m4a'];
                        if (!validTypes.includes(file.type)) {
                          toast.error('Please upload MP3, WAV, or M4A audio files only');
                          return;
                        }

                        // Get audio duration
                        const audio = new Audio(URL.createObjectURL(file));
                        audio.addEventListener('loadedmetadata', () => {
                          const duration = audio.duration;
                          if (duration > MAX_AUDIO_DURATION_SECONDS) {
                            toast.error(`Audio must be ${MAX_AUDIO_DURATION_SECONDS} seconds or less. Your audio is ${Math.ceil(duration)} seconds.`);
                            return;
                          }
                          // Store the uploaded audio
                          const url = URL.createObjectURL(file);
                          setUploadedAudio(url, file, duration);
                          toast.success(`Audio uploaded: ${Math.ceil(duration)} seconds`);
                        });
                      }}
                    />
                    {state.uploadedAudioFile ? (
                      <div className="space-y-2">
                        <Mic className="w-8 h-8 mx-auto text-primary" />
                        <p className="text-sm font-medium">{state.uploadedAudioFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Duration: {Math.ceil(state.audioDurationSeconds)} seconds
                        </p>
                        <audio controls className="w-full mt-2">
                          <source src={state.uploadedAudioUrl || ''} />
                        </audio>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                        <p className="text-sm font-medium">Click to upload audio</p>
                        <p className="text-xs text-muted-foreground">MP3, WAV, or M4A • Max 60 seconds</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional script for reference */}
                <div className="space-y-2">
                  <Label>Script Notes (optional)</Label>
                  <Textarea
                    value={localScriptText}
                    onChange={(e) => {
                      setLocalScriptText(e.target.value);
                      setScriptText(e.target.value);
                    }}
                    placeholder="Add notes about your audio content (for your reference only)..."
                    className="min-h-[60px] resize-none"
                    disabled={state.isLoading}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Video Generation */}
        {state.currentStep === 3 && (
          <div className="space-y-3">
            {/* Video Format Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Choose Video Format</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Landscape */}
                <Card
                  className={`p-4 cursor-pointer transition-all duration-300 ${
                    state.selectedResolution === 'landscape'
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-secondary/50'
                  }`}
                  onClick={() => setSelectedResolution('landscape')}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-12 h-8 rounded border-2 flex items-center justify-center ${
                      state.selectedResolution === 'landscape'
                        ? 'border-primary bg-primary/20'
                        : 'border-muted-foreground/40'
                    }`}>
                      <Monitor className={`w-4 h-4 ${
                        state.selectedResolution === 'landscape' ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-medium ${
                        state.selectedResolution === 'landscape' ? 'text-primary' : 'text-foreground'
                      }`}>
                        Landscape
                      </p>
                      <p className="text-xs text-muted-foreground">1024×576 • YouTube</p>
                    </div>
                  </div>
                </Card>

                {/* Portrait */}
                <Card
                  className={`p-4 cursor-pointer transition-all duration-300 ${
                    state.selectedResolution === 'portrait'
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-secondary/50'
                  }`}
                  onClick={() => setSelectedResolution('portrait')}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-8 h-12 rounded border-2 flex items-center justify-center ${
                      state.selectedResolution === 'portrait'
                        ? 'border-primary bg-primary/20'
                        : 'border-muted-foreground/40'
                    }`}>
                      <Smartphone className={`w-4 h-4 ${
                        state.selectedResolution === 'portrait' ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-medium ${
                        state.selectedResolution === 'portrait' ? 'text-primary' : 'text-foreground'
                      }`}>
                        Portrait
                      </p>
                      <p className="text-xs text-muted-foreground">576×1024 • TikTok/Reels</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Action Prompt (optional instructions for avatar animation) */}
            <div className="space-y-2">
              <Label>Action Prompt (optional)</Label>
              <Textarea
                value={localActionPrompt}
                onChange={(e) => {
                  setLocalActionPrompt(e.target.value);
                  setActionPrompt(e.target.value);
                }}
                placeholder="Describe visual style and movements (e.g., 'professional presenter speaking naturally to camera')"
                className="min-h-[60px] resize-none"
                disabled={state.isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Helps guide how the AI animates your avatar
              </p>
            </div>

            {/* Audio Preview in Step 3 */}
            {(state.voiceAudioUrl || state.uploadedAudioUrl) && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3">
                  {state.audioInputMode === 'upload' ? 'Uploaded Audio' : 'Generated Voice'}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-600" />
                    <div>
                      {state.audioInputMode === 'upload' ? (
                        <>
                          <p className="text-sm font-medium">{state.uploadedAudioFile?.name || 'Audio file'}</p>
                          <p className="text-xs text-muted-foreground">Duration: {Math.ceil(state.audioDurationSeconds)} seconds</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium">Voice: {selectedVoice}</p>
                          <p className="text-xs text-muted-foreground">~{Math.ceil(state.audioDurationSeconds)} seconds</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <audio controls className="flex-1">
                      <source src={state.audioInputMode === 'upload' ? state.uploadedAudioUrl || '' : state.voiceAudioUrl || ''} type="audio/mpeg" />
                    </audio>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearVoice();
                        setSelectedVoice('');
                        goToStep(2);
                      }}
                      className="text-xs"
                    >
                      Change
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
                    {state.selectedResolution === 'landscape' ? 'Landscape (1024×576)' : 'Portrait (576×1024)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Audio Duration:</span>
                  <span className="text-muted-foreground">
                    {Math.ceil(state.audioDurationSeconds)} seconds
                  </span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Estimated Credits:</span>
                  <span className="text-primary">
                    {Math.max(10, Math.ceil(state.audioDurationSeconds))} credits
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