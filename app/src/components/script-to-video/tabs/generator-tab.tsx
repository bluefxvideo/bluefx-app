'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Film, Mic, Zap } from 'lucide-react';
import { useVideoEditorStore } from '../store/video-editor-store';
import { TabContentWrapper, TabHeader, TabBody, TabError } from '@/components/tools/tab-content-wrapper';
import { useScriptToVideo } from '../hooks/use-script-to-video';

interface GeneratorTabProps {
  credits: number;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

/**
 * Generator Tab - Main script to video generation interface
 * The core functionality for AI-orchestrated video creation
 */
export function GeneratorTab({
  credits,
  onGeneratingChange
}: GeneratorTabProps) {
  // Local state for generation
  const [isLocalGenerating, setIsLocalGenerating] = useState(false);

  // Get state and actions from Zustand store
  const {
    // State
    project,
    // Actions
    updateProject,
    showToast
  } = useVideoEditorStore();
  
  // Use real script-to-video hook
  const { 
    generateBasic, 
    isGenerating,
    reloadCredits
  } = useScriptToVideo();

  const [formData, setFormData] = useState({
    script_text: project.original_script || '',
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

  const handleSubmit = async () => {
    console.log('🚀 handleSubmit called!');
    
    if (!formData.script_text.trim()) {
      showToast('Please enter a script to generate video', 'warning');
      return;
    }
    
    console.log('✅ Script validation passed');
    
    // Update project settings
    updateProject({
      generation_settings: {
        video_style: formData.video_style,
        voice_settings: formData.voice_settings,
        quality: formData.quality
      },
      aspect_ratio: '9:16'
    });

    console.log('🎬 About to call generateBasic...');
    
    // Generate video from script using real orchestrator
    try {
      setIsLocalGenerating(true);
      onGeneratingChange?.(true);
      
      console.log('🎬 Generator Tab: Starting generation...', {
        scriptLength: formData.script_text.length,
        quality: formData.quality,
        video_style: formData.video_style,
        voice_settings: formData.voice_settings
      });
      
      console.log('🚀 Calling generateBasic now...');
      
      await generateBasic(formData.script_text, {
        quality: formData.quality,
        aspect_ratio: '9:16',
        video_style: formData.video_style,
        voice_settings: formData.voice_settings
      });
      
      console.log('✅ Generator Tab: Generation completed successfully');
      showToast('Video generation completed! Redirecting to editor...', 'success');
    } catch (error) {
      console.error('❌ Generator Tab: Generation failed:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to generate video. Please try again.', 
        'error'
      );
    } finally {
      setIsLocalGenerating(false);
      onGeneratingChange?.(false);
    }
  };

  const estimatedCredits = Math.ceil(formData.script_text.length / 50) * 5 + 10;

  // Debug info  
  const hasScript = !!formData.script_text.trim();
  const creditCheck = credits > 0 && credits < estimatedCredits;
  const isDisabled = !hasScript || isGenerating || isLocalGenerating || creditCheck;
  
  console.log('🔍 GeneratorTab Debug:', `
    Script: "${formData.script_text}" (${formData.script_text.length} chars)
    Has Script: ${hasScript}
    Credits: ${credits}
    Estimated: ${estimatedCredits}  
    Is Generating: ${isGenerating}
    Credit Check: ${creditCheck}
    Button Disabled: ${isDisabled}
    
    Disable Reasons:
    - No Script: ${!hasScript}
    - Generating: ${isGenerating}  
    - Insufficient Credits: ${creditCheck}
  `);

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={Film}
        title="Script to Video"
        description="Transform your script into professional video content"
      />

      {/* Form Content */}
      <TabBody>
        {/* Error Display */}
        {project.status === 'error' && (
          <TabError error="Generation failed. Please try again with a different script." />
        )}
        {/* Smart Input Field */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">
              Script or Video Idea
            </Label>
          </div>
          <Textarea
            placeholder="Enter your script OR describe your video idea:

Examples:
• &quot;Create a story about a cat winning the lottery&quot;
• &quot;Did you know 90% of startups fail? Here's how to validate your idea in 48 hours...&quot;

AI will automatically detect and handle both!"
            value={formData.script_text}
            onChange={(e) => setFormData((prev) => ({ ...prev, script_text: e.target.value }))}
            rows={8}
            className="resize-none"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formData.script_text.length} characters</span>
            <span>
              {formData.script_text.length < 50 
                ? "💡 Idea mode" 
                : formData.script_text.length < 200 
                ? "📝 Short script" 
                : "📜 Full script"
              } • ~4-6 segments
            </span>
          </div>
        </div>

        {/* Video Style Settings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Video Style</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label
                htmlFor="tone"
                className="text-xs text-muted-foreground"
              >
                Tone
              </Label>
              <Select
                value={formData.video_style.tone}
                onValueChange={(value: "professional" | "casual" | "educational" | "dramatic" | "energetic") => setFormData((prev) => ({
                  ...prev,
                  video_style: { ...prev.video_style, tone: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="dramatic">Dramatic</SelectItem>
                  <SelectItem value="energetic">Energetic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="pacing"
                className="text-xs text-muted-foreground"
              >
                Pacing
              </Label>
              <Select
                value={formData.video_style.pacing}
                onValueChange={(value: "slow" | "medium" | "fast") => setFormData((prev) => ({
                  ...prev,
                  video_style: { ...prev.video_style, pacing: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">Slow & Steady</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="fast">Fast & Viral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="visual-style"
                className="text-xs text-muted-foreground"
              >
                Visual Style
              </Label>
              <Select
                value={formData.video_style.visual_style}
                onValueChange={(value: "artistic" | "minimal" | "realistic" | "dynamic") => setFormData((prev) => ({
                  ...prev,
                  video_style: { ...prev.video_style, visual_style: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realistic">Realistic</SelectItem>
                  <SelectItem value="artistic">Artistic</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="dynamic">Dynamic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Voice Settings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Voice Settings</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label
                htmlFor="voice"
                className="text-xs text-muted-foreground"
              >
                Voice
              </Label>
              <Select
                value={formData.voice_settings.voice_id}
                onValueChange={(value: string) => setFormData((prev) => ({
                  ...prev,
                  voice_settings: { ...prev.voice_settings, voice_id: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anna">Anna (Female)</SelectItem>
                  <SelectItem value="eric">Eric (Male)</SelectItem>
                  <SelectItem value="felix">Felix (Male)</SelectItem>
                  <SelectItem value="oscar">Oscar (Male)</SelectItem>
                  <SelectItem value="nina">Nina (Female)</SelectItem>
                  <SelectItem value="sarah">Sarah (Female)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="speed"
                className="text-xs text-muted-foreground"
              >
                Speed
              </Label>
              <Select
                value={formData.voice_settings.speed}
                onValueChange={(value: "slower" | "normal" | "faster") => setFormData((prev) => ({
                  ...prev,
                  voice_settings: { ...prev.voice_settings, speed: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slower">Slower</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="faster">Faster</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="emotion"
                className="text-xs text-muted-foreground"
              >
                Emotion
              </Label>
              <Select
                value={formData.voice_settings.emotion}
                onValueChange={(value: "neutral" | "excited" | "calm" | "authoritative" | "confident") => setFormData((prev) => ({
                  ...prev,
                  voice_settings: { ...prev.voice_settings, emotion: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="excited">Excited</SelectItem>
                  <SelectItem value="calm">Calm</SelectItem>
                  <SelectItem value="confident">Confident</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>


      </TabBody>

      {/* Generate Button - Outside scrollable area */}
      <div className="mt-6">
        <Button
          onClick={(e) => {
            console.log('🎬 Generate Button Clicked!', { 
              event: e,
              isDisabled,
              preventDefault: e.preventDefault,
              target: e.target 
            });
            handleSubmit();
          }}
          disabled={
            !formData.script_text.trim() || isGenerating || (credits > 0 && credits < estimatedCredits)
          }
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              AI Generating Video...
            </>
          ) : (
            <>
              <Film className="w-4 h-4 mr-2" />
              Generate Video ({estimatedCredits} credits)
            </>
          )}
        </Button>
      </div>
    </TabContentWrapper>
  );
}