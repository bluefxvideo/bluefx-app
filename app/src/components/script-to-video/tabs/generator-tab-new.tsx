'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Mic, 
  Loader2, 
  Play, 
  Square,
  Monitor,
  Smartphone,
  FileText,
  Edit2,
  Volume2,
  Pause
} from 'lucide-react';
import { useVideoEditorStore } from '../store/video-editor-store';
import { useScriptToVideo } from '../hooks/use-script-to-video';
import { OPENAI_VOICE_OPTIONS, DEFAULT_VOICE_SETTINGS, type VoiceSettings } from '@/components/shared/voice-constants';
import { cn } from '@/lib/utils';

interface GeneratorTabProps {
  credits: number;
  onGeneratingChange?: (isGenerating: boolean) => void;
  multiStepState?: MultiStepState;
  onMultiStepStateChange?: (state: MultiStepState) => void;
  onVoiceSelected?: (selected: boolean) => void;
  onGeneratingVoiceChange?: (isGenerating: boolean) => void;
  onGeneratingVideoChange?: (isGenerating: boolean) => void;
}

// Multi-step state interface
export interface MultiStepState {
  currentStep: number;
  totalSteps: number;
  useMyScript: boolean;
  ideaText: string;
  generatedScript: string;
  finalScript: string;
  isGeneratingScript: boolean;
  aspectRatio: '16:9' | '9:16'; // Only landscape and portrait
}

/**
 * Generator Tab - Single-panel multi-step interface like ebook writer
 * Step 1: Idea/Script input
 * Step 2: Script review and editing
 * Step 3: Voice selection
 * Step 4: Voice playback review
 * Step 5: Aspect ratio selection
 */
