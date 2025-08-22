'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Film, Mic, Zap, ArrowRight, ArrowLeft, FileText, Play, Square, CheckCircle } from 'lucide-react';
import { useVideoEditorStore } from '../store/video-editor-store';
import { TabContentWrapper, TabHeader, TabBody, TabError } from '@/components/tools/tab-content-wrapper';
import { useScriptToVideo } from '../hooks/use-script-to-video';

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
}

/**
 * Generator Tab - Multi-step script to video generation interface
 * Step 1: Idea/Script input with option to use existing script
 * Step 2: Script review and editing
 * Step 3: Voice selection and generation
 */
export function GeneratorTab({
  credits,
  onGeneratingChange,
  multiStepState,
  onMultiStepStateChange,
  onVoiceSelected,
  onGeneratingVoiceChange,
  onGeneratingVideoChange
}: GeneratorTabProps) {
  // Use shared multi-step state with fallback
  const stepState = multiStepState || {
    currentStep: 1,
    totalSteps: 3,
    useMyScript: false,
    ideaText: '',
    generatedScript: '',
    finalScript: '',
    isGeneratingScript: false,
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

  // Local state for voice selection and generation
  const [selectedVoice, setSelectedVoice] = useState('anna');
  const [hasUserSelectedVoice, setHasUserSelectedVoice] = useState(false);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Voice playback state
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Get state and actions from Zustand store
  const {
    project,
    updateProject,
    showToast
  } = useVideoEditorStore();
  
  // Use real script-to-video hook
  const { 
    generateBasic, 
  } = useScriptToVideo();

  // Form data for final generation
  const [formData, setFormData] = useState({
    video_style: {
      tone: project.generation_settings.video_style.tone,
      pacing: project.generation_settings.video_style.pacing,
      visual_style: project.generation_settings.video_style.visual_style,
    },
    voice_settings: {
      voice_id: project.generation_settings.voice_settings.voice_id,
      speed: project.generation_settings.voice_settings.speed,
      emotion: project.generation_settings.voice_settings.emotion,
    },
    quality: project.generation_settings.quality,
  });

  // Generate script from idea using AI
  const generateScript = async () => {
    const trimmedIdea = stepState.ideaText.trim();
    
    // Client-side validation
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
      // Use server action for script generation
      const { generateQuickScript } = await import('@/actions/services/script-generation-service');
      
      const result = await generateQuickScript(
        trimmedIdea, 
        project.user_id || '', 
        { 
          tone: formData.video_style.tone 
        }
      );

      if (!result.success) {
        // Handle specific error messages from server more gracefully
        const errorMessage = result.error || 'Script generation failed';
        showToast(errorMessage, 'error');
        setStepState({ ...stepState, isGeneratingScript: false });
        return;
      }

      setStepState({
        ...stepState,
        generatedScript: result.script,
        finalScript: result.script,
        isGeneratingScript: false,
        currentStep: 2  // Automatically advance to Step 2 for review
      });

      showToast(`Script generated! ${result.metadata?.word_count || 0} words, ~${result.metadata?.estimated_duration || 0}s`, 'success');
    } catch (error) {
      console.error('Script generation failed:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to generate script. Please try again.', 
        'error'
      );
      setStepState({ ...stepState, isGeneratingScript: false });
    } finally {
      onGeneratingChange?.(false);
    }
  };

  // Generate voice from script
  const generateVoice = async () => {
    if (!stepState.finalScript.trim()) {
      showToast('No script available for voice generation', 'warning');
      return;
    }

    // Get current user ID from the video editor store
    const currentUserId = project.user_id;
    if (!currentUserId) {
      showToast('User not authenticated. Please refresh and try again.', 'error');
      return;
    }

    setIsGeneratingVoice(true);
    onGeneratingChange?.(true);
    onGeneratingVoiceChange?.(true);

    try {
      console.log('🎤 Starting voice generation with real service...');
      
      // Import the voice generation service dynamically
      const { generateVoiceForScript } = await import('@/actions/services/voice-generation-service');
      
      // Call the real voice generation service
      const result = await generateVoiceForScript(
        stepState.finalScript,
        {
          voice_id: selectedVoice as 'anna' | 'eric' | 'felix' | 'oscar' | 'nina' | 'sarah',
          speed: formData.voice_settings.speed || 'normal',
          emotion: formData.voice_settings.emotion || 'neutral'
        },
        currentUserId
      );

      if (result.success && result.audio_url) {
        setVoiceAudioUrl(result.audio_url);
        showToast(`Voice generated successfully! (${result.credits_used} credits used)`, 'success');
        console.log('✅ Voice generation completed:', result.audio_url);
      } else {
        throw new Error(result.error || 'Voice generation failed');
      }
    } catch (error) {
      console.error('Voice generation failed:', error);
      showToast(`Failed to generate voice: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsGeneratingVoice(false);
      onGeneratingChange?.(false);
      onGeneratingVoiceChange?.(false);
    }
  };

  // Final video generation
  const generateVideo = async () => {
    if (!stepState.finalScript.trim()) {
      showToast('No script available for video generation', 'warning');
      return;
    }

    setIsGeneratingVideo(true);
    onGeneratingChange?.(true);
    onGeneratingVideoChange?.(true);

    try {
      // Update project settings
      updateProject({
        generation_settings: {
          video_style: formData.video_style,
          voice_settings: {
            ...formData.voice_settings,
            voice_id: selectedVoice
          },
          quality: formData.quality
        },
        aspect_ratio: '9:16'
      });

      // Generate video using the orchestrator
      await generateBasic(stepState.finalScript, {
        quality: formData.quality,
        aspect_ratio: '9:16',
        video_style: formData.video_style,
        voice_settings: {
          ...formData.voice_settings,
          voice_id: selectedVoice as "anna" | "eric" | "felix" | "oscar" | "nina" | "sarah"
        },
        // Mark if script was generated from idea
        was_script_generated: !stepState.useMyScript && stepState.generatedScript.length > 0,
        original_idea: !stepState.useMyScript ? stepState.ideaText : undefined
      });

      showToast('Video generation completed! Check the preview panel.', 'success');
    } catch (error) {
      console.error('Video generation failed:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to generate video. Please try again.', 
        'error'
      );
    } finally {
      setIsGeneratingVideo(false);
      onGeneratingChange?.(false);
      onGeneratingVideoChange?.(false);
    }
  };

  // Handle step navigation
  const goToStep = (step: number) => {
    setStepState({ ...stepState, currentStep: step });
  };

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return stepState.useMyScript 
          ? stepState.finalScript.trim().length > 0
          : stepState.ideaText.trim().length > 0;
      case 2:
        return stepState.finalScript.trim().length > 0;
      case 3:
        // For video generation, only require that a voice has been selected
        return selectedVoice.length > 0;
      default:
        return false;
    }
  };

  // Handle step actions
  const handleStepAction = async () => {
    if (stepState.currentStep === 1) {
      if (stepState.useMyScript) {
        // Skip script generation, go to step 2
        goToStep(2);
      } else if (stepState.generatedScript) {
        // Script already generated, proceed to step 2
        goToStep(2);
      } else {
        // Generate script from idea
        await generateScript();
        // Stay on step 1 to show generated script preview, then allow proceeding to step 2
      }
    } else if (stepState.currentStep === 2) {
      // Proceed to voice generation step
      goToStep(3);
    } else if (stepState.currentStep === 3) {
      // Generate video
      await generateVideo();
    }
  };

  const resetWizard = () => {
    setStepState({
      currentStep: 1,
      totalSteps: 3,
      useMyScript: false,
      ideaText: '',
      generatedScript: '',
      finalScript: '',
      isGeneratingScript: false,
    });
    setSelectedVoice('anna');
    setHasUserSelectedVoice(false);
    setVoiceAudioUrl(null);
    setIsGeneratingVoice(false);
    setIsGeneratingVideo(false);
    onVoiceSelected?.(false); // Reset voice selection state
  };

  // Voice playback functionality
  const handleVoicePlayback = (voiceId: string, sampleUrl: string) => {
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

  // Update voice selection
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      voice_settings: {
        ...prev.voice_settings,
        voice_id: selectedVoice
      }
    }));
    // Only mark voice as selected when user has explicitly chosen a voice
    onVoiceSelected?.(hasUserSelectedVoice);
  }, [selectedVoice, hasUserSelectedVoice, onVoiceSelected]);

  const estimatedCredits = Math.ceil(stepState.finalScript.length / 50) * 5 + 10;

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={Film}
        title="Script to Video Generator"
        description="Create AI-powered video content with multi-step workflow"
      />

      {/* Form Content */}
      <TabBody>
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-medium">Step {stepState.currentStep} of {stepState.totalSteps}</span>
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
              style={{ width: `${(stepState.currentStep / stepState.totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Idea/Script Input */}
        {stepState.currentStep === 1 && (
          <div className="space-y-4">
            {/* Use My Script Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-my-script"
                checked={stepState.useMyScript}
                onCheckedChange={(checked) => {
                  setStepState({ 
                    ...stepState, 
                    useMyScript: checked as boolean,
                    // Clear opposite field when switching modes
                    ideaText: checked ? '' : stepState.ideaText,
                    finalScript: checked ? stepState.finalScript : ''
                  });
                }}
              />
              <Label htmlFor="use-my-script" className="text-sm font-medium">
                Use my script (skip script generation)
              </Label>
            </div>

            {stepState.useMyScript ? (
              /* Script Input Mode */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Your Script</Label>
                </div>
                <Textarea
                  placeholder="Enter your complete script here...

Example:
Did you know 90% of startups fail? Here's how to validate your idea in 48 hours...

[Your full script content]"
                  value={stepState.finalScript}
                  onChange={(e) => setStepState({ ...stepState, finalScript: e.target.value })}
                  rows={10}
                  className="resize-none"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{stepState.finalScript.length} characters</span>
                  <span>Word count: {stepState.finalScript.trim().split(/\s+/).filter(Boolean).length}</span>
                </div>
              </div>
            ) : (
              /* Idea Input Mode */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Video Idea</Label>
                </div>
                <Textarea
                  placeholder="Describe your video idea and AI will generate a script...

Examples:
• Create a story about a cat winning the lottery
• Explain how to validate a startup idea in 48 hours  
• Make a tutorial about cooking the perfect pasta
• Write an inspirational message about overcoming challenges"
                  value={stepState.ideaText}
                  onChange={(e) => setStepState({ ...stepState, ideaText: e.target.value })}
                  rows={6}
                  className={`resize-none ${stepState.ideaText.trim().length > 0 && stepState.ideaText.trim().length < 10 ? 'border-yellow-500 focus:border-yellow-500' : ''}`}
                />
                <div className="text-sm space-y-1">
                  <div className={`${stepState.ideaText.trim().length > 0 && stepState.ideaText.trim().length < 10 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                    {stepState.ideaText.length} characters • AI will generate a ~200-300 word script
                  </div>
                  {stepState.ideaText.trim().length > 0 && stepState.ideaText.trim().length < 10 && (
                    <div className="text-yellow-600 text-xs flex items-center gap-1">
                      ⚠️ Please provide more details (minimum 10 characters)
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* Step 2: Script Review and Editing */}
        {stepState.currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Review and Edit Script</Label>
            </div>
            <Textarea
              placeholder="Review and edit your script before generating voice..."
              value={stepState.finalScript}
              onChange={(e) => setStepState({ ...stepState, finalScript: e.target.value })}
              rows={12}
              className="resize-none"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{stepState.finalScript.length} characters</span>
              <span>Word count: {stepState.finalScript.trim().split(/\s+/).filter(Boolean).length}</span>
            </div>
            
            <Card className="p-3 bg-blue-50 dark:bg-blue-950/20">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Tip:</strong> Make any final edits to your script here. Once you proceed to the next step, 
                you&apos;ll select a voice and generate the audio.
              </p>
            </Card>
          </div>
        )}

        {/* Step 3: Voice Selection and Generation */}
        {stepState.currentStep === 3 && (
          <div className="space-y-4">
            {/* Voice Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Select Voice</Label>
              </div>

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
                  }
                ].map((voice) => (
                  <Card
                    key={voice.id}
                    className={`p-3 cursor-pointer transition-all duration-200 hover:shadow-md bg-white dark:bg-gray-800/40 ${
                      selectedVoice === voice.id 
                        ? 'ring-2 ring-purple-500 bg-blue-100/10 shadow-lg' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedVoice(voice.id);
                      setHasUserSelectedVoice(true);
                    }}
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

            {/* Optional Voice Preview Generation */}
            {!voiceAudioUrl && (
              <div className="space-y-2">
                <Button
                  onClick={generateVoice}
                  disabled={isGeneratingVoice}
                  variant="outline"
                  className="w-full"
                >
                  {isGeneratingVoice ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Generating Voice Preview...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Generate Voice Preview ({selectedVoice})
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Voice Preview */}
            {voiceAudioUrl && (
              <Card className="p-4 bg-green-50 dark:bg-green-950/20">
                <h3 className="font-semibold mb-3">Voice Generated!</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Voice: {selectedVoice}</p>
                      <p className="text-xs text-muted-foreground">Ready for video generation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <audio controls className="flex-1">
                      <source src={voiceAudioUrl} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVoiceAudioUrl(null);
                      }}
                      className="text-xs"
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Generation Summary */}
            <Card className="p-4 bg-white dark:bg-gray-800/40">
              <h3 className="font-semibold mb-3">Generation Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Script Length:</span>
                  <span className="text-muted-foreground">
                    {stepState.finalScript.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Voice:</span>
                  <span className="text-muted-foreground">{selectedVoice}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Credits:</span>
                  <span className="text-muted-foreground">{estimatedCredits} credits</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Error Display */}
        {project.status === 'error' && (
          <TabError error="Generation failed. Please try again with different settings." />
        )}
      </TabBody>

      {/* Footer Buttons - Outside scrollable area */}
      <div className="mt-6">
        <div className="flex gap-2">
          {stepState.currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => goToStep(stepState.currentStep - 1)}
              disabled={stepState.isGeneratingScript || isGeneratingVoice || isGeneratingVideo}
              className="flex-1 h-12"
              size="lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          
          <Button
            onClick={handleStepAction}
            disabled={
              !canProceedFromStep(stepState.currentStep) || 
              stepState.isGeneratingScript || 
              isGeneratingVoice || 
              isGeneratingVideo
            }
            className={`${stepState.currentStep === 1 ? 'w-full' : 'flex-1'} h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium`}
            size="lg"
          >
            <Film className="w-4 h-4 mr-2" />
            {stepState.isGeneratingScript ? 'Generating Script...' :
            isGeneratingVoice ? 'Generating Voice...' :
            isGeneratingVideo ? 'Generating Video...' :
            stepState.currentStep === 3 ? `Generate Video (${estimatedCredits} credits)` :
            stepState.currentStep === 2 ? 'Continue to Voice' :
            stepState.useMyScript ? 'Continue with Script' : 
            stepState.generatedScript ? 'Continue to Review' : 'Generate Script'}
            {stepState.currentStep < 3 && !stepState.isGeneratingScript && !isGeneratingVoice && !isGeneratingVideo && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    </TabContentWrapper>
  );
}