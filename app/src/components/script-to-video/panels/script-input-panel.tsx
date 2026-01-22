'use client';

import { useState } from 'react';
import { Loader2, Film, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ScriptToVideoRequest } from '@/actions/tools/script-to-video-orchestrator';

interface ScriptInputPanelProps {
  onGenerate: (request: ScriptToVideoRequest) => void;
  isGenerating: boolean;
  credits: number;
  error?: string;
}

export function ScriptInputPanel({ onGenerate, isGenerating, credits, error }: ScriptInputPanelProps) {
  const [scriptText, setScriptText] = useState('');
  const [videoStyle, setVideoStyle] = useState<{
    tone: 'professional' | 'casual' | 'educational' | 'dramatic' | 'energetic';
    pacing: 'slow' | 'medium' | 'fast';
    visual_style: 'realistic' | 'artistic' | 'minimal' | 'dynamic';
  }>({
    tone: 'professional',
    pacing: 'medium',
    visual_style: 'dynamic',
  });
  const [voiceSettings, setVoiceSettings] = useState<{
    voice_id: 'anna' | 'eric' | 'felix' | 'oscar' | 'nina' | 'sarah';
    speed: 'slower' | 'normal' | 'faster';
    emotion: 'neutral' | 'excited' | 'calm' | 'authoritative';
  }>({
    voice_id: 'anna',
    speed: 'normal',
    emotion: 'authoritative',
  });

  const handleGenerate = () => {
    if (!scriptText.trim()) return;

    const request: ScriptToVideoRequest = {
      script_text: scriptText,
      video_style: videoStyle,
      voice_settings: voiceSettings,
      aspect_ratio: '9:16', // TikTok vertical
      user_id: 'demo-user',
    };

    onGenerate(request);
  };

  const estimatedCredits = Math.ceil(scriptText.length / 50) * 5 + 10;

  return (
    <>
      {/* Script Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>Script Input</CardTitle>
          <CardDescription>Enter your script for AI-powered video generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="script">Your Script</Label>
            <Textarea
              id="script"
              placeholder="Enter your script here... AI will analyze and segment it optimally for TikTok-style videos."
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{scriptText.length} characters</span>
              <span>~{Math.ceil(scriptText.length / 100)} segments</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Style Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Video Style</CardTitle>
          <CardDescription>Configure the tone and visual style</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={videoStyle.tone} onValueChange={(value) => setVideoStyle({...videoStyle, tone: value as 'professional' | 'casual' | 'educational' | 'dramatic' | 'energetic'})}>
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

            <div className="space-y-2">
              <Label>Pacing</Label>
              <Select value={videoStyle.pacing} onValueChange={(value) => setVideoStyle({...videoStyle, pacing: value as 'slow' | 'medium' | 'fast'})}>
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

            <div className="space-y-2">
              <Label>Visual Style</Label>
              <Select value={videoStyle.visual_style} onValueChange={(value) => setVideoStyle({...videoStyle, visual_style: value as 'realistic' | 'artistic' | 'minimal' | 'dynamic'})}>
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
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Settings</CardTitle>
          <CardDescription>Choose voice characteristics for narration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={voiceSettings.voice_id} onValueChange={(value) => setVoiceSettings({...voiceSettings, voice_id: value as 'anna' | 'eric' | 'felix' | 'oscar' | 'nina' | 'sarah'})}>
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

            <div className="space-y-2">
              <Label>Speed</Label>
              <Select value={voiceSettings.speed} onValueChange={(value) => setVoiceSettings({...voiceSettings, speed: value as 'slower' | 'normal' | 'faster'})}>
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

            <div className="space-y-2">
              <Label>Emotion</Label>
              <Select value={voiceSettings.emotion} onValueChange={(value) => setVoiceSettings({...voiceSettings, emotion: value as 'neutral' | 'excited' | 'calm' | 'authoritative'})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="excited">Excited</SelectItem>
                  <SelectItem value="calm">Calm</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Video</CardTitle>
          <CardDescription>Start AI video generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Generation Button */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Estimated cost: {estimatedCredits} credits</span>
              <span className={credits >= estimatedCredits ? 'text-blue-600' : 'text-red-600'}>
                {credits} available
              </span>
            </div>
            
            <Button
              onClick={handleGenerate}
              disabled={!scriptText.trim() || isGenerating || credits < estimatedCredits}
              className="w-full "
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  AI Generating Video...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4 mr-2" />
                  Generate Video
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}