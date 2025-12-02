'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Mic } from 'lucide-react';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';

// Complete OpenAI TTS voice options - Updated November 2024
// All 11 voices including new and legacy voices with GPT-4o-mini-TTS model
const VOICE_OPTIONS = [
  // Primary New Voices
  {
    id: 'alloy',
    name: 'Alloy',
    gender: 'neutral',
    description: 'Natural and versatile voice, great for narration',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/alloy.mp3'
  },
  {
    id: 'echo',
    name: 'Echo',
    gender: 'male',
    description: 'Deep and resonant voice, excellent for documentaries',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/echo.mp3'
  },
  {
    id: 'ash',
    name: 'Ash',
    gender: 'female',
    description: 'Expressive and dynamic with enhanced emotional range',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/ash.mp3'
  },
  {
    id: 'ballad',
    name: 'Ballad',
    gender: 'female',
    description: 'Warm and melodious, perfect for storytelling',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/ballad.mp3'
  },
  {
    id: 'coral',
    name: 'Coral',
    gender: 'female',
    description: 'Friendly and approachable with excellent emotional control',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/coral.mp3'
  },
  {
    id: 'sage',
    name: 'Sage',
    gender: 'male',
    description: 'Professional and authoritative, ideal for business content',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/sage.mp3'
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    gender: 'female',
    description: 'Bright and expressive, ideal for engaging presentations',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/shimmer.mp3'
  },
  {
    id: 'verse',
    name: 'Verse',
    gender: 'female',
    description: 'Creative and artistic voice, perfect for poetry',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/verse.mp3'
  },
  // Legacy Voices (still supported)
  {
    id: 'nova',
    name: 'Nova',
    gender: 'female',
    description: 'Warm and engaging voice (legacy)',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/nova.mp3'
  },
  {
    id: 'onyx',
    name: 'Onyx',
    gender: 'male',
    description: 'Professional and clear voice (legacy)',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/onyx.mp3'
  },
  {
    id: 'fable',
    name: 'Fable',
    gender: 'neutral',
    description: 'Versatile storytelling voice with character (legacy)',
    preview_url: 'https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/voices/sample_voices/fable.mp3'
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
  credits: number;
}

/**
 * Generator Tab - Main voice over generation interface
 * Following exact BlueFX style guide patterns
 */
export function GeneratorTab({ voiceOverState, credits }: GeneratorTabProps) {
  const {
    state,
    generateVoice,
    updateScriptText,
    updateVoiceSettings,
    handleVoicePlayback,
    setState,
  } = voiceOverState;

  const [localScriptText, setLocalScriptText] = useState(state.scriptText);

  // Check for prefilled script from Script Generator
  useEffect(() => {
    const prefillScript = localStorage.getItem('prefill_script');
    if (prefillScript) {
      setLocalScriptText(prefillScript);
      localStorage.removeItem('prefill_script'); // Clear after use
    }
  }, []);

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

  const estimatedCredits = 2; // Fixed cost for voice over
  const canGenerate = localScriptText.trim().length > 0 && state.selectedVoice && credits >= estimatedCredits;

  return (
    <TabContentWrapper>
      {/* Form Content */}
      <TabBody>
        {/* Step 1: Script Input */}
        <StandardStep
          stepNumber={1}
          title="Enter Your Script"
          description="Write or paste the text you want to convert to speech"
        >
          <Textarea
            value={localScriptText}
            onChange={(e) => setLocalScriptText(e.target.value)}
            placeholder="Enter the text you want to convert to speech..."
            className="min-h-[100px] resize-y"
            disabled={state.isGenerating}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Words: {localScriptText.trim().split(/\s+/).filter(Boolean).length}</span>
            <span>Est. duration: {Math.ceil(localScriptText.trim().split(/\s+/).filter(Boolean).length / 2.5)}s</span>
          </div>
        </StandardStep>

        {/* Step 2: Voice Selection */}
        <StandardStep
          stepNumber={2}
          title="Choose Your Voice"
          description="Select the perfect AI voice for your content"
        >
          <div className="grid grid-cols-1 gap-2 p-1">
            {VOICE_OPTIONS.map((voice) => (
              <Card
                key={voice.id}
                className={`p-3 transition-all duration-200 hover:shadow-md cursor-pointer bg-card ${
                  state.selectedVoice === voice.id
                    ? 'ring-2 ring-blue-500'
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
        </StandardStep>

        {/* Step 3: Voice Settings */}
        <StandardStep
          stepNumber={3}
          title="Voice Settings"
          description="Adjust playback speed and quality"
        >
          <div className="grid grid-cols-2 gap-4">
            {/* Speed Control */}
            <div className="space-y-2">
              <Label className="text-sm">Speed: {state.voiceSettings.speed}x</Label>
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

            {/* Quality Control */}
            <div className="space-y-2">
              <Label className="text-sm">Quality</Label>
              <Select
                value={state.quality}
                onValueChange={(quality: 'standard' | 'hd') => setState((prev) => ({ ...prev, quality }))}
                disabled={state.isGenerating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="hd">HD</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                HD provides higher audio quality
              </p>
            </div>
          </div>
        </StandardStep>

        {state.error && (
          <Card className="p-4 border-destructive">
            <p className="text-sm text-destructive">{state.error}</p>
          </Card>
        )}
      </TabBody>

      <TabFooter>
        <Button
          onClick={generateVoice}
          disabled={!canGenerate || state.isGenerating}
          className="w-full h-12 bg-primary hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 font-medium"
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
            Generate Voice (2 credits)
          </>
        )}
        </Button>
        {credits < estimatedCredits && localScriptText.trim().length > 0 && state.selectedVoice && (
          <p className="text-xs text-destructive text-center mt-2">
            Insufficient credits. You need {estimatedCredits} credits.
          </p>
        )}
      </TabFooter>
    </TabContentWrapper>
  );
}