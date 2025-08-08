'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Film, Sliders, Mic, Zap, TestTube } from 'lucide-react';
import { useVideoEditorStore } from '../store/video-editor-store';
import { TEST_SCRIPTS } from '../examples/test-user-flow';
import { TabContentWrapper, TabHeader, TabBody, TabError } from '@/components/tools/tab-content-wrapper';

interface GeneratorTabProps {
  credits: number;
}

/**
 * Generator Tab - Main script to video generation interface
 * The core functionality for AI-orchestrated video creation
 */
export function GeneratorTab({
  credits
}: GeneratorTabProps) {
  // Get state and actions from Zustand store
  const {
    // State
    project,
    ui,
    // Actions
    generateFromScript,
    updateProject,
    showToast
  } = useVideoEditorStore();

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async () => {
    if (!formData.script_text.trim()) {
      showToast('Please enter a script to generate video', 'warning');
      return;
    }
    
    // Update project settings
    updateProject({
      generation_settings: {
        video_style: formData.video_style,
        voice_settings: formData.voice_settings,
        quality: formData.quality
      },
      aspect_ratio: '9:16'
    });

    // Generate video from script
    try {
      await generateFromScript(formData.script_text);
      showToast('Video generated successfully! Switch to Editor tab to customize.', 'success');
    } catch (error) {
      showToast('Failed to generate video. Please try again.', 'error');
    }
  };

  const estimatedCredits = Math.ceil(formData.script_text.length / 50) * 5 + 10;

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
        {/* Script Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">
              Your Script
            </Label>
          </div>
          <Textarea
            placeholder="Enter your script here... AI will analyze and segment it optimally for TikTok-style videos."
            value={formData.script_text}
            onChange={(e) => setFormData((prev) => ({ ...prev, script_text: e.target.value }))}
            rows={6}
            className="resize-none"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{formData.script_text.length} characters</span>
            <span>~{Math.ceil(formData.script_text.length / 100)} segments</span>
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
                onValueChange={(value: any) => setFormData((prev) => ({
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
                onValueChange={(value: any) => setFormData((prev) => ({
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
                onValueChange={(value: any) => setFormData((prev) => ({
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
                onValueChange={(value: any) => setFormData((prev) => ({
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
                onValueChange={(value: any) => setFormData((prev) => ({
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
                onValueChange={(value: any) => setFormData((prev) => ({
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

        {/* Quality Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quality</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['draft', 'standard', 'premium'] as const).map((q) => (
              <Button
                key={q}
                variant={formData.quality === q ? 'default' : 'outline'}
                className={`capitalize ${formData.quality === q ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : ''}`}
                onClick={() => setFormData((prev) => ({ ...prev, quality: q }))}
              >
                {q}
              </Button>
            ))}
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <Button
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full justify-between h-8 px-0 text-xs"
        >
          <div className="flex items-center gap-1">
            <Sliders className="w-3 h-3" />
            <span>Advanced Settings</span>
          </div>
          <span>{showAdvanced ? "−" : "+"}</span>
        </Button>

        {/* Advanced Options */}
        {showAdvanced && (
          <Card className="p-3 space-y-3 bg-muted/20 border-dashed">
            <div className="text-xs text-muted-foreground mb-2">
              Fine-tune AI orchestration parameters
            </div>
            <div className="text-sm text-muted-foreground">
              Advanced settings will be available in future updates
            </div>
          </Card>
        )}

        {/* Demo Scripts */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <TestTube className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Try Demo Scripts</Label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TEST_SCRIPTS).map(([key, script]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => setFormData(prev => ({ 
                ...prev, 
                script_text: script.substring(0, 500) + (script.length > 500 ? '...' : '')
              }))}
            >
              {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </Button>
          ))}
        </div>
      </div>

      </TabBody>

      {/* Generate Button - Outside scrollable area */}
      <div className="mt-6">
        <Button
          onClick={handleSubmit}
          disabled={
            !formData.script_text.trim() || ui.loading.global || credits < estimatedCredits
          }
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
          {ui.loading.global ? (
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