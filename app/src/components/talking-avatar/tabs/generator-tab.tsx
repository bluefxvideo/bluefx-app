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
import { Video, User, Mic, Mic2, Play, Square, ArrowRight, ArrowLeft, Monitor, Smartphone, Upload, Clock, AlertCircle, Plus, Trash2, RotateCcw, Sparkles, ChevronDown, ChevronUp, ImageIcon, Loader2, Download, Save, Heart } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';
import { UnifiedDragDrop } from '@/components/ui/unified-drag-drop';
import { UseTalkingAvatarReturn } from '../hooks/use-talking-avatar';
import { AvatarTemplate } from '@/actions/tools/talking-avatar';
import { MINIMAX_VOICE_OPTIONS, DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '@/components/shared/voice-constants';
import { createClient } from '@/app/supabase/client';
import { toast } from 'sonner';
import { generateAvatarImage, type AvatarGeneratorRequest } from '@/actions/tools/avatar-generator';

const AVATAR_GENERATION_CREDIT_COST = 4;

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
    saveAvatar,
    deleteSavedAvatar,
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

  // Avatar generator state
  const [showAvatarGen, setShowAvatarGen] = useState(false);
  const [avatarGenPrompt, setAvatarGenPrompt] = useState('');
  const [avatarGenPreset, setAvatarGenPreset] = useState<AvatarGeneratorRequest['style_preset']>('ugc_portrait');
  const [avatarGenRefImage, setAvatarGenRefImage] = useState<File | null>(null);
  const [avatarGenRefUrl, setAvatarGenRefUrl] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);
  const [saveAvatarName, setSaveAvatarName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  // Get current user for avatar generation
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  // Handle avatar generation
  const handleGenerateAvatar = async () => {
    if (!avatarGenPrompt.trim()) {
      toast.error('Please describe your avatar');
      return;
    }
    if (!userId) {
      toast.error('Please sign in to generate avatars');
      return;
    }
    if (credits < AVATAR_GENERATION_CREDIT_COST) {
      toast.error(`Insufficient credits. You need ${AVATAR_GENERATION_CREDIT_COST} credits.`);
      return;
    }
    setIsGeneratingAvatar(true);
    setGeneratedAvatarUrl(null);
    setShowSaveInput(false);
    try {
      // Upload reference image if provided
      let refUrl = avatarGenRefUrl;
      if (avatarGenRefImage && !refUrl) {
        const { uploadImageToStorage } = await import('@/actions/supabase-storage');
        const uploadResult = await uploadImageToStorage(avatarGenRefImage, {
          bucket: 'images',
          folder: 'avatars/references',
          filename: `ref_${Date.now()}.png`,
          contentType: avatarGenRefImage.type,
        });
        if (uploadResult.success && uploadResult.url) {
          refUrl = uploadResult.url;
          setAvatarGenRefUrl(refUrl);
        }
      }

      const result = await generateAvatarImage({
        prompt: avatarGenPrompt,
        style_preset: avatarGenPreset,
        reference_image_url: refUrl || undefined,
        user_id: userId,
      });

      if (result.success && result.image_url) {
        setGeneratedAvatarUrl(result.image_url);
        toast.success('Avatar generated!');
      } else {
        toast.error(result.error || 'Generation failed');
      }
    } catch {
      toast.error('Failed to generate avatar');
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  // Download generated avatar
  const handleDownloadAvatar = async () => {
    if (!generatedAvatarUrl) return;
    try {
      const response = await fetch(generatedAvatarUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `avatar_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download avatar');
    }
  };

  // Save generated avatar to My Avatars
  const handleSaveAvatar = async () => {
    if (!generatedAvatarUrl || !saveAvatarName.trim()) return;
    setIsSavingAvatar(true);
    try {
      const success = await saveAvatar(saveAvatarName.trim(), generatedAvatarUrl);
      if (success) {
        setShowSaveInput(false);
        setSaveAvatarName('');
      }
    } finally {
      setIsSavingAvatar(false);
    }
  };

  // Use generated avatar as the selected avatar
  const handleUseGeneratedAvatar = async () => {
    if (!generatedAvatarUrl) return;
    try {
      const response = await fetch(generatedAvatarUrl);
      const blob = await response.blob();
      const file = new File([blob], `generated_avatar_${Date.now()}.png`, { type: 'image/png' });
      setCustomImage(file);
      setSelectedTemplate(null);
      await handleAvatarSelection(null, file);
      setShowAvatarGen(false);
      toast.success('Generated avatar selected');
    } catch {
      toast.error('Failed to use generated avatar');
    }
  };

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

            {/* My Avatars Section */}
            {state.savedAvatars.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-medium">My Avatars</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {state.savedAvatars.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {state.savedAvatars.map((saved) => (
                    <Card
                      key={saved.id}
                      className={`p-1.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] group relative ${
                        customImage === null && selectedTemplate === null && state.customAvatarUrl === saved.image_url
                          ? 'ring-2 ring-purple-500'
                          : 'bg-card hover:bg-muted/50'
                      }`}
                      onClick={async () => {
                        setSelectedTemplate(null);
                        const response = await fetch(saved.image_url);
                        const blob = await response.blob();
                        const file = new File([blob], `${saved.name}.png`, { type: 'image/png' });
                        setCustomImage(file);
                        await handleAvatarSelection(null, file);
                      }}
                    >
                      <div className="relative aspect-[4/3] bg-muted rounded mb-1 flex items-center justify-center overflow-hidden">
                        <Image
                          src={saved.image_url}
                          alt={saved.name}
                          fill priority={false} quality={60}
                          sizes="(max-width: 768px) 33vw, 150px"
                          className="object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        {/* Delete button on hover */}
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await deleteSavedAvatar(saved.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                      <p className="text-[11px] font-medium text-center truncate leading-tight">{saved.name}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5">
              {state.avatarTemplates.map((template: AvatarTemplate) => (
                <Card
                  key={template.id}
                  className={`p-1.5 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
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
                  <div className="relative aspect-[4/3] bg-muted rounded mb-1 flex items-center justify-center overflow-hidden">
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
                        fill priority={false} quality={60}
                        sizes="(max-width: 768px) 33vw, 150px"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                        className={`object-cover transition-opacity duration-300 ${
                          hoveredTemplateId === template.id && template.preview_video_url ? 'opacity-0' : 'opacity-100'
                        }`}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                    {template.preview_video_url && hoveredTemplateId !== template.id && (
                      <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                        <Play className="w-2.5 h-2.5 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-center truncate leading-tight">{template.name}</p>
                </Card>
              ))}
            </div>

            {/* Create Custom Avatar with AI */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setShowAvatarGen(!showAvatarGen)}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Create Custom Avatar with AI
                </span>
                {showAvatarGen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAvatarGen && (
                <div className="p-3 pt-0 space-y-3">
                  {/* Style Presets */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Style</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { id: 'ugc_portrait', label: 'UGC Portrait', desc: 'Natural, authentic look' },
                        { id: 'ugc_selfie', label: 'UGC Selfie', desc: 'Casual selfie style' },
                        { id: 'professional', label: 'Professional', desc: 'Studio headshot' },
                        { id: 'custom', label: 'Custom', desc: 'Full prompt control' },
                      ] as const).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`p-2 rounded-md text-left border transition-all text-xs ${
                            avatarGenPreset === preset.id
                              ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500'
                              : 'border-muted hover:border-muted-foreground/40'
                          }`}
                          onClick={() => setAvatarGenPreset(preset.id)}
                        >
                          <p className="font-medium">{preset.label}</p>
                          <p className="text-[10px] text-muted-foreground">{preset.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Describe Your Avatar</Label>
                    <Textarea
                      value={avatarGenPrompt}
                      onChange={(e) => setAvatarGenPrompt(e.target.value)}
                      placeholder="e.g. A 30 year old woman with brown hair, wearing a casual blue sweater, sitting in a cozy living room"
                      className="min-h-[70px] resize-none text-sm"
                      disabled={isGeneratingAvatar}
                    />
                  </div>

                  {/* Optional Reference Image */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      Reference Image (optional)
                    </Label>
                    {avatarGenRefImage ? (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-xs truncate flex-1">{avatarGenRefImage.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => { setAvatarGenRefImage(null); setAvatarGenRefUrl(null); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="block border border-dashed rounded-md p-3 text-center cursor-pointer hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setAvatarGenRefImage(file);
                              setAvatarGenRefUrl(null);
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Upload a reference photo to guide the style</p>
                      </label>
                    )}
                  </div>

                  {/* Generate Button */}
                  <div className="space-y-1.5">
                    <Button
                      onClick={handleGenerateAvatar}
                      disabled={!avatarGenPrompt.trim() || isGeneratingAvatar || credits < AVATAR_GENERATION_CREDIT_COST}
                      className="w-full"
                      size="sm"
                    >
                      {isGeneratingAvatar ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Avatar ({AVATAR_GENERATION_CREDIT_COST} credits)
                        </>
                      )}
                    </Button>
                    {credits < AVATAR_GENERATION_CREDIT_COST && (
                      <p className="text-xs text-destructive text-center">
                        Insufficient credits. You need {AVATAR_GENERATION_CREDIT_COST} credits.
                      </p>
                    )}
                  </div>

                  {/* Generated Preview */}
                  {generatedAvatarUrl && (
                    <div className="space-y-2">
                      <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                        <Image
                          src={generatedAvatarUrl}
                          alt="Generated avatar"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleUseGeneratedAvatar}
                          className="flex-1"
                          size="sm"
                        >
                          Use This Avatar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowSaveInput(!showSaveInput);
                            if (!saveAvatarName) {
                              setSaveAvatarName(avatarGenPrompt.slice(0, 50).trim() || 'My Avatar');
                            }
                          }}
                          title="Save to My Avatars"
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadAvatar}
                          title="Download"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateAvatar}
                          disabled={isGeneratingAvatar}
                          title="Regenerate"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Save to My Avatars inline input */}
                      {showSaveInput && (
                        <div className="flex gap-2">
                          <Input
                            value={saveAvatarName}
                            onChange={(e) => setSaveAvatarName(e.target.value)}
                            placeholder="Avatar name"
                            className="text-sm h-8"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveAvatar()}
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveAvatar}
                            disabled={!saveAvatarName.trim() || isSavingAvatar}
                            className="h-8 px-3"
                          >
                            {isSavingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