export function GeneratorTabNew({
  credits,
  onGeneratingChange,
  multiStepState,
  onMultiStepStateChange,
  onVoiceSelected,
  onGeneratingVoiceChange,
  onGeneratingVideoChange
}: GeneratorTabProps) {
  const router = useRouter();
  const { project, showToast } = useVideoEditorStore();
  const { generateBasic } = useScriptToVideo();
  
  // Use shared multi-step state with fallback
  const stepState = multiStepState || {
    currentStep: 1,
    totalSteps: 5,
    useMyScript: false,
    ideaText: '',
    generatedScript: '',
    finalScript: '',
    isGeneratingScript: false,
    aspectRatio: '9:16' as const,
  };

  const setStepState = (updater: MultiStepState | ((prev: MultiStepState) => MultiStepState)) => {
    if (!onMultiStepStateChange) return;
    
    if (typeof updater === 'function') {
      const newState = updater(stepState);
      onMultiStepStateChange(newState);
    } else {
      onMultiStepStateChange(updater);
    }
  };

  // Local state for voice and generation
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isPlayingReview, setIsPlayingReview] = useState(false);

  // Generate script from idea
  const generateScript = async () => {
    const trimmedIdea = stepState.ideaText.trim();
    
    if (!trimmedIdea) {
      showToast('Please enter your video idea', 'warning');
      return;
    }
    
    if (trimmedIdea.length < 10) {
      showToast('Please provide a more detailed video idea (at least 10 characters)', 'warning');
      return;
    }

    setStepState({ ...stepState, isGeneratingScript: true });
    onGeneratingChange?.(true);

    try {
      const { generateQuickScript } = await import('@/actions/services/script-generation-service');
      
      const result = await generateQuickScript(
        trimmedIdea, 
        project.user_id || '', 
        { tone: 'engaging' }
      );

      if (!result.success) {
        showToast(result.error || 'Script generation failed', 'error');
        setStepState({ ...stepState, isGeneratingScript: false });
        return;
      }

      setStepState({
        ...stepState,
        generatedScript: result.script,
        finalScript: result.script,
        isGeneratingScript: false,
        currentStep: 2
      });

      showToast(`Script generated! ${result.metadata?.word_count || 0} words`, 'success');
    } catch (error) {
      console.error('Script generation failed:', error);
      showToast('Failed to generate script. Please try again.', 'error');
      setStepState({ ...stepState, isGeneratingScript: false });
    } finally {
      onGeneratingChange?.(false);
    }
  };

  // Use my own script
  const useMyOwnScript = () => {
    if (!stepState.ideaText.trim()) {
      showToast('Please enter your script', 'warning');
      return;
    }
    
    setStepState({
      ...stepState,
      useMyScript: true,
      finalScript: stepState.ideaText,
      generatedScript: '',
      currentStep: 3 // Skip to voice selection
    });
  };

  // Play voice sample
  const playVoiceSample = async (voiceId: string) => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
      setPlayingVoiceId(null);
    }

    if (playingVoiceId === voiceId) {
      return;
    }

    try {
      const voice = OPENAI_VOICE_OPTIONS.find(v => v.id === voiceId);
      if (voice?.preview_url) {
        const audio = new Audio(voice.preview_url);
        audio.addEventListener('ended', () => {
          setPlayingVoiceId(null);
          setCurrentAudio(null);
        });
        await audio.play();
        setCurrentAudio(audio);
        setPlayingVoiceId(voiceId);
      }
    } catch (error) {
      console.error('Failed to play voice sample:', error);
    }
  };

  // Generate voice
  const generateVoice = async () => {
    if (!stepState.finalScript.trim()) {
      showToast('No script available for voice generation', 'warning');
      return;
    }

    const currentUserId = project.user_id;
    if (!currentUserId) {
      showToast('User not authenticated. Please refresh and try again.', 'error');
      return;
    }

    setIsGeneratingVoice(true);
    onGeneratingChange?.(true);
    onGeneratingVoiceChange?.(true);

    try {
      const { generateVoiceForScript } = await import('@/actions/services/voice-generation-service');
      
      const result = await generateVoiceForScript(
        stepState.finalScript,
        {
          voice_id: selectedVoice,
          speed: 1.0
        },
        currentUserId
      );

      if (result.success && result.audio_url) {
        setVoiceAudioUrl(result.audio_url);
        onVoiceSelected?.(true);
        showToast('Voice generated successfully!', 'success');
        
        // Auto-advance to voice playback step
        setStepState({ ...stepState, currentStep: 4 });
      } else {
        showToast(result.error || 'Voice generation failed', 'error');
      }
    } catch (error) {
      console.error('Voice generation failed:', error);
      showToast('Failed to generate voice. Please try again.', 'error');
    } finally {
      setIsGeneratingVoice(false);
      onGeneratingChange?.(false);
      onGeneratingVoiceChange?.(false);
    }
  };

  // Generate video and forward to editor
  const generateVideo = async () => {
    if (!stepState.finalScript.trim() || !voiceAudioUrl) {
      showToast('Please complete all steps before generating video', 'warning');
      return;
    }

    setIsGeneratingVideo(true);
    onGeneratingChange?.(true);
    onGeneratingVideoChange?.(true);

    try {
      await generateBasic(stepState.finalScript, {
        aspect_ratio: stepState.aspectRatio,
        quality: 'standard',
        voice_settings: {
          voice_id: selectedVoice as any,
          speed: 'normal',
          emotion: 'neutral'
        },
        was_script_generated: stepState.generatedScript ? true : false,
        original_idea: stepState.ideaText
      });

      showToast('Video generation started! Redirecting to editor...', 'success');
      
      // Auto-forward to editor after a short delay
      setTimeout(() => {
        router.push('/dashboard/script-to-video/editor');
      }, 1500);
    } catch (error) {
      console.error('Video generation failed:', error);
      showToast('Failed to generate video. Please try again.', 'error');
    } finally {
      setIsGeneratingVideo(false);
      onGeneratingChange?.(false);
      onGeneratingVideoChange?.(false);
    }
  };

  // Navigation
  const handleBack = () => {
    setStepState({ ...stepState, currentStep: Math.max(1, stepState.currentStep - 1) });
  };

  const handleContinue = () => {
    if (stepState.currentStep === 2 && !stepState.finalScript.trim()) {
      showToast('Please enter or generate a script', 'warning');
      return;
    }
    
    if (stepState.currentStep === 3 && !voiceAudioUrl) {
      showToast('Please generate voice before continuing', 'warning');
      return;
    }

    if (stepState.currentStep === 5) {
      generateVideo();
    } else {
      setStepState({ ...stepState, currentStep: Math.min(5, stepState.currentStep + 1) });
    }
  };

  // Render current step content
  const renderStepContent = () => {
    switch (stepState.currentStep) {
      case 1:
        // Step 1: Idea/Script Input
        return (
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Create Your Video Script</h2>
              <p className="text-muted-foreground mt-2">
                Enter your video idea and let AI generate a script, or write your own
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      1
                    </div>
                    <div>
                      <CardTitle>Your Video Idea or Script</CardTitle>
                      <CardDescription>
                        Describe what you want your video to be about
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="idea">Enter your idea or full script</Label>
                    <Textarea
                      id="idea"
                      value={stepState.ideaText}
                      onChange={(e) => setStepState({ ...stepState, ideaText: e.target.value })}
                      placeholder="e.g., 'A 30-second video about the benefits of meditation' or paste your complete script here..."
                      rows={8}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      You can enter a brief idea for AI to expand, or paste your complete script
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={generateScript}
                      disabled={!stepState.ideaText.trim() || stepState.isGeneratingScript}
                      className="flex-1"
                    >
                      {stepState.isGeneratingScript ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Script...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Script from Idea
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={useMyOwnScript}
                      disabled={!stepState.ideaText.trim()}
                      variant="outline"
                      className="flex-1"
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Use My Script As Is
                    </Button>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Quick Ideas:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        'Product showcase video',
                        'Educational explainer',
                        'Social media ad',
                        'Tutorial video',
                        'Brand story',
                        'Testimonial video'
                      ].map((idea) => (
                        <Button
                          key={idea}
                          variant="outline"
                          size="sm"
                          onClick={() => setStepState({ ...stepState, ideaText: idea })}
                        >
                          {idea}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 2:
        // Step 2: Script Review/Edit
        return (
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Review Your Script</h2>
              <p className="text-muted-foreground mt-2">
                Edit your script to perfect it before generating voice
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      2
                    </div>
                    <div>
                      <CardTitle>Your Video Script</CardTitle>
                      <CardDescription>
                        Make any final edits to your script
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="script">Script Content</Label>
                    <Textarea
                      id="script"
                      value={stepState.finalScript}
                      onChange={(e) => setStepState({ ...stepState, finalScript: e.target.value })}
                      rows={12}
                      className="resize-none font-mono text-sm"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{stepState.finalScript.split(' ').filter(w => w).length} words</span>
                      <span>~{Math.ceil(stepState.finalScript.split(' ').filter(w => w).length / 150)} min read time</span>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">Tips for a great script:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Keep sentences short and conversational</li>
                      <li>• Use active voice for better engagement</li>
                      <li>• Include a clear call-to-action</li>
                      <li>• Aim for 150-180 words per minute of video</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 3:
        // Step 3: Voice Selection
        return (
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Choose Your Voice</h2>
              <p className="text-muted-foreground mt-2">
                Select a voice that matches your video's tone
              </p>
            </div>

            <div className="max-w-6xl mx-auto">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      3
                    </div>
                    <div>
                      <CardTitle>Voice Selection</CardTitle>
                      <CardDescription>
                        Choose and preview different voice options
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {OPENAI_VOICE_OPTIONS.map((voice) => (
                      <div
                        key={voice.id}
                        onClick={() => setSelectedVoice(voice.id)}
                        className={cn(
                          "p-4 rounded-lg border-2 text-left transition-all hover:shadow-md cursor-pointer",
                          selectedVoice === voice.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{voice.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {voice.description}
                            </p>
                            <div className="flex gap-1 mt-2">
                              <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                {voice.gender}
                              </span>
                              {voice.category && (
                                <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                  {voice.category}
                                </span>
                              )}
                              {voice.isNew && (
                                <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                                  New
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoiceSample(voice.id);
                            }}
                          >
                            {playingVoiceId === voice.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-center">
                    <Button
                      onClick={generateVoice}
                      disabled={isGeneratingVoice || !selectedVoice}
                      size="lg"
                      className="min-w-[200px]"
                    >
                      {isGeneratingVoice ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating Voice...
                        </>
                      ) : (
                        <>
                          <Mic className="mr-2 h-4 w-4" />
                          Generate Voice
                        </>
                      )}
                    </Button>
                  </div>

                  {voiceAudioUrl && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        ✓ Voice generated successfully!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 4:
        // Step 4: Voice Playback Review
        return (
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Review Your Voice</h2>
              <p className="text-muted-foreground mt-2">
                Listen to your generated voice-over before proceeding
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      4
                    </div>
                    <div>
                      <CardTitle>Generated Voice-Over</CardTitle>
                      <CardDescription>
                        Listen to your AI-generated narration
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {voiceAudioUrl ? (
                    <>
                      <div className="bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg p-4 border border-border/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Mic className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {OPENAI_VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name || 'Voice'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {OPENAI_VOICE_OPTIONS.find(v => v.id === selectedVoice)?.description}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Audio Player with Wave Effect */}
                        <div className="relative w-full">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                const audio = document.getElementById('voice-playback') as HTMLAudioElement;
                                if (audio) {
                                  if (audio.paused) {
                                    audio.play();
                                    setIsPlayingReview(true);
                                  } else {
                                    audio.pause();
                                    setIsPlayingReview(false);
                                  }
                                }
                              }}
                              className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                            >
                              {isPlayingReview ? (
                                <Square className="w-5 h-5" />
                              ) : (
                                <Play className="w-5 h-5" />
                              )}
                            </button>
                            
                            <div className="flex-1 h-14 bg-black/20 dark:bg-black/40 rounded-md flex items-center px-3 backdrop-blur-sm">
                              {/* Waveform visualization */}
                              <div className="flex items-center justify-center w-full gap-1">
                                {[...Array(80)].map((_, i) => (
                                  <div
                                    key={i}
                                    className={`rounded-full transition-all duration-75 ${
                                      isPlayingReview 
                                        ? 'bg-primary/70 animate-pulse' 
                                        : 'bg-primary/40'
                                    }`}
                                    style={{
                                      width: '2px',
                                      height: `${Math.sin(i * 0.2) * 15 + 20}px`,
                                      animationDelay: isPlayingReview ? `${i * 30}ms` : '0ms',
                                      animationDuration: isPlayingReview ? '1.5s' : '0s'
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                            
                            <div className="flex-shrink-0 text-sm text-muted-foreground font-mono">
                              ~{Math.ceil(stepState.finalScript.split(' ').filter(w => w).length / 150)}m
                            </div>
                          </div>
                          
                          <audio 
                            id="voice-playback"
                            src={voiceAudioUrl}
                            className="hidden"
                            autoPlay
                            onPlay={() => setIsPlayingReview(true)}
                            onPause={() => setIsPlayingReview(false)}
                            onEnded={() => setIsPlayingReview(false)}
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <p className="text-sm font-medium mb-2">Voice Details</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Voice: {OPENAI_VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}</li>
                          <li>• Script length: {stepState.finalScript.split(' ').filter(w => w).length} words</li>
                          <li>• Estimated duration: ~{Math.ceil(stepState.finalScript.split(' ').filter(w => w).length / 150)} minutes</li>
                        </ul>
                      </div>

                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <p>Not happy with the voice?</p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setStepState({ ...stepState, currentStep: 3 })}
                          className="p-0 h-auto"
                        >
                          Go back to regenerate
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No voice generated yet.</p>
                      <Button
                        variant="outline"
                        onClick={() => setStepState({ ...stepState, currentStep: 3 })}
                        className="mt-4"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Voice Selection
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 5:
        // Step 5: Aspect Ratio Selection
        return (
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Choose Video Format</h2>
              <p className="text-muted-foreground mt-2">
                Select the aspect ratio for your video
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      5
                    </div>
                    <div>
                      <CardTitle>Aspect Ratio</CardTitle>
                      <CardDescription>
                        Choose between portrait or landscape format
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => setStepState({ ...stepState, aspectRatio: '9:16' })}
                      className={cn(
                        "flex flex-col items-center gap-3 p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                        stepState.aspectRatio === '9:16'
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Smartphone className="h-12 w-12" />
                      <div className="text-center">
                        <p className="font-medium">Portrait (9:16)</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Best for TikTok, Reels, Shorts
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setStepState({ ...stepState, aspectRatio: '16:9' })}
                      className={cn(
                        "flex flex-col items-center gap-3 p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                        stepState.aspectRatio === '16:9'
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Monitor className="h-12 w-12" />
                      <div className="text-center">
                        <p className="font-medium">Landscape (16:9)</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Best for YouTube, websites
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium mb-2">Ready to Generate Video</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Script: {stepState.finalScript.split(' ').filter(w => w).length} words</li>
                      <li>✓ Voice: {OPENAI_VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}</li>
                      <li>✓ Format: {stepState.aspectRatio === '9:16' ? 'Portrait' : 'Landscape'}</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-hover">
        {renderStepContent()}
      </div>
      
      {/* Fixed Footer */}
      <div className="border-t px-6 py-4 bg-card">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={cn(
                  "h-2 w-12 rounded-full transition-all",
                  step <= stepState.currentStep
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
            ))}
          </div>
          
          <div className="flex gap-3">
            {stepState.currentStep > 1 && (
              <Button 
                variant="outline" 
                onClick={handleBack}
                size="lg"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            
            {stepState.currentStep < 5 ? (
              <Button 
                onClick={handleContinue}
                disabled={
                  (stepState.currentStep === 2 && !stepState.finalScript.trim()) ||
                  (stepState.currentStep === 3 && !voiceAudioUrl)
                }
                className="min-w-[200px] bg-primary hover:bg-primary/90"
                size="lg"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={generateVideo}
                disabled={isGeneratingVideo}
                className="min-w-[200px] bg-primary hover:bg-primary/90"
                size="lg"
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Video...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Video
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}