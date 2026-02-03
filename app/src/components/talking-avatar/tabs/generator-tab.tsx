'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Video, User, Mic, Mic2, Play, Square, ArrowRight, ArrowLeft, Monitor, Smartphone, Upload, Clock, AlertCircle, Plus, Trash2, RotateCcw } from 'lucide-react';
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
    cloneVoice,
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

  // Avatar hover video preview
  const [hoveredTemplateId, setHoveredTemplateId] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // Voice filter state
  const [voiceCategoryFilter, setVoiceCategoryFilter] = useState<string>('all');
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<string>('all');

  // Clone voice modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneVoiceName, setCloneVoiceName] = useState('');
  const [cloneNoiseReduction, setCloneNoiseReduction] = useState(true);
  const [cloneVolumeNorm, setCloneVolumeNorm] = useState(true);

  // Load templates on mount
  useEffect(() => {
    loadAvatarTemplates();
  }, [loadAvatarTemplates]);

  // Check for prefilled script from Script Generator
  useEffect(() => {
    const prefillScript = localStorage.getItem('prefill_script');
    if (prefillScript) {
      setLocalScriptText(prefillScript);
      localStorage.removeItem('prefill_script');
    }
  }, []);

  // Update local state when wizard state changes
  useEffect(() => {
    setLocalScriptText(state.scriptText);
    setSelectedTemplate(state.selectedAvatarTemplate);
    setSelectedVoice(state.selectedVoiceId || '');
  }, [state.scriptText, state.selectedAvatarTemplate, state.selectedVoiceId]);

  // Auto-select matching voice when avatar template is selected
  useEffect(() => {
    if (state.selectedAvatarTemplate?.voice_id) {
      const matchingVoice = MINIMAX_VOICE_OPTIONS.find(v => v.id === state.selectedAvatarTemplate?.voice_id);
      if (matchingVoice) {
        setSelectedVoice(matchingVoice.id);
      }
    }
    if (state.selectedAvatarTemplate?.gender) {
      const gender = state.selectedAvatarTemplate.gender.toLowerCase();
      if (gender === 'male' || gender === 'female') {
        setVoiceGenderFilter(gender);
      }
    }
  }, [state.selectedAvatarTemplate]);

  // Avatar hover video handlers
  const handleAvatarHover = async (templateId: string, shouldPlay: boolean) => {
    const videoElement = videoRefs.current[templateId];
    if (!videoElement) return;

    if (shouldPlay) {
      setHoveredTemplateId(templateId);
      try {
        videoElement.muted = true;
        videoElement.currentTime = 0;
        await videoElement.play();
      } catch {
        // Autoplay prevented
      }
    } else {
      setHoveredTemplateId(null);
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  };

  const handleVoicePlayback = useCallback((voiceId: string, sampleUrl: string) => {
    if (playingVoiceId === voiceId && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setPlayingVoiceId(null);
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const audio = new Audio(sampleUrl);
    setCurrentAudio(audio);
    setPlayingVoiceId(voiceId);

    audio.addEventListener('ended', () => {
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });
    audio.addEventListener('error', () => {
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });

    audio.play().catch(() => {
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    });
  }, [playingVoiceId, currentAudio]);

  // Clone modal helpers
  const validateAndSetCloneFile = (file: File) => {
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload MP3, WAV, or M4A.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 20MB.');
      return;
    }
    setCloneFile(file);
    if (!cloneVoiceName) {
      setCloneVoiceName(file.name.replace(/\.[^/.]+$/, '').slice(0, 50));
    }
  };

  const handleCloneSubmit = async () => {
    if (!cloneFile || !cloneVoiceName.trim()) return;
    try {
      await cloneVoice(cloneFile, cloneVoiceName.trim(), {
        noiseReduction: cloneNoiseReduction,
        volumeNormalization: cloneVolumeNorm,
      });
      if (state.clonedVoices.length > 0) {
        setSelectedVoice(state.clonedVoices[0].minimax_voice_id);
      }
      setCloneFile(null);
      setCloneVoiceName('');
      setShowCloneModal(false);
    } catch {
      // Error handled by hook
    }
  };

  // Step actions
  const handleStepAction = async () => {
    if (state.currentStep === 1) {
      if (customImage) {
        await handleAvatarSelection(null, customImage);
      } else if (selectedTemplate) {
        await handleAvatarSelection(selectedTemplate);
      }
      if (!state.error) {
        goToStep(2);
      }
    } else if (state.currentStep === 2) {
      if (state.audioInputMode === 'upload') {
        // Upload mode: skip voice gen, go to step 3
        if (state.uploadedAudioUrl && state.audioDurationSeconds > 0) {
          goToStep(3);
        }
      } else {
        // TTS mode: generate voice → auto-advances to step 3 on success
        if (selectedVoice && localScriptText.trim()) {
          await handleVoiceGeneration(selectedVoice, localScriptText, voiceSettings.speed);
        }
      }
    } else if (state.currentStep === 3) {
      await handleVideoGeneration();
    }
  };

  // Credit estimation
  const getEstimatedDuration = () => {
    // Step 3: use actual audio duration if available
    if (state.currentStep === 3 && state.audioDurationSeconds > 0) {
      return Math.min(state.audioDurationSeconds, MAX_AUDIO_DURATION_SECONDS);
    }
    if (state.audioInputMode === 'upload' && state.audioDurationSeconds > 0) {
      return Math.min(state.audioDurationSeconds, MAX_AUDIO_DURATION_SECONDS);
    }
    const wordCount = localScriptText ? localScriptText.trim().split(/\s+/).filter(w => w).length : 0;
    return Math.min(Math.ceil(wordCount / 1.5), MAX_AUDIO_DURATION_SECONDS);
  };
  const estimatedDuration = getEstimatedDuration();
  const estimatedCredits = Math.max(10, Math.min(60, Math.ceil(estimatedDuration)));

  const canProceed = () => {
    if (state.currentStep === 1) {
      return selectedTemplate || customImage;
    } else if (state.currentStep === 2) {
      if (state.audioInputMode === 'upload') {
        return state.uploadedAudioUrl && state.audioDurationSeconds > 0 && state.audioDurationSeconds <= MAX_AUDIO_DURATION_SECONDS;
      }
      // TTS: need script + selected voice (duration is validated in step 3 with actual audio)
      return selectedVoice && localScriptText.trim();
    } else if (state.currentStep === 3) {
      const hasAudio = state.voiceAudioUrl || state.uploadedAudioUrl;
      const withinDuration = state.audioDurationSeconds <= MAX_AUDIO_DURATION_SECONDS;
      return hasAudio && withinDuration && credits >= estimatedCredits;
    }
    return false;
  };

  // Button label for each step
  const getButtonLabel = () => {
    if (state.isLoading || state.isGenerating) {
      if (state.currentStep === 2) return 'Generating Voice...';
      if (state.currentStep === 3) return 'Generating Video...';
      return 'Processing...';
    }
    if (state.currentStep === 1) return 'Select Avatar';
    if (state.currentStep === 2) {
      return state.audioInputMode === 'upload' ? 'Continue to Preview' : 'Generate Voice';
    }
    if (state.currentStep === 3) return `Generate Video (${estimatedCredits} credits)`;
    return 'Next';
  };

  // Button icon for each step
  const getButtonIcon = () => {
    if (state.currentStep === 2) return <Mic className="w-4 h-4 mr-2" />;
    if (state.currentStep === 3) return <Video className="w-4 h-4 mr-2" />;
    return null;
  };

  return (
    <TabContentWrapper>
      <TabHeader
        icon={Video}
        title="Talking Avatar Generator"
        description="Create AI-powered talking avatar videos"
      />

      <TabBody>
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-medium">Step {state.currentStep} of {state.totalSteps}</span>
            <Button variant="outline" size="sm" onClick={resetWizard} className="text-xs">
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

        {/* ===== STEP 1: Avatar Selection ===== */}
        {state.currentStep === 1 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium mb-2 block">Choose Your Avatar</Label>

            <div className="grid grid-cols-2 gap-2">
              {state.avatarTemplates.map((template: AvatarTemplate) => (
                <Card
                  key={template.id}
                  className={`p-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500' : 'bg-card hover:bg-muted/50'
                  }`}
                  onClick={async () => {
                    setSelectedTemplate(template);
                    setCustomImage(null);
                    await handleAvatarSelection(template);
                  }}
                  onMouseEnter={() => template.preview_video_url && handleAvatarHover(template.id, true)}
                  onMouseLeave={() => template.preview_video_url && handleAvatarHover(template.id, false)}
                  title={template.description || undefined}
                >
                  <div className="relative aspect-square bg-muted rounded-lg mb-1 flex items-center justify-center overflow-hidden">
                    {template.preview_video_url && (
                      <video
                        ref={(el) => { videoRefs.current[template.id] = el; }}
                        src={template.preview_video_url}
                        muted loop playsInline
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                          hoveredTemplateId === template.id ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    )}
                    {template.thumbnail_url ? (
                      <Image
                        src={template.thumbnail_url}
                        alt={template.name}
                        fill priority={false} quality={75}
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                        className={`object-cover transition-opacity duration-300 ${
                          hoveredTemplateId === template.id && template.preview_video_url ? 'opacity-0' : 'opacity-100'
                        }`}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <User className="w-8 h-8 text-muted-foreground" />
                    )}
                    {template.preview_video_url && hoveredTemplateId !== template.id && (
                      <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-1">
                        <Play className="w-3 h-3 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-center truncate">{template.name}</p>
                  <p className="text-xs text-muted-foreground text-center truncate">{template.category} • {template.gender}</p>
                </Card>
              ))}
            </div>

            <UnifiedDragDrop
              fileType="avatar"
              selectedFile={customImage}
              onFileSelect={(file) => {
                setCustomImage(file);
                setSelectedTemplate(null);
                handleAvatarSelection(null, file);
              }}
              disabled={state.isLoading}
              previewSize="medium"
              title="Drop custom avatar or click to upload"
              description="Use your own image as avatar"
            />
          </div>
        )}

        {/* ===== STEP 2: Script & Voice ===== */}
        {state.currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Maximum audio duration: <strong>60 seconds</strong>.
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
                    <span>{localScriptText.trim().split(/\s+/).filter(Boolean).length} words</span>
                    <span>~{Math.ceil(localScriptText.trim().split(/\s+/).filter(Boolean).length / 1.5)}s</span>
                  </div>
                  {localScriptText.trim().split(/\s+/).filter(Boolean).length > 90 && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-xs">Long script — the generated audio may exceed 60s. Consider increasing the speed or shortening the text.</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Voice</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-primary"
                      onClick={() => setShowCloneModal(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Clone Voice
                    </Button>
                  </div>

                  {/* Cloned Voices */}
                  {state.clonedVoices.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">My Voices</p>
                      {state.clonedVoices.map((voice) => (
                        <Card
                          key={voice.minimax_voice_id}
                          className={`p-2 cursor-pointer transition-all hover:shadow-sm ${
                            selectedVoice === voice.minimax_voice_id ? 'ring-2 ring-purple-500' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedVoice(voice.minimax_voice_id)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">{voice.name}</p>
                                <Badge variant="outline" className="text-[10px] shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                  Cloned
                                </Badge>
                              </div>
                            </div>
                            {voice.preview_url && voice.preview_url.startsWith('http') && (
                              <Button variant="outline" size="sm" className="shrink-0 h-7 w-7 p-0" onClick={(e) => {
                                e.stopPropagation();
                                handleVoicePlayback(voice.minimax_voice_id, voice.preview_url!);
                              }}>
                                {playingVoiceId === voice.minimax_voice_id ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              </Button>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* System Voice Filters */}
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">System Voices</p>
                  <div className="flex flex-wrap gap-1">
                    {['all', 'professional', 'natural', 'expressive', 'character'].map((cat) => (
                      <Button key={cat} variant={voiceCategoryFilter === cat ? 'default' : 'outline'} size="sm" className="text-xs h-7 px-2"
                        onClick={() => setVoiceCategoryFilter(cat)}>
                        {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {['all', 'male', 'female'].map((g) => (
                      <Button key={g} variant={voiceGenderFilter === g ? 'default' : 'outline'} size="sm" className="text-xs h-7 px-2"
                        onClick={() => setVoiceGenderFilter(g)}>
                        {g === 'all' ? 'All Genders' : g.charAt(0).toUpperCase() + g.slice(1)}
                      </Button>
                    ))}
                  </div>

                  {/* System Voice List */}
                  <div className="grid grid-cols-1 gap-1.5 max-h-[200px] overflow-y-auto">
                    {MINIMAX_VOICE_OPTIONS
                      .filter((voice) => {
                        if (voiceCategoryFilter !== 'all' && voice.category !== voiceCategoryFilter) return false;
                        if (voiceGenderFilter !== 'all' && voice.gender !== voiceGenderFilter) return false;
                        return true;
                      })
                      .map((voice) => (
                        <Card
                          key={voice.id}
                          className={`p-2 cursor-pointer transition-all hover:shadow-sm ${
                            selectedVoice === voice.id ? 'ring-2 ring-purple-500' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedVoice(voice.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">{voice.name}</p>
                                <Badge variant="outline" className="text-[10px] shrink-0">{voice.gender}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{voice.description}</p>
                            </div>
                            <Button variant="outline" size="sm" className="shrink-0 h-7 w-7 p-0" onClick={(e) => {
                              e.stopPropagation();
                              handleVoicePlayback(voice.id, voice.preview_url);
                            }}>
                              {playingVoiceId === voice.id ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            </Button>
                          </div>
                        </Card>
                      ))}
                  </div>
                </div>

                {/* Speed */}
                <div className="space-y-2">
                  <Label className="text-xs">Speed: {voiceSettings.speed}x</Label>
                  <input
                    type="range" min={0.5} max={2.0} step={0.25}
                    value={voiceSettings.speed}
                    onChange={(e) => setVoiceSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                    disabled={state.isGenerating}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0.5x</span><span>Normal</span><span>2.0x</span>
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
                        const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/x-m4a'];
                        if (!validTypes.includes(file.type)) {
                          toast.error('Please upload MP3, WAV, or M4A audio files only');
                          return;
                        }
                        const audio = new Audio(URL.createObjectURL(file));
                        audio.addEventListener('loadedmetadata', () => {
                          if (audio.duration > MAX_AUDIO_DURATION_SECONDS) {
                            toast.error(`Audio must be ${MAX_AUDIO_DURATION_SECONDS} seconds or less.`);
                            return;
                          }
                          const url = URL.createObjectURL(file);
                          setUploadedAudio(url, file, audio.duration);
                          toast.success(`Audio uploaded: ${Math.ceil(audio.duration)} seconds`);
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
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 3: Preview & Generate ===== */}
        {state.currentStep === 3 && (
          <div className="space-y-4">
            {/* Voice Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Voice Preview</Label>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearVoice}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Change Voice
                </Button>
              </div>

              {state.voiceAudioUrl && (
                <Card className="p-4">
                  <audio controls className="w-full" src={state.voiceAudioUrl} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Duration: {Math.ceil(state.audioDurationSeconds)}s
                  </p>
                </Card>
              )}

              {state.uploadedAudioUrl && !state.voiceAudioUrl && (
                <Card className="p-4">
                  <audio controls className="w-full" src={state.uploadedAudioUrl} />
                  <p className="text-xs text-muted-foreground mt-2">
                    Uploaded audio • {Math.ceil(state.audioDurationSeconds)}s
                  </p>
                </Card>
              )}

              {/* Duration exceeded warning */}
              {state.audioDurationSeconds > MAX_AUDIO_DURATION_SECONDS && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      Audio too long ({Math.ceil(state.audioDurationSeconds)}s)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Maximum duration is {MAX_AUDIO_DURATION_SECONDS} seconds. Go back to shorten your script or increase the voice speed.
                    </p>
                    <Button variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={clearVoice}>
                      <ArrowLeft className="w-3 h-3 mr-1" />
                      Go Back & Adjust
                    </Button>
                  </div>
                </div>
              )}

              {localScriptText.trim() && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Script</p>
                  <p className="text-sm">{localScriptText}</p>
                </div>
              )}
            </div>

            {/* Video Settings */}
            <div className="space-y-3">
              <Label>Video Settings</Label>

              <div className="grid grid-cols-2 gap-2">
                <Card
                  className={`p-3 cursor-pointer transition-all duration-200 ${
                    state.selectedResolution === 'landscape' ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                  }`}
                  onClick={() => setSelectedResolution('landscape')}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className={`w-4 h-4 ${state.selectedResolution === 'landscape' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className={`text-xs font-medium ${state.selectedResolution === 'landscape' ? 'text-primary' : 'text-foreground'}`}>Landscape</p>
                      <p className="text-xs text-muted-foreground">1024×576</p>
                    </div>
                  </div>
                </Card>
                <Card
                  className={`p-3 cursor-pointer transition-all duration-200 ${
                    state.selectedResolution === 'portrait' ? 'border-primary bg-primary/10' : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                  }`}
                  onClick={() => setSelectedResolution('portrait')}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className={`w-4 h-4 ${state.selectedResolution === 'portrait' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className={`text-xs font-medium ${state.selectedResolution === 'portrait' ? 'text-primary' : 'text-foreground'}`}>Portrait</p>
                      <p className="text-xs text-muted-foreground">576×1024</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Action Prompt */}
              <div className="space-y-2">
                <Label className="text-xs">Action Prompt (optional)</Label>
                <Textarea
                  value={localActionPrompt}
                  onChange={(e) => {
                    setLocalActionPrompt(e.target.value);
                    setActionPrompt(e.target.value);
                  }}
                  placeholder="Describe visual style and movements..."
                  className="min-h-[50px] resize-none text-sm"
                  disabled={state.isLoading}
                />
              </div>
            </div>

            {/* Credit Summary */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
              <span>Estimated cost:</span>
              <span className="font-medium text-primary">{estimatedCredits} credits</span>
            </div>
          </div>
        )}
      </TabBody>

      {/* Footer */}
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
            {getButtonIcon()}
            {getButtonLabel()}
            {state.currentStep === 1 && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
        {state.currentStep === 3 && credits < estimatedCredits && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {estimatedCredits} credits.
          </p>
        )}
      </div>

      {/* Clone Voice Modal */}
      <Dialog open={showCloneModal} onOpenChange={setShowCloneModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clone a Voice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Audio Upload */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center transition-colors border-muted-foreground/25 hover:border-primary/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) validateAndSetCloneFile(e.dataTransfer.files[0]);
              }}
            >
              {cloneFile ? (
                <div className="space-y-2">
                  <Mic2 className="w-8 h-8 mx-auto text-primary" />
                  <p className="text-sm font-medium">{cloneFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(cloneFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <Button variant="outline" size="sm" onClick={() => setCloneFile(null)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer space-y-2 block">
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) validateAndSetCloneFile(e.target.files[0]);
                    }}
                  />
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Drop audio or click to upload</p>
                  <p className="text-xs text-muted-foreground">MP3, WAV, M4A • 10s-5min • Max 20MB</p>
                </label>
              )}
            </div>

            {/* Voice Name */}
            <div className="space-y-1">
              <Label>Voice Name</Label>
              <Input
                value={cloneVoiceName}
                onChange={(e) => setCloneVoiceName(e.target.value)}
                placeholder="e.g. My Custom Voice"
                maxLength={50}
                disabled={state.isCloning}
              />
            </div>

            {/* Options */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="clone-nr" checked={cloneNoiseReduction}
                  onCheckedChange={(checked) => setCloneNoiseReduction(checked as boolean)} disabled={state.isCloning} />
                <label htmlFor="clone-nr" className="text-sm cursor-pointer">Noise reduction</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="clone-vn" checked={cloneVolumeNorm}
                  onCheckedChange={(checked) => setCloneVolumeNorm(checked as boolean)} disabled={state.isCloning} />
                <label htmlFor="clone-vn" className="text-sm cursor-pointer">Volume normalization</label>
              </div>
            </div>

            {/* Clone Button */}
            <Button
              onClick={handleCloneSubmit}
              disabled={!cloneFile || !cloneVoiceName.trim() || state.isCloning || credits < 50}
              className="w-full"
            >
              {state.isCloning ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Cloning Voice...
                </>
              ) : (
                <>
                  <Mic2 className="w-4 h-4 mr-2" />
                  Clone Voice (50 credits)
                </>
              )}
            </Button>
            {credits < 50 && cloneFile && cloneVoiceName.trim() && (
              <p className="text-xs text-destructive text-center">
                Insufficient credits. You need 50 credits to clone a voice.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TabContentWrapper>
  );
}
