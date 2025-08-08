'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';

// Voice options with enhanced details
const VOICE_OPTIONS = [
  {
    id: 'alloy',
    name: 'Alloy',
    gender: 'female',
    description: 'Natural and versatile voice',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_01.mp3'
  },
  {
    id: 'nova',
    name: 'Nova',
    gender: 'female',
    description: 'Warm and engaging voice',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_2.mp3'
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    gender: 'female',
    description: 'Bright and expressive voice',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/female_3.mp3'
  },
  {
    id: 'echo',
    name: 'Echo',
    gender: 'male',
    description: 'Deep and resonant voice',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/male_1.mp3'
  },
  {
    id: 'onyx',
    name: 'Onyx',
    gender: 'male',
    description: 'Professional and clear voice',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/male_2.mp3'
  },
  {
    id: 'fable',
    name: 'Fable',
    gender: 'neutral',
    description: 'Versatile storytelling voice',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/neutral_1.mp3'
  }
];

import { VoiceOverState } from '../hooks/use-voice-over';

interface GeneratorTabProps {
  voiceOverState: {
    state: VoiceOverState;
    generateVoice: () => void;
    updateScriptText: (text: string) => void;
    updateVoiceSettings: (settings: Partial<VoiceOverState['voiceSettings']>) => void;
    handleVoicePlayback: (voiceId: string, url: string) => void;
    setState: (updater: (prev: VoiceOverState) => VoiceOverState) => void;
  };
}

/**
 * Generator Tab - Main voice over generation interface
 * Following exact BlueFX style guide patterns
 */
export function GeneratorTab({ voiceOverState }: GeneratorTabProps) {
  const {
    state,
    generateVoice,
    updateScriptText,
    updateVoiceSettings,
    handleVoicePlayback,
    setState,
  } = voiceOverState;

  const [localScriptText, setLocalScriptText] = useState(state.scriptText);

  // Sync local state with global state
  useEffect(() => {
    setLocalScriptText(state.scriptText);
  }, [state.scriptText]);

  // Update script text with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      updateScriptText(localScriptText);
    }, 500);
    return () => clearTimeout(timer);
  }, [localScriptText, updateScriptText]);

  const handleVoiceSelection = (voiceId: string) => {
    setState((prev) => ({ ...prev, selectedVoice: voiceId }));
  };

  const canGenerate = localScriptText.trim().length > 0 && state.selectedVoice;

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={Mic}
        title="Voice Over Studio"
        description="Generate professional AI voice overs"
      />

      {/* Form Content */}
      <TabBody>
        {/* Script Input */}
        <div className="space-y-2">
          <Label>Script Text</Label>
          <Textarea
            value={localScriptText}
            onChange={(e) => setLocalScriptText(e.target.value)}
            placeholder="Enter the text you want to convert to speech..."
            className="min-h-[100px] resize-none"
            disabled={state.isGenerating}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Words: {localScriptText.trim().split(/\s+/).filter(Boolean).length}</span>
            <span>Est. duration: {Math.ceil(localScriptText.trim().split(/\s+/).filter(Boolean).length / 2.5)}s</span>
          </div>
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <Label>Voice Selection</Label>

          <div className="grid grid-cols-1 gap-2 p-1">
            {VOICE_OPTIONS.map((voice) => (
              <Card
                key={voice.id}
                className={`p-3 transition-all duration-200 hover:shadow-md cursor-pointer bg-white dark:bg-gray-800/40 ${
                  state.selectedVoice === voice.id
                    ? 'ring-2 ring-blue-500 bg-blue-500/10 shadow-lg'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleVoiceSelection(voice.id)}
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
                    {state.playingVoiceId === voice.id ? (
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
        <div className="space-y-4">
          <Label>Voice Settings</Label>

          <div className="grid grid-cols-2 gap-4">
            {/* Speed */}
            <div className="space-y-2">
              <Label className="text-xs">Speed: {state.voiceSettings.speed}x</Label>
              <input
                type="range"
                min={0.25}
                max={4.0}
                step={0.25}
                value={state.voiceSettings.speed}
                onChange={(e) => updateVoiceSettings({ speed: parseFloat(e.target.value) })}
                disabled={state.isGenerating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.25x</span>
                <span>4.0x</span>
              </div>
            </div>

            {/* Pitch */}
            <div className="space-y-2">
              <Label className="text-xs">Pitch: {state.voiceSettings.pitch > 0 ? '+' : ''}{state.voiceSettings.pitch}st</Label>
              <input
                type="range"
                min={-20}
                max={20}
                step={1}
                value={state.voiceSettings.pitch}
                onChange={(e) => updateVoiceSettings({ pitch: parseInt(e.target.value) })}
                disabled={state.isGenerating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>-20st</span>
                <span>+20st</span>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Format</Label>
              <Select
                value={state.exportFormat}
                onValueChange={(format: 'mp3' | 'wav' | 'ogg') => setState((prev) => ({ ...prev, exportFormat: format }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="wav">WAV</SelectItem>
                  <SelectItem value="ogg">OGG</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Quality</Label>
              <Select
                value={state.quality}
                onValueChange={(quality: 'standard' | 'hd') => setState((prev) => ({ ...prev, quality }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="hd">HD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {state.error && (
          <Card className="p-4 border-destructive bg-white dark:bg-gray-800/40">
            <p className="text-sm text-destructive">{state.error}</p>
          </Card>
        )}
      </TabBody>

      {/* Generate Button - Outside scrollable area */}
      <div className="mt-6">
        <Button
          onClick={generateVoice}
          disabled={!canGenerate || state.isGenerating}
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:scale-[1.02] transition-all duration-300 font-medium"
          size="lg"
        >
        {state.isGenerating ? (
          <>
            <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Generating Voice...
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 mr-2" />
            Generate Voice ({state.estimatedCredits} credits)
          </>
        )}
        </Button>
      </div>
    </TabContentWrapper>
  );
}